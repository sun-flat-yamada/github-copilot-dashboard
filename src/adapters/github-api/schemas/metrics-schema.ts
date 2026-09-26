import { z } from 'zod';

export const LanguageMetricRawSchema = z.object({
  name: z.string(),
  total_engaged_users: z.number().nonnegative(),
  total_code_suggestions: z.number().nonnegative().optional().default(0),
  total_code_acceptances: z.number().nonnegative().optional().default(0),
  total_code_lines_suggested: z.number().nonnegative().optional().default(0),
  total_code_lines_accepted: z.number().nonnegative().optional().default(0),
}).passthrough();

export const EditorMetricRawSchema = z.object({
  name: z.string(),
  total_engaged_users: z.number().nonnegative(),
  models: z.array(z.any()).optional().default([]),
}).passthrough();

export const ChatModelMetricRawSchema = z.object({
  name: z.string(),
  total_chats: z.number().nonnegative(),
}).passthrough();

export const CopilotDailyMetricsRawSchema = z.object({
  date: z.string(),
  total_active_users: z.number().nonnegative(),
  total_engaged_users: z.number().nonnegative(),
  copilot_ide_code_completions: z.object({
    total_engaged_users: z.number().nonnegative(),
    languages: z.array(LanguageMetricRawSchema).optional().default([]),
    editors: z.array(EditorMetricRawSchema).optional().default([]),
  }).passthrough().optional().default({ total_engaged_users: 0, languages: [], editors: [] }),
  copilot_ide_chat: z.object({
    total_engaged_users: z.number().nonnegative(),
    total_chats: z.number().nonnegative(),
    total_chat_copy_events: z.number().nonnegative().optional().default(0),
    total_chat_insertion_events: z.number().nonnegative().optional().default(0),
    models: z.array(ChatModelMetricRawSchema).optional().default([]), // A-9: デフォルト空配列補完
  }).passthrough().optional().default({ total_engaged_users: 0, total_chats: 0, total_chat_copy_events: 0, total_chat_insertion_events: 0, models: [] }),
  copilot_dotcom_chat: z.object({
    total_engaged_users: z.number().nonnegative(),
    total_chats: z.number().nonnegative(),
  }).passthrough().optional().default({ total_engaged_users: 0, total_chats: 0 }),
  copilot_dotcom_pull_requests: z.object({
    total_engaged_users: z.number().nonnegative(),
    total_pr_summaries_created: z.number().nonnegative(),
  }).passthrough().optional().default({ total_engaged_users: 0, total_pr_summaries_created: 0 }),
  copilot_in_cli: z.object({
    total_engaged_users: z.number().nonnegative(),
    total_cli_completions: z.number().nonnegative(),
  }).passthrough().optional().default({ total_engaged_users: 0, total_cli_completions: 0 }),
  copilot_ide_agent: z.any().optional(),
  ai_credits: z.any().optional(),
  prs_created_by_agent: z.any().optional(),
  feature_engagement: z.any().optional(),
  code_generation: z.any().optional(),
  diversity_usage: z.any().optional(),
}).passthrough();

export type CopilotDailyMetricsRaw = z.infer<typeof CopilotDailyMetricsRawSchema>;
