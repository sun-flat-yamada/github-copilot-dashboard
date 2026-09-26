import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { Money } from '../../domain/value-objects/Money.js';
import {
  CurrencyConfig,
  DEFAULT_CURRENCY_USD,
  DEFAULT_CURRENCY_JPY,
  calculateDualCreditRate,
  DEFAULT_BILLING_CONFIG,
  EnterpriseBillingConfig,
} from '../../domain/entities/billing-config.js';
import { BudgetPresenter } from '../../adapters/presenters/BudgetPresenter.js';
import { CreditsPresenter } from '../../adapters/presenters/CreditsPresenter.js';
import { CostCenterBudget } from '../../domain/entities/copilot.js';

describe('Money Value Object Dual Currency Tests', () => {
  it('formats USD alone when sub-currency is null or undefined', () => {
    const money = new Money(1234.56, 'USD');
    assert.strictEqual(money.formatWithSubCurrency(null), '$1,234.56');
    assert.strictEqual(money.formatWithSubCurrency(undefined), '$1,234.56');

    const dual = money.formatDual(null);
    assert.strictEqual(dual.usd, '$1,234.56');
    assert.strictEqual(dual.sub, undefined);
    assert.strictEqual(dual.combined, '$1,234.56');
  });

  it('formats USD alone when sub-currency is set to USD', () => {
    const money = new Money(1234.56, 'USD');
    assert.strictEqual(money.formatWithSubCurrency(DEFAULT_CURRENCY_USD), '$1,234.56');

    const dual = money.formatDual(DEFAULT_CURRENCY_USD);
    assert.strictEqual(dual.usd, '$1,234.56');
    assert.strictEqual(dual.sub, undefined);
    assert.strictEqual(dual.combined, '$1,234.56');
  });

  it('formats USD primary with JPY sub-currency in parentheses', () => {
    const money = new Money(1000, 'USD');
    const jpyConfig: CurrencyConfig = {
      code: 'JPY',
      symbol: '¥',
      exchangeRateFromUSD: 155.0,
      displayDecimals: 0,
    };

    const dual = money.formatDual(jpyConfig);
    assert.strictEqual(dual.usd, '$1,000.00');
    assert.strictEqual(dual.sub, '¥155,000');
    assert.strictEqual(dual.combined, '$1,000.00 (¥155,000)');
    assert.strictEqual(money.formatWithSubCurrency(jpyConfig), '$1,000.00 (¥155,000)');
  });

  it('formats USD primary with EUR sub-currency in parentheses', () => {
    const money = new Money(100, 'USD');
    const eurConfig: CurrencyConfig = {
      code: 'EUR',
      symbol: '€',
      exchangeRateFromUSD: 0.92,
      displayDecimals: 2,
    };

    const dual = money.formatDual(eurConfig);
    assert.strictEqual(dual.usd, '$100.00');
    assert.strictEqual(dual.sub, '€92.00');
    assert.strictEqual(dual.combined, '$100.00 (€92.00)');
  });

  it('respects custom precision options', () => {
    const money = new Money(5000, 'USD');
    const jpyConfig = DEFAULT_CURRENCY_JPY;

    const dual = money.formatDual(jpyConfig, { precisionUSD: 0, precisionSub: 0 });
    assert.strictEqual(dual.usd, '$5,000');
    assert.strictEqual(dual.sub, '¥750,000');
    assert.strictEqual(dual.combined, '$5,000 (¥750,000)');
  });

  it('supports static formatDualAmount helper', () => {
    const dual = Money.formatDualAmount(250, DEFAULT_CURRENCY_JPY);
    assert.strictEqual(dual.usd, '$250.00');
    assert.strictEqual(dual.combined, '$250.00 (¥37,500)');
  });
});

describe('calculateDualCreditRate Tests', () => {
  it('returns default USD rate when no sub-currency is specified', () => {
    const rate = calculateDualCreditRate(DEFAULT_BILLING_CONFIG);
    assert.strictEqual(rate.usdRate, 0.01);
    assert.strictEqual(rate.subRate, undefined);
    assert.strictEqual(rate.formattedUSD, '$0.01 / AIC');
    assert.strictEqual(rate.formattedSub, undefined);
    assert.strictEqual(rate.formattedCombined, '$0.01 / AIC');
  });

  it('computes dual rate with volume discount and sub-currency', () => {
    const config: EnterpriseBillingConfig = {
      ...DEFAULT_BILLING_CONFIG,
      subCurrency: {
        code: 'JPY',
        symbol: '¥',
        exchangeRateFromUSD: 150.0,
        displayDecimals: 0,
      },
      discountPercent: 15,
    };

    const rate = calculateDualCreditRate(config);
    // Base 0.01 * 0.85 = 0.0085 USD/AIC
    assert.strictEqual(rate.usdRate, 0.0085);
    // Sub 0.0085 * 150 = 1.275 JPY/AIC
    assert.strictEqual(rate.subRate, 1.275);
    assert.strictEqual(rate.formattedUSD, '$0.0085 / AIC');
    assert.strictEqual(rate.formattedSub, '¥1.275 / AIC');
    assert.strictEqual(rate.formattedCombined, '$0.0085 / AIC (¥1.275 / AIC)');
  });

  it('computes dual rate when direct contract customPricePerCredit is defined in JPY', () => {
    const config: EnterpriseBillingConfig = {
      ...DEFAULT_BILLING_CONFIG,
      subCurrency: {
        code: 'JPY',
        symbol: '¥',
        exchangeRateFromUSD: 155.0,
        displayDecimals: 0,
      },
      customPricePerCredit: 1.273, // Contractual rate in JPY
    };

    const rate = calculateDualCreditRate(config);
    assert.strictEqual(rate.subRate, 1.273);
    // USD rate = 1.273 / 155 = 0.0082129... -> rounded to 0.0082
    assert.strictEqual(rate.usdRate, 0.0082);
    assert.strictEqual(rate.formattedSub, '¥1.273 / AIC');
    assert.strictEqual(rate.formattedUSD, '$0.0082 / AIC');
    assert.strictEqual(rate.formattedCombined, '$0.0082 / AIC (¥1.273 / AIC)');
  });
});

describe('Presenter Dual Currency Integration Tests', () => {
  it('BudgetPresenter formats spending limit with dual amounts', () => {
    const mockBudgets: CostCenterBudget[] = [
      {
        cost_center_id: 'cc-1',
        cost_center_code: 'CC-FE-01',
        cost_center_name: 'Frontend Engineering',
        spending_limit_usd: 1000,
        current_spend_usd: 600,
        free_tier_budget_usd: 100,
        net_billable_spend_usd: 500,
        remaining_budget_usd: 500,
        budget_utilization_percent: 50,
        status: 'normal',
      },
    ];

    const vm = BudgetPresenter.present({
      budgets: mockBudgets,
      activeSource: 'live_metrics',
    });

    assert.strictEqual(vm.currencySymbol, '$');
    assert.strictEqual(vm.cards.length, 1);
    const card = vm.cards[0];
    assert.ok(card.spendingLimitFormatted.startsWith('$1,000.00'));
    assert.strictEqual(card.spendingLimitUsd, '$1,000.00');
  });

  it('CreditsPresenter formats effectiveRate and costs with USD primary', () => {
    const vm = CreditsPresenter.present({
      currentData: {
        overview: {
          total_spend_usd: 500,
          total_seats: 10,
          total_ai_credits_used: 10000,
        } as any,
        users: [],
        scope_type: 'monthly',
        scope_key: '2026-09',
        date_range: {
          start: '2026-09-01',
          end: '2026-09-30',
          days_count: 30,
        },
      } as any,
    });

    assert.strictEqual(vm.currencySymbol, '$');
    assert.ok(vm.effectiveRateFormatted.startsWith('$0.01 / AIC'));
    assert.ok(vm.totalCreditsCostFormatted.startsWith('$100.00'));
  });
});
