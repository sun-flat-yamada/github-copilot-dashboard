import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { AdoptionPhaseRule, ADOPTION_RULE_V2 } from '../domain/rules/AdoptionPhaseRule.js';
import type { AdoptionInputs, AdoptionPhase } from '../domain/entities/agent-metrics.js';
import { buildUserProfiles } from '../adapters/github-api/usage-reports/user-report-mapper.js';
import type { UserReportRow } from '../adapters/github-api/usage-reports/user-report-schema.js';
import { MetricsAggregator } from '../processor/metrics-aggregator.js';
import { AdoptionPresenter, SMALL_TEAMS_LABEL } from '../adapters/presenters/AdoptionPresenter.js';
import type { ScopeAggregatedData, UserUsageProfile } from '../types/copilot.js';
import { METRIC_REGISTRY } from '../domain/metrics/metric-registry.js';

const inputs = (over: Partial<AdoptionInputs> = {}): AdoptionInputs => ({
  windowStart: '2026-09-03',
  windowEnd: '2026-09-30',
  windowDays: 28,
  observedDays: 28,
  activeDays: 10,
  completionDays: 10,
  chatDays: 0,
  agentDays: 0,
  cliDays: 0,
  ...over,
});

const phaseOf = (over: Partial<AdoptionInputs>) => {
  const r = AdoptionPhaseRule.evaluate(inputs(over));
  return r.status === 'classified' ? r.phase : `insufficient`;
};

describe('AdoptionPhaseRule v2 (measured, window based)', () => {
  it('classifies no_cohort only when the window is sufficiently observed', () => {
    assert.equal(phaseOf({ activeDays: 0, completionDays: 0 }), 'no_cohort');
    assert.equal(phaseOf({ activeDays: 0, completionDays: 0, observedDays: ADOPTION_RULE_V2.minObservedDays }), 'no_cohort');
  });

  it('does not classify when observed days are below the minimum (boundary: min - 1)', () => {
    const r = AdoptionPhaseRule.evaluate(inputs({ observedDays: ADOPTION_RULE_V2.minObservedDays - 1, activeDays: 0 }));
    assert.equal(r.status, 'insufficient');
    if (r.status === 'insufficient') assert.match(r.reason, /観測日数/);
    // even an active user is not classified: the window is too short
    assert.equal(phaseOf({ observedDays: 3, agentDays: 5, chatDays: 5 }), 'insufficient');
  });

  it('code_first for usage below the agent_first criteria', () => {
    assert.equal(phaseOf({ agentDays: 0, chatDays: 0 }), 'code_first');
    assert.equal(phaseOf({ agentDays: ADOPTION_RULE_V2.agentFirstAgentDays - 1, chatDays: ADOPTION_RULE_V2.agentFirstChatDays - 1 }), 'code_first');
  });

  it('agent_first at the exact agent-day and chat-day thresholds', () => {
    assert.equal(phaseOf({ agentDays: ADOPTION_RULE_V2.agentFirstAgentDays }), 'agent_first');
    assert.equal(phaseOf({ chatDays: ADOPTION_RULE_V2.agentFirstChatDays }), 'agent_first');
  });

  it('multi_agent needs sustained agent days AND enough surfaces (boundary values)', () => {
    const base = { agentDays: ADOPTION_RULE_V2.multiAgentAgentDays, completionDays: 5, chatDays: 5, cliDays: 0 };
    assert.equal(phaseOf(base), 'multi_agent'); // completion + chat + agent = 3 surfaces
    assert.equal(phaseOf({ ...base, agentDays: ADOPTION_RULE_V2.multiAgentAgentDays - 1 }), 'agent_first');
    assert.equal(phaseOf({ ...base, chatDays: 0 }), 'agent_first'); // 2 surfaces only
    assert.equal(phaseOf({ ...base, chatDays: 0, cliDays: 2 }), 'multi_agent'); // completion + agent + cli
  });

  it('without the agent flag only a chat-based result is valid; otherwise it is not classified', () => {
    assert.equal(phaseOf({ agentDays: null, chatDays: ADOPTION_RULE_V2.agentFirstChatDays }), 'agent_first');
    const r = AdoptionPhaseRule.evaluate(inputs({ agentDays: null, chatDays: 2 }));
    assert.equal(r.status, 'insufficient');
    if (r.status === 'insufficient') assert.match(r.reason, /Agent/);
    // no activity at all is still a measurement
    assert.equal(phaseOf({ agentDays: null, activeDays: 0, completionDays: 0 }), 'no_cohort');
  });

  it('respects an explicit override even when data is insufficient', () => {
    const r = AdoptionPhaseRule.evaluate({ ...inputs({ observedDays: 1 }), overridePhase: 'multi_agent' });
    assert.deepEqual(r.status === 'classified' && r.phase, 'multi_agent');
  });
});

function row(day: string, login: string, id: number, over: Partial<UserReportRow> = {}): UserReportRow {
  return {
    day,
    user_id: id,
    user_login: login,
    user_initiated_interaction_count: 1,
    code_generation_activity_count: 1,
    code_acceptance_activity_count: 0,
    used_agent: false,
    totals_by_feature: [{ feature: 'code_completion', code_generation_activity_count: 1 }],
    ...over,
  } as unknown as UserReportRow;
}

function daysUntil(end: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(`${end}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

describe('buildUserProfiles derives adoption from measured days', () => {
  it('counts agent days inside the 28-day window and ignores days outside it', () => {
    const days = daysUntil('2026-09-30', 40); // 40 days of data, window is the last 28
    const rowsByDay = new Map<string, UserReportRow[]>();
    for (const day of days) {
      const inWindow = day >= '2026-09-03';
      rowsByDay.set(day, [
        // agent every day, but only 28 days count
        row(day, 'agent-user', 1, { used_agent: true }),
        // chat only outside the window -> in window: completion only
        row(day, 'old-chat-user', 2, {
          used_chat: !inWindow,
          totals_by_feature: [
            inWindow
              ? { feature: 'code_completion', code_generation_activity_count: 1 }
              : { feature: 'chat_panel_ask_mode', user_initiated_interaction_count: 3 },
          ],
        } as Partial<UserReportRow>),
      ]);
    }
    const profiles = buildUserProfiles(rowsByDay);
    const agent = profiles.find((p) => p.login === 'agent-user')!;
    assert.equal(agent.adoption_inputs?.agentDays, 28);
    assert.equal(agent.adoption_inputs?.windowStart, '2026-09-03');
    assert.equal(agent.ai_adoption_phase, 'agent_first'); // completion + agent = 2 surfaces: below the multi_agent breadth
    const old = profiles.find((p) => p.login === 'old-chat-user')!;
    assert.equal(old.adoption_inputs?.chatDays, 0); // chat happened only before the window
    assert.equal(old.ai_adoption_phase, 'code_first');
  });

  it('leaves the phase unset with a reason when the dataset covers too few days', () => {
    const rowsByDay = new Map<string, UserReportRow[]>();
    for (const day of daysUntil('2026-09-30', 3)) rowsByDay.set(day, [row(day, 'u', 1)]);
    const [p] = buildUserProfiles(rowsByDay);
    assert.equal(p.ai_adoption_phase, undefined);
    assert.match(p.adoption_unclassified_reason ?? '', /観測日数/);
  });

  it('treats a dataset without any used_agent flag as agent-unknown (not zero)', () => {
    const rowsByDay = new Map<string, UserReportRow[]>();
    for (const day of daysUntil('2026-09-30', 10)) {
      const r = row(day, 'u', 1);
      delete (r as { used_agent?: boolean }).used_agent;
      rowsByDay.set(day, [r]);
    }
    const [p] = buildUserProfiles(rowsByDay);
    assert.equal(p.adoption_inputs?.agentDays, null);
    assert.equal(p.ai_adoption_phase, undefined);
  });
});

const profile = (login: string, department: string, phase?: AdoptionPhase): UserUsageProfile =>
  ({
    login,
    display_name: login,
    avatar_url: '',
    department,
    cost_center: '',
    organization: '',
    plan_type: 'unknown',
    total_chats: 0,
    total_suggestions: 0,
    total_acceptances: 0,
    acceptance_rate: 0,
    total_cost_usd: 0,
    model_usage_totals: {},
    daily_history: [],
    ...(phase ? { ai_adoption_phase: phase } : { adoption_unclassified_reason: 'データ不足' }),
  }) as UserUsageProfile;

describe('MetricsAggregator keeps unclassified users out of no_cohort', () => {
  it('counts them separately', () => {
    const profiles = [profile('a', 'X', 'code_first'), profile('b', 'X'), profile('c', 'X', 'no_cohort')];
    const data = new MetricsAggregator().aggregateScope(
      'monthly', '2026-09', [], [], { start: '2026-09-01', end: '2026-09-30', days_count: 30 }, [], [], profiles
    );
    const dist = data.adoption_distribution!;
    assert.equal(dist.users_in_phase_28d.no_cohort, 1);
    assert.equal(dist.total_evaluated_users, 2);
    assert.equal(dist.unclassified_users, 1);
  });
});

function dataWith(profiles: UserUsageProfile[]): ScopeAggregatedData {
  return new MetricsAggregator().aggregateScope(
    'monthly', '2026-09', [], [], { start: '2026-09-01', end: '2026-09-30', days_count: 30 }, [], [], profiles
  );
}

const team = (name: string, n: number, phase: AdoptionPhase = 'agent_first', startId = 0) =>
  Array.from({ length: n }, (_, i) => profile(`${name}-${startId + i}`, name, phase));

describe('AdoptionPresenter team breakdown (real head count, k>=5)', () => {
  it('shows a team at exactly k and merges a team at k-1', () => {
    const vm = AdoptionPresenter.present({ currentData: dataWith([...team('big', 5), ...team('small', 4)]) });
    const rows = vm.teamBreakdown;
    assert.equal(rows.find((r) => r.teamName === 'big')?.totalUsers, 5);
    assert.equal(rows.find((r) => r.teamName === 'small'), undefined);
    // the merged row holds only 4 people: suppressed, no distribution
    const merged = rows.find((r) => r.teamName === SMALL_TEAMS_LABEL)!;
    assert.equal(merged.suppressed, true);
    assert.equal(merged.totalUsers, 0);
    assert.deepEqual(Object.values(merged.stages), [0, 0, 0, 0]);
  });

  it('shows the merged row when the small teams together reach k', () => {
    const vm = AdoptionPresenter.present({
      currentData: dataWith([...team('big', 6), ...team('s1', 3, 'code_first'), ...team('s2', 2, 'multi_agent')]),
    });
    const merged = vm.teamBreakdown.find((r) => r.teamName === SMALL_TEAMS_LABEL)!;
    assert.equal(merged.suppressed, undefined);
    assert.equal(merged.totalUsers, 5);
    assert.equal(merged.teamCount, 2);
    assert.equal(merged.stages.code_first, 3);
    assert.equal(merged.stages.multi_agent, 2);
    assert.equal(vm.teamBreakdown.some((r) => r.teamName === 's1' || r.teamName === 's2'), false);
  });

  it('uses classified members as the head count and reports unclassified separately', () => {
    const profiles = [...team('t', 5), profile('t-x', 't'), profile('t-y', 't')];
    const vm = AdoptionPresenter.present({ currentData: dataWith(profiles) });
    const t = vm.teamBreakdown.find((r) => r.teamName === 't')!;
    assert.equal(t.totalUsers, 5);
    assert.equal(t.unclassifiedUsers, 2);
    assert.equal(vm.totalEvaluatedUsers, 5);
    assert.equal(vm.unclassifiedUsers, 2);
    assert.deepEqual(vm.unclassifiedReasons, ['データ不足']);
  });

  it('a team with 6 members of which only 4 are classified is merged (k counts classified members)', () => {
    const profiles = [...team('t', 4), profile('t-x', 't'), profile('t-y', 't')];
    const vm = AdoptionPresenter.present({ currentData: dataWith(profiles) });
    assert.equal(vm.teamBreakdown.some((r) => r.teamName === 't'), false);
  });

  it('never exposes member logins and does not use the seat count as the evaluated count', () => {
    const vm = AdoptionPresenter.present({ currentData: dataWith(team('big', 5)) });
    assert.equal(JSON.stringify(vm).includes('big-0'), false);
    const empty = AdoptionPresenter.present({ currentData: dataWith([profile('z', 'z')]) });
    assert.equal(empty.totalEvaluatedUsers, 0);
    assert.equal(empty.unclassifiedUsers, 1);
  });

  it('describes the applied rule (window, thresholds, k)', () => {
    const vm = AdoptionPresenter.present({ currentData: dataWith(team('big', 5)) });
    assert.equal(vm.rule.windowDays, 28);
    assert.equal(vm.rule.minTeamSize, 5);
    assert.ok(vm.rule.criteria.length >= 5);
  });
});

describe('metric catalog', () => {
  it('registers the unclassified-users metric', () => {
    assert.ok(METRIC_REGISTRY.adoption_unclassified_users);
  });
});
