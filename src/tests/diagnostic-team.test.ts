import test from 'node:test';
import assert from 'node:assert';
import { InefficiencyDiagnosticEngine } from '../processor/inefficiency-diagnostic.js';
import { resolveDiagnosticConfig } from '../processor/diagnostic-config.js';
import { UserModelDailyUsage, UserUsageProfile } from '../types/copilot.js';

function day(date: string, suggestions: number, acceptances: number): UserModelDailyUsage {
  return {
    date,
    total_chats: 4,
    model_breakdown: { 'gpt-4o': 4 },
    suggestions,
    acceptances,
    lines_suggested: 100,
    lines_accepted: 10,
    acceptance_rate: suggestions ? acceptances / suggestions : 0,
    daily_cost_usd: 0.1,
  };
}

function member(login: string, suggestions: number, acceptances: number, days = 3): UserUsageProfile {
  const dates = ['2026-09-08', '2026-09-09', '2026-09-10'].slice(0, days);
  return {
    login,
    display_name: `Name of ${login}`,
    avatar_url: '',
    department: '',
    cost_center: '',
    organization: 'org-test',
    plan_type: 'enterprise',
    total_chats: 0,
    total_suggestions: 0,
    total_acceptances: 0,
    acceptance_rate: 0,
    total_cost_usd: 0,
    model_usage_totals: {},
    daily_history: dates.map((d) => day(d, suggestions, acceptances)),
  } as unknown as UserUsageProfile;
}

test('team below the minimum size is not diagnosed (k = 5)', () => {
  const four = ['a', 'b', 'c', 'd'].map((l) => member(l, 100, 5));
  const r = InefficiencyDiagnosticEngine.diagnoseTeam(four, '7d');
  assert.strictEqual(r.evaluable, false);
  assert.strictEqual(r.memberCount, 4);
  assert.deepStrictEqual(r.patterns, []);
  assert.strictEqual(r.metricsSummary, null);
  assert.match(r.insufficientReason!, /5 人未満/);
});

test('team at the minimum size shows only the distribution, never a login or name', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map((l, i) => member(`user-${l}`, 100, i < 2 ? 5 : 40));
  const r = InefficiencyDiagnosticEngine.diagnoseTeam(five, '7d');
  assert.strictEqual(r.evaluable, true);
  const tab = r.patterns.find((p) => p.id === 'tab_spamming_roulette')!;
  assert.strictEqual(tab.evaluatedMembers, 5);
  assert.ok(tab.distribution);
  assert.strictEqual(tab.distribution!.strong, 2);
  assert.strictEqual(tab.flaggedSharePercent, 40);
  const json = JSON.stringify(r);
  assert.ok(!/user-[a-e]/.test(json) && !/Name of/.test(json), 'no personal identifier in the team result');
  // pooled acceptance rate (sum / sum), not the mean of individual rates
  assert.strictEqual(r.metricsSummary!.totalSuggestions, 5 * 3 * 100);
  assert.strictEqual(r.metricsSummary!.acceptanceRatePercent, Number((((2 * 15 + 3 * 120) / 1500) * 100).toFixed(1)));
  assert.strictEqual(r.calibration.status, 'uncalibrated');
});

test('a pattern cell is suppressed when fewer than k members could be evaluated', () => {
  // 3 members have enough data, 2 have a single day (not evaluable for sample-based patterns)
  const team = [
    ...['a', 'b', 'c'].map((l) => member(l, 100, 5)),
    member('d', 100, 5, 1),
    member('e', 100, 5, 1),
  ];
  const r = InefficiencyDiagnosticEngine.diagnoseTeam(team, '7d');
  const tab = r.patterns.find((p) => p.id === 'tab_spamming_roulette')!;
  assert.strictEqual(tab.evaluatedMembers, 3);
  assert.strictEqual(tab.notEvaluableMembers, 2);
  assert.strictEqual(tab.distribution, null);
  assert.match(tab.suppressedReason!, /5 人未満/);
});

test('minimum team size is configurable', () => {
  const three = ['a', 'b', 'c'].map((l) => member(l, 100, 5));
  const r = InefficiencyDiagnosticEngine.diagnoseTeam(three, '7d', undefined, {
    config: resolveDiagnosticConfig({ minTeamSize: 3 }),
  });
  assert.strictEqual(r.evaluable, true);
});

test('empty profiles never produce synthesized judgement', () => {
  const r = InefficiencyDiagnosticEngine.diagnoseTeam([], '30d');
  assert.strictEqual(r.evaluable, false);
  assert.strictEqual(r.memberCount, 0);
});
