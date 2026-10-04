import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PipelineOrchestrator } from '../application/pipeline/PipelineOrchestrator.js';
import { MonthCloseService } from '../application/pipeline/month-close.js';
import { ForkSafeStorageWriter } from '../adapters/storage/ForkSafeStorageWriter.js';
import { parseReprocessArgs } from '../cli/reprocess-args.js';
import type { ICopilotDataSource } from '../domain/ports/ICopilotDataSource.js';
import type { IAttributeResolver } from '../domain/ports/IAttributeResolver.js';
import type { CopilotDailyMetrics, CopilotSeatAssignment, RollingTrendDataset, SourceStatus } from '../domain/entities/copilot.js';
import type { MonthCloseIndex, MonthCloseRecord } from '../domain/entities/month-close.js';
import {
  appendRevision,
  buildCloseIndex,
  canonicalJson,
  computeChecksum,
  createCloseRecord,
  currentVersion,
  diffFigures,
  extractMonthlyFigures,
  isCloseDue,
  monthCloseDate,
  parseBusinessCalendar,
  verifyRecordIntegrity,
} from '../processor/month-close.js';

const DEFAULT_CAL = parseBusinessCalendar(undefined).config;
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('business calendar and close date (P4-2)', () => {
  it('default: the 5th business day of the next month, weekends excluded', () => {
    // Oct 2026: Thu 1, Fri 2, Mon 5, Tue 6, Wed 7
    assert.equal(monthCloseDate('2026-09', DEFAULT_CAL), '2026-10-07');
    // Jan 2027: Fri 1, Mon 4, Tue 5, Wed 6, Thu 7
    assert.equal(monthCloseDate('2026-12', DEFAULT_CAL), '2027-01-07');
  });

  it('a month that starts on a weekend counts from the first weekday', () => {
    // Feb 2026 starts on Sunday: Mon 2, Tue 3, Wed 4, Thu 5, Fri 6
    assert.equal(monthCloseDate('2026-01', DEFAULT_CAL), '2026-02-06');
  });

  it('configured holidays are skipped', () => {
    const cal = parseBusinessCalendar(JSON.stringify({ holidays: ['2026-10-01', '2026-10-05'] })).config;
    // Thu 1 and Mon 5 are off: Fri 2, Tue 6, Wed 7, Thu 8, Fri 9
    assert.equal(monthCloseDate('2026-09', cal), '2026-10-09');
  });

  it('the number of business days and the weekend days are configurable', () => {
    const three = parseBusinessCalendar(JSON.stringify({ close_business_days: 3 })).config;
    assert.equal(monthCloseDate('2026-09', three), '2026-10-05');
    // Friday/Saturday weekend (e.g. a different locale): Oct 2026 Sun 4, Mon 5, Tue 6, Wed 7, Thu 8 ... plus Thu 1
    const fs5 = parseBusinessCalendar(JSON.stringify({ weekend_days: [5, 6] })).config;
    assert.equal(monthCloseDate('2026-09', fs5), '2026-10-07');
  });

  it('the close day itself is due; the day before is not', () => {
    assert.equal(isCloseDue('2026-09', at('2026-10-06'), DEFAULT_CAL), false);
    assert.equal(isCloseDue('2026-09', at('2026-10-07'), DEFAULT_CAL), true);
    assert.equal(isCloseDue('2026-10', at('2026-10-20'), DEFAULT_CAL), false);
  });

  it('invalid calendar settings fall back to the default and report why', () => {
    for (const raw of ['{', '[]', '{"close_business_days":0}', '{"weekend_days":[0,1,2,3,4,5,6]}', '{"holidays":["10/05"]}']) {
      const r = parseBusinessCalendar(raw);
      assert.ok(r.error, raw);
      assert.deepEqual(r.config, DEFAULT_CAL);
    }
    assert.equal(parseBusinessCalendar('').error, undefined);
  });
});

describe('checksum, diff and revision history', () => {
  const figures = { 'monthly.overview.total_spend_usd': 1000, 'monthly.overview.total_chats': 200, 'report.overview.total_net_spend_usd': null };

  it('the checksum does not depend on key order and changes with any value', () => {
    const reordered = { 'report.overview.total_net_spend_usd': null, 'monthly.overview.total_chats': 200, 'monthly.overview.total_spend_usd': 1000 };
    assert.equal(canonicalJson(figures), canonicalJson(reordered));
    assert.equal(computeChecksum('2026-09', figures), computeChecksum('2026-09', reordered));
    assert.match(computeChecksum('2026-09', figures), /^[0-9a-f]{64}$/);
    assert.notEqual(computeChecksum('2026-09', figures), computeChecksum('2026-08', figures));
    assert.notEqual(computeChecksum('2026-09', figures), computeChecksum('2026-09', { ...figures, 'monthly.overview.total_chats': 201 }));
  });

  it('diff lists only changed items, including added and removed ones', () => {
    const d = diffFigures(figures, { 'monthly.overview.total_spend_usd': 1250.5, 'monthly.overview.total_chats': 200, 'monthly.agent_sessions': 4 });
    assert.deepEqual(
      d.map((x) => [x.key, x.before, x.after, x.delta]),
      [
        ['monthly.agent_sessions', null, 4, null],
        ['monthly.overview.total_spend_usd', 1000, 1250.5, 250.5],
      ]
    );
  });

  it('a revision is appended with reason / run id / time / diff and never touches the closed version', () => {
    const record = createCloseRecord('2026-09', figures, DEFAULT_CAL, { now: at('2026-10-07'), runId: 'run-1' });
    const closedCopy = JSON.parse(JSON.stringify(record.closed));
    const next = appendRevision(record, { reason: 'late API data', actor: 'finops-team', figures: { ...figures, 'monthly.overview.total_spend_usd': 1100 } }, { now: at('2026-10-20'), runId: 'run-2' })!;
    assert.ok(next);
    assert.deepEqual(next.closed, closedCopy);
    assert.equal(next.revisions.length, 1);
    const rev = next.revisions[0];
    assert.equal(rev.version, 2);
    assert.equal(rev.reason, 'late API data');
    assert.equal(rev.actor, 'finops-team');
    assert.equal(rev.run_id, 'run-2');
    assert.equal(rev.previous_checksum, record.closed.checksum);
    assert.deepEqual(rev.diff.map((d) => [d.key, d.before, d.after, d.delta]), [['monthly.overview.total_spend_usd', 1000, 1100, 100]]);
    assert.equal(currentVersion(next).checksum, rev.checksum);
    assert.equal(verifyRecordIntegrity(next), null);
    // the input record is not mutated
    assert.equal(record.revisions.length, 0);
  });

  it('no difference means no revision; a reason is required', () => {
    const record = createCloseRecord('2026-09', figures, DEFAULT_CAL, { now: at('2026-10-07') });
    assert.equal(appendRevision(record, { reason: 'x', figures: { ...figures } }, { now: at('2026-10-08') }), null);
    assert.throws(() => appendRevision(record, { reason: '  ', figures: { ...figures, 'monthly.overview.total_chats': 1 } }, { now: at('2026-10-08') }), /reason/);
  });

  it('detects a tampered record (value edited without recomputing the checksum, or a broken chain)', () => {
    const record = createCloseRecord('2026-09', figures, DEFAULT_CAL, { now: at('2026-10-07') });
    const rev = appendRevision(record, { reason: 'r', figures: { ...figures, 'monthly.overview.total_chats': 1 } }, { now: at('2026-10-08') })!;
    const edited: MonthCloseRecord = JSON.parse(JSON.stringify(rev));
    edited.closed.figures['monthly.overview.total_spend_usd'] = 1;
    assert.equal(verifyRecordIntegrity(edited)?.kind, 'checksum_mismatch');
    const broken: MonthCloseRecord = JSON.parse(JSON.stringify(rev));
    broken.revisions[0].previous_checksum = 'deadbeef';
    assert.equal(verifyRecordIntegrity(broken)?.kind, 'checksum_mismatch');
  });

  it('the index is newest first and carries the current checksum and revision count', () => {
    const a = createCloseRecord('2026-08', figures, DEFAULT_CAL, { now: at('2026-09-08') });
    const b0 = createCloseRecord('2026-09', figures, DEFAULT_CAL, { now: at('2026-10-07') });
    const b = appendRevision(b0, { reason: 'r', figures: { ...figures, 'monthly.overview.total_chats': 1 } }, { now: at('2026-10-09') })!;
    const idx = buildCloseIndex([a, b]);
    assert.deepEqual(idx.months.map((m) => m.month), ['2026-09', '2026-08']);
    assert.equal(idx.months[0].revision_count, 1);
    assert.equal(idx.months[0].checksum, currentVersion(b).checksum);
    assert.equal(idx.months[1].last_revised_at, null);
  });

  it('figures hold numbers only: no user rows, logins or names', () => {
    const scope: any = {
      overview: { total_seats: 3, active_users: 2, idle_seats: 1, total_spend_usd: 57, idle_waste_usd: 19, active_ratio: 0.66, overall_acceptance_rate: null, missing_metrics: ['x'] },
      users: [{ login: 'real-person', display_name: 'Real Person', ai_credits_used_28d: 5 }, { login: 'other', ai_credits_used_28d: 7 }],
      agent_summary: { total_sessions: 9 },
    };
    const f = extractMonthlyFigures(scope);
    assert.equal(f['monthly.ai_credits_used'], 12);
    assert.equal(f['monthly.overview.overall_acceptance_rate'], null);
    assert.equal(f['monthly.agent_sessions'], 9);
    const text = JSON.stringify(f);
    assert.ok(!/real-person|Real Person|other/.test(text));
    assert.ok(Object.values(f).every((v) => v === null || typeof v === 'number'));
  });
});

// ---------------------------------------------------------------------------
// パイプライン結線 (実ストレージ・一時ディレクトリ)
// ---------------------------------------------------------------------------

function seat(login: string): CopilotSeatAssignment {
  return {
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    pending_cancellation_date: null,
    last_activity_at: '2024-03-09T00:00:00Z',
    last_activity_editor: 'vscode',
    plan_type: 'business',
    assignee: { login, id: 1, avatar_url: '', html_url: '', type: 'User' },
    organization: { login: 'acme-org', id: 1 },
  };
}

function metric(date: string, chats: number): CopilotDailyMetrics {
  return {
    date,
    total_active_users: 10,
    total_engaged_users: 8,
    copilot_ide_code_completions: {
      total_engaged_users: 8,
      languages: [{ name: 'typescript', total_engaged_users: 8, total_code_suggestions: 100, total_code_acceptances: 30, total_code_lines_suggested: 400, total_code_lines_accepted: 120 }],
      editors: [{ name: 'vscode', total_engaged_users: 8 }],
    },
    copilot_ide_chat: { total_engaged_users: 6, total_chats: chats, total_chat_copy_events: 5, total_chat_insertion_events: 5, models: [{ name: 'gpt-4o', total_chats: chats }] },
    copilot_dotcom_chat: { total_engaged_users: 0, total_chats: 0 },
    copilot_dotcom_pull_requests: { total_engaged_users: 2, total_pr_summaries_created: 3 },
    copilot_in_cli: { total_engaged_users: 0, total_cli_completions: 0 },
  };
}

const okStatus = (source: SourceStatus['source'], records: number): SourceStatus => ({
  source,
  status: 'ok',
  records,
  last_attempt_at: '2024-03-11T00:00:00.000Z',
  last_success_at: '2024-03-11T00:00:00.000Z',
});

function fakeSource(chats: number): ICopilotDataSource {
  const seats = [seat('user-a'), seat('user-b'), seat('user-c')];
  return {
    fetchMetrics: async () => [metric('2024-03-10', chats)],
    fetchSeats: async () => seats,
    fetchCostCenters: async () => [],
    fetchCostCenterBudgets: async () => [],
    fetchUserProfiles: async () => [],
    getIssues: () => [],
    getSourceStatuses: () => [okStatus('metrics', 1), okStatus('seats', 3), okStatus('cost_centers', 0)],
    getQualityObservations: () => null,
  } as unknown as ICopilotDataSource;
}

const emptyResolver: IAttributeResolver = { resolve: () => undefined, resolveAll: () => new Map(), getMappingCount: () => 0 };

describe('month close wired into the pipeline (P4-2)', () => {
  let tmp: string;
  let storage: ForkSafeStorageWriter;
  const ENV = ['COPILOT_USER_MAPPING', 'COPILOT_USER_MAPPING_BASE64', 'COPILOT_USER_MAPPING_FILE', 'COPILOT_BILLING_CONFIG', 'COPILOT_BUSINESS_CALENDAR', 'ANONYMIZE_USERS'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'month-close-'));
    storage = new ForkSafeStorageWriter({ baseDir: tmp, publicDir: '' });
  });
  afterEach(() => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function run(chats: number, revision?: { months: string[]; reason: string; actor?: string }) {
    const orchestrator = new PipelineOrchestrator({
      dataSource: fakeSource(chats),
      resolver: emptyResolver,
      storage,
      isMock: false,
      anonymize: false,
      revision,
    });
    const log = console.log;
    const warn = console.warn;
    console.log = () => {};
    console.warn = () => {};
    try {
      await orchestrator.run();
    } finally {
      console.log = log;
      console.warn = warn;
    }
  }

  const monthlyFile = () => path.join(tmp, 'processed/monthly/2024-03.json');
  const readJson = <T>(p: string) => JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  const chatsOf = () => readJson<any>(monthlyFile()).overview.total_chats as number;
  const errorLog = () => readJson<{ issues: Array<{ target: string; severity: string; message: string; details?: string }> }>(path.join(tmp, 'error-log.json')).issues;

  it('closes a due month with a checksum and marks it closed in the yearly trend', async () => {
    await run(50);
    const rec = readJson<MonthCloseRecord>(path.join(tmp, 'processed/closes/2024-03.json'));
    assert.equal(rec.month, '2024-03');
    // Apr 2024: Mon 1 ... Fri 5
    assert.equal(rec.closes_on, '2024-04-05');
    assert.equal(rec.closes_on, monthCloseDate('2024-03', DEFAULT_CAL));
    assert.equal(rec.closed.version, 1);
    assert.equal(rec.closed.checksum, computeChecksum('2024-03', rec.closed.figures));
    assert.equal(rec.closed.figures['monthly.overview.total_chats'], 50);
    assert.equal(rec.revisions.length, 0);
    const idx = readJson<MonthCloseIndex>(path.join(tmp, 'processed/closes/index.json'));
    assert.equal(idx.months[0].month, '2024-03');
    const trend = readJson<RollingTrendDataset>(path.join(tmp, 'processed/trends/rolling-1year.json'));
    const p = trend.points!.find((x) => x.month === '2024-03')!;
    assert.equal(p.status, 'closed');
    assert.equal(p.revision_count, 0);
  });

  it('a reprocess that would change a closed month does not overwrite it silently: figures kept, issue raised, verify stays clean', async () => {
    await run(50);
    const before = fs.readFileSync(monthlyFile(), 'utf-8');
    await run(999); // same month, different numbers, no revision requested
    assert.equal(fs.readFileSync(monthlyFile(), 'utf-8'), before);
    assert.equal(chatsOf(), 50);
    const rec = readJson<MonthCloseRecord>(path.join(tmp, 'processed/closes/2024-03.json'));
    assert.equal(rec.revisions.length, 0);
    const issue = errorLog().find((i) => i.target === 'month-close:2024-03');
    assert.ok(issue, 'a held change must be visible as an issue');
    assert.match(issue!.message, /--revise 2024-03/);
    assert.match(issue!.details!, /total_chats: 50 -> 999/);
    assert.deepEqual(new MonthCloseService(storage, { now: new Date(), calendar: DEFAULT_CAL }).verify(), []);
  });

  it('re-running with identical numbers keeps the month closed and records nothing', async () => {
    await run(50);
    await run(50);
    const rec = readJson<MonthCloseRecord>(path.join(tmp, 'processed/closes/2024-03.json'));
    assert.equal(rec.revisions.length, 0);
    assert.equal(errorLog().filter((i) => i.target === 'month-close:2024-03').length, 0);
  });

  it('an explicit revision updates the figures and keeps the original closed values with reason, run id, time and diff', async () => {
    await run(50);
    const original = readJson<MonthCloseRecord>(path.join(tmp, 'processed/closes/2024-03.json')).closed;
    await run(999, { months: ['2024-03'], reason: 'late-arriving API data', actor: 'finops-team' });
    assert.equal(chatsOf(), 999);
    const rec = readJson<MonthCloseRecord>(path.join(tmp, 'processed/closes/2024-03.json'));
    assert.deepEqual(rec.closed, original);
    assert.equal(rec.revisions.length, 1);
    const rev = rec.revisions[0];
    assert.equal(rev.reason, 'late-arriving API data');
    assert.equal(rev.actor, 'finops-team');
    assert.ok(rev.at);
    assert.ok(rev.diff.some((d) => d.key === 'monthly.overview.total_chats' && d.before === 50 && d.after === 999 && d.delta === 949));
    assert.equal(rev.previous_checksum, original.checksum);
    const idx = readJson<MonthCloseIndex>(path.join(tmp, 'processed/closes/index.json'));
    assert.equal(idx.months[0].revision_count, 1);
    assert.equal(idx.months[0].checksum, rev.checksum);
    const trend = readJson<RollingTrendDataset>(path.join(tmp, 'processed/trends/rolling-1year.json'));
    assert.equal(trend.points!.find((x) => x.month === '2024-03')!.revision_count, 1);
    assert.deepEqual(new MonthCloseService(storage, { now: new Date(), calendar: DEFAULT_CAL }).verify(), []);
  });

  it('a revision request for a month that did not change records nothing; for an unclosed month it is an error issue', async () => {
    await run(50);
    await run(50, { months: ['2024-03', '2023-01'], reason: 'check' });
    assert.equal(readJson<MonthCloseRecord>(path.join(tmp, 'processed/closes/2024-03.json')).revisions.length, 0);
    const issues = errorLog().filter((i) => i.target.startsWith('month-close:'));
    assert.ok(issues.some((i) => i.target === 'month-close:2023-01' && i.severity === 'error'));
  });

  it('a figure changed on disk without a revision is detected (month:verify would fail) and shown as an error issue on the next run', async () => {
    await run(50);
    const scope = readJson<any>(monthlyFile());
    scope.overview.total_spend_usd += 1000; // a silent edit
    fs.writeFileSync(monthlyFile(), JSON.stringify(scope), 'utf-8');
    const problems = new MonthCloseService(storage, { now: new Date(), calendar: DEFAULT_CAL }).verify();
    assert.equal(problems.length, 1);
    assert.equal(problems[0].kind, 'unrecorded_change');
    assert.ok(problems[0].diff.some((d) => d.key === 'monthly.overview.total_spend_usd'));
    await run(50);
    assert.ok(errorLog().some((i) => i.target === 'month-close:2024-03' && i.severity === 'error'));
  });

  it('a month whose close date has not come is not closed', async () => {
    await run(50);
    fs.rmSync(path.join(tmp, 'processed/closes'), { recursive: true });
    // Apr 2024: Mon 1, Tue 2, Wed 3, Thu 4, Fri 5 -> due on the 5th, not on the 4th
    assert.deepEqual(new MonthCloseService(storage, { now: at('2024-04-04'), calendar: DEFAULT_CAL }).closeDueMonths(), []);
    assert.deepEqual(new MonthCloseService(storage, { now: at('2024-04-05'), calendar: DEFAULT_CAL }).closeDueMonths(), ['2024-03']);
  });

  it('an invalid calendar setting becomes an issue and the default calendar is used', async () => {
    process.env.COPILOT_BUSINESS_CALENDAR = '{not json';
    await run(50);
    assert.ok(errorLog().some((i) => i.target === 'config:COPILOT_BUSINESS_CALENDAR'));
    assert.ok(fs.existsSync(path.join(tmp, 'processed/closes/2024-03.json')));
  });

  it('close files contain no logins or names', async () => {
    await run(50);
    const text = fs.readFileSync(path.join(tmp, 'processed/closes/2024-03.json'), 'utf-8') + fs.readFileSync(path.join(tmp, 'processed/closes/index.json'), 'utf-8');
    assert.ok(!/user-a|user-b|user-c|acme-org/.test(text));
  });
});

describe('reprocess CLI arguments', () => {
  it('parses --revise with the required reason and optional actor', () => {
    assert.deepEqual(parseReprocessArgs(['--run', 'r1', '--revise', '2026-09', '--revise', '2026-08', '--reason', 'late data', '--actor', 'ops']), {
      runId: 'r1',
      revision: { months: ['2026-09', '2026-08'], reason: 'late data', actor: 'ops' },
    });
    assert.deepEqual(parseReprocessArgs([]), { runId: undefined });
  });
  it('rejects a revision without a reason, a bad month, or a reason without --revise', () => {
    assert.throws(() => parseReprocessArgs(['--revise', '2026-09']), /--reason/);
    assert.throws(() => parseReprocessArgs(['--revise', '2026-9', '--reason', 'x']), /YYYY-MM/);
    assert.throws(() => parseReprocessArgs(['--reason', 'x']), /--revise/);
  });
});
