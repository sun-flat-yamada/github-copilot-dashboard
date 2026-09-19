import {
  MonthlyReportAggregatedData,
  UserModelDailyUsage,
  UserUsageProfile,
} from '../../../src/types/copilot';
import { normalizeModelId } from '../../../src/processor/benchmark-evaluator';

/**
 * MonthlyReportAggregatedData からディープ分析用 UserUsageProfile[] を動的合成・アダプトする純粋関数
 * 外部CSV/JSONアップロードデータや、事前計算アーカイブが存在しない過去月次レポートに対しても、
 * ディープ分析（高度行動診断）を完全実行可能にする。
 */
export function adaptReportToProfiles(
  reportData: MonthlyReportAggregatedData,
  selectedTags?: string[]
): UserUsageProfile[] {
  if (!reportData || !reportData.user_details) {
    return [];
  }

  // 1. タグANDフィルターの適用
  const filteredUsers =
    selectedTags && selectedTags.length > 0
      ? reportData.user_details.filter(
          (u) => u.tags && selectedTags.every((t) => u.tags!.includes(t))
        )
      : reportData.user_details;

  if (filteredUsers.length === 0) {
    return [];
  }

  // 2. 日別トレンドの集計比率（日別按分用）
  const dailyTrends = reportData.daily_trends || [];
  const totalTrendRequests = dailyTrends.reduce((sum, d) => sum + (d.requests || 0), 0);

  return filteredUsers.map((user) => {
    const rawModel = user.primary_model || 'Standard Completion';
    const normModelId = normalizeModelId(rawModel);
    const totalRequests = user.total_requests || 0;
    const totalCostUsd = Number((user.net_spend_usd ?? user.total_spend_usd ?? 0).toFixed(2));

    // 推定比率 (チャットモデルの場合はチャット比率高め、補完モデルの場合は受諾比率高め)
    const isReasoningModel = ['o1', 'o3-mini', 'claude-3-7-sonnet', 'deepseek-r1'].includes(normModelId);
    const chatRatio = isReasoningModel ? 0.65 : 0.45;
    const totalChats = Math.max(1, Math.round(totalRequests * chatRatio));
    const totalSuggestions = Math.max(0, totalRequests - totalChats);
    const estimatedAcceptanceRate = 0.35;
    const totalAcceptances = Math.round(totalSuggestions * estimatedAcceptanceRate);

    // 3. 日次履歴 (UserModelDailyUsage[]) の按分生成
    const dailyHistory: UserModelDailyUsage[] = [];

    if (dailyTrends.length > 0 && totalTrendRequests > 0) {
      let accumulatedChats = 0;
      let accumulatedSuggestions = 0;
      let accumulatedAcceptances = 0;
      let accumulatedCost = 0;

      dailyTrends.forEach((trend, idx) => {
        const isLast = idx === dailyTrends.length - 1;
        const trendRatio = trend.requests / totalTrendRequests;

        const dayChats = isLast
          ? Math.max(0, totalChats - accumulatedChats)
          : Math.round(totalChats * trendRatio);
        const daySuggestions = isLast
          ? Math.max(0, totalSuggestions - accumulatedSuggestions)
          : Math.round(totalSuggestions * trendRatio);
        const dayAcceptances = isLast
          ? Math.max(0, totalAcceptances - accumulatedAcceptances)
          : Math.round(totalAcceptances * trendRatio);
        const dayCost = isLast
          ? Math.max(0, Number((totalCostUsd - accumulatedCost).toFixed(4)))
          : Number((totalCostUsd * trendRatio).toFixed(4));

        accumulatedChats += dayChats;
        accumulatedSuggestions += daySuggestions;
        accumulatedAcceptances += dayAcceptances;
        accumulatedCost += dayCost;

        const modelBreakdown: Record<string, number> = {};
        if (trend.model_breakdown && Object.keys(trend.model_breakdown).length > 0) {
          const mb = trend.model_breakdown;
          const trendDayTotal = Object.values(mb).reduce((s: number, v: number) => s + v, 0);
          if (trendDayTotal > 0 && dayChats > 0) {
            let acc = 0;
            const entries = Object.entries(mb);
            entries.forEach(([m, count], mIdx) => {
              const numCount = Number(count);
              const mRatio = numCount / trendDayTotal;
              const val =
                mIdx === entries.length - 1
                  ? Math.max(0, dayChats - acc)
                  : Math.round(dayChats * mRatio);
              acc += val;
              if (val > 0) {
                const normM = normalizeModelId(m);
                modelBreakdown[normM] = (modelBreakdown[normM] || 0) + val;
              }
            });
          }
        }

        if (Object.keys(modelBreakdown).length === 0 && dayChats > 0) {
          modelBreakdown[normModelId] = dayChats;
        }

        dailyHistory.push({
          date: trend.date,
          total_chats: dayChats,
          model_breakdown: modelBreakdown,
          suggestions: daySuggestions,
          acceptances: dayAcceptances,
          lines_suggested: daySuggestions * 8,
          lines_accepted: dayAcceptances * 8,
          acceptance_rate: daySuggestions > 0 ? Number((dayAcceptances / daySuggestions).toFixed(4)) : 0,
          daily_cost_usd: dayCost,
        });
      });
    } else {
      // 日別トレンドがない場合は最終アクティビティ日単一レコード
      const actDate = user.last_activity_date || new Date().toISOString().split('T')[0];
      dailyHistory.push({
        date: actDate,
        total_chats: totalChats,
        model_breakdown: { [normModelId]: totalChats },
        suggestions: totalSuggestions,
        acceptances: totalAcceptances,
        lines_suggested: totalSuggestions * 8,
        lines_accepted: totalAcceptances * 8,
        acceptance_rate: totalSuggestions > 0 ? Number((totalAcceptances / totalSuggestions).toFixed(4)) : 0,
        daily_cost_usd: totalCostUsd,
      });
    }

    const modelUsageTotals: Record<string, number> = {};
    dailyHistory.forEach((h) => {
      Object.entries(h.model_breakdown || {}).forEach(([m, cnt]) => {
        modelUsageTotals[m] = (modelUsageTotals[m] || 0) + cnt;
      });
    });
    if (Object.keys(modelUsageTotals).length === 0) {
      modelUsageTotals[normModelId] = totalChats;
    }

    return {
      login: user.login,
      display_name: user.display_name || user.login,
      avatar_url: `https://avatars.githubusercontent.com/u/${Math.abs(hashString(user.login) % 10000000)}?v=4`,
      department: user.department || '未分類 (Unassigned)',
      cost_center: user.cost_center || 'Unassigned-CC',
      organization: user.organization || 'Default-Org',
      plan_type: 'business',
      total_chats: totalChats,
      total_suggestions: totalSuggestions,
      total_acceptances: totalAcceptances,
      acceptance_rate: estimatedAcceptanceRate,
      total_cost_usd: totalCostUsd,
      model_usage_totals: modelUsageTotals,
      daily_history: dailyHistory,
      tags: user.tags || [],
    };
  });
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
