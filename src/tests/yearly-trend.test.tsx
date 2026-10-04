import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildYearlyTrend,
  monthCloseDate,
  shiftMonth,
  yearlyTrendMonthsNeeded,
  YEARLY_TREND_CLOSE_RULE,
} from '../processor/yearly-trend.js';
import type { RollingTrendDataset, RollingTrendEntry } from '../types/copilot.js';
import { YearlyTrendPanel, formatYoy, toChartRows } from '../../dashboard/src/components/YearlyTrendPanel.js';
import { METRIC_REGISTRY } from '../domain/metrics/metric-registry.js';

function entry(month: string, over: Partial<RollingTrendEntry> = {}): RollingTrendEntry {
  return {
    month,
    total_spend_usd: 1000,
    total_seats: 50,
    active_seats: 40,
    idle_seats: 10,
    acceptance_rate: 0.3,
    total_chats: 200,
    total_ai_credits_used: 500,
    ...over,
  };
}

describe('month close rule (5th business day of the next month)', () => {
  it('skips weekends: 2026-09 closes on 2026-10-07 (Oct 1 is Thursday)', () => {
    // Oct 2026: Thu 1, Fri 2, Mon 5, Tue 6, Wed 7
    assert.equal(monthCloseDate('2026-09'), '2026-10-07');
  });
  it('rolls over the year: 2026-12 closes in January 2027', () => {
    // Jan 2027: Fri 1, Mon 4, Tue 5, Wed 6, Thu 7
    assert.equal(monthCloseDate('2026-12'), '2027-01-07');
  });
  it('shiftMonth crosses year boundaries both ways', () => {
    assert.equal(shiftMonth('2026-01', -1), '2025-12');
    assert.equal(shiftMonth('2026-12', 1), '2027-01');
    assert.equal(shiftMonth('2026-03', -12), '2025-03');
  });
});

describe('buildYearlyTrend', () => {
  it('returns 12 consecutive calendar months ending at endMonth, oldest first', () => {
    const points = buildYearlyTrend({ endMonth: '2026-09', entries: new Map(), closedMonths: new Map() });
    assert.equal(points.length, 12);
    assert.equal(points[0].month, '2025-10');
    assert.equal(points[11].month, '2026-09');
    assert.deepEqual(yearlyTrendMonthsNeeded('2026-09').length, 24);
  });

  it('missing months are "missing" with null values, never 0', () => {
    const entries = new Map([['2026-09', entry('2026-09')], ['2026-07', entry('2026-07')]]);
    const points = buildYearlyTrend({ endMonth: '2026-09', entries, closedMonths: new Map() });
    const aug = points.find((p) => p.month === '2026-08')!;
    assert.equal(aug.status, 'missing');
    assert.equal(aug.entry, null);
    assert.equal(aug.yoy.total_spend_usd.current, null);
    assert.equal(aug.yoy.total_spend_usd.delta, null);
    assert.match(aug.yoy.total_spend_usd.reason!, /保存済み集計がない/);
  });

  it('closed means a close snapshot exists, not that the close date has passed', () => {
    const entries = new Map([['2026-08', entry('2026-08')], ['2026-09', entry('2026-09')]]);
    // 2026-08 closed on 2026-09-08 but no snapshot yet; 2026-09 has one (revised once)
    const points = buildYearlyTrend({ endMonth: '2026-09', entries, closedMonths: new Map([['2026-09', { revision_count: 1 }]]) });
    const aug = points.find((p) => p.month === '2026-08')!;
    const sep = points.find((p) => p.month === '2026-09')!;
    assert.equal(aug.status, 'provisional');
    assert.equal(aug.revision_count, undefined);
    assert.equal(sep.status, 'closed');
    assert.equal(sep.revision_count, 1);
    assert.equal(sep.closes_on, '2026-10-07');
  });

  it('a configured holiday moves the close date shown on the point', () => {
    const entries = new Map([['2026-09', entry('2026-09')]]);
    const p = buildYearlyTrend({
      endMonth: '2026-09',
      entries,
      closedMonths: new Map(),
      calendar: { close_business_days: 5, weekend_days: [0, 6], holidays: ['2026-10-05'] },
    }).at(-1)!;
    assert.equal(p.closes_on, '2026-10-08');
  });

  it('year-over-year compares with the same month of the previous year', () => {
    const entries = new Map([
      ['2025-09', entry('2025-09', { total_spend_usd: 800, active_seats: 20 })],
      ['2026-09', entry('2026-09', { total_spend_usd: 1000, active_seats: 30 })],
    ]);
    const p = buildYearlyTrend({ endMonth: '2026-09', entries, closedMonths: new Map() }).at(-1)!;
    assert.equal(p.prior_month, '2025-09');
    assert.equal(p.yoy.total_spend_usd.delta, 200);
    assert.equal(p.yoy.total_spend_usd.change_rate, 0.25);
    assert.equal(p.yoy.active_seats.delta, 10);
    assert.equal(p.yoy.active_seats.change_rate, 0.5);
  });

  it('no previous-year data: "—（reason）", not a comparison against 0', () => {
    const entries = new Map([['2026-09', entry('2026-09')]]);
    const p = buildYearlyTrend({ endMonth: '2026-09', entries, closedMonths: new Map() }).at(-1)!;
    assert.equal(p.yoy.total_spend_usd.delta, null);
    assert.equal(p.yoy.total_spend_usd.change_rate, null);
    assert.equal(p.yoy.total_spend_usd.reason, '前年同月のデータなし');
  });

  it('previous year is 0: delta is reported but no change rate', () => {
    const entries = new Map([
      ['2025-09', entry('2025-09', { total_ai_credits_used: 0 })],
      ['2026-09', entry('2026-09', { total_ai_credits_used: 10 })],
    ]);
    const y = buildYearlyTrend({ endMonth: '2026-09', entries, closedMonths: new Map() }).at(-1)!.yoy.total_ai_credits_used;
    assert.equal(y.delta, 10);
    assert.equal(y.change_rate, null);
    assert.match(y.reason!, /0 のため/);
  });

  it('a measured month with unmeasured usage keeps null metrics (acceptance rate not filled)', () => {
    const entries = new Map([
      ['2025-09', entry('2025-09')],
      ['2026-09', entry('2026-09', { acceptance_rate: null, total_chats: null })],
    ]);
    const p = buildYearlyTrend({ endMonth: '2026-09', entries, closedMonths: new Map() }).at(-1)!;
    assert.equal(p.status, 'provisional');
    assert.equal(p.yoy.acceptance_rate.delta, null);
    assert.match(p.yoy.acceptance_rate.reason!, /取得できていない/);
    assert.equal(p.yoy.total_spend_usd.delta, 0);
  });
});

describe('YearlyTrendPanel', () => {
  const entries = new Map([
    ['2025-09', entry('2025-09', { total_spend_usd: 800 })],
    ['2026-07', entry('2026-07')],
    ['2026-09', entry('2026-09', { total_spend_usd: 1200, acceptance_rate: null })],
  ]);
  const points = buildYearlyTrend({
    endMonth: '2026-09',
    entries,
    closedMonths: new Map([['2025-09', { revision_count: 0 }], ['2026-07', { revision_count: 2 }]]),
  });
  const dataset: RollingTrendDataset = {
    generated_at: '2026-10-03T00:00:00Z',
    months: [],
    trends: [],
    schema_version: 2,
    close_rule: YEARLY_TREND_CLOSE_RULE,
    points,
  };

  it('chart rows keep missing months as null (the line is cut, no zero bar)', () => {
    const rows = toChartRows(points);
    const aug = rows.find((r) => r.month === '2026-08')!;
    assert.equal(aug.spend, null);
    assert.equal(aug.acceptance_rate_pct, null);
    assert.equal(rows.find((r) => r.month === '2026-09')!.acceptance_rate_pct, null);
  });

  it('renders the legend with text labels for closed / provisional / missing and the close rule', () => {
    const html = renderToStaticMarkup(<YearlyTrendPanel dataset={dataset} />);
    assert.match(html, /data-testid="yearly-trend-legend"/);
    for (const label of ['確定', '暫定', '欠損']) assert.match(html, new RegExp(label));
    assert.match(html, /第 5 営業日/);
    assert.match(html, /確定 1 か月、暫定 1 か月、欠損 \d+ か月/);
    assert.match(html, /確定後に改訂された月が 1 か月/);
    assert.match(html, /data-testid="metric-label-yoy_spend_change"/);
  });

  it('formatYoy shows "—（reason）" when not computable and the signed change when it is', () => {
    const latest = points.at(-1)!;
    assert.equal(formatYoy(latest.yoy.total_spend_usd, (n) => `$${n}`), '+$400 (+50.0%)');
    assert.match(formatYoy(points[0].yoy.total_spend_usd, (n) => `$${n}`), /^—（/);
  });

  it('shows a reason (not an empty chart) when the dataset is missing or the legacy format', () => {
    assert.match(renderToStaticMarkup(<YearlyTrendPanel dataset={null} error="HTTP 404" />), /HTTP 404/);
    const legacy = { generated_at: 'x', months: [], trends: [] } as RollingTrendDataset;
    assert.match(renderToStaticMarkup(<YearlyTrendPanel dataset={legacy} />), /新形式で出力されていません/);
  });

  it('marks demo data explicitly', () => {
    assert.match(renderToStaticMarkup(<YearlyTrendPanel dataset={dataset} isDemo />), /data-testid="yearly-trend-demo"/);
  });
});

describe('catalog and wiring', () => {
  it('yoy metrics are catalogued and the panel references only catalogued ids', () => {
    const src = fs.readFileSync('dashboard/src/components/YearlyTrendPanel.tsx', 'utf8');
    for (const m of src.matchAll(/metricId="([^"]+)"/g)) assert.ok(m[1] in METRIC_REGISTRY, m[1]);
    assert.ok('yoy_spend_change' in METRIC_REGISTRY && 'yoy_active_seats_change' in METRIC_REGISTRY);
  });
  it('the overview view hosts the yearly trend section with the data base dir', () => {
    const src = fs.readFileSync('dashboard/src/views/overview/View.tsx', 'utf8');
    assert.match(src, /<YearlyTrendSection baseDir=\{dataBaseDir\}/);
  });
});
