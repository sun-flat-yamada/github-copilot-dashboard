import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  SeatClassificationRule,
  SEAT_IDLE_CRITERIA_TEXT,
  SEAT_IDLE_DAYS,
  SEAT_LOW_ACTIVE_DAYS,
  SEAT_ONBOARDING_DAYS,
  isActiveSeatStatus,
  isIdleSeatStatus,
} from '../../domain/rules/SeatClassificationRule.js';
import { BudgetUtilizationRule } from '../../domain/rules/BudgetUtilizationRule.js';
import { monthlyIdleSavingsUsd, seatCostForScope } from '../../domain/rules/ScopeCostRule.js';
import {
  PRICING_CATALOG_VERSION,
  computeCreditsPoolUtilizationPercent,
  estimateIncludedCreditsPool,
  getCreditUnitPriceUsd,
  getIncludedCreditsPerSeat,
  getSeatListPriceUsd,
  isPricedPlan,
  resolvePricingEntry,
} from '../../domain/pricing/pricing-catalog.js';
import {
  UNASSIGNED_FILTER_SENTINEL,
  UNASSIGNED_LABELS,
  isUnassignedValue,
} from '../../domain/constants/unassigned.js';

describe('SeatClassificationRule: onboarding and consistent idle criteria (P0-9)', () => {
  it('a seat granted 2 days ago and never used is onboarding, not idle', () => {
    // 付与 2 日 / 最終活動なし (daysInactive は付与日からの経過に等しい)
    const status = SeatClassificationRule.classify({ daysInactive: 2, daysSinceCreation: 2, hasActivity: false });
    assert.equal(status, 'onboarding');
    assert.equal(isIdleSeatStatus(status), false, 'onboarding must not count as idle (reclaimable)');
    assert.equal(isActiveSeatStatus(status), false);
  });

  it('the onboarding window ends at SEAT_ONBOARDING_DAYS: unused seats older than that are never_used', () => {
    assert.equal(
      SeatClassificationRule.classify({
        daysInactive: SEAT_ONBOARDING_DAYS - 1,
        daysSinceCreation: SEAT_ONBOARDING_DAYS - 1,
        hasActivity: false,
      }),
      'onboarding'
    );
    assert.equal(
      SeatClassificationRule.classify({
        daysInactive: SEAT_ONBOARDING_DAYS,
        daysSinceCreation: SEAT_ONBOARDING_DAYS,
        hasActivity: false,
      }),
      'never_used'
    );
    assert.equal(isIdleSeatStatus('never_used'), true);
  });

  it('a new seat that was used on the grant day is active, not onboarding / never_used', () => {
    // 付与日当日に利用した: daysInactive == daysSinceCreation だが hasActivity = true
    assert.equal(SeatClassificationRule.classify({ daysInactive: 3, daysSinceCreation: 3, hasActivity: true }), 'active');
    // 付与後に使って、その後 1 日だけ空いた
    assert.equal(SeatClassificationRule.classify({ daysInactive: 1, daysSinceCreation: 3, hasActivity: true }), 'active');
  });

  it('keeps the established idle / low_active thresholds', () => {
    const veteran = { daysSinceCreation: 200, hasActivity: true };
    assert.equal(SeatClassificationRule.classify({ ...veteran, daysInactive: SEAT_LOW_ACTIVE_DAYS }), 'active');
    assert.equal(SeatClassificationRule.classify({ ...veteran, daysInactive: SEAT_LOW_ACTIVE_DAYS + 1 }), 'low_active');
    assert.equal(SeatClassificationRule.classify({ ...veteran, daysInactive: SEAT_IDLE_DAYS }), 'low_active');
    assert.equal(SeatClassificationRule.classify({ ...veteran, daysInactive: SEAT_IDLE_DAYS + 1 }), 'idle');
    // 14 日超かつ AI クレジット消費が 0 と判明している場合は遊休
    assert.equal(
      SeatClassificationRule.classify({ ...veteran, daysInactive: SEAT_LOW_ACTIVE_DAYS + 1, aiCreditsUsed28d: 0 }),
      'idle'
    );
  });

  it('the idle label text states the real criteria (it used to say "30 days" while idle needed only 14)', () => {
    assert.ok(SEAT_IDLE_CRITERIA_TEXT.includes(String(SEAT_IDLE_DAYS)));
    assert.ok(SEAT_IDLE_CRITERIA_TEXT.includes(String(SEAT_LOW_ACTIVE_DAYS)));
  });
});

describe('Pricing catalog: the single source of prices (P0-5)', () => {
  it('seat list prices are $19 (Business) / $39 (Enterprise) and unknown plans are not priced', () => {
    assert.equal(getSeatListPriceUsd('business'), 19);
    assert.equal(getSeatListPriceUsd('enterprise'), 39);
    assert.equal(getSeatListPriceUsd('unknown'), null, 'an unconfirmed plan must not be assumed to be enterprise');
    assert.equal(getSeatListPriceUsd(undefined), null);
    assert.equal(isPricedPlan('unknown'), false);
  });

  it('1 AI credit is $0.01 (the former $0.05 default is gone)', () => {
    assert.equal(getCreditUnitPriceUsd(), 0.01);
    assert.equal(getCreditUnitPriceUsd('2026-09'), 0.01);
  });

  it('included credits are plan specific and period specific (promotion 2026-06..08)', () => {
    assert.equal(getIncludedCreditsPerSeat('business', '2026-10'), 1900);
    assert.equal(getIncludedCreditsPerSeat('enterprise', '2026-10'), 3900);
    assert.equal(getIncludedCreditsPerSeat('business', '2026-07'), 3000);
    assert.equal(getIncludedCreditsPerSeat('enterprise', '2026-07'), 7000);
    assert.equal(getIncludedCreditsPerSeat('unknown', '2026-10'), null);
    assert.equal(resolvePricingEntry('2026-05').id, 'baseline');
    assert.equal(resolvePricingEntry('2026-08').id, 'usage-billing-transition-promotion-2026-06');
    assert.equal(resolvePricingEntry('2026-09').id, 'baseline');
    assert.ok(PRICING_CATALOG_VERSION.length > 0);
  });

  it('pools included credits per billing entity and flags seats whose plan is unknown', () => {
    const pool = estimateIncludedCreditsPool(['business', 'business', 'enterprise', 'unknown'], '2026-10');
    assert.equal(pool.includedCredits, 1900 * 2 + 3900);
    assert.equal(pool.unknownPlanSeats, 1);
    // 設定 (EA 契約等) による全プラン共通の上書き
    assert.equal(estimateIncludedCreditsPool(['business', 'enterprise'], '2026-10', 5000).includedCredits, 10000);
  });

  it('pool utilization is not capped at 100% and is null when the pool is unknown', () => {
    assert.equal(computeCreditsPoolUtilizationPercent(7600, 3800), 200);
    assert.equal(computeCreditsPoolUtilizationPercent(10, 0), null);
  });
});

describe('BudgetUtilizationRule.evaluateUsd: the single budget implementation (P0-5)', () => {
  it('net billable = max(0, spend - free tier); remaining never goes negative', () => {
    const r = BudgetUtilizationRule.evaluateUsd(1000, 200, 1500);
    assert.equal(r.net_billable_spend_usd, 1300);
    assert.equal(r.remaining_budget_usd, 0, 'remaining must be clamped at 0');
    assert.equal(r.budget_utilization_percent, 130);
    assert.equal(r.status, 'exceeded');
  });

  it('warns from 80% and treats exactly 100% as exceeded', () => {
    assert.equal(BudgetUtilizationRule.evaluateUsd(1000, 0, 799).status, 'normal');
    assert.equal(BudgetUtilizationRule.evaluateUsd(1000, 0, 800).status, 'warning');
    assert.equal(BudgetUtilizationRule.evaluateUsd(1000, 0, 1000).status, 'exceeded');
  });

  it('a free tier larger than the spend yields zero net billable and 0%', () => {
    const r = BudgetUtilizationRule.evaluateUsd(500, 300, 120);
    assert.equal(r.net_billable_spend_usd, 0);
    assert.equal(r.remaining_budget_usd, 500);
    assert.equal(r.budget_utilization_percent, 0);
    assert.equal(r.status, 'normal');
  });

  it('a zero limit does not divide by zero and is never "exceeded" by utilization', () => {
    const r = BudgetUtilizationRule.evaluateUsd(0, 0, 250);
    assert.equal(r.budget_utilization_percent, 0);
    assert.equal(r.status, 'normal');
  });
});

describe('seatCostForScope / monthlyIdleSavingsUsd: cost units are scope specific (P0-5)', () => {
  const seat = { monthly_cost_usd: 30, prorated_daily_cost_usd: 1 };

  it('daily = prorated day, monthly = full month, custom = prorated x days', () => {
    assert.equal(seatCostForScope(seat, 'daily', 1), 1);
    assert.equal(seatCostForScope(seat, 'monthly', 30), 30);
    assert.equal(seatCostForScope(seat, 'custom', 14), 14);
  });

  it('idle savings are per month regardless of the scope, and exclude onboarding seats', () => {
    const users = [
      { status: 'idle' as const, monthly_cost_usd: 19 },
      { status: 'never_used' as const, monthly_cost_usd: 39 },
      { status: 'onboarding' as const, monthly_cost_usd: 39 },
      { status: 'active' as const, monthly_cost_usd: 39 },
    ];
    assert.equal(monthlyIdleSavingsUsd(users), 58);
  });
});

describe('Unassigned labels: the pipeline output and the filter agree (P0-6)', () => {
  it('every label the pipeline can emit is recognized as unassigned', () => {
    for (const label of Object.values(UNASSIGNED_LABELS)) {
      assert.equal(isUnassignedValue(label), true, `${label} must be treated as unassigned`);
    }
    assert.equal(isUnassignedValue(''), true);
    assert.equal(isUnassignedValue('  '), true);
    assert.equal(isUnassignedValue('unassigned'), true, 'case-insensitive');
  });

  it('real names are not unassigned', () => {
    assert.equal(isUnassignedValue('Platform Engineering'), false);
    assert.equal(isUnassignedValue('CC-DEV-101'), false);
    assert.equal(isUnassignedValue(undefined), true);
  });

  it('the filter sentinel is a single shared constant', () => {
    assert.equal(UNASSIGNED_FILTER_SENTINEL, '__unassigned__');
  });
});
