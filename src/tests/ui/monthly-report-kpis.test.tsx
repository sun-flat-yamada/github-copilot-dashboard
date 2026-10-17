import './dom-setup.js';
import { afterEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { cleanup, render, screen } from '@testing-library/react';
import { MonthlyReportKpis } from '../../../dashboard/src/components/monthly-report/MonthlyReportKpis.js';
import type {
  MonthlyReportAggregatedData,
  ReportModelBreakdown,
} from '../../types/copilot.js';

afterEach(() => {
  cleanup();
});

function createMockReportData(
  modelBreakdown: ReportModelBreakdown[] = []
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
