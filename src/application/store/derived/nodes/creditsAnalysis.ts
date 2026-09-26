import { DerivedDataNode } from '../DerivedDataGraph.js';
import { DataStoreState } from '../../DataStoreState.js';
import { ScopeAggregatedData, MonthlyReportAggregatedData } from '../../../../domain/entities/copilot.js';
import { CreditsBillingService } from '../../../services/CreditsBillingService.js';
import { BillingConfigLoader } from '../../../../adapters/storage/BillingConfigLoader.js';
import { calculateEffectiveCreditRate } from '../../../../domain/entities/billing-config.js';

export interface CreditsAnalysisResult {
  totalCreditsConsumed: number;
  totalCreditsCostUsd: number;
  effectiveCreditRate: number;
  currencySymbol: string;
  currencyCode: string;
  discountPercent: number;
  byModel: Record<string, { credits: number; costUsd: number }>;
  byCostCenter: Record<string, { credits: number; costUsd: number; budgetStatus?: string }>;
  topConsumers: Array<{ login: string; credits: number; costUsd: number; department?: string; costCenter?: string }>;
}

export const creditsAnalysisNode: DerivedDataNode<CreditsAnalysisResult> = {
  id: 'creditsAnalysis',
  dependencies: ['filteredScopeData', 'filteredReportData'],
  compute(state: DataStoreState): CreditsAnalysisResult {
    const scopeData = state.derived.get('filteredScopeData') as ScopeAggregatedData | null;
    const reportData = state.derived.get('filteredReportData') as MonthlyReportAggregatedData | null;

    let totalCredits = 0;
    const byModelCredits: Record<string, number> = {};
    const byCostCenterCredits: Record<string, number> = {};
    const userConsumerMap = new Map<string, { credits: number; department?: string; costCenter?: string }>();

    // 1. Live Scope Data からの集約 (EnrichedUserSeat & UserUsageProfile)
    if (scopeData?.users) {
      for (const u of scopeData.users) {
        const credits = u.ai_credits_used_28d ?? 0;
        if (credits > 0) {
          totalCredits += credits;
          const cc = u.cost_center || 'Unassigned';
          byCostCenterCredits[cc] = (byCostCenterCredits[cc] ?? 0) + credits;

          userConsumerMap.set(u.login, {
            credits: (userConsumerMap.get(u.login)?.credits ?? 0) + credits,
            department: u.department,
            costCenter: u.cost_center,
          });
        }
      }
    }

    // 2. Monthly Usage Report からのモデル別・コストセンター別補強 (CSV データ)
    if (reportData?.user_details) {
      for (const u of reportData.user_details) {
        const credits = (u as any).ai_credits_consumed ?? 0;
        if (credits > 0) {
          // If not already counted in scopeData
          if (!userConsumerMap.has(u.login)) {
            totalCredits += credits;
            const cc = u.cost_center || 'Unassigned';
            byCostCenterCredits[cc] = (byCostCenterCredits[cc] ?? 0) + credits;

            userConsumerMap.set(u.login, {
              credits,
              department: u.department,
              costCenter: u.cost_center,
            });
          }
        }
      }
    }

    // モデル別の集約 (scopeData.metrics_summary または reportData.model_breakdown)
    if (reportData?.model_breakdown && Array.isArray(reportData.model_breakdown)) {
      for (const item of reportData.model_breakdown) {
        // Estimate or read credits
        const credits = (item as any).ai_credits_consumed ?? Math.round(item.total_requests * 0.5);
        byModelCredits[item.model_name] = credits;
      }
    }

    // コスト計算 (EnterpriseBillingConfig 反映)
    const billingConfig = BillingConfigLoader.load();
    const effectiveCreditRate = calculateEffectiveCreditRate(billingConfig);

    const modelCreditsSummary = CreditsBillingService.calculateModelCredits(byModelCredits, {}, effectiveCreditRate);
    const totalCostUsd = CreditsBillingService.calculateCreditsCost(totalCredits, effectiveCreditRate, billingConfig).amount;

    const byModelResult: Record<string, { credits: number; costUsd: number }> = {};
    for (const [model, detail] of Object.entries(modelCreditsSummary.byModel)) {
      byModelResult[model] = {
        credits: detail.creditsConsumed,
        costUsd: detail.costUsd.amount,
      };
    }

    const byCostCenterResult: Record<string, { credits: number; costUsd: number; budgetStatus?: string }> = {};
    for (const [cc, credits] of Object.entries(byCostCenterCredits)) {
      const cost = CreditsBillingService.calculateCreditsCost(credits, effectiveCreditRate, billingConfig).amount;
      byCostCenterResult[cc] = {
        credits,
        costUsd: cost,
      };
    }

    const topConsumers = Array.from(userConsumerMap.entries())
      .map(([login, val]) => ({
        login,
        credits: val.credits,
        costUsd: CreditsBillingService.calculateCreditsCost(val.credits, effectiveCreditRate, billingConfig).amount,
        department: val.department,
        costCenter: val.costCenter,
      }))
      .sort((a, b) => b.credits - a.credits)
      .slice(0, 10);

    return {
      totalCreditsConsumed: totalCredits,
      totalCreditsCostUsd: totalCostUsd,
      effectiveCreditRate,
      currencySymbol: billingConfig.currency.symbol,
      currencyCode: billingConfig.currency.code,
      discountPercent: billingConfig.discountPercent,
      byModel: byModelResult,
      byCostCenter: byCostCenterResult,
      topConsumers,
    };
  },
};
