import {
  AnalysisScopeType,
  CopilotDailyMetrics,
  CostCenterBudget,
  DataFetchIssue,
  EnrichedUserSeat,
  GroupSummary,
  ScopeAggregatedData,
  UserUsageProfile,
} from '../types/copilot.js';
import { isActiveSeatStatus, isIdleSeatStatus } from '../domain/rules/SeatClassificationRule.js';
import { seatCostForScope } from '../domain/rules/ScopeCostRule.js';

/** 利用状況メトリクス (補完・チャット等) を 1 日分も取得できていないことを示す欠損マーカー */
export const MISSING_USAGE_METRICS = 'copilot_usage_metrics';

/** グループ別の利用指標をシート比で按分する際の合計値。メトリクスが無い場合は null を渡す */
interface UsageTotals {
  suggestions: number;
  acceptances: number;
  chats: number;
  prSummaries: number | null;
}

export class MetricsAggregator {
  /**
   * 指定されたメトリクス群とエンリッチされたユーザーシート群からスコープ集計データを生成
   */
  public aggregateScope(
    scopeType: AnalysisScopeType,
    scopeKey: string,
    filteredMetrics: CopilotDailyMetrics[],
    users: EnrichedUserSeat[],
    dateRange: { start: string; end: string; days_count: number },
    issues: DataFetchIssue[] = [],
    costCenterBudgets: CostCenterBudget[] = [],
    userProfiles: UserUsageProfile[] = []
  ): ScopeAggregatedData {
    // 1. 全体メトリクス合計
    let totalSuggestions = 0;
    let totalAcceptances = 0;
    let totalChats = 0;
    let totalPrSummaries = 0;
    let prSummariesKnown = false;
    let totalCliCommands = 0;
    let totalAgentSessions = 0;
    let totalAgentMessages = 0;
    let totalCreditsUsed = 0;
    let totalLinesAdded = 0;
    let totalLinesDeleted = 0;
    let totalPrMergeHours = 0;
    let totalPrCount = 0;

    const languageMap: Map<string, { suggestions: number; acceptances: number; linesAccepted: number }> = new Map();
    const dailyTrends: ScopeAggregatedData['daily_trends'] = [];

    // 日付昇順でソート
    const sortedMetrics = [...filteredMetrics].sort((a, b) => a.date.localeCompare(b.date));

    for (const metric of sortedMetrics) {
      let daySuggestions = 0;
      let dayAcceptances = 0;

      for (const lang of metric.copilot_ide_code_completions.languages) {
        daySuggestions += lang.total_code_suggestions;
        dayAcceptances += lang.total_code_acceptances;

        const existing = languageMap.get(lang.name) || { suggestions: 0, acceptances: 0, linesAccepted: 0 };
        existing.suggestions += lang.total_code_suggestions;
        existing.acceptances += lang.total_code_acceptances;
        existing.linesAccepted += lang.total_code_lines_accepted;
        languageMap.set(lang.name, existing);
      }

      totalSuggestions += daySuggestions;
      totalAcceptances += dayAcceptances;

      const ideChats = metric.copilot_ide_chat.total_chats;
      const dotcomChats = metric.copilot_dotcom_chat.total_chats;
      const dayChats = ideChats + dotcomChats;
      totalChats += dayChats;

      const dayPr = metric.copilot_dotcom_pull_requests.total_pr_summaries_created;
      if (typeof dayPr === 'number') {
        prSummariesKnown = true;
        totalPrSummaries += dayPr;
      }

      const dayCli = metric.copilot_in_cli.total_cli_completions;
      totalCliCommands += dayCli;

      const agentSessions = metric.copilot_ide_agent?.total_sessions;
      const agentEngaged = metric.copilot_ide_agent?.total_engaged_users;
      const creditsUsed = metric.ai_credits?.total_used;
      const linesAdded = metric.code_generation?.total_lines_added;

      if (agentSessions) totalAgentSessions += agentSessions;
      if (metric.copilot_ide_agent?.total_user_messages) totalAgentMessages += metric.copilot_ide_agent.total_user_messages;
      if (creditsUsed) totalCreditsUsed += creditsUsed;
      if (linesAdded) totalLinesAdded += linesAdded;
      if (metric.code_generation?.total_lines_deleted) totalLinesDeleted += metric.code_generation.total_lines_deleted;
      if (metric.prs_created_by_agent?.median_time_to_merge_hours) {
        totalPrMergeHours += metric.prs_created_by_agent.median_time_to_merge_hours;
        totalPrCount++;
      }

      const dayRate = daySuggestions > 0 ? Number((dayAcceptances / daySuggestions).toFixed(4)) : 0;
      const dailySeatCost = users.reduce((acc, u) => acc + u.prorated_daily_cost_usd, 0);

      dailyTrends.push({
        date: metric.date,
        active_users: metric.total_active_users,
        suggestions: daySuggestions,
        acceptances: dayAcceptances,
        acceptance_rate: dayRate,
        chats: dayChats,
        pr_summaries: dayPr ?? undefined,
        daily_cost_usd: Number(dailySeatCost.toFixed(2)),
        agent_sessions: agentSessions,
        agent_engaged_users: agentEngaged,
        ai_credits_used: creditsUsed,
        lines_added_by_ai: linesAdded,
      });
    }

    // メトリクスを 1 日分も取得できていない場合、利用指標は 0 ではなく欠損 (null) とする
    const hasUsageMetrics = sortedMetrics.length > 0;
    const overallAcceptanceRate =
      totalSuggestions > 0 ? Number((totalAcceptances / totalSuggestions).toFixed(4)) : hasUsageMetrics ? 0 : null;
    const usageTotals: UsageTotals | null = hasUsageMetrics
      ? {
          suggestions: totalSuggestions,
          acceptances: totalAcceptances,
          chats: totalChats,
          prSummaries: prSummariesKnown ? totalPrSummaries : null,
        }
      : null;

    // 言語別ランキング
    const topLanguages = Array.from(languageMap.entries())
      .map(([name, stats]) => ({
        name,
        suggestions: stats.suggestions,
        acceptances: stats.acceptances,
        lines_accepted: stats.linesAccepted,
        acceptance_rate: stats.suggestions > 0 ? Number((stats.acceptances / stats.suggestions).toFixed(4)) : 0,
      }))
      .sort((a, b) => b.suggestions - a.suggestions);

    // 2. ユーザーシート集計 (コスト・ステータス)
    const totalSeats = users.length;
    const activeSeatsCount = users.filter((u) => isActiveSeatStatus(u.status)).length;
    const idleSeatsCount = users.filter((u) => isIdleSeatStatus(u.status)).length;
    const onboardingSeatsCount = users.filter((u) => u.status === 'onboarding').length;
    const costUnconfirmedSeats = users.filter((u) => u.cost_unconfirmed).length;

    // スコープ種別に応じた費用 (daily=日割り / monthly=月額 / custom=日割り×日数)。
    // フィルター再集計 (dashboard/src/query/filterEngine.ts) も同じ関数を使い、単位がずれないようにする
    const costOf = (u: EnrichedUserSeat) => seatCostForScope(u, scopeType, dateRange.days_count);
    const totalSpend = users.reduce((sum, u) => sum + costOf(u), 0);
    const idleWaste = users.filter((u) => isIdleSeatStatus(u.status)).reduce((sum, u) => sum + costOf(u), 0);

    // 3. 3軸グループ別集計の計算
    const byDepartment = this.calculateGroupSummaries(
      users,
      (u) => u.department,
      scopeType,
      dateRange.days_count,
      usageTotals
    );

    const byCostCenter = this.calculateGroupSummaries(
      users,
      (u) => u.cost_center,
      scopeType,
      dateRange.days_count,
      usageTotals,
      costCenterBudgets
    );

    const byOrganization = this.calculateGroupSummaries(
      users,
      (u) => u.organization,
      scopeType,
      dateRange.days_count,
      usageTotals
    );

    // 欠損メトリクスの検出
    const missingMetrics: string[] = [];
    const affectedFields = issues.flatMap((i) => i.affected_fields || []);
    if (affectedFields.includes('copilot_ide_chat')) missingMetrics.push('copilot_ide_chat');
    if (affectedFields.includes('top_languages')) missingMetrics.push('top_languages');
    if (affectedFields.includes('copilot_ide_code_completions')) missingMetrics.push('copilot_ide_code_completions');
    if (!hasUsageMetrics) missingMetrics.push(MISSING_USAGE_METRICS);

    // スコープに応じたプロファイルの調整
    const scopedUserProfiles = userProfiles.map((p) => {
      const historyInScope = p.daily_history.filter((h) => {
        return h.date >= dateRange.start && h.date <= dateRange.end;
      });
      const totalChats = historyInScope.reduce((sum, h) => sum + h.total_chats, 0);
      const totalSugg = historyInScope.reduce((sum, h) => sum + h.suggestions, 0);
      const totalAcc = historyInScope.reduce((sum, h) => sum + h.acceptances, 0);
      const rate = totalSugg > 0 ? Number((totalAcc / totalSugg).toFixed(4)) : 0;

      const modelTotals: Record<string, number> = {};
      for (const h of historyInScope) {
        for (const [model, count] of Object.entries(h.model_breakdown)) {
          modelTotals[model] = (modelTotals[model] || 0) + count;
        }
      }

      const cost = historyInScope.reduce((sum, h) => sum + h.daily_cost_usd, 0);

      return {
        ...p,
        total_chats: totalChats,
        total_suggestions: totalSugg,
        total_acceptances: totalAcc,
        acceptance_rate: rate,
        total_cost_usd: Number(cost.toFixed(2)),
        model_usage_totals: modelTotals,
        daily_history: historyInScope,
      };
    });

    const totalNetBillable = costCenterBudgets.length > 0
      ? Number(costCenterBudgets.reduce((sum, b) => sum + b.net_billable_spend_usd, 0).toFixed(2))
      : undefined;
    const totalSpendingLimit = costCenterBudgets.length > 0
      ? Number(costCenterBudgets.reduce((sum, b) => sum + b.spending_limit_usd, 0).toFixed(2))
      : undefined;

    const byTeam = this.calculateGroupSummaries(
      users,
      (u) => (u.teams && u.teams.length > 0 ? u.teams[0] : 'General'),
      scopeType,
      dateRange.days_count,
      usageTotals
    );

    // Adoption Phase 集計
    const phaseCounts = {
      no_cohort: 0,
      code_first: 0,
      agent_first: 0,
      multi_agent: 0,
    };
    // 判定できなかったユーザー (データ不足) は no_cohort に数えず、判定不能として別計上する (SDD-11 §8)
    let unclassifiedUsers = 0;
    for (const p of userProfiles) {
      if (p.ai_adoption_phase && phaseCounts[p.ai_adoption_phase] !== undefined) {
        phaseCounts[p.ai_adoption_phase]++;
      } else {
        unclassifiedUsers++;
      }
    }
    const classifiedUsers = userProfiles.length - unclassifiedUsers;

    const peakEngagedAgentUsers = Math.max(...sortedMetrics.map((m) => m.copilot_ide_agent?.total_engaged_users ?? 0), 0);

    return {
      scope_type: scopeType,
      scope_key: scopeKey,
      date_range: dateRange,
      overview: {
        total_seats: totalSeats,
        active_users: activeSeatsCount,
        idle_seats: idleSeatsCount,
        ...(onboardingSeatsCount > 0 ? { onboarding_seats: onboardingSeatsCount } : {}),
        ...(costUnconfirmedSeats > 0 ? { cost_unconfirmed_seats: costUnconfirmedSeats } : {}),
        total_spend_usd: Number(totalSpend.toFixed(2)),
        total_net_billable_usd: totalNetBillable,
        total_spending_limit_usd: totalSpendingLimit,
        idle_waste_usd: Number(idleWaste.toFixed(2)),
        active_ratio: totalSeats > 0 ? Number((activeSeatsCount / totalSeats).toFixed(4)) : 0,
        overall_acceptance_rate: overallAcceptanceRate,
        total_suggestions: hasUsageMetrics ? totalSuggestions : null,
        total_acceptances: hasUsageMetrics ? totalAcceptances : null,
        total_chats: hasUsageMetrics ? totalChats : null,
        total_pr_summaries: hasUsageMetrics && prSummariesKnown ? totalPrSummaries : null,
        total_cli_commands: hasUsageMetrics ? totalCliCommands : null,
        missing_metrics: missingMetrics.length > 0 ? missingMetrics : undefined,
      },
      usage_metrics: { availability: hasUsageMetrics ? 'live' : 'unavailable' },
      by_department: byDepartment,
      by_cost_center: byCostCenter,
      by_organization: byOrganization,
      by_team: byTeam,
      users,
      daily_trends: dailyTrends,
      top_languages: topLanguages,
      issues: issues.length > 0 ? issues : undefined,
      cost_center_budgets: costCenterBudgets.length > 0 ? costCenterBudgets : undefined,
      user_profiles: scopedUserProfiles.length > 0 ? scopedUserProfiles : undefined,
      agent_summary: totalAgentSessions > 0 ? {
        total_sessions: totalAgentSessions,
        total_messages: totalAgentMessages,
        engaged_users: peakEngagedAgentUsers,
        adoption_rate: activeSeatsCount > 0 ? Number((peakEngagedAgentUsers / activeSeatsCount).toFixed(4)) : 0,
      } : undefined,
      code_generation_summary: totalLinesAdded > 0 ? {
        total_lines_added: totalLinesAdded,
        total_lines_deleted: totalLinesDeleted,
      } : undefined,
      adoption_distribution: userProfiles.length > 0 ? {
        users_in_phase_28d: phaseCounts,
        total_evaluated_users: classifiedUsers,
        unclassified_users: unclassifiedUsers,
      } : undefined,
      // 実測のない AI PR マージ率 / コードチャーン率は、固定値で埋めず出力しない
      outcome_indicators: totalPrCount > 0 ? {
        median_pr_merge_hours: Number((totalPrMergeHours / totalPrCount).toFixed(1)),
      } : undefined,
    };
  }

  /**
   * 指定グループ軸による集計
   *
   * グループ別の利用指標 (提案・受諾・チャット・PR 要約) は、ユーザー別の実測が無いため
   * 全体値をシート数の比率で按分した「推定値」であり、is_estimated / estimation_method を設定して
   * 実測と区別できるようにする。メトリクスを取得できていない場合 (usage === null) は null とする。
   */
  private calculateGroupSummaries(
    users: EnrichedUserSeat[],
    groupKeyExtractor: (u: EnrichedUserSeat) => string,
    scopeType: AnalysisScopeType,
    daysCount: number,
    usage: UsageTotals | null,
    costCenterBudgets?: CostCenterBudget[]
  ): Record<string, GroupSummary> {
    const map: Record<string, EnrichedUserSeat[]> = {};

    for (const u of users) {
      const key = groupKeyExtractor(u) || 'その他';
      if (!map[key]) map[key] = [];
      map[key].push(u);
    }

    const totalSeatsAll = users.length || 1;
    const summaries: Record<string, GroupSummary> = {};

    for (const [groupName, groupUsers] of Object.entries(map)) {
      const seatCount = groupUsers.length;
      const activeCount = groupUsers.filter((u) => isActiveSeatStatus(u.status)).length;
      const idleCount = groupUsers.filter((u) => isIdleSeatStatus(u.status)).length;

      const costOf = (u: EnrichedUserSeat) => seatCostForScope(u, scopeType, daysCount);
      const cost = groupUsers.reduce((sum, u) => sum + costOf(u), 0);
      const potentialSavings = groupUsers.filter((u) => isIdleSeatStatus(u.status)).reduce((sum, u) => sum + costOf(u), 0);

      // グループごとのシート比率でメトリクスを推定按分 (実測ではない)
      const ratio = seatCount / totalSeatsAll;
      const estimatedSuggestions = usage ? Math.round(usage.suggestions * ratio) : null;
      const estimatedAcceptances = usage ? Math.round(usage.acceptances * ratio) : null;

      const matchedBudget = costCenterBudgets?.find(
        (b) => b.cost_center_name.toLowerCase() === groupName.toLowerCase() || b.cost_center_id === groupName
      );

      summaries[groupName] = {
        group_name: groupName,
        total_seats: seatCount,
        active_seats: activeCount,
        idle_seats: idleCount,
        total_cost_usd: Number(cost.toFixed(2)),
        net_cost_usd: matchedBudget ? matchedBudget.net_billable_spend_usd : undefined,
        spending_limit_usd: matchedBudget ? matchedBudget.spending_limit_usd : undefined,
        potential_savings_usd: Number(potentialSavings.toFixed(2)),
        active_ratio: seatCount > 0 ? Number((activeCount / seatCount).toFixed(4)) : 0,
        acceptance_rate:
          estimatedSuggestions !== null && estimatedAcceptances !== null
            ? estimatedSuggestions > 0
              ? Number((estimatedAcceptances / estimatedSuggestions).toFixed(4))
              : 0
            : null,
        total_suggestions: estimatedSuggestions,
        total_acceptances: estimatedAcceptances,
        total_chats: usage ? Math.round(usage.chats * ratio) : null,
        total_pr_summaries: usage && usage.prSummaries !== null ? Math.round(usage.prSummaries * ratio) : null,
        ...(usage ? { is_estimated: true, estimation_method: 'proportional_seat_ratio' as const } : {}),
      };
    }

    return summaries;
  }
}
