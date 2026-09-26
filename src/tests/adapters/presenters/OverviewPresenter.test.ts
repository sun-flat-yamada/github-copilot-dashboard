import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OverviewPresenter } from '../../../adapters/presenters/OverviewPresenter.js';
import { ScopeAggregatedData, MonthlyReportAggregatedData } from '../../../domain/entities/copilot.js';

describe('OverviewPresenter Tests', () => {
  it('presents empty state cleanly when no data is provided', () => {
    const vm = OverviewPresenter.present({
      activeSource: 'live_metrics',
      currentData: null,
      currentReportData: null,
    });

    assert.strictEqual(vm.hasData, false);
    assert.strictEqual(vm.kpis.totalCostFormatted, '$0.00');
    assert.strictEqual(vm.kpis.acceptanceRateFormatted, '0%');
    assert.strictEqual(vm.chips.departmentCountText, '0 部署');
  });

  it('presents live metrics scope data with formatted numbers and chips', () => {
    const mockLive: Partial<ScopeAggregatedData> = {
      scope_type: 'monthly',
      scope_key: '2026-09',
      overview: {
        total_seats: 50,
        active_users: 42,
        idle_seats: 8,
        total_spend_usd: 1250.5,
        idle_waste_usd: 152.0,
        overall_acceptance_rate: 0.345,
      } as any,
      by_department: {
        Engineering: {} as any,
        Design: {} as any,
      },
      cost_center_budgets: [
        { cost_center_id: 'CC-01' } as any,
      ],
      users: [
        { login: 'user1', status: 'active' } as any,
        { login: 'user2', status: 'dormant' } as any,
        { login: 'user3', status: 'inactive' } as any,
      ],
    };

    const vm = OverviewPresenter.present({
      activeSource: 'live_metrics',
      currentData: mockLive as ScopeAggregatedData,
    });

    assert.strictEqual(vm.hasData, true);
    assert.strictEqual(vm.isLiveSource, true);
    assert.strictEqual(vm.isReportSource, false);
    assert.strictEqual(vm.kpis.totalCostFormatted, '$1,250.50');
    assert.strictEqual(vm.kpis.activeUsersCount, 42);
    assert.strictEqual(vm.kpis.totalUsersCount, 50);
    assert.strictEqual(vm.kpis.acceptanceRateFormatted, '35%');
    assert.strictEqual(vm.kpis.idleWasteFormatted, '$152.00/月');
    assert.strictEqual(vm.kpis.idleCount, 2);
    assert.strictEqual(vm.chips.departmentCountText, '2 部署');
    assert.strictEqual(vm.chips.budgetCountText, '1 Cost Centers');
    assert.strictEqual(vm.chips.userCountText, '3 名');
    assert.strictEqual(vm.canShowAdvisor, true);
    assert.strictEqual(vm.canShowBudgets, true);
  });

  it('presents monthly report data properly without live-only fields', () => {
    const mockReport: Partial<MonthlyReportAggregatedData> = {
      report_month: '2026-09',
      overview: {
        total_net_spend_usd: 850.75,
        total_gross_spend_usd: 900.0,
        total_discount_usd: 49.25,
        total_requests: 12000,
        total_active_users: 30,
        top_model: 'claude-3-7-sonnet',
        top_sku: 'copilot-enterprise',
      },
      by_department: {
        Platform: {} as any,
      },
      model_breakdown: [
        { model_name: 'gpt-4o' } as any,
        { model_name: 'claude-3-7-sonnet' } as any,
      ],
      user_details: [
        { login: 'alice' } as any,
      ],
    };

    const vm = OverviewPresenter.present({
      activeSource: 'monthly_report',
      currentReportData: mockReport as MonthlyReportAggregatedData,
    });

    assert.strictEqual(vm.hasData, true);
    assert.strictEqual(vm.isLiveSource, false);
    assert.strictEqual(vm.isReportSource, true);
    assert.strictEqual(vm.kpis.totalCostFormatted, '$850.75');
    assert.strictEqual(vm.kpis.activeUsersCount, 30);
    assert.strictEqual(vm.kpis.totalUsersCount, 1);
    assert.strictEqual(vm.chips.modelCountText, '2 モデル');
    assert.strictEqual(vm.chips.departmentCountText, '1 部署');
    assert.strictEqual(vm.canShowAdvisor, false);
  });
});
