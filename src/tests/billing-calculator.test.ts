import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { BillingCalculator } from '../processor/billing-calculator.js';
import { EnrichedUserSeat, EnterpriseCostCenter } from '../types/copilot.js';

function makeSeat(overrides: Partial<EnrichedUserSeat> = {}): EnrichedUserSeat {
  return {
    login: 'dev1',
    display_name: 'Dev One',
    avatar_url: '',
    department: 'Unassigned',
    cost_center: 'FinTech-Division',
    organization: 'proud-org',
    plan_type: 'enterprise',
    monthly_cost_usd: 39,
    prorated_daily_cost_usd: 1.3,
    created_at: '2026-01-01T00:00:00Z',
    last_activity_at: '2026-09-07T12:00:00Z',
    last_activity_editor: 'vscode',
    days_inactive: 3,
    status: 'active',
    ...overrides,
  };
}

describe('BillingCalculator.parseBudgetConfig', () => {
  it('parses a JSON array of budget declarations', () => {
    const raw = JSON.stringify([
      { cost_center_name: 'FinTech-Division', spending_limit_usd: 2500, free_tier_budget_usd: 300 },
    ]);
    const parsed = BillingCalculator.parseBudgetConfig(raw);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].cost_center_name, 'FinTech-Division');
    assert.strictEqual(parsed[0].spending_limit_usd, 2500);
  });

  it('wraps a single JSON object into an array', () => {
    const raw = JSON.stringify({ cost_center_id: 'cc-1', spending_limit_usd: 100, free_tier_budget_usd: 0 });
    const parsed = BillingCalculator.parseBudgetConfig(raw);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].cost_center_id, 'cc-1');
  });

  it('returns an empty array for missing or invalid input (never throws)', () => {
    assert.deepStrictEqual(BillingCalculator.parseBudgetConfig(undefined), []);
    assert.deepStrictEqual(BillingCalculator.parseBudgetConfig(''), []);
    assert.deepStrictEqual(BillingCalculator.parseBudgetConfig('{not valid json'), []);
  });
});

describe('BillingCalculator.computeCostCenterBudgets (real-data budget computation)', () => {
  const costCenters: EnterpriseCostCenter[] = [
    {
      id: 'cc-fin-1001',
      name: 'FinTech-Division',
      cost_center_code: 'COST-1001',
      resources: [{ type: 'Org', name: 'proud-org' }],
    },
  ];

  it('aggregates real seat costs per cost center and matches declared budget by name', () => {
    const seats = [
      makeSeat({ login: 'dev1', monthly_cost_usd: 39 }),
      makeSeat({ login: 'dev2', monthly_cost_usd: 39 }),
      makeSeat({ login: 'dev3', monthly_cost_usd: 19, cost_center: 'Cloud-Platform' }),
    ];
    const budgetConfig = BillingCalculator.parseBudgetConfig(
      JSON.stringify([{ cost_center_name: 'FinTech-Division', spending_limit_usd: 100, free_tier_budget_usd: 10 }])
    );

    const budgets = BillingCalculator.computeCostCenterBudgets(seats, costCenters, budgetConfig);
    const fin = budgets.find((b) => b.cost_center_name === 'FinTech-Division');
    assert.ok(fin);
    assert.strictEqual(fin?.current_spend_usd, 78); // 39 + 39
    assert.strictEqual(fin?.spending_limit_usd, 100);
    assert.strictEqual(fin?.free_tier_budget_usd, 10);
    assert.strictEqual(fin?.net_billable_spend_usd, 68); // 78 - 10
    assert.strictEqual(fin?.remaining_budget_usd, 32); // 100 - 68
    assert.strictEqual(fin?.budget_utilization_percent, 68);
    assert.strictEqual(fin?.status, 'normal');

    // Cost center with real spend but no declared budget: limit/free default to 0, never fabricated
    const cloud = budgets.find((b) => b.cost_center_name === 'Cloud-Platform');
    assert.ok(cloud);
    assert.strictEqual(cloud?.current_spend_usd, 19);
    assert.strictEqual(cloud?.spending_limit_usd, 0);
    assert.strictEqual(cloud?.budget_utilization_percent, 0); // avoids divide-by-zero
    assert.strictEqual(cloud?.status, 'normal');
  });

  it('marks status as warning at >=80% and exceeded at >=100% utilization', () => {
    const seats = [makeSeat({ login: 'dev1', monthly_cost_usd: 90, cost_center: 'FinTech-Division' })];
    const warnBudgets = BillingCalculator.computeCostCenterBudgets(
      seats,
      costCenters,
      BillingCalculator.parseBudgetConfig(
        JSON.stringify([{ cost_center_name: 'FinTech-Division', spending_limit_usd: 100, free_tier_budget_usd: 0 }])
      )
    );
    assert.strictEqual(warnBudgets[0].status, 'warning'); // 90%

    const exceededBudgets = BillingCalculator.computeCostCenterBudgets(
      seats,
      costCenters,
      BillingCalculator.parseBudgetConfig(
        JSON.stringify([{ cost_center_name: 'FinTech-Division', spending_limit_usd: 50, free_tier_budget_usd: 0 }])
      )
    );
    assert.strictEqual(exceededBudgets[0].status, 'exceeded'); // 180%
  });

  it('returns an empty array when there are no enriched seats', () => {
    const budgets = BillingCalculator.computeCostCenterBudgets([], costCenters, []);
    assert.deepStrictEqual(budgets, []);
  });
});
