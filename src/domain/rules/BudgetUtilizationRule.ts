import { Money } from '../value-objects/Money.js';

export interface BudgetEvaluationResult {
  netBillable: Money;
  remaining: Money;
  utilizationPercent: number;
  status: 'normal' | 'warning' | 'exceeded';
}

/**
 * SDD-06 Specification Budget Utilization Rule.
 * Uses Money Value Object to calculate net billable spend, remaining budget, and status threshold.
 */
export class BudgetUtilizationRule {
  static evaluate(limit: Money, free: Money, currentSpend: Money): BudgetEvaluationResult {
    const netBillableAmount = Math.max(0, currentSpend.amount - free.amount);
    const remainingAmount = Math.max(0, limit.amount - netBillableAmount);
    const utilizationPercent = limit.amount > 0 ? (netBillableAmount / limit.amount) * 100 : 0;

    const status: 'normal' | 'warning' | 'exceeded' =
      utilizationPercent >= 100
        ? 'exceeded'
        : utilizationPercent >= 80
        ? 'warning'
        : 'normal';

    return {
      netBillable: new Money(netBillableAmount),
      remaining: new Money(remainingAmount),
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      status,
    };
  }
}
