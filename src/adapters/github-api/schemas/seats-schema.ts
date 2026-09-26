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

export const CopilotSeatAssignmentRawSchema = z.object({
  created_at: z.string(),
  updated_at: z.string(),
  pending_cancellation_date: z.string().nullable().optional().default(null),
  last_activity_at: z.string().nullable().optional().default(null),
  last_activity_editor: z.string().nullable().optional().default(null),
  plan_type: z.enum(['business', 'enterprise']).optional().default('enterprise'),
  assignee: GitHubUserAssigneeSchema,
  assigning_team: AssigningTeamSchema.nullable().optional().default(null),
  assigning_teams: z.array(AssigningTeamSchema).optional(),
  organization: SeatOrganizationSchema,
  ai_credits_used: z.number().optional(),
  seat_status: z.enum(['active', 'pending', 'suspended']).optional(),
  prepaid: z.boolean().optional(),
  billing_effective_date: z.string().optional(),
}).passthrough();

export type CopilotSeatAssignmentRaw = z.infer<typeof CopilotSeatAssignmentRawSchema>;
