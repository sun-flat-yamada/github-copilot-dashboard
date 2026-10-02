import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportParser } from '../processor/report-parser.js';
import { MockDataGenerator } from '../collector/mock-generator.js';
import { UsageInsightPanel } from '../../dashboard/src/components/UsageInsightPanel.js';
import { UsageSignalBadge } from '../../dashboard/src/components/common/UsageSignalBadge.js';
import { USAGE_INSIGHT_DISCLAIMER } from '../processor/usage-insight-definitions.js';

const parser = new ReportParser();
const data = parser.aggregate(
  parser.parseRecords(new MockDataGenerator().generateAiUsageReportCSV('2026-08')),
  '2026-08',
  'demo.csv'
);
const insightOf = (login: string) => data.user_details.find((u) => u.login === login)!.usage_insight!;

describe('usage insight UI', () => {
  it('兆候バッジは色だけでなくラベルを持ち、文言は断定せず「確認を推奨」とする', () => {
    assert.match(renderToStaticMarkup(React.createElement(UsageSignalBadge, { level: 'review' })), /確認を推奨/);
    assert.match(renderToStaticMarkup(React.createElement(UsageSignalBadge, { level: 'watch' })), /参考/);
    assert.match(renderToStaticMarkup(React.createElement(UsageSignalBadge, { level: 'insufficient' })), /データ不足/);
  });

  it('パネルは根拠・助言・常設注記を出し、「不当」などの断定語を使わない', () => {
    const html = renderToStaticMarkup(React.createElement(UsageInsightPanel, { insight: insightOf('demo-long-context') }));
    assert.match(html, /使用量と効率/);
    assert.match(html, /文脈の持ち越し/);
    assert.match(html, /新しいセッションを始めると/);
    assert.ok(html.includes(USAGE_INSIGHT_DISCLAIMER));
    assert.doesNotMatch(html, /不当|違反|問題ユーザー/);
  });

  it('トークンの無いデータでは値を「—」にし、兆候は判定しない旨を出す', () => {
    const noTokens = parser.aggregate(parser.parseRecords('date,username,model,quantity\n2026-08-03,u1,m,4'), '2026-08', 'x.csv');
    const html = renderToStaticMarkup(React.createElement(UsageInsightPanel, { insight: noTokens.user_details[0].usage_insight! }));
    assert.match(html, /トークン列のない CSV のため/);
    assert.match(html, /データ不足/);
  });

  it('利用の少ないユーザーは「データ不足」と表示する', () => {
    const html = renderToStaticMarkup(React.createElement(UsageInsightPanel, { insight: insightOf('demo-light') }));
    assert.match(html, /判定に必要なデータが足りません/);
  });
});
