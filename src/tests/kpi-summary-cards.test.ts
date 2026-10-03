import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KpiSummaryCards } from '../../dashboard/src/components/KpiSummaryCards.js';
import type { ScopeAggregatedData } from '../types/copilot.js';

const NOW = new Date('2026-09-16T00:00:00Z');

function makeScope(over: Partial<ScopeAggregatedData['overview']> = {}, trendDays = 15, scopeType: ScopeAggregatedData['scope_type'] = 'monthly', key = '2026-09'): ScopeAggregatedData {
  return {
    scope_type: scopeType,
    scope_key: key,
    date_range: { start: '2026-09-01', end: '2026-09-15', days_count: trendDays },
    overview: {
      total_seats: 10,
      active_users: 8,
      idle_seats: 2,
      total_spend_usd: 390,
      total_net_billable_usd: 50,
      total_spending_limit_usd: 200,
      idle_waste_usd: 78,
      active_ratio: 0.8,
      overall_acceptance_rate: 0.3,
      total_suggestions: 100,
      total_acceptances: 30,
      total_chats: 10,
      total_pr_summaries: 1,
      total_cli_commands: 0,
      ...over,
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    users: [],
    daily_trends: Array.from({ length: trendDays }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      active_users: 8,
      suggestions: 10,
      acceptances: 3,
      acceptance_rate: 0.3,
      chats: 1,
      daily_cost_usd: 13,
      ai_credits_used: 100,
    })),
    top_languages: [],
  };
}

const render = (props: Partial<React.ComponentProps<typeof KpiSummaryCards>> & { data: ScopeAggregatedData }) =>
  renderToStaticMarkup(React.createElement(KpiSummaryCards, { now: NOW, ...props }));

describe('KpiSummaryCards (P3-2 再設計)', () => {
  it('判断順に並べ、受諾率は「参考」に格下げされる', () => {
    const html = render({ data: makeScope() });
    const order = ['total_spend', 'active_rate', 'idle_waste', 'budget_utilization', 'acceptance_rate'].map((id) => html.indexOf(`data-testid="metric-label-${id}"`));
    assert.ok(order.every((i) => i >= 0), `全 KPI が MetricLabel で描画される: ${order}`);
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(html, /data-testid="acceptance-reference-chip"/);
  });

  it('前月比: 前期があれば差分と変化率、無ければ「—（前月のデータがありません）」', () => {
    const prev = makeScope({ total_spend_usd: 300, active_ratio: 0.9, idle_waste_usd: 39 }, 30, 'monthly', '2026-08');
    const withPrev = render({ data: makeScope(), previousData: prev });
    assert.match(withPrev, /data-testid="delta-total_spend"[^>]*data-direction="up"/);
    assert.match(withPrev, /前月比/);
    assert.match(withPrev, /\+\$90\.00 \(\+30\.0%\)/);
    assert.match(withPrev, /data-testid="delta-active_rate"[^>]*data-direction="down"/);

    const noPrev = render({ data: makeScope() });
    assert.match(noPrev, /data-testid="delta-total_spend"[^>]*data-state="unavailable"/);
    assert.match(noPrev, /前月のデータがありません/);
  });

  it('期間 (custom) スコープは前期比を出さず理由を示す', () => {
    const html = render({ data: makeScope({}, 15, 'custom', 'custom:2026-09-01_2026-09-15') });
    assert.match(html, /期間スコープは比較対象を定義しません/);
    assert.doesNotMatch(html, /data-state="compared"/);
  });

  it('月末予測: 推定バッジ・算出式・窓・信頼度・レンジを表示する', () => {
    const html = render({ data: makeScope() });
    assert.match(html, /data-testid="forecast-spend_forecast"[^>]*data-state="forecast"/);
    assert.match(html, /data-testid="metric-badge-estimated"/);
    assert.match(html, /算出式: 当月実績累計 \+ 直近 7 観測日の平均 × 残 15 日/);
    assert.match(html, /信頼度/);
    assert.match(html, /予測レンジ/);
    assert.match(html, /\$390\.00/); // 13 * 30
    assert.match(html, /3,000 credits/); // 100 * 30
    assert.match(html, /data-testid="metric-window-spend_forecast"/);
  });

  it('月初 (観測不足) は予測を出さず「—（理由）」', () => {
    const html = render({ data: makeScope({}, 3), now: new Date('2026-09-04T00:00:00Z') });
    assert.match(html, /data-testid="forecast-spend_forecast"[^>]*data-state="unavailable"/);
    assert.match(html, /7 日未満/);
    assert.doesNotMatch(html, /data-testid="forecast-basis-spend_forecast"/);
  });

  it('日次スコープは月末予測を出さない', () => {
    const html = render({ data: makeScope({}, 15, 'daily', '2026-09-15') });
    assert.match(html, /月次スコープでのみ月末予測を算出します/);
  });

  it('締め済み月は予測ではなく実績を示す', () => {
    const html = render({ data: makeScope({}, 30, 'monthly', '2026-09'), now: new Date('2026-10-05T00:00:00Z') });
    assert.match(html, /data-testid="forecast-spend_forecast"[^>]*data-state="closed"/);
    assert.match(html, /締め済みの月のため予測せず/);
  });

  it('AI Credits の日次値が無ければ予測せず理由を示す', () => {
    const data = makeScope();
    data.daily_trends = data.daily_trends.map(({ ai_credits_used: _unused, ...rest }) => rest);
    const html = render({ data });
    assert.match(html, /data-testid="forecast-credits_forecast"[^>]*data-state="unavailable"/);
    assert.match(html, /AI Credits の日次値を取得できていません/);
  });

  it('予算消化率: 上限があれば割合、未設定なら欠損 (0 にしない)', () => {
    const ok = render({ data: makeScope() });
    assert.match(ok, /data-testid="metric-budget_utilization"[^>]*data-quality="measured"/);
    assert.match(ok, /25\.0%/);
    const none = render({ data: makeScope({ total_spending_limit_usd: undefined }) });
    assert.match(none, /data-testid="metric-budget_utilization"[^>]*data-quality="missing"/);
    assert.match(none, /支出上限が未設定です/);
  });

  it('デモ由来は予測にもデモバッジを付ける', () => {
    const html = render({ data: makeScope(), isDemo: true });
    assert.match(html, /data-testid="forecast-spend_forecast"/);
    assert.match(html, /data-quality="demo"/);
  });
});
