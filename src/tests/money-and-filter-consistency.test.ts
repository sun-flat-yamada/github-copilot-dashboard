import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { AttributeResolver } from '../collector/attribute-resolver.js';
import { BillingCalculator } from '../processor/billing-calculator.js';
import { MetricsAggregator } from '../processor/metrics-aggregator.js';
import { CreditsBillingService } from '../application/services/CreditsBillingService.js';
import {
  applyFilterCriteriaToLiveScope,
  matchUserWithCriteria,
} from '../../dashboard/src/query/filterEngine.js';
import {
  AnalysisScopeType,
  CopilotSeatAssignment,
  DEFAULT_FILTER_CRITERIA,
  EnterpriseCostCenter,
  ScopeAggregatedData,
} from '../types/copilot.js';
import { UNASSIGNED_FILTER_SENTINEL, UNASSIGNED_LABELS } from '../domain/constants/unassigned.js';

const REFERENCE_DATE = '2026-09-10';
const DAYS_IN_MONTH = 30;

function seat(login: string, overrides: Partial<CopilotSeatAssignment> = {}): CopilotSeatAssignment {
  return {
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    pending_cancellation_date: null,
    last_activity_at: '2026-09-09T00:00:00Z',
    last_activity_editor: 'vscode',
    plan_type: 'business',
    assignee: { login, id: 1, avatar_url: '', html_url: '', type: 'User' },
    organization: { login: 'acme-org', id: 1 },
    ...overrides,
  };
}

const COST_CENTERS: EnterpriseCostCenter[] = [
  { id: 'cc-1', name: 'Platform', cost_center_code: 'P', resources: [{ type: 'User', name: 'alice' }, { type: 'User', name: 'bob' }] },
  { id: 'cc-2', name: 'Data', cost_center_code: 'D', resources: [{ type: 'User', name: 'carol' }] },
];

const SEATS: CopilotSeatAssignment[] = [
  seat('alice', { plan_type: 'enterprise', ai_credits_used: 400 }),
  seat('bob', { plan_type: 'business', ai_credits_used: 100 }),
  seat('carol', { plan_type: 'enterprise', last_activity_at: '2026-07-01T00:00:00Z', ai_credits_used: 0 }), // idle
  seat('dave', { plan_type: 'business' }), // cost center 未紐付け
];

function buildEnriched() {
  const calc = new BillingCalculator(new AttributeResolver(), COST_CENTERS, REFERENCE_DATE);
  const enriched = calc.enrichAllSeats(SEATS, DAYS_IN_MONTH);
  const budgets = BillingCalculator.computeCostCenterBudgets(enriched, COST_CENTERS, [
    { cost_center_name: 'Platform', spending_limit_usd: 100, free_tier_budget_usd: 10 },
    { cost_center_name: 'Data', spending_limit_usd: 30, free_tier_budget_usd: 0 },
  ]);
  return { enriched, budgets };
}

function aggregate(scopeType: AnalysisScopeType, daysCount: number): ScopeAggregatedData {
  const { enriched, budgets } = buildEnriched();
  return new MetricsAggregator().aggregateScope(
    scopeType,
    scopeType === 'monthly' ? '2026-09' : scopeType === 'daily' ? REFERENCE_DATE : 'latest-30d',
    [],
    enriched,
    { start: '2026-09-01', end: REFERENCE_DATE, days_count: daysCount },
    [],
    budgets,
    []
  );
}

describe('Money consistency: the same input yields the same amount on every path (P0-5)', () => {
  it('AI credits: CreditsBillingService, per-seat enrichment and the aggregate agree ($0.01 per credit)', () => {
    const { enriched } = buildEnriched();
    const alice = enriched.find((u) => u.login === 'alice')!;
    assert.equal(alice.ai_credits_cost_usd, 4, '400 credits x $0.01');
    assert.equal(
      alice.ai_credits_cost_usd,
      CreditsBillingService.calculateCreditsCost(400, undefined, undefined, '2026-09').amount
    );

    const totalFromSeats = Number(enriched.reduce((sum, u) => sum + (u.ai_credits_cost_usd ?? 0), 0).toFixed(2));
    assert.equal(totalFromSeats, CreditsBillingService.calculateCreditsCost(500, undefined, undefined, '2026-09').amount);
  });

  it('plan_type: unknown is unconfirmed everywhere (cost 0 + flag) instead of enterprise ($39)', () => {
    const calc = new BillingCalculator(new AttributeResolver(), [], REFERENCE_DATE);
    const enriched = calc.enrichSeat(seat('mystery', { plan_type: 'unknown' }), DAYS_IN_MONTH);
    assert.equal(enriched.cost_unconfirmed, true);
    assert.equal(enriched.monthly_cost_usd, 0);
    assert.equal(enriched.prorated_daily_cost_usd, 0);
  });

  it('seat prices come from the catalog ($19 / $39) and prorate over the month', () => {
    const { enriched } = buildEnriched();
    const bob = enriched.find((u) => u.login === 'bob')!;
    const alice = enriched.find((u) => u.login === 'alice')!;
    assert.equal(bob.monthly_cost_usd, 19);
    assert.equal(alice.monthly_cost_usd, 39);
    assert.equal(bob.prorated_daily_cost_usd, Number((19 / DAYS_IN_MONTH).toFixed(4)));
  });

  it('Cost Center budgets: pipeline computation == filter re-evaluation (same rule, same rounding)', () => {
    const { budgets } = buildEnriched();
    const scope = aggregate('monthly', DAYS_IN_MONTH);
    // すべてのユーザーに一致する絞り込み (Organization) を適用して再評価させる
    const filtered = applyFilterCriteriaToLiveScope(scope, { ...DEFAULT_FILTER_CRITERIA, organization: 'acme-org' });

    for (const original of budgets) {
      const reevaluated = filtered.cost_center_budgets!.find((b) => b.cost_center_name === original.cost_center_name)!;
      assert.equal(reevaluated.current_spend_usd, original.current_spend_usd);
      assert.equal(reevaluated.net_billable_spend_usd, original.net_billable_spend_usd);
      assert.equal(reevaluated.remaining_budget_usd, original.remaining_budget_usd);
      assert.equal(reevaluated.budget_utilization_percent, original.budget_utilization_percent);
      assert.equal(reevaluated.status, original.status, 'status must be re-evaluated, not left stale');
    }
  });

  it('a filter that narrows a Cost Center re-evaluates its utilization and status', () => {
    const scope = aggregate('monthly', DAYS_IN_MONTH);
    // Platform: alice($39) + bob($19) = $58, free $10 -> net $48 / limit $100 = 48%
    assert.equal(scope.cost_center_budgets!.find((b) => b.cost_center_name === 'Platform')!.budget_utilization_percent, 48);

    const onlyAlice = applyFilterCriteriaToLiveScope(scope, { ...DEFAULT_FILTER_CRITERIA, userPattern: 'alice', userPatternIsRegex: false });
    const platform = onlyAlice.cost_center_budgets!.find((b) => b.cost_center_name === 'Platform')!;
    assert.equal(platform.current_spend_usd, 39);
    assert.equal(platform.net_billable_spend_usd, 29);
    assert.equal(platform.budget_utilization_percent, 29);
    assert.equal(platform.status, 'normal');
  });
});

describe('Filtering keeps the unit of the scope (P0-5 / P0-6)', () => {
  for (const [scopeType, days] of [
    ['daily', 1],
    ['monthly', DAYS_IN_MONTH],
    ['custom', 14],
  ] as const) {
    it(`${scopeType} scope: totals / idle waste / groups are unchanged by a filter that matches everyone`, () => {
      const scope = aggregate(scopeType, days);
      const filtered = applyFilterCriteriaToLiveScope(scope, { ...DEFAULT_FILTER_CRITERIA, organization: 'acme-org' });

      // 以前は常に月額で再計算され、日次・期間スコープでもフィルター適用で費用が月額に変わっていた
      assert.equal(filtered.overview.total_spend_usd, scope.overview.total_spend_usd);
      assert.equal(filtered.overview.idle_waste_usd, scope.overview.idle_waste_usd);
      for (const key of Object.keys(scope.by_cost_center)) {
        assert.equal(filtered.by_cost_center[key].total_cost_usd, scope.by_cost_center[key].total_cost_usd);
      }
      assert.equal(filtered.overview.total_seats, scope.overview.total_seats);
    });
  }

  it('the daily scope reports the prorated day cost while monthly reports the full month', () => {
    const daily = aggregate('daily', 1);
    const monthly = aggregate('monthly', DAYS_IN_MONTH);
    assert.ok(daily.overview.total_spend_usd < monthly.overview.total_spend_usd);
    assert.equal(monthly.overview.total_spend_usd, 39 + 19 + 39 + 19);
  });

  it('marks the sections that cannot be filtered per user as company-wide (filter_notice)', () => {
    const scope = aggregate('monthly', DAYS_IN_MONTH);
    const filtered = applyFilterCriteriaToLiveScope(scope, { ...DEFAULT_FILTER_CRITERIA, organization: 'acme-org' });
    assert.ok(filtered.filter_notice);
    assert.ok(filtered.filter_notice!.unfiltered_sections.length > 0);
    assert.equal(scope.filter_notice, undefined, 'an unfiltered dataset carries no notice');
  });
});

describe('The "unassigned" filter matches what the pipeline actually emits (P0-6 regression)', () => {
  const criteria = { ...DEFAULT_FILTER_CRITERIA, costCenter: UNASSIGNED_FILTER_SENTINEL };

  it('Cost Center filter matches the pipeline labels Default-CostCenter / Unassigned-CC', () => {
    const { enriched } = buildEnriched();
    const dave = enriched.find((u) => u.login === 'dave')!;
    assert.equal(dave.cost_center, UNASSIGNED_LABELS.costCenter, 'unlinked seats get the pipeline default label');
    assert.equal(matchUserWithCriteria(dave, criteria), true, 'the unassigned filter used to match nothing');

    const alice = enriched.find((u) => u.login === 'alice')!;
    assert.equal(matchUserWithCriteria(alice, criteria), false);

    assert.equal(
      matchUserWithCriteria(
        { login: 'x', display_name: 'x', cost_center: UNASSIGNED_LABELS.reportCostCenter, organization: 'o', department: 'd', tags: [] },
        criteria
      ),
      true
    );
  });

  it('Organization and Group (department) filters also recognize the pipeline default labels', () => {
    const user = {
      login: 'x',
      display_name: 'x',
      cost_center: 'CC',
      organization: UNASSIGNED_LABELS.organization,
      department: UNASSIGNED_LABELS.department,
      tags: [] as string[],
    };
    assert.equal(matchUserWithCriteria(user, { ...DEFAULT_FILTER_CRITERIA, organization: UNASSIGNED_FILTER_SENTINEL }), true);
    assert.equal(matchUserWithCriteria(user, { ...DEFAULT_FILTER_CRITERIA, group: UNASSIGNED_FILTER_SENTINEL }), true);

    // 負の対照: 実在する名前はセンチネルに一致しない
    const named = { ...user, organization: 'acme-org', department: 'Platform Engineering' };
    assert.equal(matchUserWithCriteria(named, { ...DEFAULT_FILTER_CRITERIA, organization: UNASSIGNED_FILTER_SENTINEL }), false);
    assert.equal(matchUserWithCriteria(named, { ...DEFAULT_FILTER_CRITERIA, group: UNASSIGNED_FILTER_SENTINEL }), false);
  });
});
