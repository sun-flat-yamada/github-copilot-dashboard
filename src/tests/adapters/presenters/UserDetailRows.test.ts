import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildLiveRows, buildReportRows } from '../../../adapters/presenters/UserDetailRows.js';
import { accumulatorFromDailyHistory, computeOrgBaseline, computeUsageInsight } from '../../../processor/usage-insight.js';
import { ReportParser } from '../../../processor/report-parser.js';
import { MockDataGenerator } from '../../../collector/mock-generator.js';
import type {
  EnrichedUserSeat,
  ScopeAggregatedData,
  UserModelDailyUsage,
  UserUsageProfile,
} from '../../../domain/entities/copilot.js';

const seat = (login: string, over: Partial<EnrichedUserSeat> = {}): EnrichedUserSeat => ({
  login,
  display_name: login,
  avatar_url: '',
  department: 'Dept',
  cost_center: 'CC',
  organization: 'Org',
  plan_type: 'business',
  monthly_cost_usd: 19,
  prorated_daily_cost_usd: 0.63,
  created_at: '2026-01-01',
  last_activity_at: '2026-09-01',
  last_activity_editor: 'vscode',
  days_inactive: 3,
  status: 'active',
  ...over,
});

const day = (d: number, over: Partial<UserModelDailyUsage> = {}): UserModelDailyUsage => ({
  date: `2026-09-${String(d).padStart(2, '0')}`,
  total_chats: 10,
  model_breakdown: { 'gpt-5': 6, 'claude-sonnet-4': 4 },
  suggestions: 0,
  acceptances: 0,
  lines_suggested: 0,
  lines_accepted: 0,
  acceptance_rate: 0,
  daily_cost_usd: 1,
  ai_credits_consumed: 100,
  ...over,
});

const profile = (login: string, days: number, over: Partial<UserUsageProfile> = {}): UserUsageProfile => ({
  login,
  display_name: login,
  avatar_url: '',
  department: 'Dept',
  cost_center: 'CC',
  organization: 'Org',
  plan_type: 'business',
  total_chats: days * 10,
  total_suggestions: 200,
  total_acceptances: 70,
  acceptance_rate: 0.35,
  total_cost_usd: 5,
  model_usage_totals: { 'gpt-5': 6 * days, 'claude-sonnet-4': 4 * days },
  daily_history: Array.from({ length: days }, (_, i) => day(i + 1)),
  ...over,
});

const scope = (users: EnrichedUserSeat[]): ScopeAggregatedData =>
  ({
    scope_type: 'monthly',
    scope_key: '2026-09',
    date_range: { start: '2026-09-01', end: '2026-09-30', days_count: 30 },
    users,
  }) as unknown as ScopeAggregatedData;

describe('UserDetailRows: ライブと月次を同じ形式にそろえる', () => {
  const parser = new ReportParser();
  const report = parser.aggregate(
    parser.parseRecords(new MockDataGenerator().generateAiUsageReportCSV('2026-08')),
    '2026-08',
    'demo.csv'
  );

  it('ライブの行と月次の行は、まったく同じキー集合を持つ', () => {
    const live = buildLiveRows(scope([seat('a')]), [profile('a', 6)]).rows[0];
    const rep = buildReportRows(report).rows[0];
    assert.deepEqual(Object.keys(live).sort(), Object.keys(rep).sort());
  });

  it('月次: requests は数値、シート・Reports API 由来の項目は 0 ではなく null', () => {
    const r = buildReportRows(report).rows[0];
    assert.equal(r.source, 'report');
    for (const k of ['plan', 'status', 'days_inactive', 'suggestions', 'acceptances', 'acceptance_rate', 'chats'] as const) {
      assert.equal(r[k], null, `${k} は欠損 (null)`);
    }
    assert.equal(typeof r.usage_cost_usd, 'number');
  });

  it('月次: requests 系の明細が無い (AI usage report のみ) ときは 0 ではなく null', () => {
    const r = buildReportRows(report).rows[0];
    assert.equal(r.requests, null);
    const legacy = parser.aggregate(parser.parseRecords('date,username,model,quantity\n2026-08-03,u1,m,4'), '2026-08', 'x.csv');
    assert.equal(buildReportRows(legacy).rows[0].requests, 4);
  });

  it('月次: 兆候は集計時に算出済みのものをそのまま使う', () => {
    const rows = buildReportRows(report).rows;
    const lc = rows.find((r) => r.login === 'demo-long-context')!;
    assert.equal(lc.usage_insight?.signals[0].level, 'review');
  });

  it('ライブ: プロファイルが無いユーザーは実績を 0 ではなく null にする', () => {
    const r = buildLiveRows(scope([seat('nobody')]), [profile('someone', 6)]).rows[0];
    assert.equal(r.suggestions, null);
    assert.equal(r.chats, null);
    assert.equal(r.primary_model, null);
    assert.equal(r.usage_insight, null);
    assert.equal(r.requests, null);
  });

  it('ライブ: プロファイルの実績・主利用モデル・兆候(日別履歴から)を出す', () => {
    const r = buildLiveRows(scope([seat('a')]), [profile('a', 6)]).rows[0];
    assert.equal(r.suggestions, 200);
    assert.equal(r.acceptance_rate, 0.35);
    assert.equal(r.primary_model, 'gpt-5');
    assert.equal(r.usage_insight?.usage.active_days, 6);
    assert.equal(r.usage_insight?.usage.credits, 600);
    assert.equal(r.usage_insight?.tokens, null, 'Reports API 由来にトークンは無い');
  });

  it('ライブ: プラン未確定のシートは費用を算定せず null (0 と区別)', () => {
    const r = buildLiveRows(scope([seat('a', { cost_unconfirmed: true })])).rows[0];
    assert.equal(r.usage_cost_usd, null);
    assert.equal(r.excess_usd, null);
  });

  it('ライブ: 費用の単位はスコープ種別に従う', () => {
    const set = buildLiveRows(scope([seat('a')]));
    assert.equal(set.costUnitLabel, '月額');
    assert.equal(set.rows[0].usage_cost_usd, 19);
    const daily = buildLiveRows({ ...scope([seat('a')]), scope_type: 'daily' } as ScopeAggregatedData);
    assert.equal(daily.costUnitLabel, '日割り');
    assert.equal(daily.rows[0].usage_cost_usd, 0.63);
  });

  it('ライブ: 兆候の組織基準は全プロファイルから作る (表示対象のユーザー数に依存しない)', () => {
    const profiles = [profile('a', 8), profile('b', 8), profile('c', 8)];
    const all = buildLiveRows(scope([seat('a'), seat('b'), seat('c')]), profiles).rows;
    const one = buildLiveRows(scope([seat('a')]), profiles).rows;
    assert.deepEqual(one[0].usage_insight?.signals, all[0].usage_insight?.signals);
  });
});

describe('accumulatorFromDailyHistory', () => {
  it('日別の値をモデル比で按分しても、リクエスト・クレジット・費用・トークンの合計は保たれる', () => {
    const history = [day(1, { token_count: 1000 }), day(2, { token_count: 3000 }), day(3, { token_count: 500 })];
    const a = accumulatorFromDailyHistory(history);
    const i = computeUsageInsight(a, computeOrgBaseline([a]));
    assert.equal(i.usage.requests, 30);
    assert.equal(i.usage.credits, 300);
    assert.equal(i.tokens?.total, 4500);
    assert.equal(i.by_model.length, 2);
    assert.equal(Math.round(i.by_model.reduce((s, m) => s + m.gross_usd, 0)), 3);
    assert.equal(i.daily.length, 3);
  });

  it('モデル別が無い日もリクエスト数 (total_chats) を失わない', () => {
    const a = accumulatorFromDailyHistory([day(1, { model_breakdown: {}, total_chats: 7 })]);
    assert.equal(computeUsageInsight(a, computeOrgBaseline([a])).usage.requests, 7);
  });
});
