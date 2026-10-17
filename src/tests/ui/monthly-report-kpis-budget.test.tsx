import './dom-setup.js';
import { afterEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { cleanup, render, screen } from '@testing-library/react';
import { MonthlyReportKpis } from '../../../dashboard/src/components/monthly-report/MonthlyReportKpis.js';
import type { CostCenterBudget, MonthlyReportAggregatedData } from '../../types/copilot.js';

afterEach(() => {
  cleanup();
});

function budget(name: string, freeTier: number, limit: number): CostCenterBudget {
  return {
    cost_center_id: name,
    cost_center_name: name,
    cost_center_code: name,
    spending_limit_usd: limit,
    free_tier_budget_usd: freeTier,
    current_spend_usd: 0,
    net_billable_spend_usd: 0,
    remaining_budget_usd: limit,
    budget_utilization_percent: 0,
    status: 'normal',
  };
}

function reportData(daily?: MonthlyReportAggregatedData['cost_center_daily']): MonthlyReportAggregatedData {
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
      top_model: 'N/A',
      top_sku: 'copilot_enterprise',
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    model_breakdown: [],
    sku_breakdown: [],
    daily_trends: [],
    user_details: [],
    cost_center_daily: daily,
  };
}

// 9/1 〜 9/10 に 1 日 $30 ずつ → 現在利用料 $300
const daily = (spend: number) =>
  Array.from({ length: 10 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, spend_usd: spend }));

describe('MonthlyReportKpis - Cost Overview budget forecast summary', () => {
  it('shows current spend, free tier and limit numbers plus the forecast', () => {
    render(
      <MonthlyReportKpis
        reportData={reportData({ 'Team A': daily(30) })}
        budgets={[budget('Team A', 100, 400)]}
      />
    );
    const summary = screen.getByTestId('cost-overview-budget-summary');
    assert.ok(summary.textContent?.includes('Team A'));
    assert.ok(screen.getByTestId('budget-summary-current').textContent?.includes('300'));
    assert.ok(screen.getByTestId('budget-summary-free-tier').textContent?.includes('100'));
    assert.ok(screen.getByTestId('budget-summary-limit').textContent?.includes('400'));
    // 上限ライン = 100 + 400 = 500。傾き $30/日 → 到達見込みの文言が出る
    assert.ok(screen.getByTestId('budget-summary-forecast').textContent?.includes('上限'));
  });

  it('picks the cost center closest to its limit', () => {
    render(
      <MonthlyReportKpis
        reportData={reportData({ Low: daily(1), High: daily(30) })}
        budgets={[budget('Low', 0, 1000), budget('High', 100, 400)]}
      />
    );
    const summary = screen.getByTestId('cost-overview-budget-summary');
    assert.ok(summary.textContent?.includes('High'));
    assert.ok(summary.textContent?.includes('他 1 件'));
  });

  it('renders nothing when budgets or daily data are missing', () => {
    render(<MonthlyReportKpis reportData={reportData(undefined)} budgets={[budget('Team A', 100, 400)]} />);
    assert.strictEqual(screen.queryByTestId('cost-overview-budget-summary'), null);
    cleanup();
    render(<MonthlyReportKpis reportData={reportData({ 'Team A': daily(30) })} />);
    assert.strictEqual(screen.queryByTestId('cost-overview-budget-summary'), null);
  });
});
