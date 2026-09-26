import { UserUsageProfile } from '../../domain/entities/copilot.js';

export interface FormattedTrendDailyPoint {
  date: string;
  suggestions: number;
  acceptances: number;
  acceptanceRateFormatted: string;
  acceptanceRateRaw: number;
  models: Record<string, number>;
}

export interface TrendUserSummary {
  login: string;
  displayName: string;
  avatarUrl: string;
  department: string;
  costCenter: string;
  totalSuggestions: number;
  totalAcceptances: number;
  overallAcceptanceRateFormatted: string;
  overallAcceptanceRateRaw: number;
  primaryModel: string;
  totalCostFormatted: string;
}

export interface TrendViewModel {
  hasData: boolean;
  availableLogins: string[];
  selectedUser: TrendUserSummary | null;
  dailyPoints: FormattedTrendDailyPoint[];
  sourceBadgeText: string;
}

export interface TrendPresenterInput {
  profiles: UserUsageProfile[];
  selectedLogin?: string;
  sourceInfo?: string;
}

export class TrendPresenter {
  public static present(input: TrendPresenterInput): TrendViewModel {
    const { profiles, selectedLogin, sourceInfo } = input;

    if (!profiles || profiles.length === 0) {
      return {
        hasData: false,
        availableLogins: [],
        selectedUser: null,
        dailyPoints: [],
        sourceBadgeText: sourceInfo || 'No Data',
      };
    }

    const availableLogins = profiles.map((p) => p.login);
    const activeProfile =
      (selectedLogin ? profiles.find((p) => p.login === selectedLogin) : null) ||
      profiles[0];

    // Find primary model from model_usage_totals
    let primaryModel = 'N/A';
    if (activeProfile.model_usage_totals) {
      let maxCount = -1;
      for (const [model, count] of Object.entries(activeProfile.model_usage_totals)) {
        if (count > maxCount) {
          maxCount = count;
          primaryModel = model;
        }
      }
    }

    const selectedUser: TrendUserSummary = {
      login: activeProfile.login,
      displayName: activeProfile.display_name || activeProfile.login,
      avatarUrl: activeProfile.avatar_url || '',
      department: activeProfile.department || '未設定',
      costCenter: activeProfile.cost_center || '未設定',
      totalSuggestions: activeProfile.total_suggestions || 0,
      totalAcceptances: activeProfile.total_acceptances || 0,
      overallAcceptanceRateFormatted: `${Math.round((activeProfile.acceptance_rate || 0) * 100)}%`,
      overallAcceptanceRateRaw: activeProfile.acceptance_rate || 0,
      primaryModel,
      totalCostFormatted: `$${(activeProfile.total_cost_usd || 0).toFixed(2)}`,
    };

    const dailyPoints: FormattedTrendDailyPoint[] = (activeProfile.daily_history || []).map((h) => {
      const rate = h.suggestions > 0 ? h.acceptances / h.suggestions : 0;
      return {
        date: h.date,
        suggestions: h.suggestions || 0,
        acceptances: h.acceptances || 0,
        acceptanceRateFormatted: `${Math.round(rate * 100)}%`,
        acceptanceRateRaw: rate,
        models: h.model_breakdown || {},
      };
    });

    return {
      hasData: true,
      availableLogins,
      selectedUser,
      dailyPoints,
      sourceBadgeText: sourceInfo || 'Active Profiles',
    };
  }
}
