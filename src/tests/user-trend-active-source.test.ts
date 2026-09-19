import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { MonthlyReportAggregatedData } from '../types/copilot.js';
import { adaptReportToProfiles } from '../../dashboard/src/utils/deepAnalysisAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('User Trend Viewer Active Source & Cross-View Consistency Tests', () => {
  const mockReportData: MonthlyReportAggregatedData = {
    report_month: '2026-09',
    source_type: 'persisted',
    file_name: 'test-report-2026-09.csv',
    parsed_at: '2026-09-20T00:00:00.000Z',
    overview: {
      total_net_spend_usd: 1250,
      total_gross_spend_usd: 1400,
      total_discount_usd: 150,
      total_requests: 600,
      total_active_users: 2,
      top_model: 'claude-3-7-sonnet',
      top_sku: 'copilot_enterprise',
    },
    by_department: {
      'Engineering': {
        group_name: 'Engineering',
        total_seats: 2,
        active_seats: 2,
        idle_seats: 0,
        total_cost_usd: 1250,
        potential_savings_usd: 0,
        active_ratio: 1.0,
        acceptance_rate: 0.35,
        total_suggestions: 300,
        total_acceptances: 105,
        total_chats: 200,
        total_pr_summaries: 10,
      },
    },
    by_cost_center: {
      'CC-ENG-01': {
        group_name: 'CC-ENG-01',
        total_seats: 2,
        active_seats: 2,
        idle_seats: 0,
        total_cost_usd: 1250,
        potential_savings_usd: 0,
        active_ratio: 1.0,
        acceptance_rate: 0.35,
        total_suggestions: 300,
        total_acceptances: 105,
        total_chats: 200,
        total_pr_summaries: 10,
      },
    },
    by_organization: {},
    model_breakdown: [
      { model_name: 'claude-3-7-sonnet', total_requests: 350, total_spend_usd: 700, active_users: 1, percentage: 58.3 },
      { model_name: 'gpt-4o', total_requests: 150, total_spend_usd: 300, active_users: 1, percentage: 25.0 },
      { model_name: 'custom-internal-model', total_requests: 100, total_spend_usd: 250, active_users: 1, percentage: 16.7 },
    ],
    sku_breakdown: [],
    daily_trends: [
      {
        date: '2026-09-01',
        requests: 200,
        spend_usd: 400,
        active_users: 2,
      },
      {
        date: '2026-09-02',
        requests: 400,
        spend_usd: 850,
        active_users: 2,
      },
    ],
    user_details: [
      {
        login: 'trend-user-alice',
        display_name: 'Alice Cooper',
        department: 'Engineering',
        cost_center: 'CC-ENG-01',
        organization: 'proud-fintech',
        primary_model: 'claude-3-7-sonnet',
        total_requests: 400,
        total_spend_usd: 800,
      },
      {
        login: 'trend-user-bob',
        display_name: 'Bob Marley',
        department: 'Engineering',
        cost_center: 'CC-ENG-01',
        organization: 'proud-fintech',
        primary_model: 'custom-internal-model',
        total_requests: 200,
        total_spend_usd: 450,
      },
    ],
  };

  it('adapts monthly report into profiles that support daily model trend chart mapping', () => {
    const profiles = adaptReportToProfiles(mockReportData);
    assert.strictEqual(profiles.length, 2);

    const alice = profiles.find((p) => p.login === 'trend-user-alice');
    assert.ok(alice);
    assert.strictEqual(alice.daily_history.length, 2);

    // 日付昇順確認
    assert.strictEqual(alice.daily_history[0].date, '2026-09-01');
    assert.strictEqual(alice.daily_history[1].date, '2026-09-02');

    // Alice のモデル内訳 (primary_model: claude-3-7-sonnet)
    const aliceDay1Breakdown = alice.daily_history[0].model_breakdown;
    assert.ok(aliceDay1Breakdown);
    assert.ok(aliceDay1Breakdown['claude-3-7-sonnet'] > 0);

    const bob = profiles.find((p) => p.login === 'trend-user-bob');
    assert.ok(bob);
    const bobDay1Breakdown = bob.daily_history[0].model_breakdown;
    assert.ok(bobDay1Breakdown);
    assert.ok(bobDay1Breakdown['custom-internal-model'] > 0);

    // 合計値の算出
    const totalDay1 = Object.values(aliceDay1Breakdown).reduce((a, b) => a + b, 0);
    assert.ok(totalDay1 > 0);
  });

  it('UserTrendViewer component supports dynamic models and sourceInfo badge without hardcoding only 4 models', () => {
    const trendViewerFile = path.resolve(projectRoot, 'dashboard/src/components/UserTrendViewer.tsx');
    const content = fs.readFileSync(trendViewerFile, 'utf-8');

    // sourceInfo prop の受け入れ
    assert.ok(
      content.includes('sourceInfo?: DeepAnalysisDataSourceInfo'),
      'UserTrendViewer should accept sourceInfo prop'
    );

    // データソース情報バッジの描画
    assert.ok(
      content.includes('sourceInfo.label'),
      'UserTrendViewer should display sourceInfo.label'
    );
    assert.ok(
      content.includes('日別トレンド按分合成'),
      'UserTrendViewer should display isSynthesized badge when appropriate'
    );

    // 動的モデル検出 (activeModelConfigs)
    assert.ok(
      content.includes('activeModelConfigs'),
      'UserTrendViewer should detect models dynamically'
    );
    assert.ok(
      content.includes('activeModelConfigs.map'),
      'UserTrendViewer should render dynamic Bar components'
    );

    // ユーザー選択変更追従 (initialSelectedLogin sync)
    assert.ok(
      content.includes('setSelectedLogin(initialSelectedLogin)'),
      'UserTrendViewer should sync selectedLogin when initialSelectedLogin changes'
    );
  });

  it('App.tsx renders UserTrendViewer for all data sources without isReportSource blocking', () => {
    const appFile = path.resolve(projectRoot, 'dashboard/src/App.tsx');
    const content = fs.readFileSync(appFile, 'utf-8');

    // trend ビューにおける isReportSource ブロックの撤廃
    const trendViewSection = content.split("{activeView === 'trend'")[1]?.split("{activeView === 'budget'")[0];
    assert.ok(trendViewSection, 'Trend view section should exist in App.tsx');

    assert.ok(
      !trendViewSection.includes('日次アクティビティ履歴を含む Live Metrics データで詳細表示されます'),
      'Blocking message should be removed from trend view'
    );
    assert.ok(
      trendViewSection.includes('<UserTrendViewer'),
      'UserTrendViewer should be rendered in trend view'
    );
    assert.ok(
      trendViewSection.includes('sourceInfo={deepAnalysisSourceInfo}'),
      'sourceInfo should be passed to UserTrendViewer'
    );
    assert.ok(
      trendViewSection.includes('profiles={deepAnalysisProfiles'),
      'deepAnalysisProfiles should be passed to UserTrendViewer'
    );
  });

  it('App.tsx computes reportBudgets and provides CostCenterBudgetCards in View 5 under monthly report', () => {
    const appFile = path.resolve(projectRoot, 'dashboard/src/App.tsx');
    const content = fs.readFileSync(appFile, 'utf-8');

    // reportBudgets useMemo の存在確認
    assert.ok(
      content.includes('const reportBudgets = useMemo<CostCenterBudget[]>'),
      'App.tsx should compute reportBudgets from report data'
    );

    // budget ビューにおいて CostCenterBudgetCards に渡されていること
    const budgetViewSection = content.split("{activeView === 'budget'")[1]?.split("{activeView === 'deep_analysis'")[0];
    assert.ok(budgetViewSection, 'Budget view section should exist in App.tsx');

    assert.ok(
      budgetViewSection.includes('<CostCenterBudgetCards budgets={reportBudgets} />'),
      'CostCenterBudgetCards should be rendered with reportBudgets in monthly report mode'
    );
  });
});
