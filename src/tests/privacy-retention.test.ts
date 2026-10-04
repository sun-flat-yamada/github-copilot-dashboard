import { afterEach, beforeEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ReportGenerationService } from '../application/pipeline/report-generation.js';
import { RetentionService } from '../application/pipeline/retention.js';
import {
  checkProfileConsistency,
  evaluateIdentifiedGate,
  forbiddenDistTopLevel,
  PUBLICATION_PROFILE,
} from '../domain/privacy-profile.js';
import { parseReportDefinition } from '../processor/report-engine.js';
import {
  buildRetentionPlan,
  confirmMatches,
  keepFromMonth,
  parseRetentionMonths,
  periodMonth,
  retentionExecutionRefusal,
  runIdMonth,
  type RetentionInventory,
} from '../processor/retention.js';
import { ForkSafeStorage } from '../storage/fork-safe-storage.js';
import { checkPublicationProfile } from '../../scripts/verify-fork-health.js';
import { FORBIDDEN_DIST_PATHS, publicationProfileProblems, STAGED_PROCESSED_DIRS } from '../../scripts/pages-staging.js';

// 値はすべて架空
const NOW = new Date('2026-10-04T00:00:00Z'); // 保持 60 か月 => 2021-11 以降を保持、2021-10 以前が期限切れ

describe('publication profile (P4-6)', () => {
  it('matches the Pages staging allow-list and deny-list', () => {
    assert.deepEqual(publicationProfileProblems(), []);
  });

  it('keeps identified-tier artifacts off Pages except the processed/* scopes of the premise', () => {
    for (const e of PUBLICATION_PROFILE.filter((x) => x.tier === 'identified' && x.pages)) {
      assert.ok(e.path.startsWith('processed/'), e.path);
    }
    assert.deepEqual(forbiddenDistTopLevel().sort(), ['audit', 'config', 'raw', 'reports']);
  });

  it('detects a declaration that disagrees with the staging configuration', () => {
    const input = { stagedProcessedDirs: [...STAGED_PROCESSED_DIRS], forbiddenDistPaths: [...FORBIDDEN_DIST_PATHS].map((p) => p.split(path.sep).join('/')) };
    assert.deepEqual(checkProfileConsistency(input), []);
    // audit/ no longer denied
    assert.ok(checkProfileConsistency({ ...input, forbiddenDistPaths: input.forbiddenDistPaths.filter((p) => p !== 'audit') }).some((p) => /audit.*does not forbid/.test(p)));
    // an undeclared directory staged
    assert.ok(checkProfileConsistency({ ...input, stagedProcessedDirs: [...input.stagedProcessedDirs, 'secrets'] }).some((p) => /processed\/secrets.*not declared/.test(p)));
    // a declared-published directory missing from the allow-list
    assert.ok(checkProfileConsistency({ ...input, stagedProcessedDirs: input.stagedProcessedDirs.filter((d) => d !== 'closes') }).some((p) => /processed\/closes.*allow-list/.test(p)));
    // an identified artifact declared as published outside processed/
    const bad = [...PUBLICATION_PROFILE.filter((e) => e.path !== 'audit/seat-events'), { path: 'audit/seat-events', tier: 'identified' as const, pages: true, retention: 'audit' as const, note: 'x' }];
    assert.ok(checkProfileConsistency(input, bad).some((p) => /identified-tier and must not be published/.test(p)));
  });

  it('never lets retention touch a "retained" artifact', () => {
    const touched = PUBLICATION_PROFILE.filter((e) => e.retention !== 'retained').map((e) => e.path);
    assert.ok(!touched.some((p) => p.startsWith('processed/')), 'processed/** is never subject to retention');
    assert.ok(touched.includes('raw') && touched.includes('audit/seat-events'));
  });
});

describe('identified gate and report generation (P4-6)', () => {
  const def = (tier: string) => `id: tiered\ntitle: Tiered\ndataset: monthly\nprivacy_tier: ${tier}\noutputs: [markdown]\nsections:\n  - { type: kpi, id: k, title: K, metrics: [total_spend] }\n`;

  it('opens only with pseudonymization (strong secret) or an explicit allowance', () => {
    assert.equal(evaluateIdentifiedGate({}).allowed, false);
    assert.equal(evaluateIdentifiedGate({ ANONYMIZE_USERS: 'true' }).allowed, false);
    assert.equal(evaluateIdentifiedGate({ ANONYMIZE_USERS: 'true', ANONYMIZE_SECRET: 'short' }).allowed, false);
    assert.equal(evaluateIdentifiedGate({ ANONYMIZE_USERS: 'true', ANONYMIZE_SECRET: 'x'.repeat(16) }).allowed, true);
    assert.equal(evaluateIdentifiedGate({ COPILOT_ALLOW_IDENTIFIED_REPORTS: 'true' }).allowed, true);
    assert.equal(evaluateIdentifiedGate({ COPILOT_ALLOW_IDENTIFIED_REPORTS: '1' }).allowed, false);
    // the public-exposure override must not open the gate
    assert.equal(evaluateIdentifiedGate({ COPILOT_ALLOW_PUBLIC_DATA: 'true' }).allowed, false);
  });

  it('refuses to generate an identified report while the gate is closed, and records the tier when open', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-gen-'));
    try {
      const storage = new ForkSafeStorage({ baseDir: path.join(tmp, 'data'), publicDir: undefined });
      fs.mkdirSync(path.join(tmp, 'data/processed/monthly'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'data/processed/monthly/2026-09.json'), JSON.stringify({ overview: { total_spend_usd: 10 } }));
      const parsed = parseReportDefinition(def('identified'), 'tiered');
      const entry = { definition: parsed.definition!, sha256: parsed.sha256! };
      const target = { period: '2026-09', dataMonth: '2026-09' };

      assert.ok(new ReportGenerationService(storage).generate(entry, target, NOW).reason, 'fail closed without a gate');
      const closed = new ReportGenerationService(storage, evaluateIdentifiedGate({}));
      const refused = closed.generate(entry, target, NOW);
      assert.equal(refused.status, 'refused');
      assert.match(refused.reason ?? '', /ANONYMIZE_USERS|COPILOT_ALLOW_IDENTIFIED_REPORTS/);
      assert.equal(storage.loadReportOutputIndex(), null, 'nothing is written when refused');

      const open = new ReportGenerationService(storage, evaluateIdentifiedGate({ COPILOT_ALLOW_IDENTIFIED_REPORTS: 'true' }));
      assert.equal(open.generate(entry, target, NOW).status, 'generated');
      assert.equal(storage.loadReportOutputIndex()?.outputs[0].privacy_tier, 'identified');

      const agg = parseReportDefinition(def('aggregate-only'), 'tiered');
      assert.equal(closed.generate({ definition: agg.definition!, sha256: agg.sha256! }, target, NOW).status, 'generated');
      assert.equal(storage.loadReportOutputIndex()?.outputs[0].privacy_tier, 'aggregate-only');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('retention policy (pure, P4-6)', () => {
  it('defaults to 60 months and rejects invalid values with a reason', () => {
    assert.deepEqual(parseRetentionMonths(undefined), { months: 60 });
    assert.deepEqual(parseRetentionMonths('  '), { months: 60 });
    assert.deepEqual(parseRetentionMonths('36'), { months: 36 });
    for (const bad of ['abc', '6', '-1', '1000', '12.5']) {
      const r = parseRetentionMonths(bad);
      assert.equal(r.months, 60, bad);
      assert.ok(r.error, bad);
    }
  });

  it('keeps the latest N months including the current one (boundary)', () => {
    assert.equal(keepFromMonth(NOW, 60), '2021-11');
    assert.equal(keepFromMonth(NOW, 12), '2025-11');
    const inv: RetentionInventory = {
      rawDailyMonths: ['2021-10', '2021-11'],
      landingManifests: [],
      reportCsvMonths: [],
      seatEventMonths: ['2021-10', '2021-11'],
      billingReconciliationMonths: [],
      reportOutputs: [],
      closedMonths: ['2021-10', '2021-11'],
    };
    const plan = buildRetentionPlan(inv, NOW, 60);
    assert.deepEqual(plan.items.map((i) => `${i.category}:${i.key}`), ['raw_daily:2021-10', 'seat_events:2021-10']);
  });

  it('does not delete raw data or CSV originals of a month that is not closed', () => {
    const inv: RetentionInventory = {
      rawDailyMonths: ['2020-01', '2020-02'],
      landingManifests: [],
      reportCsvMonths: ['2020-01', '2020-02'],
      seatEventMonths: ['2020-01'],
      billingReconciliationMonths: ['2020-01'],
      reportOutputs: [],
      closedMonths: ['2020-02'],
    };
    const plan = buildRetentionPlan(inv, NOW, 60);
    assert.deepEqual(plan.skipped.map((s) => `${s.category}:${s.key}:${s.reason}`).sort(), ['raw_daily:2020-01:not_closed', 'report_csv:2020-01:not_closed']);
    assert.ok(plan.items.some((i) => i.category === 'raw_daily' && i.key === '2020-02'));
    // audit derivatives do not need the close
    assert.ok(plan.items.some((i) => i.category === 'seat_events' && i.key === '2020-01'));
    assert.ok(plan.items.some((i) => i.category === 'billing_reconciliation' && i.key === '2020-01'));
  });

  it('maps run ids and report periods (weekly -> month of its Thursday)', () => {
    assert.equal(runIdMonth('20201003T041500Z-ab12'), '2020-10');
    assert.equal(runIdMonth('bogus'), null);
    assert.equal(periodMonth('2021-10'), '2021-10');
    assert.equal(periodMonth('2026-W40'), '2026-10'); // Thursday 2026-10-01
    assert.equal(periodMonth('2026-W01'), '2026-01'); // Thursday 2026-01-01
    assert.equal(periodMonth('2021-W44'), '2021-11'); // Thursday 2021-11-04
    assert.equal(periodMonth('2021-W39'), '2021-09'); // Thursday 2021-09-30 (week crosses the month end)
    assert.equal(periodMonth('x'), null);
  });

  it('drops a landing object only when no kept manifest references it', () => {
    const o = (n: string) => `objects/${n.repeat(2)}/${n.repeat(64)}.json`;
    const inv: RetentionInventory = {
      rawDailyMonths: [],
      landingManifests: [
        { run_id: '20200101T000000Z-aaaa', objects: [o('a'), o('b')] },
        { run_id: '20261001T000000Z-bbbb', objects: [o('b')] },
        { run_id: 'weird-name', objects: [o('c')] },
      ],
      reportCsvMonths: [],
      seatEventMonths: [],
      billingReconciliationMonths: [],
      reportOutputs: [],
      closedMonths: [],
    };
    const plan = buildRetentionPlan(inv, NOW, 60);
    assert.deepEqual(plan.items.map((i) => `${i.category}:${i.key}`), [`raw_landing_manifests:20200101T000000Z-aaaa`, `raw_landing_objects:${o('a')}`]);
    assert.deepEqual(plan.skipped.map((s) => s.key), ['weird-name']);
    // an unreadable manifest: no object is deleted at all
    assert.ok(!buildRetentionPlan({ ...inv, landingUnreadable: true }, NOW, 60).items.some((i) => i.category === 'raw_landing_objects'));
  });

  it('requires --confirm to equal the cutoff and refuses a contaminated main checkout or demo', () => {
    const plan = buildRetentionPlan({ rawDailyMonths: [], landingManifests: [], reportCsvMonths: [], seatEventMonths: [], billingReconciliationMonths: [], reportOutputs: [], closedMonths: [] }, NOW, 60);
    assert.equal(confirmMatches(undefined, plan), false);
    assert.equal(confirmMatches('2021-10', plan), false);
    assert.equal(confirmMatches('2021-11', plan), true);
    assert.equal(retentionExecutionRefusal({ branch: 'main', trackedDataFiles: 0, isDemo: false }), null);
    assert.match(retentionExecutionRefusal({ branch: 'main', trackedDataFiles: 3, isDemo: false }) ?? '', /tracked by Git/);
    assert.equal(retentionExecutionRefusal({ branch: 'copilot-data', trackedDataFiles: 300, isDemo: false }), null);
    assert.match(retentionExecutionRefusal({ branch: 'copilot-data', trackedDataFiles: 0, isDemo: true }) ?? '', /demo/);
  });
});

describe('retention service on a temporary data directory (P4-6)', () => {
  let tmp: string;
  let data: string;
  let storage: ForkSafeStorage;
  const put = (rel: string, content = '{}') => {
    const f = path.join(data, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content, 'utf-8');
  };
  const exists = (rel: string) => fs.existsSync(path.join(data, rel));
  const OBJ_A = `objects/aa/${'a'.repeat(64)}.json`;
  const OBJ_B = `objects/bb/${'b'.repeat(64)}.json`;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retention-'));
    data = path.join(tmp, 'data');
    storage = new ForkSafeStorage({ baseDir: data, publicDir: undefined });
    // 期限切れ (2020-03、締め済み)
    put('raw/2020/03/2020-03-15-raw.json');
    put('reports/monthly/2020-03/usage.csv', 'a,b');
    put('audit/seat-events/2020-03.json');
    put('audit/billing-reconciliation/2020-03.json');
    put('audit/report-outputs/weekly-x/2020-W12.md', 'x');
    put('audit/report-outputs/weekly-x/2020-W12.csv', 'x');
    put('audit/report-outputs/weekly-x/2026-W40.md', 'x');
    put('audit/report-outputs/index.json', JSON.stringify({ schema_version: 1, outputs: [
      { report_id: 'weekly-x', period: '2020-W12', data_month: '2020-03', generated_at: 'x', definition_sha256: 'x', outputs: ['markdown'], demo: false },
      { report_id: 'weekly-x', period: '2026-W40', data_month: '2026-09', generated_at: 'x', definition_sha256: 'x', outputs: ['markdown'], demo: false },
    ] }));
    put(`raw/landing/${OBJ_A}`, 'A');
    put(`raw/landing/${OBJ_B}`, 'B');
    put('raw/landing/manifests/20200301T000000Z-aaaa.json', JSON.stringify({ entries: [{ object: OBJ_A }, { object: OBJ_B }] }));
    put('raw/landing/manifests/20261001T000000Z-bbbb.json', JSON.stringify({ entries: [{ object: OBJ_B }] }));
    // 保持するもの: 期限内の月、processed/** (確定済み月次を含む)
    put('raw/2026/09/2026-09-01-raw.json');
    put('audit/seat-events/2026-09.json');
    put('processed/monthly/2020-03.json');
    put('processed/closes/2020-03.json', '{"closed":{"checksum":"x"}}');
    put('processed/closes/index.json');
    put('index.json');
    put('error-log.json');
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const snapshot = () => {
    const out: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : out.push(path.relative(data, path.join(d, e.name)))));
    walk(data);
    return out.sort();
  };

  it('plans without changing anything (dry run)', () => {
    const before = snapshot();
    const service = new RetentionService(storage);
    const plan = service.plan(NOW, 60);
    assert.ok(plan.items.length >= 7);
    assert.deepEqual(plan.skipped, [], 'the month 2020-03 is closed');
    assert.deepEqual(snapshot(), before);
    assert.ok(!exists('audit/retention/log.json'));
  });

  it('never plans processed/**, closes, metadata or the retention log itself', () => {
    put('processed/closes/2020-03.json'); // (re-written; already there)
    const plan = new RetentionService(storage).plan(NOW, 60);
    const text = JSON.stringify(plan);
    assert.ok(!/processed|closes|index\.json|error-log/.test(text.replace('report_outputs', '')), text);
  });

  it('plans raw and CSV originals only for closed months', () => {
    fs.rmSync(path.join(data, 'processed/closes/2020-03.json'));
    const plan = new RetentionService(storage).plan(NOW, 60);
    assert.deepEqual(plan.skipped.map((s) => `${s.category}:${s.key}`).sort(), ['raw_daily:2020-03', 'report_csv:2020-03']);
    assert.ok(!plan.items.some((i) => i.category === 'raw_daily' || i.category === 'report_csv'));
  });

  it('executes the plan, keeps closed snapshots and recent data, and records what was deleted', () => {
    const service = new RetentionService(storage);
    const plan = service.plan(NOW, 60);
    const record = service.execute(plan, '20261004T000000Z-cafe', NOW, 'finance-ops');
    assert.equal(record.status, 'completed', record.errors.join('\n'));

    for (const gone of [
      'raw/2020/03', 'reports/monthly/2020-03', 'audit/seat-events/2020-03.json', 'audit/billing-reconciliation/2020-03.json',
      'audit/report-outputs/weekly-x/2020-W12.md', 'audit/report-outputs/weekly-x/2020-W12.csv',
      'raw/landing/manifests/20200301T000000Z-aaaa.json', `raw/landing/${OBJ_A}`,
    ]) assert.equal(exists(gone), false, gone);
    for (const kept of [
      'raw/2026/09/2026-09-01-raw.json', 'audit/seat-events/2026-09.json', 'audit/report-outputs/weekly-x/2026-W40.md',
      'raw/landing/manifests/20261001T000000Z-bbbb.json', `raw/landing/${OBJ_B}`, // shared object is still referenced
      'processed/monthly/2020-03.json', 'processed/closes/2020-03.json', 'processed/closes/index.json', 'index.json', 'error-log.json',
    ]) assert.equal(exists(kept), true, kept);

    assert.deepEqual(storage.loadReportOutputIndex()?.outputs.map((o) => o.period), ['2026-W40']);

    const log = service.loadLog();
    assert.equal(log.runs.length, 1);
    const run = log.runs[0];
    assert.equal(run.status, 'completed');
    assert.equal(run.actor, 'finance-ops');
    assert.equal(run.keep_from, '2021-11');
    assert.equal(run.retention_months, 60);
    assert.equal(run.categories.raw_daily?.count, 1);
    assert.deepEqual(run.categories.raw_daily?.keys, ['2020-03']);
    assert.ok((run.categories.report_csv?.bytes ?? 0) > 0);
    assert.ok(run.finished_at);
    // the next plan is empty (idempotent)
    assert.deepEqual(service.plan(NOW, 60).items, []);
  });

  it('holds a started record in log.json while the run is in progress', () => {
    const real = storage.saveReportOutputIndex.bind(storage);
    let during: string | undefined;
    storage.saveReportOutputIndex = (index) => {
      during = JSON.parse(fs.readFileSync(path.join(data, 'audit/retention/log.json'), 'utf-8')).runs[0]?.status;
      real(index);
    };
    const service = new RetentionService(storage);
    service.execute(service.plan(NOW, 60), '20261004T000001Z-beef', NOW);
    assert.equal(during, 'started');
    assert.equal(service.loadLog().runs[0].status, 'completed');
  });

  it('does not list or follow symbolic links', () => {
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'keep.txt'), 'keep');
    fs.rmSync(path.join(data, 'raw/2020/03'), { recursive: true });
    fs.symlinkSync(outside, path.join(data, 'raw/2020/03'));
    const service = new RetentionService(storage);
    const plan = service.plan(NOW, 60);
    assert.ok(!plan.items.some((i) => i.category === 'raw_daily'), 'a linked month directory is not listed');
    // swapped for a link after the plan was made: the delete is refused and reported
    fs.rmSync(path.join(data, 'audit/seat-events/2020-03.json'));
    fs.symlinkSync(path.join(outside, 'keep.txt'), path.join(data, 'audit/seat-events/2020-03.json'));
    const record = service.execute(plan, '20261004T000002Z-f00d', NOW);
    assert.ok(fs.existsSync(path.join(outside, 'keep.txt')));
    assert.equal(record.status, 'failed');
    assert.ok(record.errors.some((e) => /seat_events\/2020-03/.test(e)));
  });
});

describe('fork:verify publication profile check (P4-6)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-check-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const index = (outputs: unknown[]) => {
    fs.mkdirSync(path.join(tmp, 'data/audit/report-outputs'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'data/audit/report-outputs/index.json'), JSON.stringify({ schema_version: 1, outputs }));
  };
  const run = (env: NodeJS.ProcessEnv = {}) =>
    checkPublicationProfile({ dataDir: path.join(tmp, 'data'), publicDataDir: path.join(tmp, 'public'), env, now: NOW });

  it('passes on an empty data directory', () => {
    assert.ok(run().every((c) => c.status === 'pass'));
  });

  it('fails when identified outputs exist while the gate is closed, passes when it is open', () => {
    index([{ report_id: 'r', period: '2026-09', privacy_tier: 'identified', demo: false }]);
    assert.ok(run().some((c) => c.status === 'fail' && c.name === 'Report output tiers'));
    assert.ok(run({ ANONYMIZE_USERS: 'true', ANONYMIZE_SECRET: 'k'.repeat(20) }).every((c) => c.status !== 'fail'));
    assert.ok(run({ COPILOT_ALLOW_IDENTIFIED_REPORTS: 'true' }).every((c) => c.status !== 'fail'));
  });

  it('fails on an unknown recorded tier', () => {
    index([{ report_id: 'r', period: '2026-09', privacy_tier: 'public' }]);
    assert.ok(run().some((c) => c.status === 'fail'));
  });

  it('fails when the staging directory holds audit/ or raw/', () => {
    fs.mkdirSync(path.join(tmp, 'public/audit'), { recursive: true });
    const failed = run().filter((c) => c.status === 'fail');
    assert.equal(failed.length, 1);
    assert.match(failed[0].message, /audit/);
  });

  it('warns (never fails) about data past the retention period', () => {
    fs.mkdirSync(path.join(tmp, 'data/audit/seat-events'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'data/audit/seat-events/2019-01.json'), '{}');
    const retention = run().find((c) => c.name === 'Data retention');
    assert.equal(retention?.status, 'warn');
    assert.ok(run({ COPILOT_DATA_RETENTION_MONTHS: '120' }).find((c) => c.name === 'Data retention')?.status === 'pass');
  });
});
