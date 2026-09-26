import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BudgetPresenter } from '../../../adapters/presenters/BudgetPresenter.js';
import { CostCenterBudget } from '../../../domain/entities/copilot.js';

describe('BudgetPresenter Tests', () => {
  it('handles empty budgets correctly', () => {
    const vm = BudgetPresenter.present({
      activeSource: 'live_metrics',
      budgets: [],
    });

    assert.strictEqual(vm.hasBudgets, false);
    assert.strictEqual(vm.cards.length, 0);
    assert.strictEqual(vm.summary.totalSpendFormatted, '$0.00');
    assert.strictEqual(vm.summary.overallUtilizationPercent, 0);
  });

  it('formats budget cards, calculates alerts and summary totals', () => {
    const mockBudgets: CostCenterBudget[] = [
      {
        cost_center_id: 'cc-1',
        cost_center_name: 'Core Engineering',
        cost_center_code: 'ENG',
        spending_limit_usd: 1000,
        free_tier_budget_usd: 100,
        current_spend_usd: 850,
        net_billable_spend_usd: 750,
        remaining_budget_usd: 250,
        budget_utilization_percent: 75,
        status: 'normal',
      },
      {
        cost_center_id: 'cc-2',
        cost_center_name: 'AI Research',
        cost_center_code: 'RND',
        spending_limit_usd: 2000,
        free_tier_budget_usd: 200,
        current_spend_usd: 2200,
        net_billable_spend_usd: 2000,
        remaining_budget_usd: 0,
        budget_utilization_percent: 100,
        status: 'exceeded',
      },
    ];

    const vm = BudgetPresenter.present({
      activeSource: 'live_metrics',
      budgets: mockBudgets,
    });

    assert.strictEqual(vm.hasBudgets, true);
    assert.strictEqual(vm.cards.length, 2);

    // Card 1
    assert.strictEqual(vm.cards[0].costCenterName, 'Core Engineering');
    assert.strictEqual(vm.cards[0].spendingLimitFormatted, '$1000.00');
    assert.strictEqual(vm.cards[0].currentSpendFormatted, '$850.00');
    assert.strictEqual(vm.cards[0].status, 'normal');
    assert.strictEqual(vm.cards[0].isOverBudget, false);

    // Card 2
    assert.strictEqual(vm.cards[1].costCenterName, 'AI Research');
    assert.strictEqual(vm.cards[1].status, 'exceeded');
    assert.strictEqual(vm.cards[1].isOverBudget, true);

    // Summary
    assert.strictEqual(vm.summary.totalLimitFormatted, '$3000.00');
    assert.strictEqual(vm.summary.totalSpendFormatted, '$3050.00');
    assert.strictEqual(vm.summary.alertCount, 1);
    assert.strictEqual(vm.summary.overallUtilizationPercent, 102);
  });
});
