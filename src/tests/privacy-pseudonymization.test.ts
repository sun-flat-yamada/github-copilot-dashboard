import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Pseudonymizer, PseudonymizationConfigError } from '../collector/pseudonymizer.js';
import { AttributeResolver } from '../collector/attribute-resolver.js';
import { AttributeResolverAdapter } from '../adapters/storage/AttributeResolverAdapter.js';
import { BillingCalculator } from '../processor/billing-calculator.js';
import { ReportParser } from '../processor/report-parser.js';
import { PipelineOrchestrator } from '../application/pipeline/PipelineOrchestrator.js';
import { ICopilotDataSource } from '../domain/ports/ICopilotDataSource.js';
import { IAttributeResolver } from '../domain/ports/IAttributeResolver.js';
import { IStorageWriter } from '../domain/ports/IStorageWriter.js';
import {
  AnalysisScopeType,
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  DataFetchIssue,
  EnterpriseCostCenter,
  IndexMetadata,
  MonthlyReportAggregatedData,
  RollingTrendDataset,
  ScopeAggregatedData,
  SourceStatus,
} from '../types/copilot.js';

const SECRET = 'unit-test-secret-0123456789abcdef';
const OTHER_SECRET = 'another-secret-fedcba9876543210';

const REAL_LOGIN = 'real-alice';
const REAL_ID = 987654321;
const REAL_AVATAR = `https://avatars.githubusercontent.com/u/${REAL_ID}?v=4`;

function realSeat(): CopilotSeatAssignment {
  return {
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    pending_cancellation_date: null,
    last_activity_at: '2026-09-09T00:00:00Z',
    last_activity_editor: 'vscode',
    plan_type: 'enterprise',
    assignee: {
      login: REAL_LOGIN,
      id: REAL_ID,
      avatar_url: REAL_AVATAR,
      html_url: `https://github.com/${REAL_LOGIN}`,
      type: 'User',
    },
    assigning_team: { id: 555, name: 'Payments Squad', slug: 'payments-squad' },
    organization: { login: 'acme-org', id: 1 },
  };
}

/** 旧実装の 32 ビット非暗号学的ハッシュ (辞書照合で復元できた) */
function legacySimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

describe('Pseudonymizer: HMAC-SHA256 with a secret key (P0-11)', () => {
  it('refuses a missing or short secret (fail closed) without echoing it', () => {
    assert.throws(() => new Pseudonymizer(undefined), PseudonymizationConfigError);
    assert.throws(() => new Pseudonymizer(''), /not set/);
    assert.throws(() => new Pseudonymizer('short-secret'), (err: Error) => {
      assert.ok(err instanceof PseudonymizationConfigError);
      assert.match(err.message, /too short/);
      assert.ok(!err.message.includes('short-secret'), 'the secret must never be echoed');
      return true;
    });
    assert.doesNotThrow(() => new Pseudonymizer(SECRET));
  });

  it('is deterministic for the same key and normalizes case / surrounding spaces', () => {
    const pz = new Pseudonymizer(SECRET);
    assert.equal(pz.login('Real-Alice'), pz.login('real-alice'));
    assert.equal(pz.login('  real-alice '), pz.login('real-alice'));
    assert.equal(pz.login('real-alice'), new Pseudonymizer(SECRET).login('real-alice'));
    assert.notEqual(pz.login('real-alice'), pz.login('real-bob'));
  });

  it('produces different pseudonyms under a different key (so a published pseudonym cannot be re-derived without the key)', () => {
    assert.notEqual(new Pseudonymizer(SECRET).login('real-alice'), new Pseudonymizer(OTHER_SECRET).login('real-alice'));
  });

  it('is not reproducible by an attacker who only has a dictionary of logins (no unkeyed hash matches)', () => {
    const pseudonym = new Pseudonymizer(SECRET).login(REAL_LOGIN);
    const token = pseudonym.replace(/^dev_/, '');
    const candidates = [
      createHash('sha256').update(REAL_LOGIN).digest('hex'),
      createHash('md5').update(REAL_LOGIN).digest('hex'),
      createHash('sha1').update(REAL_LOGIN).digest('hex'),
      legacySimpleHash(REAL_LOGIN),
    ];
    for (const candidate of candidates) {
      assert.ok(!candidate.startsWith(token) && !token.startsWith(candidate), 'must not equal a plain hash of the login');
    }
    // 旧実装は 32 ビットで、ログイン名の辞書照合により全員分を復元できた。新しい仮名は 64 ビット分の HMAC。
    assert.match(pseudonym, /^dev_[0-9a-f]{16}$/);
  });

  it('separates domains: the login and display-name pseudonyms of the same user are unrelated', () => {
    const pz = new Pseudonymizer(SECRET);
    const loginToken = pz.login('real-alice').replace('dev_', '');
    const nameToken = pz.displayName('real-alice').replace('User-', '');
    assert.ok(!loginToken.startsWith(nameToken));
    assert.match(pz.displayName('real-alice'), /^User-[0-9a-f]{8}$/);
    assert.match(pz.department('Payments'), /^Group-[0-9a-f]{8}$/);
    assert.match(pz.team('Payments Squad'), /^Team-[0-9a-f]{8}$/);
    assert.match(pz.project('Atlas'), /^Project-[0-9a-f]{8}$/);
  });

  it('works in the browser bundle: no static node:crypto import and no direct process access in AttributeResolver', () => {
    // ReportParser (CSV の取り込み) は AttributeResolver をブラウザ内でも生成する。process.env への直接アクセスは
    // ブラウザで ReferenceError になり、node:crypto の静的 import はバンドルの externalize 警告になる。
    const root = path.resolve(import.meta.dirname, '../..');
    const pseudonymizer = fs.readFileSync(path.join(root, 'src/collector/pseudonymizer.ts'), 'utf-8');
    assert.doesNotMatch(pseudonymizer, /^import\s+(?!type)[^;]*from 'node:crypto'/m);

    const resolver = fs.readFileSync(path.join(root, 'src/collector/attribute-resolver.ts'), 'utf-8');
    const withoutHelper = resolver.replace(/function readEnv[\s\S]*?\n}\n/, '');
    assert.doesNotMatch(withoutHelper, /process\.env/);
  });

  it('redactSeat removes every identifier that could resolve to the person', () => {
    const redacted = new Pseudonymizer(SECRET).redactSeat(realSeat());
    const serialized = JSON.stringify(redacted);

    assert.ok(!serialized.includes(REAL_LOGIN), 'login must be pseudonymized');
    assert.ok(!serialized.includes(String(REAL_ID)), 'the numeric GitHub user id must be removed');
    assert.ok(!serialized.includes('avatars.githubusercontent.com'), 'avatar_url must be removed');
    assert.ok(!serialized.includes('Payments Squad') && !serialized.includes('payments-squad'), 'team names are pseudonymized');
    assert.equal(redacted.assignee.login, new Pseudonymizer(SECRET).login(REAL_LOGIN));
    assert.equal(redacted.plan_type, 'enterprise', 'non-identifying fields are preserved');
    assert.equal(redacted.organization?.login, 'acme-org');
  });

  it('redactCostCenter pseudonymizes only user resources', () => {
    const cc: EnterpriseCostCenter = {
      id: 'cc-1',
      name: 'Platform',
      cost_center_code: 'P',
      resources: [
        { type: 'User', name: REAL_LOGIN },
        { type: 'Org', name: 'acme-org' },
      ],
    };
    const redacted = new Pseudonymizer(SECRET).redactCostCenter(cc);
    assert.ok(!JSON.stringify(redacted).includes(REAL_LOGIN));
    assert.equal(redacted.resources[1].name, 'acme-org');
    assert.equal(redacted.name, 'Platform');
  });
});

describe('AttributeResolver / AttributeResolverAdapter anonymization (P0-11)', () => {
  const mapping = JSON.stringify([
    {
      github_user: REAL_LOGIN,
      display_name: 'Alice Realname',
      department: 'Payments',
      notes: 'Alice Realname, sits next to the window',
      teams: ['Payments Squad'],
      projects: ['Atlas'],
      tags: ['契約社員'],
    },
  ]);

  const savedEnv: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ['ANONYMIZE_USERS', 'ANONYMIZE_SECRET']) savedEnv[k] = process.env[k];
    delete process.env.ANONYMIZE_USERS;
    delete process.env.ANONYMIZE_SECRET;
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('pseudonymizes login, display name, department, teams and projects, and drops free-text notes', () => {
    const resolver = new AttributeResolver(mapping, true, { anonymizeSecret: SECRET });
    const resolved = resolver.resolve(REAL_LOGIN);
    const serialized = JSON.stringify(resolved);

    for (const leaked of [REAL_LOGIN, 'Alice Realname', 'Payments', 'Atlas', 'window']) {
      assert.ok(!serialized.includes(leaked), `${leaked} must not appear in anonymized output`);
    }
    assert.equal(resolver.isAnonymizing(), true);
    assert.deepEqual(resolved.tags, ['契約社員'], 'tags are not personal data and are kept');
  });

  it('also pseudonymizes users that have no mapping entry', () => {
    const resolver = new AttributeResolver(mapping, true, { anonymizeSecret: SECRET });
    const resolved = resolver.resolve('unmapped-user');
    assert.ok(!JSON.stringify(resolved).includes('unmapped-user'));
    assert.match(resolved.login, /^dev_[0-9a-f]{16}$/);
  });

  it('is fail-closed: anonymization without a secret throws instead of emitting reversible output', () => {
    assert.throws(() => new AttributeResolver(mapping, true), PseudonymizationConfigError);
    process.env.ANONYMIZE_USERS = 'true';
    assert.throws(() => new AttributeResolver(mapping), PseudonymizationConfigError);
    assert.throws(() => new AttributeResolverAdapter(mapping), PseudonymizationConfigError);
  });

  it('reads the secret from ANONYMIZE_SECRET and does not anonymize when disabled', () => {
    process.env.ANONYMIZE_USERS = 'true';
    process.env.ANONYMIZE_SECRET = SECRET;
    const viaEnv = new AttributeResolver(mapping);
    assert.equal(viaEnv.isAnonymizing(), true);
    assert.equal(viaEnv.resolve(REAL_LOGIN).login, new Pseudonymizer(SECRET).login(REAL_LOGIN));

    delete process.env.ANONYMIZE_USERS;
    const plain = new AttributeResolver(mapping);
    assert.equal(plain.isAnonymizing(), false);
    assert.equal(plain.resolve(REAL_LOGIN).displayName, 'Alice Realname');
  });

  it('the adapter and the legacy resolver produce the same pseudonyms for the same key', () => {
    const legacy = new AttributeResolver(mapping, true, { anonymizeSecret: SECRET });
    const adapter = new AttributeResolverAdapter(mapping, true, { anonymizeSecret: SECRET });
    const v2 = adapter.resolve(REAL_LOGIN)!;
    assert.equal(v2.github_user, legacy.resolve(REAL_LOGIN).login);
    assert.equal(v2.display_name, legacy.resolve(REAL_LOGIN).displayName);
    assert.ok(!JSON.stringify(v2).includes('Alice Realname'));
    assert.equal((v2 as { notes?: string }).notes, undefined);
  });

  it('enriched seats carry no avatar_url and a pseudonymous login when anonymizing', () => {
    const resolver = new AttributeResolver(mapping, true, { anonymizeSecret: SECRET });
    const enriched = new BillingCalculator(resolver, [], '2026-09-10').enrichSeat(realSeat(), 30);
    assert.equal(enriched.avatar_url, '');
    assert.ok(!JSON.stringify(enriched).includes(REAL_LOGIN));
    assert.ok(!JSON.stringify(enriched).includes(String(REAL_ID)));
  });

  it('without anonymization the avatar is kept (behavior unchanged)', () => {
    const enriched = new BillingCalculator(new AttributeResolver(mapping), [], '2026-09-10').enrichSeat(realSeat(), 30);
    assert.equal(enriched.avatar_url, REAL_AVATAR);
  });

  it('monthly report user_details use the pseudonymous login (the CSV user name is not published)', () => {
    const resolver = new AttributeResolver(mapping, true, { anonymizeSecret: SECRET });
    const parser = new ReportParser(resolver);
    const records = parser.parseRecords(
      'date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,organization,cost_center_name\n' +
        `2026-08-01,${REAL_LOGIN},copilot,copilot_premium_request,GPT-4o,5,requests,0.03,0.15,0.00,0.15,acme-org,Platform\n`
    );
    const report = parser.aggregate(records, '2026-08', 'a.csv');
    const serialized = JSON.stringify(report);
    assert.ok(!serialized.includes(REAL_LOGIN), 'the real user name must not appear in the report output');
    assert.ok(!serialized.includes('Alice Realname'));
    assert.equal(report.user_details[0].login, new Pseudonymizer(SECRET).login(REAL_LOGIN));
  });
});

// ---------------------------------------------------------------------------
// パイプライン全体: 匿名化モードで保存されるすべての成果物に、復元可能な識別子が残らない
// ---------------------------------------------------------------------------

class SeatsOnlySource implements ICopilotDataSource {
  async fetchMetrics(): Promise<CopilotDailyMetrics[]> {
    return [];
  }
  async fetchSeats() {
    return [realSeat()];
  }
  async fetchCostCenters(): Promise<EnterpriseCostCenter[]> {
    return [
      {
        id: 'cc-1',
        name: 'Platform',
        cost_center_code: 'P',
        resources: [{ type: 'User', name: REAL_LOGIN }],
      },
    ];
  }
  async fetchCostCenterBudgets() {
    return [];
  }
  async fetchUserProfiles() {
    return [];
  }
  getIssues(): DataFetchIssue[] {
    return [];
  }
  getSourceStatuses(): SourceStatus[] {
    const base = { records: 1, last_attempt_at: '2026-09-10T00:00:00Z', last_success_at: '2026-09-10T00:00:00Z' };
    return [
      { source: 'metrics', status: 'skipped', records: 0, last_attempt_at: base.last_attempt_at, last_success_at: null },
      { source: 'seats', status: 'ok', ...base },
      { source: 'cost_centers', status: 'ok', ...base },
    ];
  }
}

class RecordingStorage implements IStorageWriter {
  outputs: unknown[] = [];
  index: IndexMetadata | null = null;
  saveRawDailyData(date: string, metrics: CopilotDailyMetrics, seats: CopilotSeatAssignment[], costCenters: EnterpriseCostCenter[]) {
    this.outputs.push({ date, metrics, seats, costCenters });
  }
  saveScopeData(_t: AnalysisScopeType, _k: string, data: ScopeAggregatedData) {
    this.outputs.push(data);
  }
  saveReportData(_m: string, data: MonthlyReportAggregatedData) {
    this.outputs.push(data);
  }
  saveDeepAnalysisArchive(_m: string, profiles: unknown) {
    this.outputs.push(profiles);
  }
  saveRolling1YearTrend(data: RollingTrendDataset) {
    this.outputs.push(data);
  }
  saveIndex(metadata: IndexMetadata) {
    this.index = metadata;
    this.outputs.push(metadata);
  }
  loadIndex() {
    return this.index;
  }
  loadScopeData() {
    return null;
  }
  saveErrorLog(issues: DataFetchIssue[]) {
    this.outputs.push(issues);
  }
  getRawReportFiles() {
    return [];
  }
  getStoredReportMonths() {
    return [];
  }
  getStoredProcessedMonths() {
    return [];
  }
  getStoredDeepAnalysisMonths() {
    return [];
  }
  saveRawReportFile() {}
}

const noopResolver: IAttributeResolver = { resolve: () => undefined, resolveAll: () => new Map(), getMappingCount: () => 0 };

describe('Pipeline in anonymization mode leaves no recoverable identifiers in any stored output (P0-11)', () => {
  const savedEnv: Record<string, string | undefined> = {};
  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 8, 10, 12) });
    for (const k of ['ANONYMIZE_USERS', 'ANONYMIZE_SECRET', 'COPILOT_USER_MAPPING']) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    mock.timers.reset();
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  async function run(storage: RecordingStorage, anonymize: boolean) {
    const orchestrator = new PipelineOrchestrator({
      dataSource: new SeatsOnlySource(),
      resolver: noopResolver,
      storage,
      isMock: false,
      anonymize,
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

  it('without anonymization the real login is present (the control)', async () => {
    const storage = new RecordingStorage();
    await run(storage, false);
    assert.ok(JSON.stringify(storage.outputs).includes(REAL_LOGIN));
  });

  it('with anonymization none of the login / user id / avatar URL / team name appears anywhere', async () => {
    process.env.ANONYMIZE_SECRET = SECRET;
    const storage = new RecordingStorage();
    await run(storage, true);

    const serialized = JSON.stringify(storage.outputs);
    assert.ok(serialized.length > 100, 'the pipeline must have produced outputs');
    for (const leaked of [REAL_LOGIN, String(REAL_ID), 'avatars.githubusercontent.com', 'Payments Squad', 'payments-squad']) {
      assert.ok(!serialized.includes(leaked), `"${leaked}" must not appear in any stored output`);
    }
    assert.ok(serialized.includes(new Pseudonymizer(SECRET).login(REAL_LOGIN)), 'the pseudonym is what remains');
  });

  it('is fail-closed: without a secret the pipeline stops before storing anything', async () => {
    const storage = new RecordingStorage();
    await assert.rejects(run(storage, true), PseudonymizationConfigError);
    assert.equal(storage.outputs.length, 0, 'nothing may be written when anonymization cannot be applied safely');
  });
});
