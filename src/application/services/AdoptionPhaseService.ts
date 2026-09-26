import { UserUsageProfile, EnrichedUserSeat } from '../../domain/entities/copilot.js';
import { AdoptionPhase, AdoptionPhaseMetrics } from '../../domain/entities/agent-metrics.js';
import { AdoptionPhaseRule, UserAdoptionActivity } from '../../domain/rules/AdoptionPhaseRule.js';

export class AdoptionPhaseService {
  /**
   * 単一ユーザーのプロファイルから成熟度フェーズを判定
   */
  static evaluateUser(profile: UserUsageProfile | EnrichedUserSeat, overridePhase?: AdoptionPhase): AdoptionPhase {
    const totalSuggestions = 'total_suggestions' in profile ? profile.total_suggestions : 0;
    const totalChats = 'total_chats' in profile ? profile.total_chats : 0;
    const totalAgentSessions = ('total_agent_sessions' in profile ? profile.total_agent_sessions : 0) ?? 0;

    const activity: UserAdoptionActivity = {
      totalSuggestions,
      totalChats,
      totalAgentSessions,
      overridePhase: overridePhase || ('ai_adoption_phase' in profile ? profile.ai_adoption_phase : undefined),
    };

    return AdoptionPhaseRule.classify(activity);
  }

  /**
   * 全ユーザーの成熟度フェーズ判定マップを生成
   */
  static evaluateAll(profiles: (UserUsageProfile | EnrichedUserSeat)[]): Record<string, AdoptionPhase> {
    const map: Record<string, AdoptionPhase> = {};
    for (const p of profiles) {
      map[p.login] = this.evaluateUser(p);
    }
    return map;
  }

  /**
   * 組織全体の採用成熟度分布 (AdoptionPhaseMetrics) を算出
   */
  static calculateDistribution(profiles: (UserUsageProfile | EnrichedUserSeat)[]): AdoptionPhaseMetrics {
    const phaseCounts: Record<AdoptionPhase, number> = {
      no_cohort: 0,
      code_first: 0,
      agent_first: 0,
      multi_agent: 0,
    };

    for (const p of profiles) {
      const phase = this.evaluateUser(p);
      phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
    }

    return {
      users_in_phase_28d: phaseCounts,
      total_evaluated_users: profiles.length,
    };
  }

  /**
   * チーム別の採用成熟度分布を算出
   */
  static calculateTeamDistribution(
    profiles: (UserUsageProfile | EnrichedUserSeat)[]
  ): Record<string, AdoptionPhaseMetrics> {
    const teamGroups: Record<string, (UserUsageProfile | EnrichedUserSeat)[]> = {};

    for (const p of profiles) {
      const teamKey = ('department' in p && p.department ? p.department : 'General');
      if (!teamGroups[teamKey]) {
        teamGroups[teamKey] = [];
      }
      teamGroups[teamKey].push(p);
    }

    const result: Record<string, AdoptionPhaseMetrics> = {};
    for (const [teamName, teamProfiles] of Object.entries(teamGroups)) {
      result[teamName] = this.calculateDistribution(teamProfiles);
    }

    return result;
  }
}
