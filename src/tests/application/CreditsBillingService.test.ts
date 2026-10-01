import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { CreditsBillingService } from '../../application/services/CreditsBillingService.js';
import { Money } from '../../domain/value-objects/Money.js';
import { getCreditUnitPriceUsd } from '../../domain/pricing/pricing-catalog.js';

describe('CreditsBillingService Tests (P6-A-9)', () => {
  describe('calculateCreditsCost', () => {
    it('returns zero money for zero or negative credits', () => {
      assert.equal(CreditsBillingService.calculateCreditsCost(0).amount, 0);
      assert.equal(CreditsBillingService.calculateCreditsCost(-10).amount, 0);
    });

    it('calculates cost using the catalog unit price of $0.01 per credit', () => {
      const cost = CreditsBillingService.calculateCreditsCost(100);
      assert.equal(cost.amount, 1.0);
      assert.equal(cost.format(), '$1.00');
    });

    it('uses the same unit price as the pricing catalog (no service-specific default rate)', () => {
      // 以前はこのサービスだけ固定の $0.05 を持ち、パイプライン集計 ($0.01) と同じ消費量で 5 倍ずれていた
      const cost = CreditsBillingService.calculateCreditsCost(1000, undefined, undefined, '2026-09');
      assert.equal(cost.amount, Number((1000 * getCreditUnitPriceUsd('2026-09')).toFixed(2)));
    });

    it('supports custom credit rates', () => {
      const cost = CreditsBillingService.calculateCreditsCost(200, 0.08);
      assert.equal(cost.amount, 16.0);
    });

    it('calculates cost using EA contractual custom rate (e.g. 1.273 JPY/AIC)', () => {
      const eaConfig = {
        currency: { code: 'JPY', symbol: '¥', exchangeRateFromUSD: 150, displayDecimals: 0 },
        seatPricing: { businessMonthlyUSD: 19, enterpriseMonthlyUSD: 39 },
        creditsPricing: { costPerCreditUSD: 0.01, includedCreditsPerSeat: 3900 },
        discountPercent: 15,
        customPricePerCredit: 1.273, // Contractual exact unit rate
      };
      const cost = CreditsBillingService.calculateCreditsCost(1000, undefined, eaConfig);
      assert.equal(cost.amount, 1273);
      assert.equal(cost.currency, 'JPY');
      assert.equal(cost.formatWithCurrency(eaConfig.currency), '¥1,273');
    });
  });

  describe('calculateModelCredits', () => {
    it('handles empty breakdown gracefully', () => {
      const summary = CreditsBillingService.calculateModelCredits({});
      assert.equal(summary.totalCredits, 0);
      assert.equal(summary.totalCostUsd.amount, 0);
      assert.deepEqual(summary.byModel, {});
    });

    it('aggregates credits and calculates cost per model', () => {
      const breakdown = {
        'claude-3-7-sonnet': 200,
        'gpt-4o': 100,
        'o1': 50,
      };
      const summary = CreditsBillingService.calculateModelCredits(breakdown, {
        'claude-3-7-sonnet': 0.06,
      });

      assert.equal(summary.totalCredits, 350);
      // claude: 200 * 0.06 (モデル別の上書き単価) = 12.00
      // gpt-4o: 100 * 0.01 (カタログ単価) = 1.00
      // o1: 50 * 0.01 (カタログ単価) = 0.50
      // total = 13.50
      assert.equal(summary.totalCostUsd.amount, 13.5);
      assert.equal(summary.byModel['claude-3-7-sonnet'].costUsd.amount, 12.0);
      assert.equal(summary.byModel['gpt-4o'].costUsd.amount, 1.0);
      assert.equal(summary.byModel['o1'].costUsd.amount, 0.5);
    });
  });

  describe('evaluateBudget', () => {
    it('returns under_budget when utilization is below 80%', () => {
      const budget = { cost_center: 'FinTech-Division', monthly_budget_usd: 1000, credits_limit: 500 };
      const evalResult = CreditsBillingService.evaluateBudget(budget, 500, 100); // 500 + 1 = 501 / 1000 = 50.1%
      assert.equal(evalResult.status, 'under_budget');
      assert.equal(evalResult.totalCombinedSpendUsd, 501);
      assert.equal(evalResult.budgetUtilizationPct, 50.1);
    });

    it('returns warning when utilization is between 80% and 100%', () => {
      const budget = { cost_center: 'Cloud-Platform', monthly_budget_usd: 1000, credits_limit: 500 };
      const evalResult = CreditsBillingService.evaluateBudget(budget, 800, 100); // 800 + 1 = 801 / 1000 = 80.1%
      assert.equal(evalResult.status, 'warning');
      assert.equal(evalResult.budgetUtilizationPct, 80.1);
    });

    it('returns exceeded when combined spend exceeds budget', () => {
      const budget = { cost_center: 'Research-and-AI', monthly_budget_usd: 1000 };
      const evalResult = CreditsBillingService.evaluateBudget(budget, 950, 6000); // 950 + 60 = 1010 / 1000 = 101%
      assert.equal(evalResult.status, 'exceeded');
      assert.equal(evalResult.budgetUtilizationPct, 101);
    });

    it('returns exceeded when credits_limit is strictly exceeded', () => {
      const budget = { cost_center: 'Research-and-AI', monthly_budget_usd: 5000, credits_limit: 100 };
      const evalResult = CreditsBillingService.evaluateBudget(budget, 100, 150); // spend 101.5/5000 (2%), but credits 150 > 100
      assert.equal(evalResult.status, 'exceeded');
    });
  });

  describe('calculateCombinedTotal', () => {
    it('prevents double billing and calculates clean sum of base seat and metered credits', () => {
      const baseSeat = Money.fromUsd(39.0);
      const meteredCredits = Money.fromUsd(12.5);
      const combined = CreditsBillingService.calculateCombinedTotal(baseSeat, meteredCredits);
      assert.equal(combined.amount, 51.5);
      assert.equal(combined.format(), '$51.50');
    });
  });
});
