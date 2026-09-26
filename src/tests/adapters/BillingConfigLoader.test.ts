import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  BillingConfigLoader,
} from '../../adapters/storage/BillingConfigLoader.js';
import {
  calculateEffectiveCreditRate,
  calculateEffectiveSeatPrice,
  DEFAULT_BILLING_CONFIG,
} from '../../domain/entities/billing-config.js';

describe('BillingConfigLoader & EA Pricing Tests', () => {
  it('returns default USD config when no configuration is provided', () => {
    const config = BillingConfigLoader.load(undefined);
    assert.equal(config.currency.code, 'USD');
    assert.equal(config.currency.symbol, '$');
    assert.equal(config.discountPercent, 0);

    const creditRate = calculateEffectiveCreditRate(config);
    assert.equal(creditRate, 0.01);

    const bizSeat = calculateEffectiveSeatPrice(config, 'business');
    assert.equal(bizSeat, 19);
  });

  it('parses JPY configuration with volume discount percentage', () => {
    const rawJson = JSON.stringify({
      currency: {
        code: 'JPY',
        symbol: '¥',
        exchangeRateFromUSD: 150.0,
        displayDecimals: 0,
      },
      discountPercent: 15,
    });

    const config = BillingConfigLoader.load(rawJson);
    assert.equal(config.currency.code, 'JPY');
    assert.equal(config.currency.symbol, '¥');
    assert.equal(config.discountPercent, 15);

    // AI Credit: 0.01 USD * 150 JPY/USD * (1 - 0.15) = 1.5 * 0.85 = 1.275
    const creditRate = calculateEffectiveCreditRate(config);
    assert.equal(creditRate, 1.275);

    // Business Seat: 19 USD * 150 * 0.85 = 2422.5
    const bizSeat = calculateEffectiveSeatPrice(config, 'business');
    assert.equal(bizSeat, 2422.5);
  });

  it('prioritizes direct customPricePerCredit (e.g. 1.273 JPY/AIC) over discount percentage', () => {
    const rawJson = JSON.stringify({
      currency: {
        code: 'JPY',
        symbol: '¥',
        exchangeRateFromUSD: 150.0,
        displayDecimals: 0,
      },
      discountPercent: 20,
      customPricePerCredit: 1.273, // Exact contractual rate
      customSeatPricing: {
        businessMonthly: 2500,
        enterpriseMonthly: 5000,
      },
    });

    const config = BillingConfigLoader.load(rawJson);
    assert.equal(config.customPricePerCredit, 1.273);

    // customPricePerCredit must be used directly, ignoring discountPercent
    const creditRate = calculateEffectiveCreditRate(config);
    assert.equal(creditRate, 1.273);

    // customSeatPricing must be used directly
    const bizSeat = calculateEffectiveSeatPrice(config, 'business');
    assert.equal(bizSeat, 2500);

    const entSeat = calculateEffectiveSeatPrice(config, 'enterprise');
    assert.equal(entSeat, 5000);
  });

  it('falls back safely to default on malformed JSON or invalid schema values', () => {
    const malformed = '{ invalid json ';
    const config1 = BillingConfigLoader.load(malformed);
    assert.deepEqual(config1, DEFAULT_BILLING_CONFIG);

    const invalidDiscount = JSON.stringify({ discountPercent: 150 }); // max is 100
    const config2 = BillingConfigLoader.load(invalidDiscount);
    assert.deepEqual(config2, DEFAULT_BILLING_CONFIG);
  });
});
