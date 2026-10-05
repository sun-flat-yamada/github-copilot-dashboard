import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BudgetForecastRule } from '../domain/rules/BudgetForecastRule.js';

const days = (n: number, usd: number) =>
  Array.from({ length: n }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, gross_usd: usd }));

describe('BudgetForecastRule', () => {
  it('builds a cumulative series across the whole month and marks unobserved days as null', () => {
    const t = BudgetForecastRule.buildTimeline({ month: '2026-09', daily: days(10, 10), free_tier_usd: 0, spending_limit_usd: 1000 });
    assert.equal(t.days_in_month, 30);
    assert.equal(t.points.length, 30);
    assert.equal(t.points[9].cumulative_usd, 100);
    assert.equal(t.points[10].cumulative_usd, null);
  });

  it('puts the limit line at free tier + limit and finds the crossing days', () => {
    const t = BudgetForecastRule.buildTimeline({ month: '2026-09', daily: days(20, 10), free_tier_usd: 50, spending_limit_usd: 100 });
    assert.equal(t.limit_line_usd, 150);
    assert.equal(t.free_tier_exceeded_on, '2026-09-06'); // 60 > 50
    assert.equal(t.limit_reached_on, '2026-09-15'); // 150 >= 150
    assert.equal(t.forecast, null);
    assert.equal(t.forecast_unavailable_reason, 'already_reached');
  });

  it('forecasts the reach date with a range from the trend', () => {
    const daily = days(10, 10).map((d, i) => ({ ...d, gross_usd: i < 5 ? 5 : 15 })); // accelerating
    const t = BudgetForecastRule.buildTimeline({ month: '2026-09', daily, free_tier_usd: 0, spending_limit_usd: 400 });
    const f = t.forecast!;
    assert.ok(f, 'forecast exists');
    assert.equal(f.from_date, '2026-09-10');
    assert.ok(f.earliest <= f.expected && f.expected <= (f.latest ?? '9999'));
    assert.ok(f.earliest < (f.latest ?? '9999'), 'range has width');
    // expected: trailing-7 mean = (2*5 + 5*15)/7, remaining 300
    // ceil(300 / 12.14) = 25 days after 9/10 -> crosses into October
    assert.equal(f.expected, '2026-10-05');
    assert.equal(f.projection[0].day, 10);
  });

  it('never invents a forecast without enough data', () => {
    const base = { month: '2026-09', free_tier_usd: 0 };
    assert.equal(BudgetForecastRule.buildTimeline({ ...base, daily: days(5, 1), spending_limit_usd: 0 }).forecast_unavailable_reason, 'no_limit');
    assert.equal(BudgetForecastRule.buildTimeline({ ...base, daily: [], spending_limit_usd: 100 }).forecast_unavailable_reason, 'no_data');
    assert.equal(BudgetForecastRule.buildTimeline({ ...base, daily: days(2, 1), spending_limit_usd: 100 }).forecast_unavailable_reason, 'insufficient_days');
    assert.equal(BudgetForecastRule.buildTimeline({ ...base, daily: days(5, 0), spending_limit_usd: 100 }).forecast_unavailable_reason, 'no_spend');
  });

  it('ignores records outside the month', () => {
    const t = BudgetForecastRule.buildTimeline({
      month: '2026-09',
      daily: [{ date: '2026-08-31', gross_usd: 999 }, ...days(3, 1)],
      free_tier_usd: 0,
      spending_limit_usd: 100,
    });
    assert.equal(t.points[2].cumulative_usd, 3);
  });
});
