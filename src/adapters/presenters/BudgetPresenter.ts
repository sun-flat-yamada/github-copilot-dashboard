import { CostCenterBudget, DataSourceType } from '../../domain/entities/copilot.js';

export interface FormattedBudgetCard {
  costCenterId: string;
  costCenterName: string;
  spendingLimitFormatted: string;
  currentSpendFormatted: string;
  freeTierFormatted: string;
  netBillableFormatted: string;
  remainingBudgetFormatted: string;
  utilizationPercent: number;
  status: 'normal' | 'warning' | 'exceeded';
  statusColor: string;
  isOverBudget: boolean;
}

export interface BudgetSummaryViewModel {
  totalLimitFormatted: string;
  totalLimitRaw: number;
  totalSpendFormatted: string;
  totalSpendRaw: number;
  totalRemainingFormatted: string;
  totalRemainingRaw: number;
  overallUtilizationPercent: number;
  alertCount: number;
}

export interface BudgetViewModel {
  hasBudgets: boolean;
  activeSource: DataSourceType;
  cards: FormattedBudgetCard[];
  summary: BudgetSummaryViewModel;
}

export interface BudgetPresenterInput {
  budgets?: CostCenterBudget[] | null;
  reportBudgets?: CostCenterBudget[] | null;
  activeSource: DataSourceType;
}

export class BudgetPresenter {
  public static present(input: BudgetPresenterInput): BudgetViewModel {
    const { budgets, reportBudgets, activeSource } = input;
    const isReportSource = activeSource === 'monthly_report' || activeSource === 'user_upload';
    const targetBudgets = isReportSource ? (reportBudgets || budgets || []) : (budgets || []);

    if (!targetBudgets || targetBudgets.length === 0) {
      return {
        hasBudgets: false,
        activeSource,
        cards: [],
        summary: {
          totalLimitFormatted: '$0.00',
          totalLimitRaw: 0,
          totalSpendFormatted: '$0.00',
          totalSpendRaw: 0,
          totalRemainingFormatted: '$0.00',
          totalRemainingRaw: 0,
          overallUtilizationPercent: 0,
          alertCount: 0,
        },
      };
    }

    let totalLimit = 0;
    let totalSpend = 0;
    let totalRemaining = 0;
    let alertCount = 0;

    const cards: FormattedBudgetCard[] = targetBudgets.map((b) => {
      const limit = b.spending_limit_usd || 0;
      const spend = b.current_spend_usd || 0;
      const free = b.free_tier_budget_usd || 0;
      const billable = b.net_billable_spend_usd || 0;
      const remaining = b.remaining_budget_usd || 0;
      const utilization = b.budget_utilization_percent || (limit > 0 ? Math.round((billable / limit) * 100) : 0);

      totalLimit += limit;
      totalSpend += spend;
      totalRemaining += remaining;

      let statusColor = 'text-emerald-400';
      if (b.status === 'exceeded') {
        statusColor = 'text-rose-400';
        alertCount++;
      } else if (b.status === 'warning') {
        statusColor = 'text-amber-400';
        alertCount++;
      }

      return {
        costCenterId: b.cost_center_id,
        costCenterName: b.cost_center_name || b.cost_center_code,
        spendingLimitFormatted: `$${limit.toFixed(2)}`,
        currentSpendFormatted: `$${spend.toFixed(2)}`,
        freeTierFormatted: `$${free.toFixed(2)}`,
        netBillableFormatted: `$${billable.toFixed(2)}`,
        remainingBudgetFormatted: `$${remaining.toFixed(2)}`,
        utilizationPercent: utilization,
        status: b.status,
        statusColor,
        isOverBudget: b.status === 'exceeded',
      };
    });

    const overallUtilization = totalLimit > 0 ? Math.round((totalSpend / totalLimit) * 100) : 0;

    return {
      hasBudgets: true,
      activeSource,
      cards,
      summary: {
        totalLimitFormatted: `$${totalLimit.toFixed(2)}`,
        totalLimitRaw: totalLimit,
        totalSpendFormatted: `$${totalSpend.toFixed(2)}`,
        totalSpendRaw: totalSpend,
        totalRemainingFormatted: `$${totalRemaining.toFixed(2)}`,
        totalRemainingRaw: totalRemaining,
        overallUtilizationPercent: overallUtilization,
        alertCount,
      },
    };
  }
}
