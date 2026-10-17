import './dom-setup.js';
import { afterEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { cleanup, render, screen } from '@testing-library/react';
import { MonthlyReportKpis, SingleMonthlyReportKpiCard } from '../../../dashboard/src/components/monthly-report/MonthlyReportKpis.js';
import type { MonthlyReportAggregatedData } from '../../../src/types/copilot.js';

afterEach(() => {
  cleanup();
});

function createBaseReport(overrides: Partial<MonthlyReportAggregatedData> = {}): MonthlyReportAggregatedData {
  return {
    report_month: '2026-09',
    source_type: 'persisted',
    file_name: 'test-2026-09.csv',
    parsed_at: '2026-10-01T00:00:00Z',
    overview: {
      total_net_spend_usd: 100,
      total_gross_spend_usd: 120,
      total_discount_usd: 20,
      total_requests: 0,
      total_active_users: 0,
      top_model: 'gpt-4o',
      top_sku: 'copilot_standard',
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    model_breakdown: [{ model_name: 'gpt-4o', total_requests: 0, total_spend_usd: 100, percentage: 100, active_users: 1 }],
    sku_breakdown: [],
    daily_trends: [],
    user_details: [],
    ...overrides,
  };
}

describe('MonthlyReportKpis: 総リクエスト / クレジット カードの表示改善', () => {
  it('リクエストのみのデータ: 「総リクエスト数」タイトル、リクエストバッジ、req単位、最小・中央・最大値を表示する', () => {
    const report = createBaseReport({
      overview: {
        total_net_spend_usd: 50,
        total_gross_spend_usd: 50,
        total_discount_usd: 0,
        total_requests: 450,
        total_active_users: 4,
        top_model: 'gpt-4o',
        top_sku: 'copilot_standard',
      },
      user_details: [
        {
          login: 'user-a',
          display_name: 'User A',
          department: 'Engineering',
          cost_center: 'CC-1',
          organization: 'Org-1',
          total_requests: 50,
          total_spend_usd: 10,
          primary_model: 'gpt-4o',
        },
        {
          login: 'user-b',
          display_name: 'User B',
          department: 'Engineering',
          cost_center: 'CC-1',
          organization: 'Org-1',
          total_requests: 100,
          total_spend_usd: 10,
          primary_model: 'gpt-4o',
        },
        {
          login: 'user-c',
          display_name: 'User C',
          department: 'Design',
          cost_center: 'CC-2',
          organization: 'Org-1',
          total_requests: 300,
          total_spend_usd: 30,
          primary_model: 'gpt-4o',
        },
        {
          login: 'user-idle',
          display_name: 'User Idle',
          department: 'Sales',
          cost_center: 'CC-3',
          organization: 'Org-1',
          total_requests: 0,
          total_spend_usd: 0,
          primary_model: 'gpt-4o',
        },
      ],
    });

    render(<SingleMonthlyReportKpiCard cardId="report_kpi_requests" reportData={report} />);

    // タイトルとバッジの検証
    assert.equal(screen.getByTestId('metric-label-report_requests').textContent?.includes('総リクエスト数'), true);
    assert.equal(screen.getByTestId('report-requests-badge').textContent, 'リクエスト');

    // 合計値と単位
    assert.equal(screen.getByTestId('report-requests-total').textContent, '450');

    // 統計値: 未利用アカウント(0)は除外され、[50, 100, 300] の 3 件
    assert.equal(screen.getByTestId('report-requests-active-count').textContent?.trim(), '3 名');
    assert.equal(screen.getByTestId('report-requests-min').textContent, '50');
    assert.equal(screen.getByTestId('report-requests-median').textContent, '100');
    assert.equal(screen.getByTestId('report-requests-max').textContent, '300');

    // 分布ミニヒストグラムの検証
    const dist = screen.getByTestId('report-requests-distribution');
    assert.ok(dist);
    assert.equal(dist.textContent?.includes('分布 (5階級)'), true);
    const bar0 = screen.getByTestId('distribution-bar-0');
    assert.ok(bar0);
    assert.ok(bar0.getAttribute('title')?.includes('req'));
  });

  it('AI クレジットのみのデータ: 「総 AI クレジット (AIC)」タイトル、AICバッジ、AIC単位、最小・中央・最大値を表示する', () => {
    const report = createBaseReport({
      overview: {
        total_net_spend_usd: 80,
        total_gross_spend_usd: 80,
        total_discount_usd: 0,
        total_requests: 0,
        quantity_by_unit: { credits: 8000 },
        total_active_users: 4,
        top_model: 'claude-3-7-sonnet',
        top_sku: 'copilot_ai_credit',
      },
      sku_breakdown: [
        {
          sku_name: 'copilot_ai_credit',
          total_quantity: 8000,
          unit_type: 'credits',
          total_spend_usd: 80,
          percentage: 100,
        },
      ],
      user_details: [
        {
          login: 'user-1',
          display_name: 'User 1',
          department: 'Eng',
          cost_center: 'CC-1',
          organization: 'Org-1',
          total_requests: 0,
          total_spend_usd: 10,
          primary_model: 'claude-3-7-sonnet',
          usage_insight: {
            usage: {
              requests: null,
              credits: 1000,
              active_days: 5,
              per_active_day: 200,
              per_active_day_unit: 'credits',
              peak_day: null,
            },
            tokens: null,
            unit_cost: { per_million_tokens_usd: null, per_request_usd: null, per_credit_usd: 0.01 },
            by_model: [],
            signals: [],
            level: 'none',
            daily: [],
          },
        },
        {
          login: 'user-2',
          display_name: 'User 2',
          department: 'Eng',
          cost_center: 'CC-1',
          organization: 'Org-1',
          total_requests: 0,
          total_spend_usd: 30,
          primary_model: 'claude-3-7-sonnet',
          usage_insight: {
            usage: {
              requests: null,
              credits: 3000,
              active_days: 10,
              per_active_day: 300,
              per_active_day_unit: 'credits',
              peak_day: null,
            },
            tokens: null,
            unit_cost: { per_million_tokens_usd: null, per_request_usd: null, per_credit_usd: 0.01 },
            by_model: [],
            signals: [],
            level: 'none',
            daily: [],
          },
        },
        {
          login: 'user-3',
          display_name: 'User 3',
          department: 'Eng',
          cost_center: 'CC-1',
          organization: 'Org-1',
          total_requests: 0,
          total_spend_usd: 40,
          primary_model: 'claude-3-7-sonnet',
          usage_insight: {
            usage: {
              requests: null,
              credits: 4000,
              active_days: 12,
              per_active_day: 333,
              per_active_day_unit: 'credits',
              peak_day: null,
            },
            tokens: null,
            unit_cost: { per_million_tokens_usd: null, per_request_usd: null, per_credit_usd: 0.01 },
            by_model: [],
            signals: [],
            level: 'none',
            daily: [],
          },
        },
        {
          login: 'user-zero',
          display_name: 'User Zero',
          department: 'Eng',
          cost_center: 'CC-1',
          organization: 'Org-1',
          total_requests: 0,
          total_spend_usd: 0,
          primary_model: 'None',
        },
      ],
    });

    render(<SingleMonthlyReportKpiCard cardId="report_kpi_requests" reportData={report} />);

    // タイトルとバッジの検証
    assert.equal(screen.getByTestId('metric-label-report_requests').textContent?.includes('総 AI クレジット (AIC)'), true);
    assert.equal(screen.getByTestId('report-requests-badge').textContent, 'AIC (クレジット)');

    // 合計値 (AIC)
    assert.equal(screen.getByTestId('report-requests-total').textContent, '8,000');

    // 統計値: [1000, 3000, 4000] の 3 件
    assert.equal(screen.getByTestId('report-requests-active-count').textContent?.trim(), '3 名');
    assert.equal(screen.getByTestId('report-requests-min').textContent, '1,000');
    assert.equal(screen.getByTestId('report-requests-median').textContent, '3,000');
    assert.equal(screen.getByTestId('report-requests-max').textContent, '4,000');

    // 分布ミニヒストグラム (AIC) の検証
    const dist = screen.getByTestId('report-requests-distribution');
    assert.ok(dist);
    const bar0 = screen.getByTestId('distribution-bar-0');
    assert.ok(bar0);
    assert.ok(bar0.getAttribute('title')?.includes('AIC'));
  });

  it('両方 (リクエストと AIC) が混在するデータ: 両方の合計値とそれぞれの最小・中央・最大値を分離して併記する', () => {
    const report = createBaseReport({
      overview: {
        total_net_spend_usd: 150,
        total_gross_spend_usd: 150,
        total_discount_usd: 0,
        total_requests: 600,
        total_active_users: 3,
        top_model: 'gpt-4o',
        top_sku: 'copilot_ai_credit',
      },
      user_details: [
        {
          login: 'alice',
          display_name: 'Alice',
          department: 'Engineering',
          cost_center: 'CC-1',
          organization: 'Org-1',
          total_requests: 200,
          total_spend_usd: 50,
          primary_model: 'gpt-4o',
          usage_insight: {
            usage: {
              requests: 200,
              credits: 1500,
              active_days: 10,
              per_active_day: 20,
              per_active_day_unit: 'requests',
              peak_day: null,
            },
            tokens: null,
            unit_cost: { per_million_tokens_usd: null, per_request_usd: 0.1, per_credit_usd: 0.01 },
            by_model: [],
            signals: [],
            level: 'none',
            daily: [],
          },
        },
        {
          login: 'bob',
          display_name: 'Bob',
          department: 'Engineering',
          cost_center: 'CC-1',
          organization: 'Org-1',
          total_requests: 400,
          total_spend_usd: 100,
          primary_model: 'gpt-4o',
          usage_insight: {
            usage: {
              requests: 400,
              credits: 3500,
              active_days: 15,
              per_active_day: 26,
              per_active_day_unit: 'requests',
              peak_day: null,
            },
            tokens: null,
            unit_cost: { per_million_tokens_usd: null, per_request_usd: 0.1, per_credit_usd: 0.01 },
            by_model: [],
            signals: [],
            level: 'none',
            daily: [],
          },
        },
      ],
    });

    render(<SingleMonthlyReportKpiCard cardId="report_kpi_requests" reportData={report} />);

    // タイトルとバッジの検証
    assert.equal(screen.getByTestId('metric-label-report_requests').textContent?.includes('総リクエスト & AI クレジット'), true);
    assert.equal(screen.getByTestId('report-requests-badge').textContent, 'リクエスト & AIC');

    // リクエスト合計と AIC 合計
    assert.equal(screen.getByTestId('report-requests-total').textContent, '600');
    assert.equal(screen.getByTestId('report-credits-total').textContent, '5,000');

    // リクエスト統計 [200, 400] -> 最小 200, 中央 (200+400)/2 = 300, 最大 400
    assert.equal(screen.getByTestId('report-requests-min').textContent, '200');
    assert.equal(screen.getByTestId('report-requests-median').textContent, '300');
    assert.equal(screen.getByTestId('report-requests-max').textContent, '400');

    // AIC 統計 [1500, 3500] -> 最小 1,500, 中央 2,500, 最大 3,500
    assert.equal(screen.getByTestId('report-credits-min').textContent, '1,500');
    assert.equal(screen.getByTestId('report-credits-median').textContent, '2,500');
    assert.equal(screen.getByTestId('report-credits-max').textContent, '3,500');
  });

  it('実績ゼロのデータ: ハイフンで統計値を表示しゼロ除算やエラーを起こさない', () => {
    const report = createBaseReport({
      overview: {
        total_net_spend_usd: 0,
        total_gross_spend_usd: 0,
        total_discount_usd: 0,
        total_requests: 0,
        total_active_users: 0,
        top_model: 'None',
        top_sku: 'None',
      },
      user_details: [],
    });

    render(<SingleMonthlyReportKpiCard cardId="report_kpi_requests" reportData={report} />);

    assert.equal(screen.getByTestId('report-requests-badge').textContent, '実績なし');
    assert.equal(screen.getByTestId('report-requests-total').textContent, '0');
    assert.equal(screen.getByTestId('report-requests-active-count').textContent?.trim(), '0 名');
    assert.equal(screen.getByTestId('report-requests-min').textContent, '—');
    assert.equal(screen.getByTestId('report-requests-median').textContent, '—');
    assert.equal(screen.getByTestId('report-requests-max').textContent, '—');

    // 実績なしの場合は分布グラフが表示されないこと
    assert.equal(screen.queryByTestId('report-requests-distribution'), null);
  });

  it('MonthlyReportKpis 全体グリッドレンダリングでも正常に表示される', () => {
    const report = createBaseReport({
      overview: {
        total_net_spend_usd: 100,
        total_gross_spend_usd: 120,
        total_discount_usd: 20,
        total_requests: 50,
        total_active_users: 1,
        top_model: 'gpt-4o',
        top_sku: 'copilot_standard',
      },
      user_details: [
        {
          login: 'user-single',
          display_name: 'Single User',
          department: 'Eng',
          cost_center: 'CC-1',
          organization: 'Org-1',
          total_requests: 50,
          total_spend_usd: 100,
          primary_model: 'gpt-4o',
        },
      ],
    });

    render(<MonthlyReportKpis reportData={report} />);

    assert.ok(screen.getByTestId('report-requests-card'));
    assert.equal(screen.getByTestId('report-requests-total').textContent, '50');
    assert.equal(screen.getByTestId('report-requests-min').textContent, '50');
    assert.equal(screen.getByTestId('report-requests-median').textContent, '50');
    assert.equal(screen.getByTestId('report-requests-max').textContent, '50');
    assert.ok(screen.getByTestId('report-requests-distribution'));
  });

  it('Tooltip の定義にリクエスト数とAICが異なる尺度である旨が明記されている', () => {
    const report = createBaseReport();
    render(<SingleMonthlyReportKpiCard cardId="report_kpi_requests" reportData={report} />);

    const defElem = screen.getByTestId('metric-definition-report_requests');
    const title = defElem.getAttribute('title') || '';
    assert.ok(title.includes('「リクエスト数 (req)」と「AI クレジット (AIC)」は異なる尺度です'));
  });

  it('分布グラフの各バー上に度数（人数）が表示され、X軸目盛りとして最小・中央・最大値が直感対応して配置されている', () => {
    const report = createBaseReport({
      overview: {
        total_requests: 1000,
        total_active_users: 5,
        total_net_spend_usd: 100,
        total_gross_spend_usd: 100,
        total_discount_usd: 0,
        top_model: 'gpt-4o',
        top_sku: 'copilot',
      },
      user_details: [
        { login: 'u1', display_name: 'U1', department: 'D', cost_center: 'C', organization: 'O', total_requests: 10, total_spend_usd: 10, primary_model: 'm' },
        { login: 'u2', display_name: 'U2', department: 'D', cost_center: 'C', organization: 'O', total_requests: 15, total_spend_usd: 10, primary_model: 'm' },
        { login: 'u3', display_name: 'U3', department: 'D', cost_center: 'C', organization: 'O', total_requests: 50, total_spend_usd: 10, primary_model: 'm' },
        { login: 'u4', display_name: 'U4', department: 'D', cost_center: 'C', organization: 'O', total_requests: 80, total_spend_usd: 10, primary_model: 'm' },
        { login: 'u5', display_name: 'U5', department: 'D', cost_center: 'C', organization: 'O', total_requests: 200, total_spend_usd: 10, primary_model: 'm' },
      ],
    });

    render(<SingleMonthlyReportKpiCard cardId="report_kpi_requests" reportData={report} />);

    const dist = screen.getByTestId('report-requests-distribution');
    assert.ok(dist);

    // バー上に度数（人数）テキストが存在する
    const bar0 = screen.getByTestId('distribution-bar-0');
    assert.ok(bar0.textContent?.includes('2')); // 10, 15

    // X軸目盛りとしての最小(10)・中央値(50)・最大(200)の表示
    assert.equal(screen.getByTestId('report-requests-min').textContent, '10');
    assert.equal(screen.getByTestId('report-requests-median').textContent, '50');
    assert.equal(screen.getByTestId('report-requests-max').textContent, '200');
  });
});
