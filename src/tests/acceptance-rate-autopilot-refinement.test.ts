import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InefficiencyDiagnosticEngine } from '../processor/inefficiency-diagnostic.js';
import { diagnoseTabSpamming, diagnoseModelCostMismatch } from '../processor/inefficiency-rules.js';
import { UserUsageProfile } from '../types/copilot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

test('Acceptance Rate & Autopilot/CLI Refinement: Agent/CLI-driven user suppresses tab_spamming false positive', () => {
  // Copilot CLI で Autopilot (allow-all) を多用し、手動補完受諾率は 8% と低いが生産的な自律エージェントユーザー
  const autopilotUserProfile: UserUsageProfile = {
    login: 'agent-power-user',
    display_name: 'Autopilot活用エンジニア',
    avatar_url: '',
    department: 'プラットフォーム基盤部',
    cost_center: 'CC-AI-DEV',
    organization: 'org-enterprise',
    plan_type: 'enterprise',
    total_chats: 45,
    total_suggestions: 2400,
    total_acceptances: 192, // 受諾率 8.0% (見かけ上極端に低い)
    acceptance_rate: 0.08,
    total_cost_usd: 39,
    model_usage_totals: {
      'claude-3-7-sonnet': 30,
      'gpt-4o': 15,
    },
    total_agent_sessions: 14, // 活発なAgent/CLIセッション
    completed_agent_sessions: 12,
    daily_history: [
      {
        date: '2026-09-10',
        total_chats: 15,
        model_breakdown: { 'claude-3-7-sonnet': 10, 'gpt-4o': 5 },
        suggestions: 800,
        acceptances: 64, // 8.0%
        lines_suggested: 4500,
        lines_accepted: 360,
        acceptance_rate: 0.08,
        daily_cost_usd: 1.3,
      },
    ],
  };

  const diagnosis = InefficiencyDiagnosticEngine.diagnoseUser(autopilotUserProfile, 'today');
  const tabSpamPattern = diagnosis.patterns.find((p) => p.id === 'tab_spamming_roulette');

  assert.ok(tabSpamPattern, 'tab_spamming_roulette pattern should be evaluated');
  // 自律エージェント駆動型のため、受諾率が8%であってもHighにならずHealthy(<=20%)に抑制されること
  assert.ok(
    tabSpamPattern.probabilityPercent <= 20,
    `Expected probability <= 20% for agent user, but got ${tabSpamPattern.probabilityPercent}%`
  );
  assert.strictEqual(tabSpamPattern.riskLevel, 'healthy');
  assert.match(
    tabSpamPattern.summary,
    /CLIやAutopilot等の自律エージェント活用/,
    'Summary should explain that low completion rate is due to agent-driven workflow'
  );

  const acceptanceFactor = tabSpamPattern.contributingFactors.find(
    (f) => f.metricName === 'コード受諾率'
  );
  assert.ok(acceptanceFactor);
  assert.strictEqual(acceptanceFactor.severity, 'good');
  assert.match(acceptanceFactor.description, /受諾率パラドックス/);
});

test('Acceptance Rate & Autopilot/CLI Refinement: Direct diagnoseTabSpamming evaluates agentSessions and totalChats', () => {
  // 提案件数120、受諾数7（受諾率5.8%）の低受諾率ケース
  // 1. Agentセッションなし (agentSessions: 0, totalChats: 0) -> 高リスク (prob >= 70)
  const nonAgentResult = diagnoseTabSpamming(120, 7, 0.058, 1, 0, 0);
  assert.ok(nonAgentResult.probabilityPercent >= 70, `Expected prob >= 70, got ${nonAgentResult.probabilityPercent}`);
  assert.strictEqual(nonAgentResult.riskLevel, 'high');

  // 2. Agentセッションあり (agentSessions: 5, totalChats: 20) -> 健全 (prob <= 10)
  const agentResult = diagnoseTabSpamming(120, 7, 0.058, 1, 5, 20);
  assert.ok(agentResult.probabilityPercent <= 10, `Expected prob <= 10, got ${agentResult.probabilityPercent}`);
  assert.strictEqual(agentResult.riskLevel, 'healthy');
});

test('Acceptance Rate & Autopilot/CLI Refinement: Non-agent manual spammer still flagged as high risk (No Regression)', () => {
  // エージェントもチャットも使わず、ただTab連打と生成ガチャを繰り返すユーザー
  const manualSpammerProfile: UserUsageProfile = {
    login: 'manual-tab-spammer',
    display_name: '従来型ガチャユーザー',
    avatar_url: '',
    department: 'レガシー開発部',
    cost_center: 'CC-LEGACY',
    organization: 'org-enterprise',
    plan_type: 'enterprise',
    total_chats: 2,
    total_suggestions: 3500,
    total_acceptances: 210, // 受諾率 6.0%
    acceptance_rate: 0.06,
    total_cost_usd: 39,
    model_usage_totals: {},
    total_agent_sessions: 0, // エージェント利用なし
    daily_history: [
      {
        date: '2026-09-10',
        total_chats: 1,
        model_breakdown: { 'gpt-4o': 1 },
        suggestions: 120,
        acceptances: 7, // 5.8%
        lines_suggested: 900,
        lines_accepted: 45,
        acceptance_rate: 0.058,
        daily_cost_usd: 1.3,
      },
    ],
  };

  const diagnosis = InefficiencyDiagnosticEngine.diagnoseUser(manualSpammerProfile, 'today');
  const tabSpamPattern = diagnosis.patterns.find((p) => p.id === 'tab_spamming_roulette');

  assert.ok(tabSpamPattern);
  assert.ok(
    tabSpamPattern.probabilityPercent >= 70,
    `Manual spammer must be flagged high risk (prob >= 70%), got ${tabSpamPattern.probabilityPercent}%`
  );
  assert.strictEqual(tabSpamPattern.riskLevel, 'high');
});

test('Acceptance Rate & Autopilot/CLI Refinement: Model cost mismatch accommodates autonomous agent users', () => {
  // o1やSonnetなどの上位モデルを80%使用し、コード補完受諾率は12%だが、Agentセッションが10件あるケース
  const agentResult = diagnoseModelCostMismatch(16, 20, 0.12, 10);
  assert.ok(
    agentResult.probabilityPercent <= 30,
    `Agent user model mismatch probability should be moderated, got ${agentResult.probabilityPercent}%`
  );
  assert.notStrictEqual(agentResult.riskLevel, 'high');

  // 一方でAgent利用が0件の場合
  const nonAgentResult = diagnoseModelCostMismatch(16, 20, 0.12, 0);
  assert.ok(
    nonAgentResult.probabilityPercent >= 70,
    `Non-agent user model mismatch probability should remain high, got ${nonAgentResult.probabilityPercent}%`
  );
  assert.strictEqual(nonAgentResult.riskLevel, 'high');
});

test('Acceptance Rate & Autopilot/CLI Refinement: SDD specifications maintain Acceptance Rate Paradox and Reports API integrity', () => {
  const sdd03Path = path.join(REPO_ROOT, 'docs/specifications/03_github_copilot_api_spec_2026.ja.md');
  const sdd06Path = path.join(REPO_ROOT, 'docs/specifications/06_aggregation_and_billing_logic_spec.ja.md');
  const sdd11Path = path.join(REPO_ROOT, 'docs/specifications/11_deep_analysis_view_spec.ja.md');

  const sdd03 = fs.readFileSync(sdd03Path, 'utf8');
  const sdd06 = fs.readFileSync(sdd06Path, 'utf8');
  const sdd11 = fs.readFileSync(sdd11Path, 'utf8');

  // SDD-03 検証
  assert.match(sdd03, /Usage Metrics Reports API/, 'SDD-03 must document Reports API transition');
  assert.match(sdd03, /暗黙的拒否 \(Implicit Rejection\)/, 'SDD-03 must specify implicit rejection trigger');
  assert.match(sdd03, /計測サーフェス（Surface）の完全分離/, 'SDD-03 must specify surface separation');

  // SDD-06 検証
  assert.match(sdd06, /受諾率パラドックス \(Acceptance Rate Paradox\)/, 'SDD-06 must document acceptance rate paradox');
  assert.match(sdd06, /推奨分析設計（サーフェス別分離評価）/, 'SDD-06 must document recommended analysis architecture');

  // SDD-11 検証
  assert.match(sdd11, /CLI\/Autopilot誤診防止補正/, 'SDD-11 must document CLI/Autopilot diagnostic guard');
});
