import test from 'node:test';
import assert from 'node:assert';
import {
  assessDataSufficiency,
  buildSignalEvidence,
  signalStrengthBand,
} from '../processor/diagnostic-signals.js';
import { resolveDiagnosticConfig } from '../processor/diagnostic-config.js';
import { InefficiencyDiagnosticEngine } from '../processor/inefficiency-diagnostic.js';
import { UserModelDailyUsage, UserUsageProfile } from '../types/copilot.js';

function day(date: string, o: Partial<UserModelDailyUsage> = {}): UserModelDailyUsage {
  return {
    date,
    total_chats: 6,
    model_breakdown: { 'gpt-4o': 6 },
    suggestions: 20,
    acceptances: 1,
    lines_suggested: 100,
    lines_accepted: 5,
    acceptance_rate: 0.05,
    daily_cost_usd: 0.1,
    ...o,
  };
}

function profile(login: string, history: UserModelDailyUsage[]): UserUsageProfile {
  return {
    login,
    display_name: '',
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
    daily_history: history,
  } as unknown as UserUsageProfile;
}

test('signal band boundaries are inclusive lower bounds', () => {
  assert.strictEqual(signalStrengthBand(14), 'none');
  assert.strictEqual(signalStrengthBand(15), 'weak');
  assert.strictEqual(signalStrengthBand(39), 'weak');
  assert.strictEqual(signalStrengthBand(40), 'medium');
  assert.strictEqual(signalStrengthBand(69), 'medium');
  assert.strictEqual(signalStrengthBand(70), 'strong');
  const cfg = resolveDiagnosticConfig({ bandThresholds: { strong: 90 } });
  assert.strictEqual(signalStrengthBand(80, cfg), 'medium');
});

test('data sufficiency boundary: required - 1 is insufficient, required is sufficient', () => {
  const base = { activeDays: 3, windowDays: 30, suggestions: 30, chats: 0 };
  assert.strictEqual(assessDataSufficiency('tab_spamming_roulette', base).sufficient, true);
  const fewSugg = assessDataSufficiency('tab_spamming_roulette', { ...base, suggestions: 29 });
  assert.strictEqual(fewSugg.sufficient, false);
  assert.match(fewSugg.reason!, /Inline 提案数: 29 \/ 必要 30 以上/);
  const fewDays = assessDataSufficiency('tab_spamming_roulette', { ...base, activeDays: 2 });
  assert.strictEqual(fewDays.sufficient, false);
  assert.match(fewDays.reason!, /稼働日数: 2/);
  // passive seat needs a 7-day window, not active days
  assert.strictEqual(assessDataSufficiency('passive_seat_disengaged', { ...base, activeDays: 0, windowDays: 6 }).sufficient, false);
  assert.strictEqual(assessDataSufficiency('passive_seat_disengaged', { ...base, activeDays: 0, windowDays: 7 }).sufficient, true);
});

test('thresholds are configurable', () => {
  const cfg = resolveDiagnosticConfig({ minimums: { tab_spamming_roulette: { minSuggestions: 5, minActiveDays: 1 } } });
  assert.strictEqual(
    assessDataSufficiency('tab_spamming_roulette', { activeDays: 1, windowDays: 7, suggestions: 5, chats: 0 }, cfg).sufficient,
    true
  );
});

test('evidence exposes input, threshold and rationale for every rule', () => {
  const ev = buildSignalEvidence([
    {
      metricName: 'Inline補完受諾率',
      currentValueFormatted: '5.0% (1/20 件)',
      recommendedThresholdFormatted: '≥ 25.0%',
      description: '低い',
      severity: 'danger',
    },
    {
      metricName: 'x',
      currentValueFormatted: '1',
      recommendedThresholdFormatted: '2',
      description: 'ok',
      severity: 'good',
    },
    { metricName: 'y', currentValueFormatted: '1', recommendedThresholdFormatted: '2', description: 'n', severity: 'neutral' },
  ]);
  assert.deepStrictEqual(
    ev.map((e) => e.status),
    ['met', 'not_met', 'reference']
  );
  assert.strictEqual(ev[0].input, 'Inline補完受諾率');
  assert.strictEqual(ev[0].value, '5.0% (1/20 件)');
  assert.strictEqual(ev[0].threshold, '≥ 25.0%');
});

test('diagnoseUser: insufficient sample gives no judgement and states why', () => {
  // One active day only: every sample-based pattern must be "not evaluable"
  const p = profile('u1', [day('2026-09-10', { suggestions: 500, acceptances: 10, total_chats: 50 })]);
  const r = InefficiencyDiagnosticEngine.diagnoseUser(p, '30d');
  const tab = r.patterns.find((x) => x.id === 'tab_spamming_roulette')!;
  assert.strictEqual(tab.evaluable, false);
  assert.strictEqual(tab.signalBand, 'unknown');
  assert.match(tab.insufficientDataReason!, /稼働日数: 1 \/ 必要 3 以上/);
  assert.strictEqual(tab.dataSufficiency?.sufficient, false);
  assert.ok(r.patterns.filter((x) => x.id !== 'passive_seat_disengaged').every((x) => x.signalBand !== undefined));
});

test('diagnoseUser: sufficient sample gives strength, band, evidence and sufficiency; probability alias kept', () => {
  const h = ['2026-09-08', '2026-09-09', '2026-09-10'].map((d) => day(d, { suggestions: 120, acceptances: 7 }));
  const r = InefficiencyDiagnosticEngine.diagnoseUser(profile('u2', h), '7d');
  const tab = r.patterns.find((x) => x.id === 'tab_spamming_roulette')!;
  assert.notStrictEqual(tab.evaluable, false);
  assert.strictEqual(tab.signalStrengthPercent, tab.probabilityPercent);
  assert.strictEqual(tab.signalBand, 'strong');
  assert.ok(tab.evidence!.length >= 2 && tab.evidence!.every((e) => e.input && e.value && e.threshold && e.rationale));
  assert.strictEqual(tab.dataSufficiency?.sufficient, true);
  assert.strictEqual(r.calibration?.status, 'uncalibrated');
});

test('diagnoseUser: no acceptance-rate "healthy bonus" (SDD-06 §4.2)', () => {
  // acceptance 35% would have removed 10 penalty points under the old bonus; the score must equal the penalty-only score
  const bad = ['2026-09-08', '2026-09-09', '2026-09-10'].map((d) =>
    day(d, { suggestions: 100, acceptances: 35, total_chats: 100, model_breakdown: { o1: 100 } })
  );
  const r = InefficiencyDiagnosticEngine.diagnoseUser(profile('u3', bad), '7d');
  const flagged = r.patterns.filter((p) => p.evaluable !== false && p.probabilityPercent >= 40);
  assert.ok(flagged.length > 0);
  assert.ok(r.healthScore < 100);
});
