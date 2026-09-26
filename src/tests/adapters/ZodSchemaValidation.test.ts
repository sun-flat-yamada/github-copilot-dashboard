import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { CopilotDailyMetricsRawSchema } from '../../adapters/github-api/schemas/metrics-schema.js';
import { CopilotSeatAssignmentRawSchema } from '../../adapters/github-api/schemas/seats-schema.js';
import { EnterpriseCostCenterRawSchema } from '../../adapters/github-api/schemas/cost-centers-schema.js';
import { TeamDailyMetricsRawSchema } from '../../adapters/github-api/schemas/teams-metrics-schema.js';
import { normalizeMetrics20260310 } from '../../adapters/github-api/normalizers/metrics-2026-03-10.js';
import { normalizeSeats20260310 } from '../../adapters/github-api/normalizers/seats-2026-03-10.js';

describe('Zod Schema Validation & Normalization Tests', () => {
  it('validates CopilotDailyMetrics and allows unknown passthrough fields', () => {
    const raw = {
      date: '2026-09-01',
      total_active_users: 10,
      total_engaged_users: 8,
      copilot_ide_code_completions: {
        total_engaged_users: 7,
      },
      copilot_ide_chat: {
        total_engaged_users: 5,
        total_chats: 20,
      },
      copilot_dotcom_chat: {
        total_engaged_users: 2,
        total_chats: 4,
      },
      copilot_dotcom_pull_requests: {
        total_engaged_users: 1,
        total_pr_summaries_created: 2,
      },
      copilot_in_cli: {
        total_engaged_users: 3,
        total_cli_completions: 15,
      },
      unknown_future_field: 'should_not_break',
      future_object: { nested: 123 },
    };

    const parsed = CopilotDailyMetricsRawSchema.parse(raw);
    assert.equal(parsed.date, '2026-09-01');
    assert.equal((parsed as any).unknown_future_field, 'should_not_break');
  });

  it('A-9: defaults models to empty array when models field is omitted in chat metrics', () => {
    const rawWithoutModels = {
      date: '2026-09-01',
      total_active_users: 5,
      total_engaged_users: 4,
      copilot_ide_chat: {
        total_engaged_users: 4,
        total_chats: 10,
        // models is omitted
      },
    };

    const normalized = normalizeMetrics20260310(rawWithoutModels);
    assert.ok(Array.isArray(normalized.copilot_ide_chat.models));
    assert.equal(normalized.copilot_ide_chat.models?.length, 0);
  });

  it('validates CopilotSeatAssignment with full and minimal payload', () => {
    const raw = {
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
      assignee: {
        login: 'octocat',
        id: 1,
      },
      organization: {
        login: 'github',
        id: 2,
      },
      seat_status: 'active',
      ai_credits_used: 150,
      prepaid: true,
      billing_effective_date: '2026-10-01',
      extra_field: 'extra',
    };

    const parsed = CopilotSeatAssignmentRawSchema.parse(raw);
    assert.equal(parsed.assignee.login, 'octocat');
    const normalized = normalizeSeats20260310(raw);
    assert.equal(normalized.assignee.login, 'octocat');
    assert.equal(normalized.seat_status, 'active');
    assert.equal(normalized.ai_credits_used, 150);
    assert.equal(normalized.prepaid, true);
    assert.equal(normalized.billing_effective_date, '2026-10-01');
  });

  it('validates EnterpriseCostCenter and TeamDailyMetrics schemas', () => {
    const costCenter = EnterpriseCostCenterRawSchema.parse({
      id: 'cc-1',
      name: 'Engineering',
      cost_center_code: 'ENG-01',
      resources: [{ type: 'User', name: 'octocat' }],
    });
    assert.equal(costCenter.cost_center_code, 'ENG-01');

    const teamMetrics = TeamDailyMetricsRawSchema.parse({
      team_slug: 'core-dev',
      team_name: 'Core Development',
      date: '2026-09-01',
      total_active_users: 20,
      total_engaged_users: 18,
    });
    assert.equal(teamMetrics.team_slug, 'core-dev');
  });
});
