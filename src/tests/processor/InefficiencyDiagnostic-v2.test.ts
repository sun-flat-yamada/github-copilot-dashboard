import test from 'node:test';
import assert from 'node:assert';
import {
  InefficiencyDiagnosticEngine,
  diagnoseCreditBurnOverdrive,
  diagnoseAgentAbandonment,
  diagnoseModelCostMismatch,
  diagnoseReviewBypass,
} from '../../processor/inefficiency-diagnostic.js';
import { UserUsageProfile } from '../../types/copilot.js';

test('Inefficiency Diagnostic V2: Credit Burn Overdrive (クレジット過剰消費型)', () => {
  // 高リスクケース: 割当3900に対し6000消費、成果わずか
  const highRisk = diagnoseCreditBurnOverdrive(6000, 3900, 2, 1);
  assert.strictEqual(highRisk.id, 'credit_burn_overdrive');
  assert.ok(highRisk.probabilityPercent >= 70, `Expected prob >= 70, got ${highRisk.probabilityPercent}`);
  assert.strictEqual(highRisk.riskLevel, 'high');
  assert.ok(highRisk.recommendations.length > 0);
  assert.ok(highRisk.contributingFactors.some((f) => f.metricName.includes('AIクレジット消費ペース')));

  // 健全ケース: 割当3900に対し1500消費、成果多数
  const healthy = diagnoseCreditBurnOverdrive(1500, 3900, 50, 20);
  assert.ok(healthy.probabilityPercent < 25, `Expected prob < 25, got ${healthy.probabilityPercent}`);
  assert.strictEqual(healthy.riskLevel, 'healthy');
});

test('Inefficiency Diagnostic V2: Agent Session Abandonment (Agent セッション途中放棄型)', () => {
  // 高リスクケース: 12セッション中9セッション放棄
  const highRisk = diagnoseAgentAbandonment(12, 6, 3);
  assert.strictEqual(highRisk.id, 'agent_abandonment');
  assert.ok(highRisk.probabilityPercent >= 70, `Expected prob >= 70, got ${highRisk.probabilityPercent}`);
  assert.strictEqual(highRisk.riskLevel, 'high');
  assert.ok(highRisk.recommendations.length > 0);

  // 健全ケース: 15セッション中13セッション完了
  const healthy = diagnoseAgentAbandonment(15, 1, 13);
  assert.ok(healthy.probabilityPercent <= 15, `Expected prob <= 15, got ${healthy.probabilityPercent}`);
  assert.strictEqual(healthy.riskLevel, 'healthy');
});

test('Inefficiency Diagnostic V2: Model Cost Mismatch (モデルコスト不整合型)', () => {
  // 高リスクケース: o1/Sonnet率が85%だが受諾率がわずか12%
  const highRisk = diagnoseModelCostMismatch(85, 100, 0.12);
  assert.strictEqual(highRisk.id, 'model_cost_mismatch');
  assert.ok(highRisk.probabilityPercent >= 70, `Expected prob >= 70, got ${highRisk.probabilityPercent}`);
  assert.strictEqual(highRisk.riskLevel, 'high');
  assert.ok(highRisk.recommendations.length > 0);

  // 健全ケース: 高コストモデル率25%で受諾率38%
  const healthy = diagnoseModelCostMismatch(25, 100, 0.38);
  assert.ok(healthy.probabilityPercent <= 15, `Expected prob <= 15, got ${healthy.probabilityPercent}`);
  assert.strictEqual(healthy.riskLevel, 'healthy');
});

test('Inefficiency Diagnostic V2: Review Bypass (レビュー迂回・ノーチェックマージ型)', () => {
  // 高リスクケース: Agent作成PR 8件中7件が未レビュー、マージ時間中央値5分
  const highRisk = diagnoseReviewBypass(8, 7, 5);
  assert.strictEqual(highRisk.id, 'review_bypass');
  assert.ok(highRisk.probabilityPercent >= 70, `Expected prob >= 70, got ${highRisk.probabilityPercent}`);
  assert.strictEqual(highRisk.riskLevel, 'high');
  assert.ok(highRisk.recommendations.length > 0);

  // 健全ケース: Agent作成PR 10件中全件レビュー済み、マージ時間中央値50分
  const healthy = diagnoseReviewBypass(10, 0, 50);
  assert.ok(healthy.probabilityPercent <= 10, `Expected prob <= 10, got ${healthy.probabilityPercent}`);
  assert.strictEqual(healthy.riskLevel, 'healthy');
});

test('Inefficiency Diagnostic V2: diagnoseUser evaluates all 9 patterns', () => {
  const profile: UserUsageProfile = {
    login: 'test-v2-eval',
    display_name: 'V2評価テスト',
    avatar_url: '',
    department: 'AI推進部',
    cost_center: 'CC-AI',
    organization: 'org-test',
    plan_type: 'enterprise',
    total_chats: 40,
    total_suggestions: 400,
    total_acceptances: 140,
    acceptance_rate: 0.35,
    total_cost_usd: 39,
    model_usage_totals: { 'claude-3-7-sonnet': 20, 'gpt-4o': 20 },
    daily_history: [
      {
        date: '2026-09-10',
        total_chats: 10,
        model_breakdown: { 'claude-3-7-sonnet': 5, 'gpt-4o': 5 },
        suggestions: 80,
        acceptances: 28,
        lines_suggested: 500,
        lines_accepted: 180,
        acceptance_rate: 0.35,
        daily_cost_usd: 1.3,
        ai_credits_consumed: 45,
      },
    ],
    ai_credits_used_28d: 120,
    total_agent_sessions: 8,
    completed_agent_sessions: 7,
    ai_credits_limit_monthly: 3900,
    agent_prs_created: 2,
    agent_prs_unreviewed: 0,
    agent_pr_median_merge_mins: 45,
  };

  const result = InefficiencyDiagnosticEngine.diagnoseUser(profile, 'today');
  assert.strictEqual(result.patterns.length, 9);

  const patternIds = result.patterns.map((p) => p.id);
  assert.ok(patternIds.includes('tab_spamming_roulette'));
  assert.ok(patternIds.includes('overkill_model_addiction'));
  assert.ok(patternIds.includes('context_blind_chat_churn'));
  assert.ok(patternIds.includes('passive_seat_disengaged'));
  assert.ok(patternIds.includes('off_hours_workload_spike'));
  assert.ok(patternIds.includes('credit_burn_overdrive'));
  assert.ok(patternIds.includes('agent_abandonment'));
  assert.ok(patternIds.includes('model_cost_mismatch'));
  assert.ok(patternIds.includes('review_bypass'));

  // 健全な利用プロファイルなので healthScore は良好
  assert.ok(result.healthScore >= 80, `Expected healthScore >= 80, got ${result.healthScore}`);
  assert.strictEqual(result.healthStatus, 'healthy');
});
