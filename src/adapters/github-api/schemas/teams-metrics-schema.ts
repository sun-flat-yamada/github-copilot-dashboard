import { z } from 'zod';

export const TeamDailyMetricsRawSchema = z.object({
  team_slug: z.string(),
  team_name: z.string(),
  date: z.string(),
  total_active_users: z.number().nonnegative(),
  total_engaged_users: z.number().nonnegative(),
  total_code_suggestions: z.number().nonnegative().optional(),
  total_code_acceptances: z.number().nonnegative().optional(),
  total_chat_turns: z.number().nonnegative().optional(),
  total_agent_sessions: z.number().nonnegative().optional(),
  ai_credits_used: z.number().nonnegative().optional(),
}).passthrough();

export type TeamDailyMetricsRaw = z.infer<typeof TeamDailyMetricsRawSchema>;
