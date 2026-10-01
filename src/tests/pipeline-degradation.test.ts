import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import * as assert from 'node:assert/strict';
import { PipelineOrchestrator } from '../application/pipeline/PipelineOrchestrator.js';
import { ICopilotDataSource } from '../domain/ports/ICopilotDataSource.js';
import { IAttributeResolver } from '../domain/ports/IAttributeResolver.js';
import { IStorageWriter } from '../domain/ports/IStorageWriter.js';
import {
  AnalysisScopeType,
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  DataFetchIssue,
  DataSourceId,
  EnterpriseCostCenter,
  IndexMetadata,
  MonthlyReportAggregatedData,
  RollingTrendDataset,
  ScopeAggregatedData,
  SourceStatus,
  UserUsageProfile,
} from '../domain/entities/copilot.js';

// ---------------------------------------------------------------------------
// フィクスチャ
// ---------------------------------------------------------------------------

function seat(login: string, overrides: Partial<CopilotSeatAssignment> = {}): CopilotSeatAssignment {
  return {
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    pending_cancellation_date: null,
    last_activity_at: '2026-09-09T00:00:00Z',
    last_activity_editor: 'vscode',
    plan_type: 'business',
    assignee: { login, id: 1, avatar_url: '', html_url: '', type: 'User' },
    organization: { login: 'acme-org', id: 1 },
    ...overrides,
  };
}

function metric(date: string): CopilotDailyMetrics {
  return {
    date,
    total_active_users: 10,
    total_engaged_users: 8,
    copilot_ide_code_completions: {
      total_engaged_users: 8,
      languages: [
        {
          name: 'typescript',
          total_engaged_users: 8,
          total_code_suggestions: 100,
          total_code_acceptances: 30,
          total_code_lines_suggested: 400,
          total_code_lines_accepted: 120,
        },
      ],
      editors: [{ name: 'vscode', total_engaged_users: 8 }],
    },
    copilot_ide_chat: {
      total_engaged_users: 6,
      total_chats: 50,
      total_chat_copy_events: 5,
      total_chat_insertion_events: 5,
      models: [{ name: 'gpt-4o', total_chats: 50 }],
    },
    copilot_dotcom_chat: { total_engaged_users: 0, total_chats: 0 },
    copilot_dotcom_pull_requests: { total_engaged_users: 2, total_pr_summaries_created: 3 },
    copilot_in_cli: { total_engaged_users: 0, total_cli_completions: 0 },
  };
}

function status(source: DataSourceId, s: SourceStatus['status'], records: number, error?: string): SourceStatus {
  return {
    source,
    status: s,
    records,
    last_attempt_at: '2026-09-10T00:00:00.000Z',
    last_success_at: s === 'ok' || s === 'partial' ? '2026-09-10T00:00:00.000Z' : null,
    ...(error ? { error } : {}),
  };
}

class FakeDataSource implements ICopilotDataSource {
  constructor(
    private readonly data: {
      metrics?: CopilotDailyMetrics[];
      seats?: CopilotSeatAssignment[];
      costCenters?: EnterpriseCostCenter[];
      statuses: SourceStatus[];
      issues?: DataFetchIssue[];
      profiles?: UserUsageProfile[];
    }
  ) {}
  async fetchMetrics() {
    return this.data.metrics ?? [];
  }
  async fetchSeats() {
    return this.data.seats ?? [];
  }
  async fetchCostCenters() {
    return this.data.costCenters ?? [];
  }
  async fetchCostCenterBudgets() {
    return [];
  }
  async fetchUserProfiles(): Promise<UserUsageProfile[]> {
    return this.data.profiles ?? [];
  }
  getIssues() {
    return this.data.issues ?? [];
  }
  getSourceStatuses() {
    return this.data.statuses;
  }
}

const emptyResolver: IAttributeResolver = {
  resolve: () => undefined,
  resolveAll: () => new Map(),
  getMappingCount: () => 0,
};

class MemoryStorage implements IStorageWriter {
  index: IndexMetadata | null = null;
  scopes = new Map<string, ScopeAggregatedData>();
  errorLog: DataFetchIssue[] = [];
  rawSaves: Array<{ date: string; seats: CopilotSeatAssignment[]; costCenters: EnterpriseCostCenter[] }> = [];
  trend: RollingTrendDataset | null = null;

  saveRawDailyData(date: string, _m: CopilotDailyMetrics, seats: CopilotSeatAssignment[], costCenters: EnterpriseCostCenter[]) {
    this.rawSaves.push({ date, seats, costCenters });
  }
  saveScopeData(scopeType: AnalysisScopeType, key: string, data: ScopeAggregatedData) {
    this.scopes.set(`${scopeType}:${key}`, data);
  }
  saveReportData(_month: string, _data: MonthlyReportAggregatedData) {}
  archives: Array<{ month: string; profiles: UserUsageProfile[] }> = [];
  saveDeepAnalysisArchive(month: string, profiles: UserUsageProfile[]) {
    this.archives.push({ month, profiles });
  }
  saveRolling1YearTrend(data: RollingTrendDataset) {
    this.trend = data;
  }
  saveIndex(metadata: IndexMetadata) {
    this.index = metadata;
  }
  loadIndex() {
    return this.index;
  }
  loadScopeData(scopeType: AnalysisScopeType, key: string) {
    return this.scopes.get(`${scopeType}:${key}`) ?? null;
  }
  saveErrorLog(issues: DataFetchIssue[]) {
    this.errorLog = issues;
  }
  getRawReportFiles() {
    return [];
  }
  getStoredReportMonths() {
    return [];
  }
  getStoredProcessedMonths() {
    return Array.from(this.scopes.keys())
      .filter((k) => k.startsWith('monthly:'))
      .map((k) => k.slice('monthly:'.length))
      .sort()
      .reverse();
  }
  getStoredDeepAnalysisMonths() {
    return [];
  }
  saveRawReportFile() {}
}

const ENV_KEYS = [
  'ANONYMIZE_USERS',
  'ANONYMIZE_SECRET',
  'COPILOT_USER_MAPPING',
  'COPILOT_USER_MAPPING_BASE64',
  'COPILOT_USER_MAPPING_FILE',
  'COPILOT_COST_CENTER_BUDGETS',
  'COPILOT_BILLING_CONFIG',
] as const;

async function runPipeline(
  source: ICopilotDataSource,
  storage: MemoryStorage,
  opts: { isMock?: boolean; anonymize?: boolean } = {}
) {
  const orchestrator = new PipelineOrchestrator({
    dataSource: source,
    resolver: emptyResolver,
    storage,
    isMock: opts.isMock ?? false,
    anonymize: opts.anonymize ?? false,
  });
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    await orchestrator.run();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

const SEATS = [seat('alice'), seat('bob'), seat('carol', { last_activity_at: '2026-07-01T00:00:00Z' })];
const METRICS = [metric('2026-09-09'), metric('2026-09-10')];

describe('PipelineOrchestrator: per-source degradation (P0-3)', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    // メトリクスが取得できない回の「当月」は現在時刻から決まる。時刻を固定してテストを決定的にする
    mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 8, 10, 12, 0, 0) });
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    mock.timers.reset();
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('all sources healthy: records ok statuses, writes daily/monthly/custom scopes and is_mock_mode: false', async () => {
    const storage = new MemoryStorage();
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats: SEATS,
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 3), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );

    assert.ok(storage.index);
    assert.equal(storage.index!.is_mock_mode, false, 'real data must never be flagged as demo');
    assert.deepEqual(storage.index!.source_status?.map((s) => `${s.source}:${s.status}`), [
      'metrics:ok',
      'seats:ok',
      'cost_centers:skipped',
    ]);
    assert.equal(storage.index!.summary.total_seats, 3);
    assert.ok(storage.scopes.has('daily:2026-09-10'));
    assert.ok(storage.scopes.has('monthly:2026-09'));
    assert.ok(storage.scopes.has('custom:latest-30d'));
    assert.equal(storage.scopes.get('monthly:2026-09')!.overview.overall_acceptance_rate, 0.3);
  });

  it('metrics failed, seats ok: seat / cost analysis still runs and usage metrics are reported as unavailable (null, not 0)', async () => {
    const storage = new MemoryStorage();
    await runPipeline(
      new FakeDataSource({
        metrics: [],
        seats: SEATS,
        statuses: [
          status('metrics', 'failed', 0, 'HTTP 500 from /enterprises/acme/copilot/metrics'),
          status('seats', 'ok', 3),
          status('cost_centers', 'skipped', 0),
        ],
      }),
      storage
    );

    const index = storage.index!;
    assert.equal(index.is_mock_mode, false, 'a failed collection must not flip the data to demo');
    assert.equal(index.summary.total_seats, 3, 'seat analysis must not depend on usage metrics');
    assert.equal(index.source_status?.find((s) => s.source === 'metrics')?.status, 'failed');
    assert.equal(index.source_status?.find((s) => s.source === 'seats')?.status, 'ok');

    const monthly = storage.scopes.get('monthly:2026-09')!;
    assert.equal(monthly.overview.total_seats, 3);
    assert.equal(monthly.overview.overall_acceptance_rate, null, 'missing usage must be null, not 0%');
    assert.equal(monthly.overview.total_chats, null);
    assert.equal(monthly.usage_metrics?.availability, 'unavailable');
    assert.ok(!storage.scopes.has('daily:2026-09-10'), 'no daily scope is fabricated without metrics');
  });

  it('metrics failed after a good run: carries the last-known-good usage forward and labels it as such', async () => {
    const storage = new MemoryStorage();
    // 1 回目: 全ソース成功
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats: SEATS,
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 3), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );
    const firstSuccessAt = storage.index!.source_status!.find((s) => s.source === 'metrics')!.last_success_at;
    assert.ok(firstSuccessAt);

    // 2 回目: metrics が失敗
    await runPipeline(
      new FakeDataSource({
        metrics: [],
        seats: SEATS,
        statuses: [status('metrics', 'failed', 0, 'HTTP 503'), status('seats', 'ok', 3), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );

    const monthly = storage.scopes.get('monthly:2026-09')!;
    assert.equal(monthly.overview.overall_acceptance_rate, 0.3, 'last-known-good usage must be kept');
    assert.equal(monthly.usage_metrics?.availability, 'carried_over');
    assert.ok(monthly.usage_metrics?.as_of, 'the carried-over value must say when it was measured');

    const metricsStatus = storage.index!.source_status!.find((s) => s.source === 'metrics')!;
    assert.equal(metricsStatus.status, 'failed');
    assert.equal(metricsStatus.last_success_at, firstSuccessAt, 'last_success_at must point to the last successful run');
    assert.ok(storage.scopes.has('daily:2026-09-10'), 'previous daily scopes are kept, not deleted');
    assert.deepEqual(storage.index!.available_days, ['2026-09-10', '2026-09-09']);
  });

  it('seats failed: never overwrites the previous seat analysis with an empty one', async () => {
    const storage = new MemoryStorage();
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats: SEATS,
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 3), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );
    const previousMonthly = storage.scopes.get('monthly:2026-09')!;
    const previousSummary = storage.index!.summary;

    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats: [],
        statuses: [status('metrics', 'ok', 2), status('seats', 'failed', 0, 'HTTP 502'), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );

    assert.equal(storage.scopes.get('monthly:2026-09'), previousMonthly, 'the monthly scope must not be replaced by an empty seat list');
    assert.deepEqual(storage.index!.summary, previousSummary, 'the seat summary must be carried over');
    assert.equal(storage.index!.source_status?.find((s) => s.source === 'seats')?.status, 'failed');
  });

  it('all sources failed: keeps the previous artifacts, reports every failure, and is not demo', async () => {
    const storage = new MemoryStorage();
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats: SEATS,
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 3), status('cost_centers', 'ok', 1)],
      }),
      storage
    );
    const previousSummary = storage.index!.summary;

    await runPipeline(
      new FakeDataSource({
        statuses: [
          status('metrics', 'failed', 0, 'HTTP 401'),
          status('seats', 'failed', 0, 'HTTP 401'),
          status('cost_centers', 'failed', 0, 'HTTP 401'),
        ],
        issues: [
          {
            id: 'i1',
            timestamp: '2026-09-11T00:00:00Z',
            severity: 'error',
            category: 'api_auth',
            target: 'copilot/metrics',
            message: 'unauthorized',
          },
        ],
      }),
      storage
    );

    const index = storage.index!;
    assert.equal(index.is_mock_mode, false);
    assert.deepEqual(
      index.source_status?.map((s) => s.status),
      ['failed', 'failed', 'failed']
    );
    assert.ok(index.source_status!.every((s) => s.last_success_at !== null), 'every failed source keeps its last success time');
    assert.deepEqual(index.summary, previousSummary, 'a total outage must not zero out the seat summary');
    assert.ok(index.available_months.includes('2026-09'), 'previously collected months stay available');
    assert.equal(storage.errorLog.length >= 1, true, 'the failure is visible in the error log');
  });

  it('first run with nothing collected: empty (not demo, not fabricated) and every source has no success time', async () => {
    const storage = new MemoryStorage();
    await runPipeline(
      new FakeDataSource({
        statuses: [
          status('metrics', 'skipped', 0),
          status('seats', 'skipped', 0),
          status('cost_centers', 'skipped', 0),
        ],
      }),
      storage
    );
    const index = storage.index!;
    assert.equal(index.is_mock_mode, false);
    assert.equal(index.summary.total_seats, 0);
    assert.deepEqual(index.available_days, []);
    assert.ok(index.source_status!.every((s) => s.last_success_at === null));
  });

  it('is_mock_mode is true only when the pipeline itself is in MOCK_MODE', async () => {
    const storage = new MemoryStorage();
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats: SEATS,
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 3), status('cost_centers', 'ok', 0)],
      }),
      storage,
      { isMock: true }
    );
    assert.equal(storage.index!.is_mock_mode, true);
  });

  it('records an invalid COPILOT_BILLING_CONFIG as an issue visible in the error log / header (P0-8)', async () => {
    process.env.COPILOT_BILLING_CONFIG = '{"currency": {"code": "JPY"';
    const storage = new MemoryStorage();
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats: SEATS,
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 3), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );

    const configIssue = storage.errorLog.find((i) => i.target === 'config:COPILOT_BILLING_CONFIG');
    assert.ok(configIssue, 'a misconfiguration must not silently fall back to defaults');
    assert.equal(configIssue!.severity, 'error');
    assert.ok(!JSON.stringify(configIssue).includes('JPY'), 'the config value itself must not be echoed');
    assert.ok(storage.index!.issues?.some((i) => i.target === 'config:COPILOT_BILLING_CONFIG'), 'the issue reaches index.json (header count)');
  });

  it('records an unparsable COPILOT_COST_CENTER_BUDGETS as an issue', async () => {
    process.env.COPILOT_COST_CENTER_BUDGETS = 'not json';
    const storage = new MemoryStorage();
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats: SEATS,
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 3), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );
    assert.ok(storage.errorLog.some((i) => i.target === 'config:COPILOT_COST_CENTER_BUDGETS'));
  });
});

describe('PipelineOrchestrator: seat classification and unconfirmed cost (P0-9 / P0-5)', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    // メトリクスが取得できない回の「当月」は現在時刻から決まる。時刻を固定してテストを決定的にする
    mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 8, 10, 12, 0, 0) });
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    mock.timers.reset();
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('a seat granted 2 days ago and never used is "onboarding", not idle (no savings counted)', async () => {
    const storage = new MemoryStorage();
    const seats = [
      seat('veteran'),
      seat('newcomer', { created_at: '2026-09-08T00:00:00Z', last_activity_at: null }),
    ];
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats,
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 2), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );

    const monthly = storage.scopes.get('monthly:2026-09')!;
    const newcomer = monthly.users.find((u) => u.login === 'newcomer')!;
    assert.equal(newcomer.status, 'onboarding');
    assert.equal(monthly.overview.idle_seats, 0);
    assert.equal(monthly.overview.idle_waste_usd, 0);
    assert.equal(monthly.overview.onboarding_seats, 1);
    assert.equal(storage.index!.summary.idle_seats_30d, 0);
  });

  it('plan_type: unknown has an unconfirmed (excluded) cost instead of being billed as enterprise', async () => {
    const storage = new MemoryStorage();
    const seats = [seat('known', { plan_type: 'business' }), seat('mystery', { plan_type: 'unknown' })];
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats,
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 2), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );

    const monthly = storage.scopes.get('monthly:2026-09')!;
    const mystery = monthly.users.find((u) => u.login === 'mystery')!;
    assert.equal(mystery.cost_unconfirmed, true);
    assert.equal(mystery.monthly_cost_usd, 0);
    assert.equal(monthly.overview.total_spend_usd, 19, 'only the confirmed business seat ($19) is billed');
    assert.equal(monthly.overview.cost_unconfirmed_seats, 1);
    assert.equal(storage.index!.summary.cost_unconfirmed_seats, 1);
  });

  it('the credits unit price is the catalog $0.01 on every path (summary == per-seat sum)', async () => {
    const storage = new MemoryStorage();
    const seats = [seat('heavy', { ai_credits_used: 1000 }), seat('light', { ai_credits_used: 250 })];
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats,
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 2), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );
    const summary = storage.index!.summary;
    assert.equal(summary.total_ai_credits_used, 1250);
    assert.equal(summary.total_ai_credits_cost_usd, 12.5, '1,250 credits x $0.01 (not $0.05)');
  });
});

describe('PipelineOrchestrator: measured per-user profiles for live data (P1-1)', () => {
  beforeEach(() => mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 8, 10, 12, 0, 0) }));
  afterEach(() => mock.timers.reset());

  function reportProfile(login: string, date: string): UserUsageProfile {
    return {
      login,
      display_name: login,
      avatar_url: '',
      department: '',
      cost_center: '',
      organization: '',
      plan_type: 'unknown',
      total_chats: 12,
      total_suggestions: 100,
      total_acceptances: 30,
      acceptance_rate: 0.3,
      total_cost_usd: 0.02,
      model_usage_totals: { 'gpt-5': 12 },
      daily_history: [
        {
          date,
          total_chats: 12,
          model_breakdown: { 'gpt-5': 12 },
          suggestions: 100,
          acceptances: 30,
          lines_suggested: 400,
          lines_accepted: 120,
          acceptance_rate: 0.3,
          daily_cost_usd: 0.02,
        },
      ],
    };
  }

  it('enriches the measured profiles with the seat (plan, organization) and publishes them with the scopes and the archive', async () => {
    const storage = new MemoryStorage();
    await runPipeline(
      new FakeDataSource({
        metrics: METRICS,
        seats: SEATS,
        profiles: [reportProfile('alice', '2026-09-10'), reportProfile('stranger', '2026-09-10')],
        statuses: [status('metrics', 'ok', 2), status('seats', 'ok', 3), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );

    const monthly = storage.scopes.get('monthly:2026-09')!;
    const profiles = monthly.user_profiles ?? [];
    assert.deepEqual(profiles.map((p) => p.login).sort(), ['alice', 'stranger']);
    const alice = profiles.find((p) => p.login === 'alice')!;
    assert.equal(alice.plan_type, 'business', 'the plan comes from the seat');
    assert.equal(alice.organization, 'acme-org');
    assert.equal(profiles.find((p) => p.login === 'stranger')!.plan_type, 'unknown', 'no seat: the plan stays unconfirmed');
    assert.equal(storage.archives.length, 1);
    assert.equal(storage.archives[0].month, '2026-09');
  });

  it('publishes no profiles (and no archive) when the usage metrics failed', async () => {
    const storage = new MemoryStorage();
    await runPipeline(
      new FakeDataSource({
        metrics: [],
        seats: SEATS,
        profiles: [],
        statuses: [status('metrics', 'failed', 0, 'HTTP 500'), status('seats', 'ok', 3), status('cost_centers', 'skipped', 0)],
      }),
      storage
    );
    assert.equal(storage.archives.length, 0);
  });
});
