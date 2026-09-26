import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { Money } from '../../domain/value-objects/Money.js';
import { DEFAULT_CURRENCY_USD, DEFAULT_CURRENCY_JPY } from '../../domain/entities/billing-config.js';

describe('Money Multi-Currency & Precision Tests', () => {
  it('formats money with default USD settings', () => {
    const m = Money.fromUsd(1234.5);
    assert.equal(m.format(), '$1,234.50');
    assert.equal(m.formatWithCurrency(DEFAULT_CURRENCY_USD), '$1,234.50');
  });

  it('formats money in JPY with zero decimals by default', () => {
    const m = new Money(15000, 'JPY');
    assert.equal(m.formatWithCurrency(DEFAULT_CURRENCY_JPY), '¥15,000');
  });

  it('formats contract rate with custom precision (e.g. 1.273 JPY/AIC)', () => {
    const unitPrice = new Money(1.273, 'JPY');
    assert.equal(unitPrice.formatWithCurrency(DEFAULT_CURRENCY_JPY, { precision: 3 }), '¥1.273');
    assert.equal(unitPrice.formatWithCurrency(DEFAULT_CURRENCY_JPY, { precision: 4 }), '¥1.2730');
  });

  it('applies volume discount correctly', () => {
    const base = Money.fromUsd(100);
    const discounted = base.applyDiscount(15); // 15% OFF
    assert.equal(discounted.amount, 85);

    const zeroDiscount = base.applyDiscount(0);
    assert.equal(zeroDiscount.amount, 100);

    const fullDiscount = base.applyDiscount(100);
    assert.equal(fullDiscount.amount, 0);
  });

  it('converts currency using exchange rate', () => {
    const usd = Money.fromUsd(10);
    const jpy = usd.convertCurrency(150, 'JPY');
    assert.equal(jpy.amount, 1500);
    assert.equal(jpy.currency, 'JPY');
  });
});
