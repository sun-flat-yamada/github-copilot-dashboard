import { ScopeAggregatedData } from '../../domain/entities/copilot.js';
import { AgentAdoptionResult } from '../../application/store/derived/nodes/agentAdoption.js';

export interface AgentViewModel {
  hasData: boolean;
  totalSessions: number;
  totalSessionsFormatted: string;
  totalMessages: number;
  totalMessagesFormatted: string;
  engagedUsers: number;
  adoptionRateFormatted: string;
  adoptionRateRaw: number;
  topAgents: Array<{ name: string; sessions: number; users: number }>;
  topMcps: Array<{ name: string; calls: number }>;
  topSkills: Array<{ name: string; count: number }>;
  topSlashCommands: Array<{ name: string; count: number }>;
  prMetrics: {
    prsCreatedByAgent: number;
    prsMergedByAgent: number;
    medianMergeHours: number;
  };
  teams: Array<{ teamName: string; sessions: number; engagedUsers: number; adoptionRate: number; adoptionRateFormatted: string }>;
}

export interface AgentPresenterInput {
  currentData?: ScopeAggregatedData | null;
  agentAdoption?: AgentAdoptionResult | null;
}

export class AgentPresenter {
  public static present(input: AgentPresenterInput): AgentViewModel {
    const { currentData, agentAdoption } = input;
    const hasData = Boolean(agentAdoption || currentData?.agent_summary || (currentData?.overview && (currentData.overview as any).total_agent_sessions));

    const totalSessions = agentAdoption?.totalSessions ?? currentData?.agent_summary?.total_sessions ?? 0;
    const totalMessages = agentAdoption?.totalMessages ?? currentData?.agent_summary?.total_messages ?? 0;
    const engagedUsers = agentAdoption?.engagedUsers ?? currentData?.agent_summary?.engaged_users ?? 0;
    const adoptionRate = agentAdoption?.adoptionRate ?? currentData?.agent_summary?.adoption_rate ?? 0;

    const topAgents = agentAdoption?.topAgents ?? [];
    const topMcps = agentAdoption?.topMcps ?? [];
    const topSkills = agentAdoption?.topSkills ?? [];
    const topSlashCommands = agentAdoption?.topSlashCommands ?? [];
    const prMetrics = agentAdoption?.prMetrics ?? {
      prsCreatedByAgent: 0,
      prsMergedByAgent: 0,
      medianMergeHours: 4.5,
    };

    const teams: Array<{ teamName: string; sessions: number; engagedUsers: number; adoptionRate: number; adoptionRateFormatted: string }> = [];
    if (agentAdoption?.byTeam) {
      for (const [team, stats] of Object.entries(agentAdoption.byTeam)) {
        teams.push({
          teamName: team,
          sessions: stats.sessions,
          engagedUsers: stats.engagedUsers,
          adoptionRate: stats.adoptionRate,
          adoptionRateFormatted: `${(stats.adoptionRate * 100).toFixed(1)}%`,
        });
      }
    }

    return {
      hasData,
      totalSessions,
      totalSessionsFormatted: totalSessions.toLocaleString(),
      totalMessages,
      totalMessagesFormatted: totalMessages.toLocaleString(),
      engagedUsers,
      adoptionRateRaw: adoptionRate,
      adoptionRateFormatted: `${(adoptionRate * 100).toFixed(1)}%`,
      topAgents,
      topMcps,
      topSkills,
      topSlashCommands,
      prMetrics,
      teams,
    };
  }
}
