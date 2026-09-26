import { Money } from '../value-objects/Money.js';

export interface SeatBillingEvaluation {
  billingEffectiveDate: string;
  isPrepaid: boolean;
  billedAmount: Money;
  isProrated: boolean;
  daysBilled: number;
}

export interface SeatBillingInput {
  createdAt: string;
  planType: 'business' | 'enterprise';
  monthlyPrice: Money;
  targetMonth: string; // 'YYYY-MM'
  daysInMonth: number;
  isPrepaid?: boolean;
}

/**
 * SDD-06 Specification: Seat Billing & Prepaid Evaluation Rule (D-5).
 * Determines billing effective date, proration, and prepaid status.
 */
export class SeatBillingRule {
  /**
   * Evaluates seat billing for a given month and plan.
   */
  static evaluate(input: SeatBillingInput): SeatBillingEvaluation {
    const { createdAt, monthlyPrice, targetMonth, daysInMonth, isPrepaid = false } = input;
    const createdDate = createdAt.slice(0, 10);
    const createdMonth = createdDate.slice(0, 7);

    // If seat was created after the target month, it is not billed in this month
    if (createdMonth > targetMonth) {
      return {
        billingEffectiveDate: createdDate,
        isPrepaid,
        billedAmount: Money.zero(),
        isProrated: false,
        daysBilled: 0,
      };
    }

    // Prepaid plan: Full month billing without proration
    if (isPrepaid) {
      return {
        billingEffectiveDate: createdDate,
        isPrepaid: true,
        billedAmount: monthlyPrice,
        isProrated: false,
        daysBilled: daysInMonth,
      };
    }

    // Month seat was created: Calculate proration from creation day to end of month
    if (createdMonth === targetMonth) {
      const createdDay = parseInt(createdDate.slice(8, 10), 10);
      const daysActive = Math.max(1, daysInMonth - createdDay + 1);
      const prorationFactor = daysActive / daysInMonth;
      const billedAmount = monthlyPrice.multiply(prorationFactor);

      return {
        billingEffectiveDate: createdDate,
        isPrepaid: false,
        billedAmount,
        isProrated: daysActive < daysInMonth,
        daysBilled: daysActive,
      };
    }

    // Seat was created before target month: Full monthly price applies
    return {
      billingEffectiveDate: `${targetMonth}-01`,
      isPrepaid: false,
      billedAmount: monthlyPrice,
      isProrated: false,
      daysBilled: daysInMonth,
    };
  }

  /**
   * Calculates prorated billing amount given days active.
   */
  static calculateProratedAmount(
    monthlyPrice: Money,
    daysActive: number,
    totalDaysInMonth: number
  ): Money {
    if (daysActive <= 0 || totalDaysInMonth <= 0) return Money.zero();
    if (daysActive >= totalDaysInMonth) return monthlyPrice;
    return monthlyPrice.multiply(daysActive / totalDaysInMonth);
  }
}
