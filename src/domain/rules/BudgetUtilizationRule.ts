import { Money } from '../value-objects/Money.js';

export interface BudgetEvaluationResult {
  netBillable: Money;
  remaining: Money;
  utilizationPercent: number;
  status: 'normal' | 'warning' | 'exceeded';
}

/** CostCenterBudget の派生フィールドと同じ形 (USD の数値) */
export interface BudgetEvaluationUsd {
  net_billable_spend_usd: number;
  remaining_budget_usd: number;
  budget_utilization_percent: number;
  status: 'normal' | 'warning' | 'exceeded';
}

/** 警告 (warning) とする使用率 (%) の下限 */
export const BUDGET_WARNING_PERCENT = 80;
/** 超過 (exceeded) とする使用率 (%) の下限 */
export const BUDGET_EXCEEDED_PERCENT = 100;

/**
 * SDD-06 Specification Budget Utilization Rule — Cost Center 予算評価の唯一の実装。
 * Uses Money Value Object to calculate net billable spend, remaining budget, and status threshold.
 *
 * パイプライン (BillingCalculator)・フィルター再集計 (filterEngine)・月次レポートの予算 (App) は、
 * それぞれ別の計算式を持っていた (残余が負になる箇所とならない箇所、フィルター時に使用率/ステータスが
 * 更新されない等)。すべてこのルール経由に統一する。
 *
 * - 課金対象実使用額 = max(0, 現在使用額 - 無料枠)
 * - 残余 = max(0, 上限 - 課金対象実使用額)
 * - 使用率 = 課金対象実使用額 / 上限 × 100 (上限が 0 以下のときは 0)
 */
export class BudgetUtilizationRule {
  static evaluate(limit: Money, free: Money, currentSpend: Money): BudgetEvaluationResult {
    const netBillableAmount = Math.max(0, currentSpend.amount - free.amount);
    const remainingAmount = Math.max(0, limit.amount - netBillableAmount);
    const utilizationPercent = limit.amount > 0 ? (netBillableAmount / limit.amount) * 100 : 0;

    const status: 'normal' | 'warning' | 'exceeded' =
      utilizationPercent >= BUDGET_EXCEEDED_PERCENT
        ? 'exceeded'
        : utilizationPercent >= BUDGET_WARNING_PERCENT
        ? 'warning'
        : 'normal';

    return {
      netBillable: new Money(netBillableAmount),
      remaining: new Money(remainingAmount),
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      status,
    };
  }

  /**
   * USD の数値で扱う呼び出し側 (パイプライン / ブラウザ) 向け。計算は evaluate() に委譲し、
   * 金額は小数 2 桁、使用率は表示精度の小数 1 桁に丸める。
   */
  static evaluateUsd(limitUsd: number, freeUsd: number, spendUsd: number): BudgetEvaluationUsd {
    const result = BudgetUtilizationRule.evaluate(
      Money.fromUsd(limitUsd),
      Money.fromUsd(freeUsd),
      Money.fromUsd(spendUsd)
    );
    return {
      net_billable_spend_usd: Number(result.netBillable.amount.toFixed(2)),
      remaining_budget_usd: Number(result.remaining.amount.toFixed(2)),
      budget_utilization_percent: Number(result.utilizationPercent.toFixed(1)),
      status: result.status,
    };
  }
}
