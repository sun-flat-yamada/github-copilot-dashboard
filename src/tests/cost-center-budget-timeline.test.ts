import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ReportParser } from '../processor/report-parser.js';
import { AttributeResolver } from '../collector/attribute-resolver.js';
import { buildBudgetTimeline, daysInMonth, forecastReachSpan, liveCostCenterDaily, livePeriod, monthPeriod } from '../../dashboard/src/utils/budgetForecast.js';

const month = '2026-08';
const day = (d: number) => `${month}-${String(d).padStart(2, '0')}`;
const steady = (days: number, perDay: number) =>
  Array.from({ length: days }, (_, i) => ({ date: day(i + 1), spend_usd: perDay }));

describe('timeline period (selected range)', () => {
  it('builds the axis over start..end, not a calendar month', () => {
    const dated = [
      { date: '2026-08-29', spend_usd: 10 }, { date: '2026-08-30', spend_usd: 10 }, { date: '2026-08-31', spend_usd: 10 },
      { date: '2026-09-01', spend_usd: 10 }, { date: '2026-09-02', spend_usd: 10 },
    ];
    const t = buildBudgetTimeline({ start: '2026-08-29', end: '2026-09-04', daily: dated, freeTierUsd: 0, spendingLimitUsd: 100, forecastEnabled: false });
    assert.strictEqual(t.points.length, 7);
    assert.strictEqual(t.points[0].date, '2026-08-29');
    assert.strictEqual(t.points[6].date, '2026-09-04');
    assert.strictEqual(t.points[4].actual, 50);
    assert.strictEqual(t.points[5].actual, undefined);
    assert.strictEqual(t.lastObservedDate, '2026-09-02');
  });

  it('draws a single day for a daily scope and keeps the limit line', () => {
    const t = buildBudgetTimeline({ start: '2026-08-13', end: '2026-08-13', daily: [{ date: '2026-08-13', spend_usd: 42.1 }], freeTierUsd: 300, spendingLimitUsd: 2500, forecastEnabled: false });
    assert.strictEqual(t.points.length, 1);
    assert.strictEqual(t.limitLineUsd, 2800);
    assert.strictEqual(t.points[0].actual, 42.1);
  });

  it('does not forecast outside a monthly period and says why, but still reports a reached limit', () => {
    const f = buildBudgetTimeline({ start: '2026-08-01', end: '2026-08-20', daily: steady(10, 10), freeTierUsd: 0, spendingLimitUsd: 250, forecastEnabled: false }).forecast;
    assert.strictEqual(f.status, 'unavailable');
    assert.match(f.reason!, /月次/);
    const reached = buildBudgetTimeline({ start: '2026-08-01', end: '2026-08-20', daily: steady(10, 10), freeTierUsd: 0, spendingLimitUsd: 60, forecastEnabled: false }).forecast;
    assert.strictEqual(reached.status, 'reached');
  });

  it('livePeriod: monthly = whole month; daily / custom = the selected range', () => {
    assert.deepStrictEqual(livePeriod({ scope_type: 'monthly', scope_key: '2026-09', date_range: { start: '2026-09-01', end: '2026-09-10' } }), { start: '2026-09-01', end: '2026-09-30', monthly: true });
    assert.deepStrictEqual(livePeriod({ scope_type: 'custom', scope_key: 'latest-30d', date_range: { start: '2026-08-12', end: '2026-09-10' } }), { start: '2026-08-12', end: '2026-09-10', monthly: false });
    assert.deepStrictEqual(livePeriod({ scope_type: 'daily', scope_key: '2026-08-13', date_range: { start: '2026-08-13', end: '2026-08-13' } }), { start: '2026-08-13', end: '2026-08-13', monthly: false });
    assert.deepStrictEqual(monthPeriod('2026-02'), { start: '2026-02-01', end: '2026-02-28' });
  });
});

describe('liveCostCenterDaily', () => {
  it('sums the seats daily cost per cost center on each observed day only', () => {
    const r = liveCostCenterDaily({
      users: [
        { cost_center: 'CC-A', prorated_daily_cost_usd: 1.5 },
        { cost_center: 'CC-A', prorated_daily_cost_usd: 0.5 },
        { cost_center: 'CC-B', prorated_daily_cost_usd: 2 },
        { cost_center: '', prorated_daily_cost_usd: 9 },
      ],
      daily_trends: [{ date: '2026-09-02' }, { date: '2026-09-01' }, { date: '2026-09-01' }],
    });
    assert.deepStrictEqual(r['CC-A'], [{ date: '2026-09-01', spend_usd: 2 }, { date: '2026-09-02', spend_usd: 2 }]);
    assert.deepStrictEqual(r['CC-B'].length, 2);
    assert.strictEqual(Object.keys(r).length, 2);
  });

  it('has no series when there are no observed days', () => {
    const r = liveCostCenterDaily({ users: [{ cost_center: 'CC-A', prorated_daily_cost_usd: 1 }], daily_trends: [] });
    assert.deepStrictEqual(r['CC-A'], []);
  });
});

describe('forecastReachSpan', () => {
  it('turns the reach window into a day span within the month with the expected day', () => {
    const t = buildBudgetTimeline({ month, daily: steady(10, 10), freeTierUsd: 0, spendingLimitUsd: 250 });
    const span = forecastReachSpan(t)!;
    assert.strictEqual(span.expectedDay, 25);
    assert.ok(span.fromDay <= 25 && span.toDay >= 25 && span.toDay <= daysInMonth(month));
    assert.strictEqual(span.beyondMonthEnd, false);
  });

  it('clamps a window that runs past month end and flags it', () => {
    const t = buildBudgetTimeline({ month, daily: steady(10, 10), freeTierUsd: 0, spendingLimitUsd: 2000 });
    const span = forecastReachSpan(t)!;
    assert.strictEqual(span.toDay, daysInMonth(month));
    assert.strictEqual(span.expectedDay, null);
    assert.strictEqual(span.beyondMonthEnd, true);
  });

  it('returns null when there is no ok forecast', () => {
    assert.strictEqual(forecastReachSpan(buildBudgetTimeline({ month, daily: steady(10, 10), freeTierUsd: 0, spendingLimitUsd: 60 })), null);
    assert.strictEqual(forecastReachSpan(buildBudgetTimeline({ month, daily: steady(3, 10), freeTierUsd: 0, spendingLimitUsd: 100 })), null);
  });
});

describe('buildBudgetTimeline', () => {
  it('covers day 1 to month end and accumulates actuals only through the last observed day', () => {
    const t = buildBudgetTimeline({ month, daily: steady(10, 10), freeTierUsd: 50, spendingLimitUsd: 500 });
    assert.strictEqual(t.points.length, daysInMonth(month));
    assert.strictEqual(t.points[9].actual, 100);
    assert.strictEqual(t.points[10].actual, undefined);
    assert.strictEqual(t.lastObservedDate, day(10));
  });

  it('finds the day the free tier is exceeded and draws the limit at free + limit', () => {
    const t = buildBudgetTimeline({ month, daily: steady(10, 10), freeTierUsd: 55, spendingLimitUsd: 245 });
    assert.strictEqual(t.freeTierExceededDate, day(6));
    assert.strictEqual(t.limitLineUsd, 300);
  });

  it('projects the limit reach date with a band around it for a steady trend', () => {
    const t = buildBudgetTimeline({ month, daily: steady(10, 10), freeTierUsd: 0, spendingLimitUsd: 250 });
    assert.strictEqual(t.forecast.status, 'ok');
    assert.strictEqual(t.forecast.reachDate, day(25));
    assert.strictEqual(t.forecast.slopePerDay, 10);
    const p = t.points[14];
    assert.ok(p.band && p.band[0] <= p.projected! && p.projected! <= p.band[1]);
  });

  it('widens the band and the reach window when daily spend is noisy', () => {
    const noisy = Array.from({ length: 12 }, (_, i) => ({ date: day(i + 1), spend_usd: i % 2 ? 2 : 18 }));
    const t = buildBudgetTimeline({ month, daily: noisy, freeTierUsd: 0, spendingLimitUsd: 300 });
    assert.strictEqual(t.forecast.status, 'ok');
    assert.ok(t.forecast.earliestDate! < t.forecast.reachDate!);
    assert.ok(!t.forecast.latestDate || t.forecast.latestDate > t.forecast.reachDate!);
  });

  it('reports an already reached limit from actuals', () => {
    const t = buildBudgetTimeline({ month, daily: steady(10, 10), freeTierUsd: 0, spendingLimitUsd: 60 });
    assert.strictEqual(t.forecast.status, 'reached');
    assert.strictEqual(t.forecast.reachDate, day(6));
  });

  it('does not forecast with too few days, no growth, or no limit', () => {
    assert.strictEqual(buildBudgetTimeline({ month, daily: steady(3, 10), freeTierUsd: 0, spendingLimitUsd: 100 }).forecast.status, 'unavailable');
    assert.strictEqual(buildBudgetTimeline({ month, daily: steady(10, 0), freeTierUsd: 0, spendingLimitUsd: 100 }).forecast.status, 'unavailable');
    assert.strictEqual(buildBudgetTimeline({ month, daily: steady(10, 10), freeTierUsd: 0, spendingLimitUsd: 0 }).forecast.status, 'unavailable');
  });

  it('ignores records outside the month', () => {
    const t = buildBudgetTimeline({ month, daily: [{ date: '2026-07-31', spend_usd: 99 }], freeTierUsd: 0, spendingLimitUsd: 10 });
    assert.strictEqual(t.lastObservedDate, null);
    assert.strictEqual(t.points[0].actual, undefined);
  });
});

describe('ReportParser cost_center_daily', () => {
  it('emits gross spend per Cost Center per date', () => {
    const parser = new ReportParser(new AttributeResolver(JSON.stringify([])));
    const csv = `date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,organization,cost_center_name
2026-08-01,dev_a,copilot,copilot_premium_request,GPT-4o,5,requests,0.04,0.40,0.00,0.40,org,CC-A
2026-08-01,dev_b,copilot,copilot_premium_request,GPT-4o,5,requests,0.04,0.60,0.00,0.60,org,CC-A
2026-08-02,dev_a,copilot,copilot_premium_request,GPT-4o,5,requests,0.04,0.50,0.00,0.50,org,CC-A
2026-08-02,dev_c,copilot,copilot_premium_request,GPT-4o,5,requests,0.04,0.20,0.00,0.20,org,CC-B
`;
    const agg = parser.aggregate(parser.parseRecords(csv), month, 'r.csv');
    assert.deepStrictEqual(agg.cost_center_daily?.['CC-A'], [
      { date: '2026-08-01', spend_usd: 1 },
      { date: '2026-08-02', spend_usd: 0.5 },
    ]);
    assert.deepStrictEqual(agg.cost_center_daily?.['CC-B'], [{ date: '2026-08-02', spend_usd: 0.2 }]);
  });
});
