import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { SeatClassificationRule } from '../../domain/rules/SeatClassificationRule.js';
import { BudgetUtilizationRule } from '../../domain/rules/BudgetUtilizationRule.js';
import { Money } from '../../domain/value-objects/Money.js';

describe('Domain Business Rules Tests', () => {
  describe('SeatClassificationRule', () => {
    it('classifies never_used when daysInactive >= daysSinceCreation >= 7', () => {
      const status = SeatClassificationRule.classify({
        daysInactive: 10,
        daysSinceCreation: 10,
      });
      assert.equal(status, 'never_used');
    });

    it('classifies idle when daysInactive > 30', () => {
      const status = SeatClassificationRule.classify({
        daysInactive: 35,
        daysSinceCreation: 100,
      });
      assert.equal(status, 'idle');
    });

    it('classifies idle when daysInactive > 14 and zero AI credits consumed', () => {
      const status = SeatClassificationRule.classify({
        daysInactive: 20,
        daysSinceCreation: 100,
        aiCreditsUsed28d: 0,
      });
      assert.equal(status, 'idle');
    });

    it('classifies low_active when 14 < daysInactive <= 30 with active credits', () => {
      const status = SeatClassificationRule.classify({
        daysInactive: 20,
        daysSinceCreation: 100,
        aiCreditsUsed28d: 50,
      });
      assert.equal(status, 'low_active');
    });

    it('classifies active when daysInactive <= 14', () => {
      const status = SeatClassificationRule.classify({
        daysInactive: 5,
        daysSinceCreation: 100,
      });
      assert.equal(status, 'active');
    });
  });

  describe('BudgetUtilizationRule', () => {
    it('evaluates normal utilization when under 80%', () => {
      const limit = new Money(1000);
      const free = new Money(100);
      const spend = new Money(500);

      const result = BudgetUtilizationRule.evaluate(limit, free, spend);
      assert.equal(result.netBillable.amount, 400);
      assert.equal(result.remaining.amount, 600);
      assert.equal(result.utilizationPercent, 40);
      assert.equal(result.status, 'normal');
    });

    it('evaluates warning utilization when between 80% and 99.9%', () => {
      const limit = new Money(1000);
      const free = new Money(0);
      const spend = new Money(850);

      const result = BudgetUtilizationRule.evaluate(limit, free, spend);
      assert.equal(result.netBillable.amount, 850);
      assert.equal(result.remaining.amount, 150);
      assert.equal(result.utilizationPercent, 85);
      assert.equal(result.status, 'warning');
    });

    it('evaluates exceeded utilization when 100% or greater', () => {
      const limit = new Money(1000);
      const free = new Money(0);
      const spend = new Money(1200);

      const result = BudgetUtilizationRule.evaluate(limit, free, spend);
      assert.equal(result.netBillable.amount, 1200);
      assert.equal(result.remaining.amount, 0);
      assert.equal(result.utilizationPercent, 120);
      assert.equal(result.status, 'exceeded');
    });

    it('handles zero limit safely without division by zero', () => {
      const limit = new Money(0);
      const free = new Money(0);
      const spend = new Money(100);

      const result = BudgetUtilizationRule.evaluate(limit, free, spend);
      assert.equal(result.utilizationPercent, 0);
      assert.equal(result.status, 'normal');
    });
  });
});
