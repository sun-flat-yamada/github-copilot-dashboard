import { CostCenterBudget, DataSourceType } from '../../domain/entities/copilot.js';
import { BillingConfigLoader } from '../storage/BillingConfigLoader.js';
import { Money } from '../../domain/value-objects/Money.js';

export interface FormattedBudgetCard {
  costCenterId: string;
  costCenterName: string;
  spendingLimitFormatted: string;
  currentSpendFormatted: string;
  freeTierFormatted: string;
  netBillableFormatted: string;
  remainingBudgetFormatted: string;
  spendingLimitUsd?: string;
  currentSpendUsd?: string;
  spendingLimitSub?: string;
  currentSpendSub?: string;
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
  subCurrencySymbol?: string;
  subCurrencyCode?: string;
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
    const subCurrency = billingConfig.subCurrency ?? (billingConfig.currency.code !== 'USD' ? billingConfig.currency : null);
    const sym = '$';

    const formatMoney = (usdVal: number) => {
      return Money.formatDualAmount(usdVal, subCurrency).combined;
    };

    if (!targetBudgets || targetBudgets.length === 0) {
      return {
        hasBudgets: false,
        currencySymbol: sym,
        subCurrencySymbol: subCurrency?.symbol,
        subCurrencyCode: subCurrency?.code,
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

      const dualLimit = Money.formatDualAmount(limit, subCurrency);
      const dualSpend = Money.formatDualAmount(spend, subCurrency);
      const dualFree = Money.formatDualAmount(free, subCurrency);
      const dualBillable = Money.formatDualAmount(billable, subCurrency);
      const dualRemaining = Money.formatDualAmount(remaining, subCurrency);

      return {
        costCenterId: b.cost_center_id,
        costCenterName: b.cost_center_name || b.cost_center_code,
        spendingLimitFormatted: dualLimit.combined,
        currentSpendFormatted: dualSpend.combined,
        freeTierFormatted: dualFree.combined,
        netBillableFormatted: dualBillable.combined,
        remainingBudgetFormatted: dualRemaining.combined,
        spendingLimitUsd: dualLimit.usd,
        currentSpendUsd: dualSpend.usd,
        spendingLimitSub: dualLimit.sub,
        currentSpendSub: dualSpend.sub,
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
      subCurrencySymbol: subCurrency?.symbol,
      subCurrencyCode: subCurrency?.code,
      activeSource,
      cards,
      summary: {
        totalLimitFormatted: formatMoney(totalLimit),
        totalLimitRaw: totalLimit,
        totalSpendFormatted: formatMoney(totalSpend),
        totalSpendRaw: totalSpend,
        totalRemainingFormatted: formatMoney(totalRemaining),
        totalRemainingRaw: totalRemaining,
        overallUtilizationPercent: overallUtilization,
        alertCount,
      },
    };
  }
}
