import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UserDetailTable, USER_DETAIL_COLUMN_COUNT } from '../../dashboard/src/components/UserDetailTable.js';
import { ReportParser } from '../processor/report-parser.js';
import { MockDataGenerator } from '../collector/mock-generator.js';
import type { EnrichedUserSeat, ScopeAggregatedData, UserUsageProfile } from '../domain/entities/copilot.js';

const seat = (login: string): EnrichedUserSeat => ({
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
});

const profile = (login: string): UserUsageProfile => ({
  login,
  display_name: login,
  avatar_url: '',
  department: 'Dept',
  cost_center: 'CC',
  organization: 'Org',
  plan_type: 'business',
  total_chats: 60,
  total_suggestions: 200,
  total_acceptances: 70,
  acceptance_rate: 0.35,
  total_cost_usd: 5,
  model_usage_totals: { 'gpt-5': 60 },
  daily_history: Array.from({ length: 6 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    total_chats: 10,
    model_breakdown: { 'gpt-5': 10 },
    suggestions: 0,
    acceptances: 0,
    lines_suggested: 0,
    lines_accepted: 0,
    acceptance_rate: 0,
    daily_cost_usd: 1,
    ai_credits_consumed: 50,
  })),
});

const live = {
  scope_type: 'monthly',
  scope_key: '2026-09',
  date_range: { start: '2026-09-01', end: '2026-09-30', days_count: 30 },
  users: [seat('alice'), seat('bob')],
} as unknown as ScopeAggregatedData;

const parser = new ReportParser();
const report = parser.aggregate(
  parser.parseRecords(new MockDataGenerator().generateAiUsageReportCSV('2026-08')),
  '2026-08',
  'demo.csv'
);

const strip = (h: string) => h.replace(/<[^>]*>/g, '').trim();
const headers = (html: string): string[] =>
  [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1]).replace(/^利用費用.*$/, '利用費用'));
const firstRowCells = (html: string): number => {
  const body = html.slice(html.indexOf('<tbody'));
  const row = body.slice(body.indexOf('<tr'), body.indexOf('</tr>'));
  return (row.match(/<td/g) ?? []).length;
};

describe('UserDetailTable: 表示経路・View によらず同じ形式', () => {
  const liveHtml = renderToStaticMarkup(
    React.createElement(UserDetailTable, { data: live, userProfiles: [profile('alice'), profile('bob')] })
  );
  const reportHtml = renderToStaticMarkup(React.createElement(UserDetailTable, { reportData: report }));

  it('ライブと月次で、列の見出しがまったく同じ (順序も同じ)', () => {
    assert.deepEqual(headers(liveHtml), headers(reportHtml));
    assert.equal(headers(liveHtml).filter((h) => h !== '').length >= USER_DETAIL_COLUMN_COUNT - 1, true);
  });

  it('どの行も列数が見出しと一致する', () => {
    assert.equal(firstRowCells(liveHtml), USER_DETAIL_COLUMN_COUNT);
    assert.equal(firstRowCells(reportHtml), USER_DETAIL_COLUMN_COUNT);
  });

  it('使用量の列 (トークン / コスト/100万トークン / 兆候) が両方に出る', () => {
    for (const html of [liveHtml, reportHtml]) {
      for (const h of ['トークン', 'コスト/100万トークン', '兆候', '総リクエスト', '利用費用', '超過請求 (USD)']) {
        assert.ok(html.includes(`<span>${h}`), `${h} の列が無い`);
      }
    }
  });

  it('そのソースに無い値は 0 ではなく「—」で、理由がツールチップに入る', () => {
    assert.match(reportHtml, /title="シート情報は月次レポートに含まれません"[^>]*>—</);
    assert.match(liveHtml, /title="このデータソースには含まれない項目です"[^>]*>—</);
    // ライブ: トークンは Reports API に無いが、兆候はプロファイルの日別履歴から出る
    assert.match(liveHtml, /title="トークン列のないデータです[^"]*"[^>]*>—</);
  });

  it('月次: 兆候バッジに「確認を推奨」が出て、断定語は使わない', () => {
    assert.match(reportHtml, /確認を推奨/);
    assert.doesNotMatch(reportHtml + liveHtml, /不当|違反/);
  });

  it('グループ絞り込みの軸は grouping に従う (View によって軸は変わるが列は変わらない)', () => {
    const byCc = renderToStaticMarkup(React.createElement(UserDetailTable, { reportData: report, grouping: 'cost_center' }));
    assert.match(byCc, /すべてのCost Center/);
    assert.deepEqual(headers(byCc), headers(reportHtml));
  });

  it('シート情報が無いデータでは、ステータス絞り込みを出さない', () => {
    assert.doesNotMatch(reportHtml, /全ステータス/);
    assert.match(liveHtml, /全ステータス/);
  });
});
