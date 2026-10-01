import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildRollingTrendEntry } from '../../processor/rolling-trend.js';
import { carryOverUsageSections, hasUsageMetrics } from '../../processor/scope-merge.js';
import { ScopeAggregatedData } from '../../types/copilot.js';

function scope(overrides: Partial<ScopeAggregatedData> & { month: string; spend: number; seats: number }): ScopeAggregatedData {
  const { month, spend, seats, ...rest } = overrides;
  return {
    scope_type: 'monthly',
    scope_key: month,
    date_range: { start: `${month}-01`, end: `${month}-28`, days_count: 28 },
    overview: {
      total_seats: seats,
      active_users: seats - 1,
      idle_seats: 1,
      total_spend_usd: spend,
      idle_waste_usd: 19,
      active_ratio: 0.9,
      overall_acceptance_rate: 0.31,
      total_suggestions: 1000,
      total_acceptances: 310,
      total_chats: 420,
      total_pr_summaries: 12,
      total_cli_commands: 0,
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    users: [],
    daily_trends: [
      {
        date: `${month}-01`,
        daily_cost_usd: 1,
        suggestions: 1,
        acceptances: 1,
        chats: 1,
        pr_summaries: 0,
        active_users: 1,
      } as ScopeAggregatedData['daily_trends'][number],
    ],
    top_languages: [],
    ...rest,
  } as ScopeAggregatedData;
}

describe('Rolling 1-year trend is built from stored monthly data, month by month (P0-4)', () => {
  it('each month reflects its own stored values (the old file copied the current month into every month)', () => {
    const august = buildRollingTrendEntry('2026-08', scope({ month: '2026-08', spend: 570, seats: 30 }));
    const september = buildRollingTrendEntry('2026-09', scope({ month: '2026-09', spend: 950, seats: 50 }));

    assert.equal(august.month, '2026-08');
    assert.equal(august.total_spend_usd, 570);
    assert.equal(august.total_seats, 30);
    assert.equal(september.total_spend_usd, 950);
    assert.equal(september.total_seats, 50);
    assert.notEqual(august.total_spend_usd, september.total_spend_usd);
  });

  it('a month without measured usage metrics has null acceptance / chats instead of a fixed 0.35', () => {
    const noUsage = scope({
      month: '2026-07',
      spend: 400,
      seats: 20,
      daily_trends: [],
      usage_metrics: { availability: 'unavailable' },
    });
    noUsage.overview.overall_acceptance_rate = null;
    noUsage.overview.total_chats = null;

    const entry = buildRollingTrendEntry('2026-07', noUsage);
    assert.equal(entry.acceptance_rate, null);
    assert.equal(entry.total_chats, null);
    assert.equal(entry.total_spend_usd, 400, 'seat / cost values are still real');
  });

  it('a month with measured usage keeps the measured acceptance rate', () => {
    const entry = buildRollingTrendEntry('2026-09', scope({ month: '2026-09', spend: 950, seats: 50 }));
    assert.equal(entry.acceptance_rate, 0.31);
    assert.equal(entry.total_chats, 420);
  });
});

describe('Last-known-good carry-over of usage sections (P0-3)', () => {
  const previous = scope({ month: '2026-09', spend: 900, seats: 48 });

  function freshSeatsOnly(): ScopeAggregatedData {
    const fresh = scope({ month: '2026-09', spend: 950, seats: 50, daily_trends: [], usage_metrics: { availability: 'unavailable' } });
    fresh.overview.overall_acceptance_rate = null;
    fresh.overview.total_suggestions = null;
    fresh.overview.total_acceptances = null;
    fresh.overview.total_chats = null;
    fresh.overview.total_pr_summaries = null;
    return fresh;
  }

  it('keeps the fresh seat / cost values and borrows only the usage sections', () => {
    const merged = carryOverUsageSections(freshSeatsOnly(), previous, '2026-09-09T00:00:00Z');
    assert.equal(merged.overview.total_seats, 50, 'seats come from the latest run');
    assert.equal(merged.overview.total_spend_usd, 950, 'cost comes from the latest run');
    assert.equal(merged.overview.overall_acceptance_rate, 0.31, 'usage comes from the last good run');
    assert.equal(merged.daily_trends.length, 1);
  });

  it('labels the borrowed values as carried over, with the time they were measured', () => {
    const merged = carryOverUsageSections(freshSeatsOnly(), previous, '2026-09-09T00:00:00Z');
    assert.equal(merged.usage_metrics?.availability, 'carried_over');
    assert.equal(merged.usage_metrics?.as_of, '2026-09-09T00:00:00Z');
  });

  it('keeps the original measurement time when the value is carried over repeatedly', () => {
    const first = carryOverUsageSections(freshSeatsOnly(), previous, '2026-09-09T00:00:00Z');
    const second = carryOverUsageSections(freshSeatsOnly(), first, '2026-09-20T00:00:00Z');
    assert.equal(second.usage_metrics?.as_of, '2026-09-09T00:00:00Z', 'as_of must not move forward on every failed run');
  });

  it('returns the fresh (unavailable) data when there is nothing good to carry over', () => {
    assert.equal(carryOverUsageSections(freshSeatsOnly(), null, undefined).usage_metrics?.availability, 'unavailable');
    const alsoMissing = scope({ month: '2026-09', spend: 1, seats: 1, daily_trends: [], usage_metrics: { availability: 'unavailable' } });
    assert.equal(carryOverUsageSections(freshSeatsOnly(), alsoMissing, undefined).usage_metrics?.availability, 'unavailable');
  });

  it('hasUsageMetrics understands the new marker and the legacy shape', () => {
    assert.equal(hasUsageMetrics(null), false);
    assert.equal(hasUsageMetrics(scope({ month: '2026-09', spend: 1, seats: 1, usage_metrics: { availability: 'unavailable' } })), false);
    assert.equal(hasUsageMetrics(scope({ month: '2026-09', spend: 1, seats: 1, usage_metrics: { availability: 'carried_over' } })), true);
    // usage_metrics が無い旧形式: 日次推移の有無で判定
    assert.equal(hasUsageMetrics(scope({ month: '2026-09', spend: 1, seats: 1 })), true);
    assert.equal(hasUsageMetrics(scope({ month: '2026-09', spend: 1, seats: 1, daily_trends: [] })), false);
  });
});
