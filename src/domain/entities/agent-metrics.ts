/**
 * Agent, Feature Engagement, and Adoption Phase Metrics Entities
 * 2026.09 Specification for AI Agent & Team Activity Analysis
 */

export interface AgentBreakdownMetric {
  agent_name: string;
  total_engaged_users: number;
  total_sessions: number;
  total_user_messages: number;
}

export interface ThirdPartyAgentMetric {
  provider: string;
  agent_name: string;
  total_engaged_users: number;
  total_requests: number;
}

export interface McpMetric {
  server_name: string;
  total_invocations: number;
  total_engaged_users: number;
  success_rate?: number;
}

export interface SkillMetric {
  skill_name: string;
  total_invocations: number;
  total_engaged_users: number;
}

export interface SlashCommandMetric {
  command: string;
  total_invocations: number;
  total_engaged_users: number;
}

export interface PluginMetric {
  plugin_id: string;
  plugin_name: string;
  total_invocations: number;
  total_engaged_users: number;
}

export interface CopilotAppMetric {
  app_name: string;
  total_engaged_users: number;
  total_sessions: number;
}

export interface FeatureEngagementMetric {
  feature_name: string;
  total_engaged_users: number;
  total_actions: number;
}

export type AdoptionPhase = 'no_cohort' | 'code_first' | 'agent_first' | 'multi_agent';

export interface AdoptionPhaseMetrics {
  users_in_phase_28d: {
    no_cohort: number;
    code_first: number;
    agent_first: number;
    multi_agent: number;
  };
  total_evaluated_users: number;
}

export interface AgentPrMetrics {
  total_prs_created_by_agent: number;
  total_prs_merged_by_agent: number;
  median_time_to_merge_hours: number;
  revert_rate_percent?: number;
}

export interface DiversityUsageMetrics {
  distinct_agent_use_count?: number;
  distinct_mcp_use_count?: number;
  distinct_model_use_count?: number;
  distinct_surface_use_count?: number;
}

export interface TeamDailyMetrics {
  team_slug: string;
  team_name: string;
  date: string;
  total_active_users: number;
  total_engaged_users: number;
  total_code_suggestions?: number;
  total_code_acceptances?: number;
  total_chat_turns?: number;
  total_agent_sessions?: number;
  ai_credits_used?: number;
}
