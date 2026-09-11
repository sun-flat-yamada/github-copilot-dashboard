import test from 'node:test';
import assert from 'node:assert';
import {
  ANALYSIS_METHODS_REGISTRY,
  InefficiencyDiagnosticEngine,
} from '../processor/inefficiency-diagnostic.js';
import { UserModelDailyUsage, UserUsageProfile } from '../types/copilot.js';

test('Inefficiency Diagnostic: Registry & Analysis Methods', () => {
  assert.ok(ANALYSIS_METHODS_REGISTRY.length >= 4);
  const activeMethod = ANALYSIS_METHODS_REGISTRY.find((m) => m.id === 'inefficient_usage_diagnostic');
  assert.ok(activeMethod);
  assert.strictEqual(activeMethod?.status, 'active');

  const comingSoonMethods = ANALYSIS_METHODS_REGISTRY.filter((m) => m.status === 'coming_soon');
  assert.ok(comingSoonMethods.length >= 3);
});

test('Inefficiency Diagnostic: Period Scope Filtering', () => {
  const mockDailyHistory: UserModelDailyUsage[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date('2026-09-10');
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    mockDailyHistory.push({
      date: dateStr,
      total_chats: 10,
      model_breakdown: { 'gpt-4o': 10 },
      suggestions: 50,
      acceptances: 15,
      lines_suggested: 300,
      lines_accepted: 90,
      acceptance_rate: 0.3,
      daily_cost_usd: 1.3,
    });
  }

  // 1. 30d (前1カ月間)
  const res30d = InefficiencyDiagnosticEngine.filterDailyHistory(
    mockDailyHistory,
    '30d',
    undefined,
    '2026-09-10'
  );
  assert.strictEqual(res30d.filteredHistory.length, 30);
  assert.strictEqual(res30d.periodInfo.totalDays, 30);
  assert.strictEqual(res30d.periodInfo.activeDays, 30);

  // 2. today (当日)
  const resToday = InefficiencyDiagnosticEngine.filterDailyHistory(
    mockDailyHistory,
    'today',
    undefined,
    '2026-09-10'
  );
  assert.strictEqual(resToday.filteredHistory.length, 1);
  assert.strictEqual(resToday.filteredHistory[0].date, '2026-09-10');

  // 3. 7d (1週間前まで)
  const res7d = InefficiencyDiagnosticEngine.filterDailyHistory(
    mockDailyHistory,
    '7d',
    undefined,
    '2026-09-10'
  );
  assert.strictEqual(res7d.filteredHistory.length, 7);

  // 4. custom (期間指定)
  const resCustom = InefficiencyDiagnosticEngine.filterDailyHistory(
    mockDailyHistory,
    'custom',
    { start: '2026-09-01', end: '2026-09-05' },
    '2026-09-10'
  );
  assert.strictEqual(resCustom.filteredHistory.length, 5);
  assert.strictEqual(resCustom.filteredHistory[0].date, '2026-09-01');
  assert.strictEqual(resCustom.filteredHistory[4].date, '2026-09-05');
});

test('Inefficiency Diagnostic: Tab-Spamming Roulette (生成ガチャ型)', () => {
  const spammerProfile: UserUsageProfile = {
    login: 'test-spammer',
    display_name: 'ガチャ型テスト',
    avatar_url: '',
    department: 'テスト部',
    cost_center: 'CC-1',
    organization: 'org-test',
    plan_type: 'enterprise',
    total_chats: 20,
    total_suggestions: 3000,
    total_acceptances: 180, // 受諾率 6%
    acceptance_rate: 0.06,
    total_cost_usd: 39,
    model_usage_totals: {},
    daily_history: [
      {
        date: '2026-09-10',
        total_chats: 2,
        model_breakdown: { 'gpt-4o': 2 },
        suggestions: 120,
        acceptances: 7, // 受諾率 5.8%
        lines_suggested: 800,
        lines_accepted: 40,
        acceptance_rate: 0.058,
        daily_cost_usd: 1.3,
      },
    ],
  };

  const result = InefficiencyDiagnosticEngine.diagnoseUser(spammerProfile, 'today');
  const tabSpamPattern = result.patterns.find((p) => p.id === 'tab_spamming_roulette');
  assert.ok(tabSpamPattern);
  assert.ok(tabSpamPattern.probabilityPercent >= 70, `Expected prob >= 70, got ${tabSpamPattern.probabilityPercent}`);
  assert.strictEqual(tabSpamPattern.riskLevel, 'high');
  assert.ok(tabSpamPattern.recommendations.length > 0);
});

test('Inefficiency Diagnostic: Overkill Model Addiction (超重量級モデル過剰依存型)', () => {
  const o1AddictProfile: UserUsageProfile = {
    login: 'test-o1-addict',
    display_name: 'o1依存テスト',
    avatar_url: '',
    department: 'テスト部',
    cost_center: 'CC-1',
    organization: 'org-test',
    plan_type: 'enterprise',
    total_chats: 100,
    total_suggestions: 500,
    total_acceptances: 180,
    acceptance_rate: 0.36,
    total_cost_usd: 39,
    model_usage_totals: {},
    daily_history: Array.from({ length: 10 }).map((_, idx) => ({
      date: `2026-09-0${idx + 1}`,
      total_chats: 15,
      model_breakdown: {
        'o1': 12, // 80% o1
        'claude-3-7-sonnet': 3,
        'gemini-2-0-flash': 0,
      },
      suggestions: 50,
      acceptances: 18,
      lines_suggested: 350,
      lines_accepted: 120,
      acceptance_rate: 0.36,
      daily_cost_usd: 1.3,
    })),
  };

  const result = InefficiencyDiagnosticEngine.diagnoseUser(o1AddictProfile, '30d');
  const overkillPattern = result.patterns.find((p) => p.id === 'overkill_model_addiction');
  assert.ok(overkillPattern);
  assert.ok(overkillPattern.probabilityPercent >= 70, `Expected prob >= 70, got ${overkillPattern.probabilityPercent}`);
  assert.strictEqual(overkillPattern.riskLevel, 'high');
});

test('Inefficiency Diagnostic: Healthy User has High Health Score & Low Risk', () => {
  const healthyProfile: UserUsageProfile = {
    login: 'test-healthy',
    display_name: '健全テスト',
    avatar_url: '',
    department: 'テスト部',
    cost_center: 'CC-1',
    organization: 'org-test',
    plan_type: 'enterprise',
    total_chats: 80,
    total_suggestions: 800,
    total_acceptances: 300, // 37.5%
    acceptance_rate: 0.375,
    total_cost_usd: 39,
    model_usage_totals: {},
    daily_history: Array.from({ length: 14 }).map((_, idx) => {
      const day = idx + 1;
      const dateStr = `2026-09-${day < 10 ? '0' + day : day}`;
      return {
        date: dateStr,
        total_chats: 8,
        model_breakdown: {
          'gemini-2-0-flash': 3,
          'gpt-4o': 3,
          'claude-3-7-sonnet': 2,
        },
        suggestions: 60,
        acceptances: 22,
        lines_suggested: 400,
        lines_accepted: 150,
        acceptance_rate: 0.366,
        daily_cost_usd: 1.3,
      };
    }),
  };

  const result = InefficiencyDiagnosticEngine.diagnoseUser(healthyProfile, '30d');
  assert.ok(result.healthScore >= 80, `Expected healthScore >= 80, got ${result.healthScore}`);
  assert.strictEqual(result.healthStatus, 'healthy');

  for (const pattern of result.patterns) {
    assert.ok(pattern.probabilityPercent < 40, `Pattern ${pattern.id} prob should be < 40, got ${pattern.probabilityPercent}`);
  }
});

test('Inefficiency Diagnostic: Graceful handling of empty history', () => {
  const emptyProfile: UserUsageProfile = {
    login: 'test-empty',
    display_name: '空履歴テスト',
    avatar_url: '',
    department: 'テスト部',
    cost_center: 'CC-1',
    organization: 'org-test',
    plan_type: 'business',
    total_chats: 0,
    total_suggestions: 0,
    total_acceptances: 0,
    acceptance_rate: 0,
    total_cost_usd: 19,
    model_usage_totals: {},
    daily_history: [],
  };

  const result = InefficiencyDiagnosticEngine.diagnoseUser(emptyProfile, '30d');
  assert.ok(result);
  assert.strictEqual(result.metricsSummary.totalChats, 0);
  assert.strictEqual(result.drilldown.dailyActivity.length, 0);
});
