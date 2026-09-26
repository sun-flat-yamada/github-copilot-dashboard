import { Money } from '../../domain/value-objects/Money.js';
import {
  EnterpriseBillingConfig,
  calculateEffectiveCreditRate,
} from '../../domain/entities/billing-config.js';
import { BillingConfigLoader } from '../../adapters/storage/BillingConfigLoader.js';

export interface ModelCreditsDetail {
  modelName: string;
  creditsConsumed: number;
  ratePerCredit: number;
  costUsd: Money;
}

export interface CreditsCostSummary {
  totalCredits: number;
  totalCostUsd: Money;
  byModel: Record<string, ModelCreditsDetail>;
}

export interface CostCenterCreditsBudgetEvaluation {
  costCenter: string;
  monthlyBudgetUsd: number;
  seatSpendUsd: number;
  creditsSpendUsd: number;
  totalCombinedSpendUsd: number;
  budgetUtilizationPct: number;
  creditsLimit?: number;
  creditsConsumed: number;
  creditsUtilizationPct?: number;
  status: 'under_budget' | 'warning' | 'exceeded';
}

export class CreditsBillingService {
  public static readonly DEFAULT_CREDIT_RATE_USD = 0.05;

  /**
   * Calculates cost for consumed AI Credits using effective rate from config or provided override.
   */
  static calculateCreditsCost(
    creditsConsumed: number,
    ratePerCredit?: number,
    config: EnterpriseBillingConfig = BillingConfigLoader.load()
  ): Money {
    if (creditsConsumed <= 0) return Money.zero(config.currency.code);
    let effectiveRate: number;
    if (typeof ratePerCredit === 'number') {
      effectiveRate = ratePerCredit;
    } else if (config.customPricePerCredit !== undefined || config.discountPercent > 0 || config.currency.code !== 'USD') {
      effectiveRate = calculateEffectiveCreditRate(config);
    } else {
      effectiveRate = this.DEFAULT_CREDIT_RATE_USD;
    }
    return Money.of(creditsConsumed * effectiveRate, config.currency.code);
  }

  /**
   * Calculates breakdown and total costs from credits_by_model map.
   */
  static calculateModelCredits(
    creditsByModel: Record<string, number> = {},
    customRates: Record<string, number> = {},
    defaultRate?: number
  ): CreditsCostSummary {
    let totalCredits = 0;
    let totalCost = Money.zero();
    const byModel: Record<string, ModelCreditsDetail> = {};
    const fallbackRate = typeof defaultRate === 'number' ? defaultRate : this.DEFAULT_CREDIT_RATE_USD;

    for (const [model, credits] of Object.entries(creditsByModel)) {
      if (credits <= 0) continue;
      const rate = customRates[model] ?? fallbackRate;
      const cost = Money.fromUsd(credits * rate);

      totalCredits += credits;
      totalCost = totalCost.add(cost);

      byModel[model] = {
        modelName: model,
        creditsConsumed: credits,
        ratePerCredit: rate,
        costUsd: cost,
      };
    }

    return {
      totalCredits,
      totalCostUsd: totalCost,
      byModel,
    };
  }

  /**
   * Evaluates cost center budget combining seat spend and AI credits spend.
   */
  static evaluateBudget(
    budget: { cost_center: string; monthly_budget_usd: number; credits_limit?: number },
    seatSpendUsd: number,
    creditsConsumed: number,
    ratePerCredit: number = this.DEFAULT_CREDIT_RATE_USD
  ): CostCenterCreditsBudgetEvaluation {
    const creditsSpend = this.calculateCreditsCost(creditsConsumed, ratePerCredit).amount;
    const totalCombined = seatSpendUsd + creditsSpend;
    const budgetPct = budget.monthly_budget_usd > 0 ? (totalCombined / budget.monthly_budget_usd) * 100 : 0;

    let status: 'under_budget' | 'warning' | 'exceeded' = 'under_budget';
    if (budgetPct > 100 || (budget.credits_limit && creditsConsumed > budget.credits_limit)) {
      status = 'exceeded';
    } else if (budgetPct >= 80 || (budget.credits_limit && creditsConsumed >= budget.credits_limit * 0.8)) {
      status = 'warning';
    }

    const creditsUtilPct = budget.credits_limit && budget.credits_limit > 0
      ? (creditsConsumed / budget.credits_limit) * 100
      : undefined;

    return {
      costCenter: budget.cost_center,
      monthlyBudgetUsd: budget.monthly_budget_usd,
      seatSpendUsd: Number(seatSpendUsd.toFixed(2)),
      creditsSpendUsd: Number(creditsSpend.toFixed(2)),
      totalCombinedSpendUsd: Number(totalCombined.toFixed(2)),
      budgetUtilizationPct: Number(budgetPct.toFixed(1)),
      creditsLimit: budget.credits_limit,
      creditsConsumed,
      creditsUtilizationPct: creditsUtilPct !== undefined ? Number(creditsUtilPct.toFixed(1)) : undefined,
      status,
    };
  }

  /**
   * Prevents double billing between Monthly Usage Report CSV (usage lines) and Live Seat billing.
   * Seat licenses are base subscriptions; AI credits represent metered overage.
   */
  static calculateCombinedTotal(baseSeatCost: Money, meteredCreditsCost: Money): Money {
    return baseSeatCost.add(meteredCreditsCost);
  }
}
