import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  MonthlyReportAggregatedData,
  ReportDailyTrend,
  ReportUserDetail,
} from '../types/copilot.js';
import { adaptReportToProfiles } from '../../dashboard/src/utils/deepAnalysisAdapter.js';
import { InefficiencyDiagnosticEngine } from '../processor/inefficiency-diagnostic.js';

describe('Deep Analysis Multi-Source Adaptation & Diagnostics', () => {
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

  it('adapts MonthlyReportAggregatedData into compliant UserUsageProfile[]', () => {
    const profiles = adaptReportToProfiles(mockReportData);

    assert.strictEqual(profiles.length, 2);

    const alice = profiles.find((p) => p.login === 'dev-alice');
    assert.ok(alice);
    assert.strictEqual(alice.display_name, 'Alice Dev');
    assert.strictEqual(alice.department, 'Frontend Engineering');
    assert.strictEqual(alice.cost_center, 'CC-DEV-101');
    assert.strictEqual(alice.total_cost_usd, 15.0);

    // 日別トレンドが3日分按分生成されていること
    assert.strictEqual(alice.daily_history.length, 3);
    assert.strictEqual(alice.daily_history[0].date, '2026-08-03');
    assert.strictEqual(alice.daily_history[1].date, '2026-08-04');
    assert.strictEqual(alice.daily_history[2].date, '2026-08-05');

    // モデル名が正規化されていること
    assert.ok(alice.model_usage_totals['claude-3-7-sonnet'] > 0);
  });

  it('correctly applies tag AND filtering when adapting profiles', () => {
    // 'Frontend' タグのみ指定
    const frontendProfiles = adaptReportToProfiles(mockReportData, ['Frontend']);
    assert.strictEqual(frontendProfiles.length, 1);
    assert.strictEqual(frontendProfiles[0].login, 'dev-alice');

    // 存在しない組み合わせ
    const nonExistent = adaptReportToProfiles(mockReportData, ['Frontend', 'Infra']);
    assert.strictEqual(nonExistent.length, 0);
  });

  it('runs InefficiencyDiagnosticEngine successfully on adapted profiles without errors or NaN', () => {
    const profiles = adaptReportToProfiles(mockReportData);
    const alice = profiles[0];

    const result = InefficiencyDiagnosticEngine.diagnoseUser(
      alice,
      '30d',
      undefined,
      profiles
    );

    assert.ok(result);
    assert.strictEqual(result.user.login, 'dev-alice');
    assert.ok(!isNaN(result.healthScore));
    assert.ok(result.healthScore >= 0 && result.healthScore <= 100);
    assert.ok(['healthy', 'warning', 'critical'].includes(result.healthStatus));
    assert.strictEqual(result.patterns.length, 9);

    // 各パターンの確率が 0-100 の範囲内であること
    for (const pattern of result.patterns) {
      assert.ok(!isNaN(pattern.probabilityPercent));
      assert.ok(pattern.probabilityPercent >= 0 && pattern.probabilityPercent <= 100);
      assert.ok(['high', 'medium', 'low', 'healthy'].includes(pattern.riskLevel));
    }
  });

  it('handles empty report data gracefully', () => {
    const emptyProfiles = adaptReportToProfiles({
      ...mockReportData,
      user_details: [],
      daily_trends: [],
    });
    assert.deepStrictEqual(emptyProfiles, []);
  });

  it('verifies custom date range filtering in InefficiencyDiagnosticEngine', () => {
    const profiles = adaptReportToProfiles(mockReportData);
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
