import { CopilotDailyMetricsRawSchema } from '../schemas/metrics-schema.js';
import { CopilotDailyMetrics } from '../../../domain/entities/copilot.js';

export function normalizeMetrics20260310(raw: unknown): CopilotDailyMetrics {
  const parsed = CopilotDailyMetricsRawSchema.parse(raw);

  return {
    date: parsed.date,
    total_active_users: parsed.total_active_users,
    total_engaged_users: parsed.total_engaged_users,
    copilot_ide_code_completions: {
      total_engaged_users: parsed.copilot_ide_code_completions.total_engaged_users,
      languages: parsed.copilot_ide_code_completions.languages || [],
      editors: parsed.copilot_ide_code_completions.editors || [],
    },
    copilot_ide_chat: {
      total_engaged_users: parsed.copilot_ide_chat.total_engaged_users,
      total_chats: parsed.copilot_ide_chat.total_chats,
      total_chat_copy_events: parsed.copilot_ide_chat.total_chat_copy_events || 0,
      total_chat_insertion_events: parsed.copilot_ide_chat.total_chat_insertion_events || 0,
      models: parsed.copilot_ide_chat.models || [], // A-9: Default to empty array if omitted
    },
    copilot_dotcom_chat: {
      total_engaged_users: parsed.copilot_dotcom_chat.total_engaged_users,
      total_chats: parsed.copilot_dotcom_chat.total_chats,
    },
    copilot_dotcom_pull_requests: {
      total_engaged_users: parsed.copilot_dotcom_pull_requests.total_engaged_users,
      total_pr_summaries_created: parsed.copilot_dotcom_pull_requests.total_pr_summaries_created,
    },
    copilot_in_cli: {
      total_engaged_users: parsed.copilot_in_cli.total_engaged_users,
      total_cli_completions: parsed.copilot_in_cli.total_cli_completions,
    },
    copilot_ide_agent: parsed.copilot_ide_agent,
    ai_credits: parsed.ai_credits,
    prs_created_by_agent: parsed.prs_created_by_agent,
    feature_engagement: parsed.feature_engagement,
    code_generation: parsed.code_generation,
    diversity_usage: parsed.diversity_usage,
  };
}
