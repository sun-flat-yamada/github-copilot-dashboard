import { CopilotSeatAssignmentRawSchema } from '../schemas/seats-schema.js';
import { CopilotSeatAssignment } from '../../../domain/entities/copilot.js';

export function normalizeSeats20260310(raw: unknown): CopilotSeatAssignment {
  const parsed = CopilotSeatAssignmentRawSchema.parse(raw);

  return {
    created_at: parsed.created_at,
    updated_at: parsed.updated_at,
    pending_cancellation_date: parsed.pending_cancellation_date,
    last_activity_at: parsed.last_activity_at,
    last_activity_editor: parsed.last_activity_editor,
    plan_type: parsed.plan_type,
    assignee: {
      login: parsed.assignee.login,
      id: parsed.assignee.id,
      avatar_url: parsed.assignee.avatar_url,
      html_url: parsed.assignee.html_url,
      type: parsed.assignee.type,
    },
    assigning_team: parsed.assigning_team,
    assigning_teams: parsed.assigning_teams,
    organization: {
      login: parsed.organization.login,
      id: parsed.organization.id,
    },
    ai_credits_used: parsed.ai_credits_used,
    seat_status: parsed.seat_status,
    prepaid: parsed.prepaid,
    billing_effective_date: parsed.billing_effective_date,
  };
}
