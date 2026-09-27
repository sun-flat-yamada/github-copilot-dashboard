import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  EnterpriseBillingConfig,
  DEFAULT_BILLING_CONFIG,
  resolveBillingConfigForMonth,
  calculateEffectiveSeatPrice,
  calculateEffectiveCreditRate,
  calculateDualCreditRate,
} from '../../domain/entities/billing-config.js';
import { BillingConfigLoader } from '../../adapters/storage/BillingConfigLoader.js';
import { PublicExchangeRatesService } from '../../domain/services/PublicExchangeRatesService.js';
import { Money } from '../../domain/value-objects/Money.js';

describe('Period-based EA Billing Configuration & Public Exchange Rates Tests (#105)', () => {
  const samplePeriodConfig: EnterpriseBillingConfig = {
    ...DEFAULT_BILLING_CONFIG,
    discountPercent: 10, // Global default discount 10%
    subCurrency: {
      code: 'JPY',
      symbol: '¥',
      exchangeRateFromUSD: 150.0,
      displayDecimals: 0,
    },
    periods: [
      {
        startMonth: '2025-04',
        endMonth: '2026-03',
        discountPercent: 20, // 20% EA discount during FY2025
        seatPricing: {
          businessMonthlyUSD: 16,
          enterpriseMonthlyUSD: 32,
        },
        creditsPricing: {
          costPerCreditUSD: 0.008,
          includedCreditsPerSeat: 4000,
        },
        customPricePerCredit: 1.273, // 1.273 JPY / AIC
        customPricePerCreditCurrency: 'JPY',
        customSeatPricing: {
          businessMonthly: 2500,
          enterpriseMonthly: 5000,
          currency: 'JPY',
        },
        exchangeRateFromUSD: 155.0, // Specific negotiated rate for this period
      },
    ],
  };

  it('applies period-specific pricing and discount when month falls within startMonth and endMonth', () => {
    // 2025-06 falls in 2025-04 ~ 2026-03
    const resolved = resolveBillingConfigForMonth(samplePeriodConfig, '2025-06');

    assert.strictEqual(resolved.discountPercent, 20);
    assert.strictEqual(resolved.seatPricing.businessMonthlyUSD, 16);
    assert.strictEqual(resolved.seatPricing.enterpriseMonthlyUSD, 32);
    assert.strictEqual(resolved.creditsPricing.costPerCreditUSD, 0.008);
    assert.strictEqual(resolved.creditsPricing.includedCreditsPerSeat, 4000);
    assert.strictEqual(resolved.customPricePerCredit, 1.273);
    assert.strictEqual(resolved.customPricePerCreditCurrency, 'JPY');
    assert.strictEqual(resolved.subCurrency?.exchangeRateFromUSD, 155.0);

    // Custom seat pricing in target currency
    const bizSeatPrice = calculateEffectiveSeatPrice(resolved, 'business');
    const entSeatPrice = calculateEffectiveSeatPrice(resolved, 'enterprise');
    assert.strictEqual(bizSeatPrice, 2500);
    assert.strictEqual(entSeatPrice, 5000);

    // Custom credit rate
    const creditRate = calculateEffectiveCreditRate(resolved);
    assert.strictEqual(creditRate, 1.273);
  });

  it('falls back cleanly to default configuration when month is outside any period', () => {
    // 2025-02 is before 2025-04
    const resolvedBefore = resolveBillingConfigForMonth(samplePeriodConfig, '2025-02');
    assert.strictEqual(resolvedBefore.discountPercent, 10); // default
    assert.strictEqual(resolvedBefore.seatPricing.enterpriseMonthlyUSD, 39); // default catalog price
    assert.strictEqual(resolvedBefore.creditsPricing.costPerCreditUSD, 0.01); // default
    assert.strictEqual(resolvedBefore.customPricePerCredit, undefined);

    // 2026-05 is after 2026-03
    const resolvedAfter = resolveBillingConfigForMonth(samplePeriodConfig, '2026-05');
    assert.strictEqual(resolvedAfter.discountPercent, 10);
    assert.strictEqual(resolvedAfter.seatPricing.enterpriseMonthlyUSD, 39);
  });

  it('automatically calculates exchange rates from reliable public data (ECB/BOJ) for omitted periods', () => {
    const configWithoutExplicitRate: EnterpriseBillingConfig = {
      ...DEFAULT_BILLING_CONFIG,
      subCurrency: {
        code: 'JPY',
        symbol: '¥',
        exchangeRateFromUSD: 0, // Not explicitly set
        displayDecimals: 0,
      },
      periods: [
        {
          startMonth: '2025-01',
          endMonth: '2025-06',
          discountPercent: 15,
          // Note: exchangeRateFromUSD is intentionally omitted
        },
      ],
    };

    // PublicExchangeRatesService should provide the official rate for 2025-04 (150.5 JPY/USD)
    const resolved = resolveBillingConfigForMonth(configWithoutExplicitRate, '2025-04');
    assert.ok(resolved.subCurrency);
    assert.strictEqual(resolved.subCurrency.code, 'JPY');
    assert.strictEqual(resolved.subCurrency.exchangeRateFromUSD, 150.5);

    // Non-period month 2024-09 should resolve to official public rate for 2024-09 (143.1 JPY/USD)
    const resolved202409 = resolveBillingConfigForMonth(configWithoutExplicitRate, '2024-09');
    assert.strictEqual(resolved202409.subCurrency?.exchangeRateFromUSD, 143.1);

    // Public EUR test for 2025-01 (0.962 EUR/USD)
    const eurRate = PublicExchangeRatesService.getExchangeRate('EUR', '2025-01');
    assert.strictEqual(eurRate, 0.962);
  });

  it('parses and validates periods in BillingConfigLoader', () => {
    const rawJson = JSON.stringify({
      discountPercent: 5,
      periods: [
        {
          startMonth: '2026-01',
          endMonth: '2026-12',
          discountPercent: 25,
          seatPricing: {
            businessMonthlyUSD: 15,
            enterpriseMonthlyUSD: 30,
          },
          customPricePerCredit: 1.25,
          customPricePerCreditCurrency: 'JPY',
        },
      ],
    });

    const config = BillingConfigLoader.load(rawJson);
    assert.ok(Array.isArray(config.periods));
    assert.strictEqual(config.periods.length, 1);
    assert.strictEqual(config.periods[0].startMonth, '2026-01');
    assert.strictEqual(config.periods[0].discountPercent, 25);

    // Test loadForMonth
    const resolvedMatch = BillingConfigLoader.loadForMonth('2026-06', rawJson);
    assert.strictEqual(resolvedMatch.discountPercent, 25);
    assert.strictEqual(resolvedMatch.seatPricing.enterpriseMonthlyUSD, 30);

    const resolvedUnmatched = BillingConfigLoader.loadForMonth('2025-06', rawJson);
    assert.strictEqual(resolvedUnmatched.discountPercent, 5);
    assert.strictEqual(resolvedUnmatched.seatPricing.enterpriseMonthlyUSD, 39);
  });

  it('supports EA-USD sub-currency display with dual catalog USD and EA contracted USD', () => {
    const eaUsdConfig: EnterpriseBillingConfig = {
      ...DEFAULT_BILLING_CONFIG,
      discountPercent: 15, // 15% EA discount
      subCurrency: {
        code: 'EA-USD',
        symbol: '$',
        exchangeRateFromUSD: 0.85, // 1 - 15/100
        displayDecimals: 2,
      },
    };

    // Credit rate dual calculation
    const dualCredit = calculateDualCreditRate(eaUsdConfig);
    assert.strictEqual(dualCredit.usdRate, 0.01); // Catalog price: $0.01
    assert.strictEqual(dualCredit.subRate, 0.0085); // EA discounted price: $0.0085
    assert.ok(dualCredit.formattedCombined.includes('$0.01 / AIC'));
    assert.ok(dualCredit.formattedCombined.includes('$0.0085 / AIC (EA)'));

    // Money dual formatting with EA-USD
    const money = Money.fromUsd(39.0); // Catalog price: $39.00
    const dual = money.formatDual(eaUsdConfig.subCurrency);
    assert.strictEqual(dual.usd, '$39.00');
    assert.strictEqual(dual.sub, '$33.15 EA');
    assert.strictEqual(dual.combined, '$39.00 ($33.15 EA)');
  });

  it('supports EA-JPY and EA-EUR sub-currency resolution with period exchangeRates', () => {
    const rawJson = JSON.stringify({
      currency: { code: 'USD', symbol: '$', exchangeRateFromUSD: 1.0, displayDecimals: 2 },
      subCurrency: { code: 'EA-JPY', symbol: '¥', exchangeRateFromUSD: 150.0, displayDecimals: 0 },
      periods: [
        {
          startMonth: '2025-04',
          endMonth: '2026-03',
          exchangeRates: {
            JPY: 155.0,
            EUR: 0.92,
          },
        },
      ],
    });

    const resolved = BillingConfigLoader.loadForMonth('2025-06', rawJson);
    assert.strictEqual(resolved.subCurrency?.code, 'EA-JPY');
    assert.strictEqual(resolved.subCurrency?.exchangeRateFromUSD, 155.0);

    const money = Money.fromUsd(39.0);
    const dual = money.formatDual(resolved.subCurrency);
    assert.strictEqual(dual.usd, '$39.00');
    assert.strictEqual(dual.sub, '¥6,045');
    assert.strictEqual(dual.combined, '$39.00 (¥6,045)');
  });

  it('normalizes intuitive aliases for seatPricing, creditPricing, and exchangeRates (#115)', () => {
    const rawJsonWithAliases = JSON.stringify({
      discountPercent: 10,
      subCurrency: {
        code: 'JPY',
        symbol: '¥',
        exchangeRateFromUSD: 150.0,
        displayDecimals: 0,
      },
      // Root-level aliases
      seatPricing: {
        enterprise: 5000,
        business: 2500,
        currency: 'JPY',
      },
      creditPricing: {
        pricePerCredit: 1.273,
        currency: 'JPY',
      },
      periods: [
        {
          startMonth: '2025-04',
          endMonth: '2026-03',
          discountPercent: 20,
          seatPricing: {
            enterprise: 4800,
            business: 2400,
            currency: 'JPY',
          },
          creditPricing: {
            pricePerCredit: 1.25,
            currency: 'JPY',
          },
          exchangeRates: {
            JPY: 155.0,
            EUR: 0.92,
          },
        },
      ],
    });

    const config = BillingConfigLoader.load(rawJsonWithAliases);

    // Verify root normalization
    assert.strictEqual(config.customPricePerCredit, 1.273);
    assert.strictEqual(config.customPricePerCreditCurrency, 'JPY');
    assert.strictEqual(config.subCurrency?.exchangeRateFromUSD, 150.0);
    assert.deepStrictEqual(config.customSeatPricing, {
      enterpriseMonthly: 5000,
      businessMonthly: 2500,
      currency: 'JPY',
    });

    // Verify period normalization for 2025-06 (within period: uses 155.0)
    const periodResolved = BillingConfigLoader.loadForMonth('2025-06', rawJsonWithAliases);
    assert.strictEqual(periodResolved.discountPercent, 20);
    assert.strictEqual(periodResolved.customPricePerCredit, 1.25);
    assert.strictEqual(periodResolved.customPricePerCreditCurrency, 'JPY');
    assert.deepStrictEqual(periodResolved.customSeatPricing, {
      enterpriseMonthly: 4800,
      businessMonthly: 2400,
      currency: 'JPY',
    });
    assert.strictEqual(periodResolved.subCurrency?.exchangeRateFromUSD, 155.0);

    // Verify fallback month (2025-02: out-of-period month auto-calculates public rate 154.2)
    const rootResolved = BillingConfigLoader.loadForMonth('2025-02', rawJsonWithAliases);
    assert.strictEqual(rootResolved.discountPercent, 10);
    assert.strictEqual(rootResolved.customPricePerCredit, 1.273);
    assert.deepStrictEqual(rootResolved.customSeatPricing, {
      enterpriseMonthly: 5000,
      businessMonthly: 2500,
      currency: 'JPY',
    });
    assert.strictEqual(rootResolved.subCurrency?.exchangeRateFromUSD, 154.2);
  });
});
