import { z } from 'zod';

export const GitHubUserAssigneeSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().optional().default(''),
  html_url: z.string().optional().default(''),
  type: z.string().optional().default('User'),
}).passthrough();

export const AssigningTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
}).passthrough();

export const SeatOrganizationSchema = z.object({
  login: z.string(),
  id: z.number(),
}).passthrough();

/**
 * plan_type は API の列挙値 (business | enterprise | unknown) を前提にしつつ、
 * 欠損・未知の値は 'unknown' (未確定) として保持する。
 * 以前は欠損を 'enterprise' ($39) と見なしており、費用を過大に見積もっていた。
 */
export const SeatPlanTypeSchema = z
  .string()
  .nullish()
  .transform((value): 'business' | 'enterprise' | 'unknown' => {
    const normalized = value?.trim().toLowerCase();
    return normalized === 'business' || normalized === 'enterprise' ? normalized : 'unknown';
  });

export const CopilotSeatAssignmentRawSchema = z.object({
  created_at: z.string(),
  // updated_at は非推奨フィールドで返らないことがある。欠損時は created_at で補う (normalizer)
  updated_at: z.string().optional(),
  pending_cancellation_date: z.string().nullable().optional().default(null),
  last_activity_at: z.string().nullable().optional().default(null),
  last_activity_editor: z.string().nullable().optional().default(null),
  plan_type: SeatPlanTypeSchema,
  assignee: GitHubUserAssigneeSchema,
  assigning_team: AssigningTeamSchema.nullable().optional().default(null),
  assigning_teams: z.array(AssigningTeamSchema).optional(),
  // Enterprise 直下のシート等では null が返る
  organization: SeatOrganizationSchema.nullable().optional().default(null),
  ai_credits_used: z.number().optional(),
  // 将来追加される未知のステータスでレコード全体を落とさない
  seat_status: z.enum(['active', 'pending', 'suspended']).optional().catch(undefined),
  prepaid: z.boolean().optional(),
  billing_effective_date: z.string().optional(),
}).passthrough();

export type CopilotSeatAssignmentRaw = z.infer<typeof CopilotSeatAssignmentRawSchema>;
