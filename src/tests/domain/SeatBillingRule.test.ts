import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { SeatBillingRule } from '../../domain/rules/SeatBillingRule.js';
import { Money } from '../../domain/value-objects/Money.js';

describe('SeatBillingRule Domain Rule Tests (P6-A-10)', () => {
  const monthlyEnterprise = Money.fromUsd(39.0);

  describe('evaluate', () => {
    it('returns zero billing for seat created after target month', () => {
      const evaluation = SeatBillingRule.evaluate({
        createdAt: '2026-10-15T00:00:00Z',
        planType: 'enterprise',
        monthlyPrice: monthlyEnterprise,
        targetMonth: '2026-09',
        daysInMonth: 30,
      });

      assert.equal(evaluation.billedAmount.amount, 0);
      assert.equal(evaluation.daysBilled, 0);
      assert.equal(evaluation.isProrated, false);
      assert.equal(evaluation.billingEffectiveDate, '2026-10-15');
    });

    it('returns full billing without proration when prepaid', () => {
      const evaluation = SeatBillingRule.evaluate({
        createdAt: '2026-09-15T00:00:00Z',
        planType: 'enterprise',
        monthlyPrice: monthlyEnterprise,
        targetMonth: '2026-09',
        daysInMonth: 30,
        isPrepaid: true,
      });

      assert.equal(evaluation.billedAmount.amount, 39.0);
      assert.equal(evaluation.isPrepaid, true);
      assert.equal(evaluation.isProrated, false);
      assert.equal(evaluation.daysBilled, 30);
    });

    it('calculates prorated billing in creation month', () => {
      // 9月16日作成 -> 9月30日まで15日間有効 (30日中15日 = 50%)
      const evaluation = SeatBillingRule.evaluate({
        createdAt: '2026-09-16T00:00:00Z',
        planType: 'enterprise',
        monthlyPrice: monthlyEnterprise,
        targetMonth: '2026-09',
        daysInMonth: 30,
      });

      assert.equal(evaluation.daysBilled, 15);
      assert.equal(evaluation.isProrated, true);
      assert.equal(evaluation.billedAmount.amount, 19.5); // 39 * (15/30) = 19.5
    });

    it('applies full monthly price for seat created before target month', () => {
      const evaluation = SeatBillingRule.evaluate({
        createdAt: '2026-07-01T00:00:00Z',
        planType: 'enterprise',
        monthlyPrice: monthlyEnterprise,
        targetMonth: '2026-09',
        daysInMonth: 30,
      });

      assert.equal(evaluation.billedAmount.amount, 39.0);
      assert.equal(evaluation.isProrated, false);
      assert.equal(evaluation.daysBilled, 30);
      assert.equal(evaluation.billingEffectiveDate, '2026-09-01');
    });
  });

  describe('calculateProratedAmount', () => {
    it('handles edge cases gracefully', () => {
      assert.equal(SeatBillingRule.calculateProratedAmount(monthlyEnterprise, 0, 30).amount, 0);
      assert.equal(SeatBillingRule.calculateProratedAmount(monthlyEnterprise, -5, 30).amount, 0);
      assert.equal(SeatBillingRule.calculateProratedAmount(monthlyEnterprise, 35, 30).amount, 39.0);
    });

    it('accurately prorates for partial month', () => {
      const prorated = SeatBillingRule.calculateProratedAmount(monthlyEnterprise, 10, 30);
      assert.equal(prorated.amount, 13.0); // 39 * 10 / 30 = 13.0
    });
  });
});
