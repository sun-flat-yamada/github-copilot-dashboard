import { Money } from '../../domain/value-objects/Money.js';
import {
  EnterpriseBillingConfig,
  calculateEffectiveCreditRate,
} from '../../domain/entities/billing-config.js';
import {
  CATALOG_BILLING_CONFIG_PROVIDER,
  type IBillingConfigProvider,
} from '../../domain/ports/IBillingConfigProvider.js';
import { getCreditUnitPriceUsd } from '../../domain/pricing/pricing-catalog.js';

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

/**
 * AI クレジットの金額計算。単価は価格カタログ (src/domain/pricing) と請求設定
 * (EnterpriseBillingConfig) から解決する唯一の経路で、サービス固有の既定単価は持たない。
 * (以前は固定の $0.05 を持ち、パイプライン集計の $0.01 と同じ消費量で 5 倍ずれていた)
 */
export class CreditsBillingService {
  /**
   * 設定を渡されなかったときの取得元 (Port)。Composition Root が BillingConfigLoader のアダプタを注入する。
   * 未注入なら価格カタログの既定値 (I/O なし)。
   */
  private static billingConfig: IBillingConfigProvider = CATALOG_BILLING_CONFIG_PROVIDER;

  /** 請求設定の取得元を差し替える (Composition Root / テスト用)。引数なしで価格カタログの既定値へ戻す */
  static useBillingConfigProvider(provider: IBillingConfigProvider = CATALOG_BILLING_CONFIG_PROVIDER): void {
    this.billingConfig = provider;
  }

  /**
   * Calculates cost for consumed AI Credits using effective rate from config or provided override.
   * 設定が無ければ価格カタログの単価 ($0.01 / credit) になる。
   */
  static calculateCreditsCost(
    creditsConsumed: number,
    ratePerCredit?: number,
    config?: EnterpriseBillingConfig,
    targetMonth?: string
  ): Money {
    const resolvedConfig = config ?? this.billingConfig.loadForMonth(targetMonth);
    if (creditsConsumed <= 0) return Money.zero(resolvedConfig.currency.code);
    const effectiveRate =
      typeof ratePerCredit === 'number' ? ratePerCredit : calculateEffectiveCreditRate(resolvedConfig);
    return Money.of(creditsConsumed * effectiveRate, resolvedConfig.currency.code);
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
    const fallbackRate = typeof defaultRate === 'number' ? defaultRate : getCreditUnitPriceUsd();

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
    ratePerCredit?: number
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
