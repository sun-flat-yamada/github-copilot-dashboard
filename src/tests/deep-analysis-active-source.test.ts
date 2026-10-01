import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MonthlyReportAggregatedData,
  ReportDailyTrend,
  ReportUserDetail,
  ScopeAggregatedData,
  UserUsageProfile,
} from '../types/copilot.js';
import { resolveDeepAnalysisProfiles } from '../../dashboard/src/hooks/useDeepAnalysisData.js';
import { InefficiencyDiagnosticEngine } from '../processor/inefficiency-diagnostic.js';

/** 実測の日次履歴を持つプロファイル (テスト用の固定データ) */
function buildProfile(login: string, tags: string[], dates: string[]): UserUsageProfile {
  const daily_history = dates.map((date) => ({
    date,
    total_chats: 10,
    model_breakdown: { 'claude-3-7-sonnet': 6, 'gpt-4o': 4 },
    suggestions: 40,
    acceptances: 14,
    lines_suggested: 320,
    lines_accepted: 112,
    acceptance_rate: 0.35,
    daily_cost_usd: 1.5,
  }));
  return {
    login,
    display_name: login,
    avatar_url: '',
    department: 'Frontend Engineering',
    cost_center: 'CC-DEV-101',
    organization: 'proud-org',
    plan_type: 'enterprise',
    total_chats: 10 * dates.length,
    total_suggestions: 40 * dates.length,
    total_acceptances: 14 * dates.length,
    acceptance_rate: 0.35,
    total_cost_usd: 1.5 * dates.length,
    model_usage_totals: { 'claude-3-7-sonnet': 6 * dates.length, 'gpt-4o': 4 * dates.length },
    daily_history,
    tags,
  };
}

describe('Deep Analysis Multi-Source Resolution & Diagnostics', () => {
  const mockDailyTrends: ReportDailyTrend[] = [
    { date: '2026-08-03', requests: 100, spend_usd: 5.0, active_users: 2 },
    { date: '2026-08-04', requests: 200, spend_usd: 10.0, active_users: 2 },
    { date: '2026-08-05', requests: 100, spend_usd: 5.0, active_users: 2 },
  ];

  const mockUserDetails: ReportUserDetail[] = [
    {
      login: 'dev-alice',
      display_name: 'Alice Dev',
      department: 'Frontend Engineering',
      cost_center: 'CC-DEV-101',
      organization: 'proud-org',
      total_requests: 300,
      total_spend_usd: 15.0,
      net_spend_usd: 15.0,
      primary_model: 'Claude 3.7 Sonnet',
      last_activity_date: '2026-08-05',
      surface: 'VS Code',
      tags: ['Frontend', 'Senior'],
    },
    {
      login: 'dev-bob',
      display_name: 'Bob Infra',
      department: 'Infrastructure',
      cost_center: 'CC-INFRA-202',
      organization: 'proud-org',
      total_requests: 100,
      total_spend_usd: 5.0,
      net_spend_usd: 5.0,
      primary_model: 'o1',
      last_activity_date: '2026-08-04',
      surface: 'VS Code',
      tags: ['Infra'],
    },
  ];

  const mockReportData: MonthlyReportAggregatedData = {
    report_month: '2026-08',
    source_type: 'persisted',
    file_name: 'monthly_report_2026-08.csv',
    parsed_at: '2026-08-31T23:59:59Z',
    overview: {
      total_net_spend_usd: 20.0,
      total_gross_spend_usd: 20.0,
      total_discount_usd: 0,
      total_requests: 400,
      total_active_users: 2,
      top_model: 'Claude 3.7 Sonnet',
      top_sku: 'copilot_business',
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    model_breakdown: [],
    sku_breakdown: [],
    daily_trends: mockDailyTrends,
    user_details: mockUserDetails,
  };

  const baseParams = {
    selectedReportMonth: '2026-08',
    archiveData: null,
    currentData: null,
    currentReportData: null,
    uploadedData: null,
    selectedTags: [] as string[],
  };

  it('does not synthesize per-user profiles from a monthly report (aggregated CSV has no per-user daily data)', () => {
    // 以前は全員の受諾率 35%・組織全体の日次形状で個人の日次履歴を合成し、個人の健全度スコアを算出していた
    const adapterPath = path.resolve('dashboard/src/utils/deepAnalysisAdapter.ts');
    assert.ok(!fs.existsSync(adapterPath), 'the synthesizing adapter must be removed');

    const resolved = resolveDeepAnalysisProfiles({
      ...baseParams,
      activeSource: 'monthly_report',
      currentReportData: mockReportData,
    });
    assert.deepStrictEqual(resolved.profiles, []);
    assert.strictEqual(resolved.sourceInfo.sourceType, 'monthly_report');
    assert.strictEqual(resolved.sourceInfo.isEstimated, false);
    assert.match(resolved.sourceInfo.label, /日次診断不可/);
    assert.match(resolved.sourceInfo.details ?? '', /日次/);
    assert.strictEqual(resolved.sourceInfo.totalUsers, 2);
    assert.strictEqual(resolved.sourceInfo.filteredUsers, 0);
  });

  it('does not synthesize profiles for uploaded CSV data either', () => {
    const resolved = resolveDeepAnalysisProfiles({
      ...baseParams,
      activeSource: 'user_upload',
      uploadedData: mockReportData,
    });
    assert.deepStrictEqual(resolved.profiles, []);
    assert.match(resolved.sourceInfo.label, /日次診断不可/);
    assert.ok(resolved.sourceInfo.details);
  });

  it('uses a stored monthly archive only when it actually holds per-user profiles', () => {
    const alice = buildProfile('dev-alice', ['Frontend', 'Senior'], ['2026-08-03', '2026-08-04']);
    const bob = buildProfile('dev-bob', ['Infra'], ['2026-08-03']);
    const resolved = resolveDeepAnalysisProfiles({
      ...baseParams,
      activeSource: 'monthly_report',
      currentReportData: mockReportData,
      archiveData: { month: '2026-08', generated_at: '2026-08-31T23:59:59Z', user_profiles: [alice, bob] },
    });
    assert.strictEqual(resolved.profiles.length, 2);
    assert.strictEqual(resolved.sourceInfo.totalUsers, 2);
    assert.strictEqual(resolved.sourceInfo.details, undefined);

    // 空のアーカイブは「実測あり」とは扱わず、月次集計のみとして扱う
    const emptyArchive = resolveDeepAnalysisProfiles({
      ...baseParams,
      activeSource: 'monthly_report',
      currentReportData: mockReportData,
      archiveData: { month: '2026-08', generated_at: '2026-08-31T23:59:59Z', user_profiles: [] },
    });
    assert.deepStrictEqual(emptyArchive.profiles, []);
  });

  it('correctly applies tag AND filtering to measured profiles', () => {
    const alice = buildProfile('dev-alice', ['Frontend', 'Senior'], ['2026-08-03']);
    const bob = buildProfile('dev-bob', ['Infra'], ['2026-08-03']);
    const live = { scope_key: '2026-08', users: [{}, {}], user_profiles: [alice, bob] } as unknown as ScopeAggregatedData;

    const frontend = resolveDeepAnalysisProfiles({
      ...baseParams,
      activeSource: 'live_metrics',
      currentData: live,
      selectedTags: ['Frontend'],
    });
    assert.strictEqual(frontend.profiles.length, 1);
    assert.strictEqual(frontend.profiles[0].login, 'dev-alice');

    const nonExistent = resolveDeepAnalysisProfiles({
      ...baseParams,
      activeSource: 'live_metrics',
      currentData: live,
      selectedTags: ['Frontend', 'Infra'],
    });
    assert.strictEqual(nonExistent.profiles.length, 0);
  });

  it('explains why diagnostics are unavailable when live data has seats but no per-user usage profiles', () => {
    const live = { scope_key: '2026-09', users: [{}, {}, {}], user_profiles: [] } as unknown as ScopeAggregatedData;
    const resolved = resolveDeepAnalysisProfiles({ ...baseParams, activeSource: 'live_metrics', currentData: live });
    assert.deepStrictEqual(resolved.profiles, []);
    assert.ok(resolved.sourceInfo.details, 'a reason must be shown instead of an empty or fabricated diagnosis');
  });

  it('runs InefficiencyDiagnosticEngine successfully on measured profiles without errors or NaN', () => {
    const profiles = [
      buildProfile('dev-alice', ['Frontend'], ['2026-08-03', '2026-08-04', '2026-08-05']),
      buildProfile('dev-bob', ['Infra'], ['2026-08-03', '2026-08-04']),
    ];
    const alice = profiles[0];

    const result = InefficiencyDiagnosticEngine.diagnoseUser(alice, '30d', undefined, profiles);

    assert.ok(result);
    assert.strictEqual(result.user.login, 'dev-alice');
    assert.ok(!isNaN(result.healthScore));
    assert.ok(result.healthScore >= 0 && result.healthScore <= 100);
    assert.ok(['healthy', 'warning', 'critical'].includes(result.healthStatus));
    assert.strictEqual(result.patterns.length, 9);
    assert.strictEqual(result.patternCount, 9);

    // 各パターンの確率が 0-100 の範囲内であること
    for (const pattern of result.patterns) {
      assert.ok(!isNaN(pattern.probabilityPercent));
      assert.ok(pattern.probabilityPercent >= 0 && pattern.probabilityPercent <= 100);
      assert.ok(['high', 'medium', 'low', 'healthy'].includes(pattern.riskLevel));
    }
  });

  it('marks patterns that need unmeasured Agent / PR data as not evaluable instead of assuming fixed ratios', () => {
    // Agent セッション・PR の実測が無いプロファイル。以前は完了率 70%・PR 作成率 10%・マージ 60 分などの
    // 固定比率で補って「兆候なし」と判定していた。
    const profiles = [buildProfile('dev-alice', ['Frontend'], ['2026-08-03', '2026-08-04'])];
    const result = InefficiencyDiagnosticEngine.diagnoseUser(profiles[0], '30d', undefined, profiles);

    const agentAbandonment = result.patterns.find((p) => p.id === 'agent_abandonment');
    const reviewBypass = result.patterns.find((p) => p.id === 'review_bypass');
    assert.strictEqual(agentAbandonment?.evaluable, false);
    assert.ok(agentAbandonment?.insufficientDataReason);
    assert.strictEqual(reviewBypass?.evaluable, false);
    assert.ok(reviewBypass?.insufficientDataReason);

    assert.ok(result.evaluatedPatternCount < result.patternCount);
    assert.strictEqual(
      result.evaluatedPatternCount,
      result.patterns.filter((p) => p.evaluable !== false).length
    );
  });

  it('does not report a peer-average comparison when there is nothing to compare against', () => {
    // 比較対象のプロファイルが無いとき、旧実装は受諾率 34.7% / 18.5 件/日 / o1 比率 12.0% の固定値を返していた
    const alice = buildProfile('dev-alice', ['Frontend'], ['2026-08-03', '2026-08-04']);
    const result = InefficiencyDiagnosticEngine.diagnoseUser(alice, '30d', undefined, []);
    assert.deepStrictEqual(result.drilldown.peerBenchmarks, []);
  });

  it('verifies custom date range filtering in InefficiencyDiagnosticEngine', () => {
    const profiles = [buildProfile('dev-alice', ['Frontend'], ['2026-08-03', '2026-08-04', '2026-08-05'])];
    const alice = profiles[0];

    // 2026-08-04 〜 2026-08-04 の1日のみ指定
    const customResult = InefficiencyDiagnosticEngine.diagnoseUser(
      alice,
      'custom',
      { start: '2026-08-04', end: '2026-08-04' },
      profiles
    );

    assert.ok(customResult);
    assert.strictEqual(customResult.period.scopeType, 'custom');
    assert.strictEqual(customResult.period.startDate, '2026-08-04');
    assert.strictEqual(customResult.period.endDate, '2026-08-04');
    assert.strictEqual(customResult.period.totalDays, 1);
  });

  it('verifies user navigation logic (index boundary and prev/next)', () => {
    const userLogins = ['dev-alice', 'dev-bob', 'dev-charlie'];

    // 1人目 (先頭)
    let currentIndex = userLogins.indexOf('dev-alice');
    let canGoPrev = currentIndex > 0;
    let canGoNext = currentIndex >= 0 && currentIndex < userLogins.length - 1;
    assert.strictEqual(canGoPrev, false);
    assert.strictEqual(canGoNext, true);
    assert.strictEqual(userLogins[currentIndex + 1], 'dev-bob');

    // 2人目 (中間)
    currentIndex = userLogins.indexOf('dev-bob');
    canGoPrev = currentIndex > 0;
    canGoNext = currentIndex >= 0 && currentIndex < userLogins.length - 1;
    assert.strictEqual(canGoPrev, true);
    assert.strictEqual(canGoNext, true);
    assert.strictEqual(userLogins[currentIndex - 1], 'dev-alice');
    assert.strictEqual(userLogins[currentIndex + 1], 'dev-charlie');

    // 3人目 (末尾)
    currentIndex = userLogins.indexOf('dev-charlie');
    canGoPrev = currentIndex > 0;
    canGoNext = currentIndex >= 0 && currentIndex < userLogins.length - 1;
    assert.strictEqual(canGoPrev, true);
    assert.strictEqual(canGoNext, false);
    assert.strictEqual(userLogins[currentIndex - 1], 'dev-bob');
  });

  it('verifies UserPeriodControls component contains user navigation and fixed custom period triggers', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const userPeriodControlsPath = path.resolve('dashboard/src/components/deep-analysis/UserPeriodControls.tsx');
    assert.ok(fs.existsSync(userPeriodControlsPath), 'UserPeriodControls.tsx exists');

    const content = fs.readFileSync(userPeriodControlsPath, 'utf-8');
    // 左右送り関連要素
    assert.ok(content.includes('ChevronLeft'), 'includes ChevronLeft icon');
    assert.ok(content.includes('ChevronRight'), 'includes ChevronRight icon');
    assert.ok(content.includes('canGoPrev'), 'calculates canGoPrev boundary');
    assert.ok(content.includes('canGoNext'), 'calculates canGoNext boundary');
    assert.ok(content.includes('handlePrevUser'), 'defines handlePrevUser handler');
    assert.ok(content.includes('handleNextUser'), 'defines handleNextUser handler');

    // 期間指定クリック時の連動
    assert.ok(content.includes('handleCustomScopeClick'), 'defines handleCustomScopeClick handler');
    assert.ok(content.includes("onSelectPeriodScope('custom')"), "sets scope to 'custom' on period button click");
  });

  it('verifies DeepAnalysisView prevents initialSelectedLogin rollback and supports onSelectLogin', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const deepAnalysisViewPath = path.resolve('dashboard/src/components/DeepAnalysisView.tsx');
    assert.ok(fs.existsSync(deepAnalysisViewPath), 'DeepAnalysisView.tsx exists');

    const content = fs.readFileSync(deepAnalysisViewPath, 'utf-8');
    assert.ok(content.includes('prevInitialSelectedLoginRef'), 'uses prevInitialSelectedLoginRef to guard against unwanted rollbacks');
    assert.ok(content.includes('onSelectLogin?: (login: string) => void'), 'supports onSelectLogin prop in interface');
    assert.ok(content.includes('handleSelectLogin'), 'defines handleSelectLogin');
  });
});
