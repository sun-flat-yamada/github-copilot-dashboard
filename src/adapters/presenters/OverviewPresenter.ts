import { ScopeAggregatedData, DataSourceType, MonthlyReportAggregatedData } from '../../domain/entities/copilot.js';

export interface OverviewKpiViewModel {
  totalCostFormatted: string;
  totalCostRaw: number;
  activeUsersCount: number;
  totalUsersCount: number;
  acceptanceRateFormatted: string;
  acceptanceRateRaw: number;
  idleWasteFormatted: string;
  idleWasteRaw: number;
  idleCount: number;
}

export interface OverviewSectionChips {
  departmentCountText: string;
  budgetCountText: string;
  modelCountText: string;
  userCountText: string;
}

export interface OverviewViewModel {
  hasData: boolean;
  activeSource: DataSourceType;
  isLiveSource: boolean;
  isReportSource: boolean;
  kpis: OverviewKpiViewModel;
  chips: OverviewSectionChips;
  canShowAdvisor: boolean;
  canShowBudgets: boolean;
}

export interface OverviewPresenterInput {
  currentData?: ScopeAggregatedData | null;
  currentReportData?: MonthlyReportAggregatedData | null;
  activeSource: DataSourceType;
}

export class OverviewPresenter {
  public static present(input: OverviewPresenterInput): OverviewViewModel {
    const { currentData, currentReportData, activeSource } = input;
    const isLiveSource = activeSource === 'live_metrics';
    const isReportSource = activeSource === 'monthly_report' || activeSource === 'user_upload';

    if (isLiveSource && currentData) {
      const overview = currentData.overview;
      const deptCount = Object.keys(currentData.by_department || {}).length;
      const budgetCount = currentData.cost_center_budgets?.length || 0;
      const userCount = currentData.users?.length || 0;
      const idleCount = (currentData.users || []).filter(
        (u: any) => u.status === 'dormant' || u.status === 'inactive'
      ).length;

      return {
        hasData: true,
        activeSource,
        isLiveSource: true,
        isReportSource: false,
        kpis: {
          totalCostFormatted: `$${(overview.total_spend_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          totalCostRaw: overview.total_spend_usd || 0,
          activeUsersCount: overview.active_users || 0,
          totalUsersCount: overview.total_seats || 0,
          acceptanceRateFormatted: `${Math.round((overview.overall_acceptance_rate || 0) * 100)}%`,
          acceptanceRateRaw: overview.overall_acceptance_rate || 0,
          idleWasteFormatted: `$${(overview.idle_waste_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/月`,
          idleWasteRaw: overview.idle_waste_usd || 0,
          idleCount,
        },
        chips: {
          departmentCountText: `${deptCount} 部署`,
          budgetCountText: `${budgetCount} Cost Centers`,
          modelCountText: `Live Models`,
          userCountText: `${userCount} 名`,
        },
        canShowAdvisor: (overview.idle_waste_usd || 0) > 0 || idleCount > 0,
        canShowBudgets: budgetCount > 0,
      };
    }

    if (isReportSource && currentReportData) {
      const overview = currentReportData.overview;
      const deptCount = Object.keys(currentReportData.by_department || {}).length;
      const modelCount = currentReportData.model_breakdown?.length || 0;
      const userCount = currentReportData.user_details?.length || 0;
      const totalCost = overview.total_net_spend_usd ?? overview.total_gross_spend_usd ?? 0;

      return {
        hasData: true,
        activeSource,
        isLiveSource: false,
        isReportSource: true,
        kpis: {
          totalCostFormatted: `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          totalCostRaw: totalCost,
          activeUsersCount: overview.total_active_users || 0,
          totalUsersCount: userCount,
          acceptanceRateFormatted: `N/A`,
          acceptanceRateRaw: 0,
          idleWasteFormatted: `$0.00/月`,
          idleWasteRaw: 0,
          idleCount: 0,
        },
        chips: {
          departmentCountText: `${deptCount} 部署`,
          budgetCountText: `Cost Centers`,
          modelCountText: `${modelCount} モデル`,
          userCountText: `${userCount} 名`,
        },
        canShowAdvisor: false,
        canShowBudgets: true,
      };
    }

    return {
      hasData: false,
      activeSource,
      isLiveSource,
      isReportSource,
      kpis: {
        totalCostFormatted: '$0.00',
        totalCostRaw: 0,
        activeUsersCount: 0,
        totalUsersCount: 0,
        acceptanceRateFormatted: '0%',
        acceptanceRateRaw: 0,
        idleWasteFormatted: '$0.00/月',
        idleWasteRaw: 0,
        idleCount: 0,
      },
      chips: {
        departmentCountText: '0 部署',
        budgetCountText: '0 Cost Centers',
        modelCountText: '0 モデル',
        userCountText: '0 名',
      },
      canShowAdvisor: false,
      canShowBudgets: false,
    };
  }
}
