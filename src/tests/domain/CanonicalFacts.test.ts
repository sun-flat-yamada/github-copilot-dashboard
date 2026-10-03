import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  FACT_SCHEMAS,
  FACT_SCHEMA_VERSION,
  generateFactJsonSchemas,
  toSeatSnapshot,
  toUsageOrgDaily,
  toUsageUserDaily,
  toUsageUserFeatureDaily,
  usageUserDailySchema,
} from '../../domain/facts/index.js';
import { validateUserReportRow } from '../../adapters/github-api/usage-reports/user-report-schema.js';
import { buildDailyMetrics, userKey } from '../../adapters/github-api/usage-reports/user-report-mapper.js';
import type { CopilotSeatAssignment } from '../../domain/entities/copilot.js';

function row(extra: Record<string, unknown> = {}) {
  const v = validateUserReportRow({
    day: '2026-09-30',
    user_id: 7,
    user_login: 'user-a',
    user_initiated_interaction_count: 5,
    code_generation_activity_count: 10,
    code_acceptance_activity_count: 4,
    used_chat: true,
    totals_by_feature: [{ feature: 'code_completion', code_generation_activity_count: 10 }],
    totals_by_model_feature: [{ feature: 'chat_panel_ask_mode', model: 'gpt-x', user_initiated_interaction_count: 5 }],
    ...extra,
  });
  assert.ok(v.ok);
  return v.row;
}
const opts = { resolveUserKey: userKey };

describe('canonical facts v1', () => {
  it('every fact schema carries schema_version', () => {
    for (const [name, schema] of Object.entries(FACT_SCHEMAS)) {
      assert.ok('schema_version' in schema.shape, name);
    }
  });

  it('maps a Reports row to a user-day fact; absent metrics are null, not 0', () => {
    const fact = toUsageUserDaily('2026-09-30', row(), opts);
    assert.equal(fact.schema_version, FACT_SCHEMA_VERSION);
    assert.equal(fact.user_key, 'id:7');
    assert.equal(fact.interactions, 5);
    assert.equal(fact.loc_added, null);
    assert.equal(fact.ai_credits_used, null);
    assert.equal(fact.used_agent, null);
    assert.equal(fact.used_chat, true);
    assert.equal(fact.quality, 'measured');
    usageUserDailySchema.parse(fact);
  });

  it('marks a row with no reported metrics as missing', () => {
    const fact = toUsageUserDaily('2026-09-30', row({
      user_initiated_interaction_count: undefined,
      code_generation_activity_count: undefined,
      code_acceptance_activity_count: undefined,
      used_chat: undefined,
    }), opts);
    assert.equal(fact.quality, 'missing');
    assert.equal(fact.interactions, null);
  });

  it('emits breakdown rows at the finest grain only (no double counting)', () => {
    const byModel = toUsageUserFeatureDaily('2026-09-30', row(), opts);
    assert.deepEqual(byModel.map((r) => [r.feature, r.model]), [['chat_panel_ask_mode', 'gpt-x']]);
    const byFeature = toUsageUserFeatureDaily('2026-09-30', row({ totals_by_model_feature: undefined }), opts);
    assert.deepEqual(byFeature.map((r) => [r.feature, r.model]), [['code_completion', null]]);
    assert.equal(byFeature[0].loc_added, null);
  });

  it('maps daily metrics to an org fact, keeping unreported PR summaries null', () => {
    const metrics = buildDailyMetrics('2026-09-30', [row()]);
    const fact = toUsageOrgDaily(metrics, 'enterprise:acme');
    assert.equal(fact.pr_summaries_created, null);
    assert.equal(fact.scope, 'enterprise:acme');
    assert.equal(fact.agent_users, null);
    FACT_SCHEMAS['fact.usage_org_daily'].parse(fact);
  });

  it('maps seats; unknown plan stays unknown and a null organization stays null', () => {
    const seat = {
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      pending_cancellation_date: '2026-10-15T00:00:00Z',
      last_activity_at: null,
      last_activity_editor: null,
      plan_type: 'something-new',
      assignee: { login: 'user-a', id: 7, avatar_url: '', html_url: '', type: 'User' },
      assigning_teams: [{ id: 1, name: 'Team A', slug: 'team-a' }],
      organization: null,
    } as unknown as CopilotSeatAssignment;
    const fact = toSeatSnapshot('2026-10-01', seat, { resolveUserKey: (s) => `id:${s.assignee.id}` });
    assert.equal(fact.plan_type, 'unknown');
    assert.equal(fact.organization, null);
    assert.equal(fact.last_activity_at, null);
    assert.equal(fact.pending_cancellation_date, '2026-10-15');
    assert.deepEqual(fact.assigning_teams, ['team-a']);
    FACT_SCHEMAS['fact.seat_snapshot'].parse(fact);
  });

  it('rejects a fact without schema_version, a negative metric, and unknown keys', () => {
    const fact = toUsageUserDaily('2026-09-30', row(), opts);
    const { schema_version: _omit, ...without } = fact;
    assert.equal(usageUserDailySchema.safeParse(without).success, false);
    assert.equal(usageUserDailySchema.safeParse({ ...fact, interactions: -1 }).success, false);
    assert.equal(usageUserDailySchema.safeParse({ ...fact, user_login: 'x' }).success, false);
  });

  it('committed JSON Schemas match the zod definitions (run `npm run schema:facts` on drift)', () => {
    const dir = path.resolve('docs/schemas/facts');
    for (const [name, body] of Object.entries(generateFactJsonSchemas())) {
      const file = path.join(dir, name);
      assert.ok(fs.existsSync(file), `${name} is missing`);
      assert.equal(fs.readFileSync(file, 'utf8'), body, `${name} is stale`);
      assert.equal(z.fromJSONSchema(JSON.parse(body)) !== undefined, true);
    }
  });
});
