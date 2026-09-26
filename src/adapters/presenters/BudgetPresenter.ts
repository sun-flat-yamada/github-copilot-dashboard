import { CostCenterBudget, DataSourceType } from '../../domain/entities/copilot.js';
import { BillingConfigLoader } from '../storage/BillingConfigLoader.js';

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
  currencySymbol: string;
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

    const billingConfig = BillingConfigLoader.load();
    const sym = billingConfig.currency.symbol;
    const decimals = billingConfig.currency.displayDecimals;
    const rate = billingConfig.currency.exchangeRateFromUSD;

    const formatMoney = (usdVal: number) => {
      const converted = usdVal * rate;
      const formattedNum = converted.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return `${sym}${formattedNum}`;
    };

    if (!targetBudgets || targetBudgets.length === 0) {
      return {
        hasBudgets: false,
        currencySymbol: sym,
        activeSource,
        cards: [],
        summary: {
          totalLimitFormatted: formatMoney(0),
          totalLimitRaw: 0,
          totalSpendFormatted: formatMoney(0),
          totalSpendRaw: 0,
          totalRemainingFormatted: formatMoney(0),
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
        spendingLimitFormatted: formatMoney(limit),
        currentSpendFormatted: formatMoney(spend),
        freeTierFormatted: formatMoney(free),
        netBillableFormatted: formatMoney(billable),
        remainingBudgetFormatted: formatMoney(remaining),
        utilizationPercent: utilization,
        status: b.status,
        statusColor,
        isOverBudget: b.status === 'exceeded',
      };
    });

    const overallUtilization = totalLimit > 0 ? Math.round((totalSpend / totalLimit) * 100) : 0;

    return {
      hasBudgets: true,
      currencySymbol: sym,
      activeSource,
      cards,
      summary: {
        totalLimitFormatted: formatMoney(totalLimit),
        totalLimitRaw: totalLimit * rate,
        totalSpendFormatted: formatMoney(totalSpend),
        totalSpendRaw: totalSpend * rate,
        totalRemainingFormatted: formatMoney(totalRemaining),
        totalRemainingRaw: totalRemaining * rate,
        overallUtilizationPercent: overallUtilization,
        alertCount,
      },
    };
  }
}
