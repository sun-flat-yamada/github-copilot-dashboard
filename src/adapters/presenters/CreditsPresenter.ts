import { ScopeAggregatedData, MonthlyReportAggregatedData } from '../../domain/entities/copilot.js';
import { CreditsAnalysisResult } from '../../application/store/derived/nodes/creditsAnalysis.js';
import { BillingConfigLoader } from '../storage/BillingConfigLoader.js';
import { calculateDualCreditRate } from '../../domain/entities/billing-config.js';
import { Money } from '../../domain/value-objects/Money.js';

export interface CreditsViewModel {
  hasData: boolean;
  currencySymbol: string;
  subCurrencySymbol?: string;
  subCurrencyCode?: string;
  effectiveRateFormatted: string;
  effectiveRateUsdFormatted: string;
  effectiveRateSubFormatted?: string;
  discountPercent: number;
  totalCreditsUsed: number;
  totalCreditsUsedFormatted: string;
  totalCreditsCostUsd: number;
  totalCreditsCostFormatted: string;
  totalCombinedCostUsd: number;
  totalCombinedCostFormatted: string;
  poolUtilizationPercent: number;
  poolStatus: 'normal' | 'warning' | 'exceeded';
  byModel: Array<{ modelName: string; credits: number; costUsdFormatted: string; percentage: number }>;
  byCostCenter: Array<{ costCenter: string; credits: number; costUsdFormatted: string; status?: string }>;
  topConsumers: Array<{ login: string; credits: number; costUsd: number; costUsdFormatted: string; department?: string; costCenter?: string }>;
}

export interface CreditsPresenterInput {
  currentData?: ScopeAggregatedData | null;
  currentReportData?: MonthlyReportAggregatedData | null;
  creditsAnalysis?: CreditsAnalysisResult | null;
}

export class CreditsPresenter {
  public static present(input: CreditsPresenterInput): CreditsViewModel {
    const { currentData, creditsAnalysis } = input;
    const hasData = Boolean(creditsAnalysis || currentData?.credits_summary || currentData?.users);

    const billingConfig = BillingConfigLoader.load();
    const subCurrency = billingConfig.subCurrency ?? (billingConfig.currency.code !== 'USD' ? billingConfig.currency : null);
    const dualRate = calculateDualCreditRate(billingConfig);
    const sym = '$';
    const effectiveRate = creditsAnalysis?.effectiveCreditRate ?? dualRate.usdRate;
    const discountPercent = creditsAnalysis?.discountPercent ?? billingConfig.discountPercent;

    const formatMoney = (usdVal: number) => {
      return Money.formatDualAmount(usdVal, subCurrency).combined;
    };

    const userCreditsSum = currentData?.users?.reduce((acc, u) => acc + (u.ai_credits_used_28d || 0), 0) ?? 0;
    const totalCredits = creditsAnalysis?.totalCreditsConsumed ?? (currentData as any)?.overview?.total_ai_credits_used ?? userCreditsSum;
    const totalCreditsCost = creditsAnalysis?.totalCreditsCostUsd ?? (totalCredits * effectiveRate);
    const totalSpend = currentData?.overview?.total_spend_usd ?? 0;
    const totalCombinedCost = totalSpend + totalCreditsCost;

    const totalSeats = currentData?.overview?.total_seats || currentData?.users?.length || 1;
    const poolAllowance = totalSeats * 3900;
    const poolUtilization = poolAllowance > 0 ? Number(((totalCredits / poolAllowance) * 100).toFixed(1)) : 0;
    let poolStatus: 'normal' | 'warning' | 'exceeded' = 'normal';
    if (poolUtilization >= 100) poolStatus = 'exceeded';
    else if (poolUtilization >= 80) poolStatus = 'warning';

    const byModel: Array<{ modelName: string; credits: number; costUsdFormatted: string; percentage: number }> = [];
    if (creditsAnalysis?.byModel) {
      for (const [model, stats] of Object.entries(creditsAnalysis.byModel)) {
        const pct = totalCredits > 0 ? Number(((stats.credits / totalCredits) * 100).toFixed(1)) : 0;
        byModel.push({
          modelName: model,
          credits: stats.credits,
          costUsdFormatted: formatMoney(stats.costUsd),
          percentage: pct,
        });
      }
    }

    const byCostCenter: Array<{ costCenter: string; credits: number; costUsdFormatted: string; status?: string }> = [];
    if (creditsAnalysis?.byCostCenter) {
      for (const [cc, stats] of Object.entries(creditsAnalysis.byCostCenter)) {
        byCostCenter.push({
          costCenter: cc,
          credits: stats.credits,
          costUsdFormatted: formatMoney(stats.costUsd),
          status: stats.budgetStatus,
        });
      }
    }

    const topConsumers: Array<{ login: string; credits: number; costUsd: number; costUsdFormatted: string; department?: string; costCenter?: string }> = [];
    if (creditsAnalysis?.topConsumers) {
      for (const c of creditsAnalysis.topConsumers) {
        topConsumers.push({
          login: c.login,
          credits: c.credits,
          costUsd: c.costUsd,
          costUsdFormatted: formatMoney(c.costUsd),
          department: c.department,
          costCenter: c.costCenter,
        });
      }
    } else if (currentData?.users) {
      const sortedUsers = [...currentData.users]
        .filter((u) => (u.ai_credits_used_28d || 0) > 0)
        .sort((a, b) => (b.ai_credits_used_28d || 0) - (a.ai_credits_used_28d || 0))
        .slice(0, 10);
      for (const u of sortedUsers) {
        const credits = u.ai_credits_used_28d || 0;
        const costUsd = credits * effectiveRate;
        topConsumers.push({
          login: u.login,
          credits,
          costUsd,
          costUsdFormatted: formatMoney(costUsd),
          department: u.department,
          costCenter: u.cost_center,
        });
      }
    }

    return {
      hasData,
      currencySymbol: sym,
      subCurrencySymbol: subCurrency?.symbol,
      subCurrencyCode: subCurrency?.code,
      effectiveRateFormatted: dualRate.formattedCombined,
      effectiveRateUsdFormatted: dualRate.formattedUSD,
      effectiveRateSubFormatted: dualRate.formattedSub,
      discountPercent,
      totalCreditsUsed: totalCredits,
      totalCreditsUsedFormatted: `${totalCredits.toLocaleString()} Credits`,
      totalCreditsCostUsd: totalCreditsCost,
      totalCreditsCostFormatted: formatMoney(totalCreditsCost),
      totalCombinedCostUsd: totalCombinedCost,
      totalCombinedCostFormatted: formatMoney(totalCombinedCost),
      poolUtilizationPercent: poolUtilization,
      poolStatus,
      byModel,
      byCostCenter,
      topConsumers,
    };
  }
}
