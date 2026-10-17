import './dom-setup.js';
import { afterEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { cleanup, render, screen } from '@testing-library/react';
import { MonthlyReportKpis } from '../../../dashboard/src/components/monthly-report/MonthlyReportKpis.js';
import { CurrencyProvider } from '../../../dashboard/src/contexts/CurrencyContext.js';
import type {
  MonthlyReportAggregatedData,
  ReportModelBreakdown,
} from '../../types/copilot.js';

afterEach(() => {
  cleanup();
});

function createMockReportData(
  modelBreakdown: ReportModelBreakdown[] = [],
  overviewOverrides: Partial<MonthlyReportAggregatedData['overview']> = {}
): MonthlyReportAggregatedData {
  return {
    report_month: '2026-09',
    source_type: 'persisted',
    file_name: '2026-09.json',
    parsed_at: '2026-10-01T00:00:00.000Z',
    overview: {
      total_net_spend_usd: 1500,
      total_gross_spend_usd: 1800,
      total_discount_usd: 300,
      total_requests: 12500,
      total_active_users: 42,
      top_model: modelBreakdown[0]?.model_name || 'N/A',
      top_sku: 'copilot_enterprise',
      ...overviewOverrides,
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    model_breakdown: modelBreakdown,
    sku_breakdown: [
      {
        sku_name: 'copilot_enterprise',
        total_quantity: 42,
        unit_type: 'seats',
        total_spend_usd: 1500,
        percentage: 100,
      },
    ],
    daily_trends: [],
    user_details: [],
  };
}

describe('MonthlyReportKpis - report_top_model Top 3 Display', () => {
  it('renders top 3 AI models with ranking and percentage share when >= 3 models exist', () => {
    const models: ReportModelBreakdown[] = [
      {
        model_name: 'Claude 3.7 Sonnet',
        total_requests: 6000,
        total_spend_usd: 800,
        active_users: 30,
        percentage: 48.0,
      },
      {
        model_name: 'GPT-4o',
        total_requests: 4000,
        total_spend_usd: 500,
        active_users: 25,
        percentage: 32.0,
      },
      {
        model_name: 'o1',
        total_requests: 1500,
        total_spend_usd: 300,
        active_users: 15,
        percentage: 12.0,
      },
      {
        model_name: 'Gemini 2.0 Flash',
        total_requests: 1000,
        total_spend_usd: 100,
        active_users: 10,
        percentage: 8.0,
      },
    ];

    const reportData = createMockReportData(models);

    render(<MonthlyReportKpis reportData={reportData} />);

    // Verify Rank 1
    const rank1 = screen.getByTestId('report-top-model-rank-1');
    assert.ok(rank1.textContent?.includes('Claude 3.7 Sonnet'));
    assert.ok(rank1.textContent?.includes('48%'));

    // Verify Rank 2
    const rank2 = screen.getByTestId('report-top-model-rank-2');
    assert.ok(rank2.textContent?.includes('GPT-4o'));
    assert.ok(rank2.textContent?.includes('32%'));

    // Verify Rank 3
    const rank3 = screen.getByTestId('report-top-model-rank-3');
    assert.ok(rank3.textContent?.includes('o1'));
    assert.ok(rank3.textContent?.includes('12%'));

    // 4th model should NOT be rendered in the top-model card
    assert.strictEqual(screen.queryByTestId('report-top-model-rank-4'), null);
    assert.ok(!rank1.parentElement?.textContent?.includes('Gemini 2.0 Flash'));
  });

  it('renders fewer models gracefully when less than 3 models exist (e.g. 2 models)', () => {
    const models: ReportModelBreakdown[] = [
      {
        model_name: 'Claude 3.7 Sonnet',
        total_requests: 8000,
        total_spend_usd: 1000,
        active_users: 20,
        percentage: 80.0,
      },
      {
        model_name: 'GPT-4o',
        total_requests: 2000,
        total_spend_usd: 250,
        active_users: 10,
        percentage: 20.0,
      },
    ];

    const reportData = createMockReportData(models);

    render(<MonthlyReportKpis reportData={reportData} />);

    const rank1 = screen.getByTestId('report-top-model-rank-1');
    assert.ok(rank1.textContent?.includes('Claude 3.7 Sonnet'));
    assert.ok(rank1.textContent?.includes('80%'));

    const rank2 = screen.getByTestId('report-top-model-rank-2');
    assert.ok(rank2.textContent?.includes('GPT-4o'));
    assert.ok(rank2.textContent?.includes('20%'));

    assert.strictEqual(screen.queryByTestId('report-top-model-rank-3'), null);
  });

  it('renders fallback "データなし" when model breakdown is empty', () => {
    const reportData = createMockReportData([]);

    render(<MonthlyReportKpis reportData={reportData} />);

    assert.ok(screen.getByText('データなし'));
    assert.strictEqual(screen.queryByTestId('report-top-model-rank-1'), null);
  });
});

describe('MonthlyReportKpis - report_kpi_active_users Plan Breakdown & Abolished report_kpi_top_sku', () => {
  it('does NOT render the abolished report_kpi_top_sku card, and renders 4 cards in total', () => {
    const reportData = createMockReportData([]);
    const { container } = render(<MonthlyReportKpis reportData={reportData} />);

    // report_kpi_top_sku must NOT exist
    assert.strictEqual(screen.queryByTestId('report-kpi-top-sku'), null);

    // Verify grid has 4 columns class
    const grid = container.firstChild as HTMLElement;
    assert.ok(grid.className.includes('lg:grid-cols-4'), 'Grid should use lg:grid-cols-4 for 4 cards');
    assert.ok(!grid.className.includes('lg:grid-cols-5'), 'Grid should not use lg:grid-cols-5');

    // Expected cards: cost, requests, active users, top model
    assert.ok(screen.getByTestId('report-kpi-cost'));
    assert.ok(screen.getByTestId('report-requests-card'));
    assert.ok(screen.getByTestId('report-kpi-active-users'));
    assert.ok(screen.getByTestId('report-kpi-top-model'));
  });

  it('renders Copilot plan breakdown (Enterprise and Business) from sku_breakdown', () => {
    const reportData: MonthlyReportAggregatedData = {
      ...createMockReportData([]),
      overview: {
        total_net_spend_usd: 556,
        total_gross_spend_usd: 560,
        total_discount_usd: 4,
        total_requests: 4000,
        total_active_users: 16,
        top_model: 'Gemini 3.8 Flash',
        top_sku: 'copilot_business',
      },
      sku_breakdown: [
        {
          sku_name: 'copilot_business',
          total_quantity: 11,
          unit_type: 'seats',
          total_spend_usd: 209,
          percentage: 37.6,
        },
        {
          sku_name: 'copilot_enterprise',
          total_quantity: 5,
          unit_type: 'seats',
          total_spend_usd: 195,
          percentage: 35.1,
        },
      ],
    };

    render(<MonthlyReportKpis reportData={reportData} />);

    // Total active users
    const totalUsers = screen.getByTestId('report-active-users-total');
    assert.strictEqual(totalUsers.textContent?.trim(), '16');

    // Plan breakdown section
    const breakdown = screen.getByTestId('report-plan-breakdown');
    assert.ok(breakdown);
    assert.ok(breakdown.textContent?.includes('プラン内訳 (アクティブ / ノンアクティブ / 全数):'));

    const entCount = screen.getByTestId('report-plan-enterprise-count');
    assert.strictEqual(entCount.textContent?.trim(), '5');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-active').textContent?.trim(), '5');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-inactive').textContent?.trim(), '0');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-total').textContent?.trim(), '5');

    const bizCount = screen.getByTestId('report-plan-business-count');
    assert.strictEqual(bizCount.textContent?.trim(), '11');
    assert.strictEqual(screen.getByTestId('report-plan-business-active').textContent?.trim(), '11');
    assert.strictEqual(screen.getByTestId('report-plan-business-inactive').textContent?.trim(), '0');
    assert.strictEqual(screen.getByTestId('report-plan-business-total').textContent?.trim(), '11');
  });

  it('renders breakdown accurately when user_details includes plan_type with active and non-active users', () => {
    const reportData: MonthlyReportAggregatedData = {
      ...createMockReportData([]),
      overview: {
        total_net_spend_usd: 100,
        total_gross_spend_usd: 100,
        total_discount_usd: 0,
        total_requests: 500,
        total_active_users: 2,
        top_model: 'Claude 3.7 Sonnet',
        top_sku: 'copilot_enterprise',
      },
      user_details: [
        {
          login: 'user-a',
          display_name: 'User A',
          department: 'Eng',
          cost_center: 'CC1',
          organization: 'Org1',
          total_requests: 200,
          total_spend_usd: 39,
          primary_model: 'Claude 3.7 Sonnet',
          plan_type: 'enterprise',
        },
        {
          login: 'user-b',
          display_name: 'User B',
          department: 'Eng',
          cost_center: 'CC1',
          organization: 'Org1',
          total_requests: 0,
          total_spend_usd: 0,
          primary_model: 'None',
          plan_type: 'enterprise',
          status: 'idle',
        },
        {
          login: 'user-c',
          display_name: 'User C',
          department: 'Design',
          cost_center: 'CC2',
          organization: 'Org1',
          total_requests: 100,
          total_spend_usd: 19,
          primary_model: 'GPT-4o',
          plan_type: 'business',
        },
        {
          login: 'user-d',
          display_name: 'User D',
          department: 'Design',
          cost_center: 'CC2',
          organization: 'Org1',
          total_requests: 0,
          total_spend_usd: 0,
          primary_model: 'None',
          plan_type: 'business',
        },
      ],
      sku_breakdown: [],
    };

    render(<MonthlyReportKpis reportData={reportData} />);

    // Enterprise: 1 active, 1 non-active, total 2
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-count').textContent?.trim(), '2');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-active').textContent?.trim(), '1');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-inactive').textContent?.trim(), '1');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-total').textContent?.trim(), '2');

    // Business: 1 active, 1 non-active, total 2
    assert.strictEqual(screen.getByTestId('report-plan-business-count').textContent?.trim(), '2');
    assert.strictEqual(screen.getByTestId('report-plan-business-active').textContent?.trim(), '1');
    assert.strictEqual(screen.getByTestId('report-plan-business-inactive').textContent?.trim(), '1');
    assert.strictEqual(screen.getByTestId('report-plan-business-total').textContent?.trim(), '2');
  });

  it('calculates active and non-active proportionally when falling back to sku_breakdown with idle seats', () => {
    const reportData: MonthlyReportAggregatedData = {
      ...createMockReportData([]),
      overview: {
        total_net_spend_usd: 300,
        total_gross_spend_usd: 300,
        total_discount_usd: 0,
        total_requests: 2000,
        total_active_users: 10,
        top_model: 'Claude 3.7 Sonnet',
        top_sku: 'copilot_business',
      },
      sku_breakdown: [
        {
          sku_name: 'copilot_enterprise',
          total_quantity: 10,
          unit_type: 'seats',
          total_spend_usd: 390,
          percentage: 50,
        },
        {
          sku_name: 'copilot_business',
          total_quantity: 10,
          unit_type: 'seats',
          total_spend_usd: 190,
          percentage: 50,
        },
      ],
      user_details: [],
    };

    render(<MonthlyReportKpis reportData={reportData} />);

    // Total seats: 20, active: 10. Enterprise 10 -> active: 5, inactive: 5. Business 10 -> active: 5, inactive: 5.
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-count').textContent?.trim(), '10');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-active').textContent?.trim(), '5');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-inactive').textContent?.trim(), '5');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-total').textContent?.trim(), '10');

    assert.strictEqual(screen.getByTestId('report-plan-business-count').textContent?.trim(), '10');
    assert.strictEqual(screen.getByTestId('report-plan-business-active').textContent?.trim(), '5');
    assert.strictEqual(screen.getByTestId('report-plan-business-inactive').textContent?.trim(), '5');
    assert.strictEqual(screen.getByTestId('report-plan-business-total').textContent?.trim(), '10');
  });

  it('renders 0 for both plans gracefully when no plan breakdown is present', () => {
    const reportData = createMockReportData([]);
    reportData.sku_breakdown = [];
    reportData.user_details = [];

    render(<MonthlyReportKpis reportData={reportData} />);

    const entCount = screen.getByTestId('report-plan-enterprise-count');
    assert.strictEqual(entCount.textContent?.trim(), '0');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-active').textContent?.trim(), '0');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-inactive').textContent?.trim(), '0');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-total').textContent?.trim(), '0');

    const bizCount = screen.getByTestId('report-plan-business-count');
    assert.strictEqual(bizCount.textContent?.trim(), '0');
    assert.strictEqual(screen.getByTestId('report-plan-business-active').textContent?.trim(), '0');
    assert.strictEqual(screen.getByTestId('report-plan-business-inactive').textContent?.trim(), '0');
    assert.strictEqual(screen.getByTestId('report-plan-business-total').textContent?.trim(), '0');
  });
});

describe('MonthlyReportKpis - Active Users Slash Separated Format Display (#385)', () => {
  it('displays slash separated format when unfiltered: 16 (100.0%) / 16 / 16 名', () => {
    const reportData = createMockReportData([], { total_active_users: 16 });
    reportData.sku_breakdown = [
      { sku_name: 'copilot_enterprise', total_quantity: 5, unit_type: 'seats', total_spend_usd: 195, percentage: 35 },
      { sku_name: 'copilot_business', total_quantity: 11, unit_type: 'seats', total_spend_usd: 209, percentage: 38 },
    ];

    render(
      <CurrencyProvider>
        <MonthlyReportKpis reportData={reportData} />
      </CurrencyProvider>
    );

    const totalEl = screen.getByTestId('report-active-users-total');
    const percentEl = screen.getByTestId('report-active-users-percent');
    const ratioEl = screen.getByTestId('report-active-users-ratio');

    assert.strictEqual(totalEl.textContent?.trim(), '16');
    assert.strictEqual(percentEl.textContent?.trim(), '(100.0%)');
    assert.strictEqual(ratioEl.textContent?.trim(), '/ 16 / 16 名');
  });

  it('displays slash separated format for user example: 16 (100.0%) / 16 / 32 名', () => {
    const rawReportData = createMockReportData([], { total_active_users: 32 });
    rawReportData.sku_breakdown = [
      { sku_name: 'copilot_enterprise', total_quantity: 10, unit_type: 'seats', total_spend_usd: 390, percentage: 50 },
      { sku_name: 'copilot_business', total_quantity: 22, unit_type: 'seats', total_spend_usd: 418, percentage: 50 },
    ];

    const filteredReportData = createMockReportData([], { total_active_users: 16 });
    filteredReportData.sku_breakdown = [
      { sku_name: 'copilot_enterprise', total_quantity: 5, unit_type: 'seats', total_spend_usd: 195, percentage: 35 },
      { sku_name: 'copilot_business', total_quantity: 11, unit_type: 'seats', total_spend_usd: 209, percentage: 38 },
    ];

    render(
      <CurrencyProvider>
        <MonthlyReportKpis reportData={filteredReportData} rawReportData={rawReportData} />
      </CurrencyProvider>
    );

    const totalEl = screen.getByTestId('report-active-users-total');
    const percentEl = screen.getByTestId('report-active-users-percent');
    const ratioEl = screen.getByTestId('report-active-users-ratio');

    assert.strictEqual(totalEl.textContent?.trim(), '16');
    assert.strictEqual(percentEl.textContent?.trim(), '(100.0%)');
    assert.strictEqual(ratioEl.textContent?.trim(), '/ 16 / 32 名');

    // 下部のプラン内訳も確認
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-active').textContent?.trim(), '5');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-inactive').textContent?.trim(), '0');
    assert.strictEqual(screen.getByTestId('report-plan-enterprise-total').textContent?.trim(), '5');

    assert.strictEqual(screen.getByTestId('report-plan-business-active').textContent?.trim(), '11');
    assert.strictEqual(screen.getByTestId('report-plan-business-inactive').textContent?.trim(), '0');
    assert.strictEqual(screen.getByTestId('report-plan-business-total').textContent?.trim(), '11');
  });

  it('safely handles zero total users without division by zero: 0 (0.0%) / 0 / 0 名', () => {
    const reportData = createMockReportData([], { total_active_users: 0 });
    reportData.sku_breakdown = [];
    reportData.user_details = [];

    render(
      <CurrencyProvider>
        <MonthlyReportKpis reportData={reportData} />
      </CurrencyProvider>
    );

    const totalEl = screen.getByTestId('report-active-users-total');
    const percentEl = screen.getByTestId('report-active-users-percent');
    const ratioEl = screen.getByTestId('report-active-users-ratio');

    assert.strictEqual(totalEl.textContent?.trim(), '0');
    assert.strictEqual(percentEl.textContent?.trim(), '(0.0%)');
    assert.strictEqual(ratioEl.textContent?.trim(), '/ 0 / 0 名');
  });
});

