import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { Money, getSeatPricing } from '../../domain/value-objects/Money.js';
import { BASELINE_PRICING } from '../../domain/pricing/pricing-catalog.js';
import { HealthScore } from '../../domain/value-objects/HealthScore.js';
import { DomainError } from '../../domain/value-objects/DomainError.js';

describe('Domain Value Objects Tests', () => {
  describe('DomainError', () => {
    it('creates an error instance with name DomainError', () => {
      const err = new DomainError('Test error');
      assert.equal(err.name, 'DomainError');
      assert.equal(err.message, 'Test error');
      assert.ok(err instanceof Error);
    });
  });

  describe('Money', () => {
    it('creates Money and formats currency in USD', () => {
      const m = new Money(1234.5);
      assert.equal(m.amount, 1234.5);
      assert.equal(m.currency, 'USD');
      assert.equal(m.format(), '$1,234.50');
    });

    it('performs addition, subtraction, and multiplication', () => {
      const m1 = new Money(100);
      const m2 = new Money(40.5);

      const sum = m1.add(m2);
      assert.equal(sum.amount, 140.5);

      const diff = m1.subtract(m2);
      assert.equal(diff.amount, 59.5);

      const product = m2.multiply(2);
      assert.equal(product.amount, 81);
    });

    it('checks zero and positive status', () => {
      assert.equal(Money.zero().isZero(), true);
      assert.equal(new Money(10).isPositive(), true);
      assert.equal(new Money(0).isPositive(), false);
    });

    it('throws DomainError on non-finite amounts', () => {
      assert.throws(() => new Money(NaN), { name: 'DomainError' });
      assert.throws(() => new Money(Infinity), { name: 'DomainError' });
    });
  });

  describe('HealthScore', () => {
    it('creates valid score and determines healthStatus', () => {
      const healthy = new HealthScore(85);
      assert.equal(healthy.value, 85);
      assert.equal(healthy.status, 'healthy');

      const warning = new HealthScore(55);
      assert.equal(warning.value, 55);
      assert.equal(warning.status, 'warning');

      const critical = new HealthScore(20);
      assert.equal(critical.value, 20);
      assert.equal(critical.status, 'critical');
    });

    it('throws DomainError for out-of-bounds values', () => {
      assert.throws(() => new HealthScore(-1), { name: 'DomainError' });
      assert.throws(() => new HealthScore(101), { name: 'DomainError' });
    });
  });
});

describe('getSeatPricing (no environment access in the domain, C-07)', () => {
  it('returns the catalog prices without an override, even when COPILOT_SEAT_PRICING_OVERRIDE is set', () => {
    const saved = process.env.COPILOT_SEAT_PRICING_OVERRIDE;
    process.env.COPILOT_SEAT_PRICING_OVERRIDE = '{"business": 1, "enterprise": 2}';
    try {
      const p = getSeatPricing();
      assert.equal(p.business.amount, BASELINE_PRICING.seatPriceUsd.business);
      assert.equal(p.enterprise.amount, BASELINE_PRICING.seatPriceUsd.enterprise);
    } finally {
      if (saved === undefined) delete process.env.COPILOT_SEAT_PRICING_OVERRIDE;
      else process.env.COPILOT_SEAT_PRICING_OVERRIDE = saved;
    }
  });

  it('applies an override passed by the caller (JSON and key=value forms)', () => {
    assert.equal(getSeatPricing('{"business": 21}').business.amount, 21);
    assert.equal(getSeatPricing('{"business": 21}').enterprise.amount, BASELINE_PRICING.seatPriceUsd.enterprise);
    const kv = getSeatPricing('business=20,enterprise=40.5');
    assert.equal(kv.business.amount, 20);
    assert.equal(kv.enterprise.amount, 40.5);
  });
});
