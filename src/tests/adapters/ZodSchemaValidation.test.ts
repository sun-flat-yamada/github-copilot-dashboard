import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { CopilotSeatAssignmentRawSchema } from '../../adapters/github-api/schemas/seats-schema.js';
import { EnterpriseCostCenterRawSchema } from '../../adapters/github-api/schemas/cost-centers-schema.js';
import { normalizeSeats20260310 } from '../../adapters/github-api/normalizers/seats-2026-03-10.js';

describe('Zod Schema Validation & Normalization Tests', () => {
  // 廃止済み /copilot/metrics の応答スキーマ (metrics-schema / teams-metrics-schema) は削除済み (Issue #241)。
  // 利用状況メトリクスの行スキーマは UsageReports.test.ts / TeamMetrics.test.ts で検証する。

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

  it('validates EnterpriseCostCenter schema', () => {
    const costCenter = EnterpriseCostCenterRawSchema.parse({
      id: 'cc-1',
      name: 'Engineering',
      cost_center_code: 'ENG-01',
      resources: [{ type: 'User', name: 'octocat' }],
    });
    assert.equal(costCenter.cost_center_code, 'ENG-01');
  });
});
