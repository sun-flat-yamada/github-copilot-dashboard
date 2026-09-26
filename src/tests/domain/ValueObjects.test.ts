import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateRange } from '../../domain/value-objects/DateRange.js';
import { Money } from '../../domain/value-objects/Money.js';
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

  describe('DateRange', () => {
    it('creates valid date range and calculates days count', () => {
      const range = new DateRange('2026-09-01', '2026-09-10');
      assert.equal(range.start, '2026-09-01');
      assert.equal(range.end, '2026-09-10');
      assert.equal(range.daysCount, 10);
    });

    it('throws DomainError when start > end', () => {
      assert.throws(() => new DateRange('2026-09-15', '2026-09-10'), {
        name: 'DomainError',
      });
    });

    it('throws DomainError when dates are empty', () => {
      assert.throws(() => new DateRange('', '2026-09-10'), {
        name: 'DomainError',
      });
    });

    it('correctly checks contains', () => {
      const range = new DateRange('2026-09-01', '2026-09-10');
      assert.equal(range.contains('2026-09-05'), true);
      assert.equal(range.contains('2026-09-01'), true);
      assert.equal(range.contains('2026-09-10'), true);
      assert.equal(range.contains('2026-08-31'), false);
      assert.equal(range.contains('2026-09-11'), false);
    });

    it('correctly checks equality', () => {
      const range1 = new DateRange('2026-09-01', '2026-09-10');
      const range2 = new DateRange('2026-09-01', '2026-09-10');
      const range3 = new DateRange('2026-09-01', '2026-09-15');
      assert.equal(range1.equals(range2), true);
      assert.equal(range1.equals(range3), false);
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
