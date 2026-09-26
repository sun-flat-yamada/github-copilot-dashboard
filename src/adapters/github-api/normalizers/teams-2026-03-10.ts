import { TeamDailyMetricsRawSchema } from '../schemas/teams-metrics-schema.js';
import { TeamDailyMetrics } from '../../../domain/entities/agent-metrics.js';

/**
 * Normalizer for GitHub Copilot Team-level Metrics API (2026-03-10 version).
 */
export function normalizeTeams20260310(raw: unknown): TeamDailyMetrics {
  const parsed = TeamDailyMetricsRawSchema.parse(raw);

  return {
    team_slug: parsed.team_slug,
    team_name: parsed.team_name,
    date: parsed.date,
    total_active_users: parsed.total_active_users,
    total_engaged_users: parsed.total_engaged_users,
    total_code_suggestions: parsed.total_code_suggestions ?? 0,
    total_code_acceptances: parsed.total_code_acceptances ?? 0,
    total_chat_turns: parsed.total_chat_turns ?? 0,
    total_agent_sessions: parsed.total_agent_sessions ?? 0,
    ai_credits_used: parsed.ai_credits_used ?? 0,
  };
}
