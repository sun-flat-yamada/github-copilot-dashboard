import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { MonthlyReportAggregatedData } from '../types/copilot.js';
import { resolveDeepAnalysisProfiles } from '../../dashboard/src/hooks/useDeepAnalysisData.js';

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

  it('does not build per-user daily trend profiles from an aggregated monthly report', () => {
    // 月次レポート (CSV の集計) にはユーザー別の日次実績・モデル内訳が無い。以前は組織全体の日次形状を
    // 按分して個人の日次モデル内訳を合成していたため、実在しない推移がユーザー別推移に表示されていた。
    const resolved = resolveDeepAnalysisProfiles({
      activeSource: 'monthly_report',
      currentData: null,
      selectedReportMonth: '2026-09',
      archiveData: null,
      currentReportData: mockReportData,
      uploadedData: null,
      selectedTags: [],
    });

    assert.deepStrictEqual(resolved.profiles, []);
    // ユーザー別推移ビューは、空表示ではなく「なぜ表示できないか」を sourceInfo.details で示す
    assert.ok(resolved.sourceInfo.details && resolved.sourceInfo.details.length > 0);
    assert.strictEqual(resolved.sourceInfo.totalUsers, 2);
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

  it('UserTrendViewer does not invent models, avatars or a default radar model when nothing was measured', () => {
    const trendViewerFile = path.resolve(projectRoot, 'dashboard/src/components/UserTrendViewer.tsx');
    const content = fs.readFileSync(trendViewerFile, 'utf-8');

    // 実測のモデルが無いときに代表モデル (claude-3-7-sonnet / gpt-4o / o1 / gemini) を仮定して系列を作らない
    assert.ok(!content.includes("foundModels.add('claude-3-7-sonnet')"), 'must not add placeholder models to the series');
    assert.ok(!content.includes("?? 'claude-3-7-sonnet'") && !content.includes("|| 'claude-3-7-sonnet'"), 'must not default the radar model');
    // アバター URL が無いときに外部の ghost 画像を取得しない (閲覧者の IP を外部へ送らない)
    assert.ok(!content.includes('github.com/ghost.png'), 'must not fetch an external placeholder avatar');
    // 実測が無いときは理由を表示する
    assert.ok(content.includes('user-trend-no-profile-reason'), 'must show why no profile is available');
    // フックの呼び出し順を保つ: useMemo は早期 return より前に置く (プロファイルの有無でフック数が変わると例外になる)
    const earlyReturn = content.indexOf('if (!currentProfile) {');
    const lastMemo = content.lastIndexOf('useMemo');
    assert.ok(earlyReturn > 0 && lastMemo < earlyReturn, 'all hooks must be declared before the early return');
  });

  it('App.tsx renders UserTrendViewer for all data sources without isReportSource blocking', () => {
    const trendFile = path.resolve(projectRoot, 'dashboard/src/views/trend/View.tsx');
    const content = fs.readFileSync(trendFile, 'utf-8');

    // trend ビューにおける isReportSource ブロックの撤廃
    const trendViewSection = content;
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
    const appFile = path.resolve(projectRoot, 'dashboard/src/AppShell.tsx');
    const content = fs.readFileSync(appFile, 'utf-8');

    // reportBudgets useMemo の存在確認
    assert.ok(
      content.includes('const reportBudgets = useMemo<CostCenterBudget[]>'),
      'App.tsx should compute reportBudgets from report data'
    );

    // budget ビューにおいて CostCenterBudgetCards に渡されていること
    const budgetViewSection = fs.readFileSync(path.resolve(projectRoot, 'dashboard/src/views/budget/View.tsx'), 'utf-8');
    assert.ok(budgetViewSection, 'Budget view section should exist in App.tsx');

    assert.ok(
      budgetViewSection.includes('<CostCenterBudgetCards budgets={reportBudgets} />'),
      'CostCenterBudgetCards should be rendered with reportBudgets in monthly report mode'
    );
  });
});
