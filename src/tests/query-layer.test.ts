import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  queryPopulation,
  queryLiveScope,
  queryReport,
  queryFilterOptions,
  queryCapabilities,
} from '../../dashboard/src/query/index.js';
import {
  loadIndexDataset,
  loadScopeDataset,
  loadReportDataset,
  scopeCandidateUrls,
  deriveDatasetState,
} from '../../dashboard/src/dataset/datasetLoader.js';
import {
  DEFAULT_FILTER_CRITERIA,
  type EnrichedUserSeat,
  type MonthlyReportAggregatedData,
  type ReportUserDetail,
  type ScopeAggregatedData,
} from '../types/copilot.js';
import { UNASSIGNED_FILTER_SENTINEL } from '../domain/constants/unassigned.js';

const PEOPLE = [
  { login: 'user-a', cost_center: 'CC-1', organization: 'Org1', department: 'Dev', tags: ['t1'] },
  { login: 'user-b', cost_center: 'CC-1', organization: 'Org2', department: 'Ops', tags: ['t1', 't2'] },
  { login: 'user-c', cost_center: 'CC-2', organization: 'Org1', department: 'Dev', tags: [] },
  { login: 'user-d', cost_center: 'Default-CostCenter', organization: 'Org1', department: '', tags: [] },
];

function liveFixture(): ScopeAggregatedData {
  const users = PEOPLE.map(
    (p) =>
      ({
        ...p,
        display_name: p.login,
        status: 'active',
        plan_type: 'business',
        monthly_cost_usd: 19,
        prorated_daily_cost_usd: 0.63,
        created_at: '2026-01-01',
        days_inactive: 1,
      }) as unknown as EnrichedUserSeat
  );
  return {
    scope_type: 'monthly',
    scope_key: '2026-09',
    date_range: { start: '2026-09-01', end: '2026-09-30', days_count: 30 },
    overview: { total_seats: 4, active_users: 4, total_spend_usd: 76, idle_seats: 0, idle_waste_usd: 0 },
    users,
    user_profiles: [],
    daily_trends: [],
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    top_languages: [],
    cost_center_budgets: [],
  } as unknown as ScopeAggregatedData;
}

function reportFixture(): MonthlyReportAggregatedData {
  return {
    report_month: '2026-09',
    source_type: 'persisted',
    file_name: 'r.csv',
    parsed_at: '2026-10-01T00:00:00Z',
    overview: {
      total_net_spend_usd: 40,
      total_gross_spend_usd: 76,
      total_discount_usd: 36,
      total_requests: 40,
      total_active_users: 4,
      top_model: 'm',
      top_sku: 's',
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    model_breakdown: [],
    sku_breakdown: [],
    daily_trends: [],
    user_details: PEOPLE.map(
      (p) =>
        ({
          ...p,
          display_name: p.login,
          total_requests: 10,
          total_spend_usd: 19,
          gross_spend_usd: 19,
          net_spend_usd: 10,
          primary_model: 'm',
        }) as unknown as ReportUserDetail
    ),
  } as unknown as MonthlyReportAggregatedData;
}

const CONDITIONS = [
  { name: 'no filter', criteria: DEFAULT_FILTER_CRITERIA, expected: 4 },
  { name: 'cost center', criteria: { ...DEFAULT_FILTER_CRITERIA, costCenter: 'CC-1' }, expected: 2 },
  { name: 'organization', criteria: { ...DEFAULT_FILTER_CRITERIA, organization: 'Org1' }, expected: 3 },
  { name: 'group', criteria: { ...DEFAULT_FILTER_CRITERIA, group: 'Dev' }, expected: 2 },
  { name: 'tags (AND)', criteria: { ...DEFAULT_FILTER_CRITERIA, tags: ['t1', 't2'] }, expected: 1 },
  { name: 'unassigned cost center', criteria: { ...DEFAULT_FILTER_CRITERIA, costCenter: UNASSIGNED_FILTER_SENTINEL }, expected: 1 },
  { name: 'user pattern', criteria: { ...DEFAULT_FILTER_CRITERIA, userPattern: 'user-[ab]', userPatternIsRegex: true }, expected: 2 },
  { name: 'no match', criteria: { ...DEFAULT_FILTER_CRITERIA, costCenter: 'CC-404' }, expected: 0 },
];

describe('Query layer: the same condition yields the same number on every screen (P2-2)', () => {
  for (const c of CONDITIONS) {
    it(`${c.name}: population, filtered Live users and filtered Report users agree`, () => {
      const live = liveFixture();
      const report = reportFixture();

      // 画面 A (ActiveDataSelector / DataSelectionModal): 未フィルターのデータに対する該当件数
      const livePop = queryPopulation({ source: 'live_metrics', data: live }, c.criteria);
      const reportPop = queryPopulation({ source: 'monthly_report', data: report }, c.criteria);
      const uploadPop = queryPopulation({ source: 'user_upload', data: report }, c.criteria);
      // 画面 B (KPI・ユーザー明細): 再集計後のデータ
      const filteredLive = queryLiveScope(live, c.criteria);
      const filteredReport = queryReport(report, c.criteria);

      assert.equal(livePop.matched, c.expected);
      assert.equal(reportPop.matched, c.expected);
      assert.equal(uploadPop.matched, c.expected);
      assert.equal(filteredLive.users.length, c.expected);
      assert.equal(filteredReport.user_details.length, c.expected);
      assert.equal(filteredLive.overview.total_seats, c.expected, 'KPI seat count follows the same population');
      assert.equal(livePop.total, 4);
      assert.equal(livePop.filtered, c !== CONDITIONS[0]);
    });
  }

  it('population and options on missing data are empty, not an exception', () => {
    assert.deepEqual(queryPopulation({ source: 'live_metrics', data: null }, DEFAULT_FILTER_CRITERIA), {
      matched: 0,
      total: 0,
      filtered: false,
    });
    assert.deepEqual(queryFilterOptions({ source: 'monthly_report', data: null }).tags, []);
  });

  it('filter options exclude unassigned labels and are sorted', () => {
    const options = queryFilterOptions({ source: 'live_metrics', data: liveFixture() });
    assert.deepEqual(options.costCenters, ['CC-1', 'CC-2']);
    assert.deepEqual(options.organizations, ['Org1', 'Org2']);
    assert.deepEqual(options.groups, ['Dev', 'Ops']);
    assert.deepEqual(options.tags, ['t1', 't2']);
  });

  it('declares the sections that do not follow filters', () => {
    assert.ok(queryCapabilities('live_metrics').unfilterableSections.length > 0);
    assert.deepEqual([...queryCapabilities('monthly_report').unfilterableSections], ['daily_trends', 'cost_center_daily', 'sku_breakdown']);
  });
});

describe('Dataset Loader: states and fallbacks (P2-2)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function stubFetch(routes: Record<string, unknown | number>) {
    const requested: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      const hit = Object.entries(routes).find(([suffix]) => url.endsWith(suffix));
      if (!hit) return new Response('not found', { status: 404 });
      if (typeof hit[1] === 'number') return new Response('err', { status: hit[1] });
      return new Response(JSON.stringify(hit[1]), { status: 200 });
    }) as typeof fetch;
    return requested;
  }

  it('derives the state: demo wins over partial, partial over ok', () => {
    assert.equal(deriveDatasetState({ demoSourced: true, partial: true }), 'demo');
    assert.equal(deriveDatasetState({ demoSourced: false, partial: true }), 'partial');
    assert.equal(deriveDatasetState({ demoSourced: false, partial: false }), 'ok');
  });

  it('index: ok / partial / demo / failed', async () => {
    stubFetch({ 'data/index.json': { default_scopes: {}, source_status: [] } });
    assert.equal((await loadIndexDataset('./data')).state, 'ok');

    stubFetch({ 'data/index.json': { source_status: [{ source: 'metrics', status: 'failed' }] } });
    assert.equal((await loadIndexDataset('./data')).state, 'partial');

    stubFetch({ 'data/index.json': { is_mock_mode: true } });
    const demo = await loadIndexDataset('./data');
    assert.equal(demo.state, 'demo');
    assert.equal(demo.demoSourced, true);

    stubFetch({ 'data/demo/index.json': {} });
    assert.equal((await loadIndexDataset('./data/demo')).state, 'demo');

    stubFetch({});
    const failed = await loadIndexDataset('./data');
    assert.equal(failed.state, 'failed');
    assert.equal(failed.data, null);
    assert.match(failed.error ?? '', /404/);
  });

  it('scope: falls back to processed/ and never to demo data implicitly', async () => {
    const requested = stubFetch({ 'data/processed/monthly/2026-09.json': liveFixture() });
    const ok = await loadScopeDataset('./data', 'monthly', '2026-09');
    assert.equal(ok.state, 'ok');
    assert.ok(ok.url?.includes('/processed/monthly/'));
    assert.equal(requested.length, 2);

    const requested2 = stubFetch({});
    const failed = await loadScopeDataset('./data', 'monthly', '2026-09');
    assert.equal(failed.state, 'failed');
    assert.ok(requested2.every((u) => !u.includes('/demo/')), 'no silent switch to demo');
  });

  it('scope: error issues make it partial; mock declaration makes it demo; custom range is sliced', async () => {
    const withIssue = { ...liveFixture(), issues: [{ id: 'x', severity: 'error' }] };
    stubFetch({ 'data/monthly/2026-09.json': withIssue });
    assert.equal((await loadScopeDataset('./data', 'monthly', '2026-09')).state, 'partial');
    assert.equal((await loadScopeDataset('./data', 'monthly', '2026-09', { mockDeclared: true })).state, 'demo');

    stubFetch({ 'custom/custom_2026-09-01_2026-09-03.json': liveFixture() });
    const custom = await loadScopeDataset('./data', 'custom', 'custom:2026-09-01_2026-09-03');
    assert.equal(custom.data?.scope_key, 'custom:2026-09-01_2026-09-03');
  });

  it('report: ok / demo / failed', async () => {
    stubFetch({ 'reports/2026-09.json': reportFixture() });
    assert.equal((await loadReportDataset('./data', '2026-09')).state, 'ok');
    stubFetch({ 'data/demo/reports/2026-09.json': reportFixture() });
    assert.equal((await loadReportDataset('./data/demo', '2026-09')).state, 'demo');
    stubFetch({});
    assert.equal((await loadReportDataset('./data', '2026-09')).state, 'failed');
  });

  it('scopeCandidateUrls keeps the multi-tier order (direct, then processed/)', () => {
    const urls = scopeCandidateUrls('./data', 'daily', '2026-09-01');
    assert.ok(urls[0].endsWith('data/daily/2026-09-01.json'));
    assert.ok(urls[1].endsWith('data/processed/daily/2026-09-01.json'));
  });
});

describe('DuckDB-WASM is lazy-loaded, never part of the initial bundle (P2-2)', () => {
  const root = path.resolve(import.meta.dirname, '../../dashboard/src');

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
    });
  }

  it('only duckdbLoader imports @duckdb/duckdb-wasm', () => {
    const importers = sourceFiles(root).filter((f) => /@duckdb\/duckdb-wasm/.test(fs.readFileSync(f, 'utf-8')));
    assert.deepEqual(
      importers.map((f) => path.relative(root, f)),
      [path.join('query', 'duckdb', 'duckdbLoader.ts')]
    );
  });

  it('nothing statically imports duckdbLoader, and the Query index does not re-export it', () => {
    for (const f of sourceFiles(root)) {
      const text = fs.readFileSync(f, 'utf-8');
      const staticImport = /^\s*(import|export)\b[^;]*from\s+['"][^'"]*duckdbLoader['"]/m.test(text);
      assert.equal(staticImport, false, `${path.relative(root, f)} statically imports the DuckDB loader`);
    }
  });
});

describe('Views use the Query layer instead of counting users themselves (P2-2)', () => {
  const root = path.resolve(import.meta.dirname, '../../dashboard/src');
  for (const file of ['components/layout/ActiveDataSelector.tsx', 'components/layout/DataSelectionModal.tsx']) {
    it(`${file} gets its counts from queryPopulation`, () => {
      const text = fs.readFileSync(path.join(root, file), 'utf-8');
      assert.match(text, /queryPopulation\(/);
      assert.doesNotMatch(text, /matchUserWithCriteria/);
      assert.doesNotMatch(text, /\.users\.length|\.user_details\.length/);
    });
  }
});
