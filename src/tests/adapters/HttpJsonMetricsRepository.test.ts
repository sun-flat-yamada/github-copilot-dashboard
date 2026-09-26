import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { HttpJsonMetricsRepository } from '../../adapters/storage/HttpJsonMetricsRepository.js';

describe('HttpJsonMetricsRepository Tests', () => {
  const originalFetch = globalThis.fetch;
  let repo: HttpJsonMetricsRepository;

  beforeEach(() => {
    repo = new HttpJsonMetricsRepository();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches index.json and caches the result', async () => {
    let callCount = 0;
    const mockIndex = {
      repository: { owner: 'org', name: 'repo', is_fork: false },
      generated_at: '2026-09-26T00:00:00Z',
      data_retention_days: 28,
      available_months: ['2026-09'],
      available_days: ['2026-09-25'],
      available_reports: ['2026-09'],
      default_scopes: { latest_month: '2026-09' },
      summary: {
        total_seats: 10,
        active_seats_30d: 8,
        idle_seats_30d: 2,
        total_monthly_spend_usd: 190,
        idle_waste_spend_usd: 38,
      },
    };

    globalThis.fetch = async () => {
      callCount++;
      return {
        ok: true,
        json: async () => mockIndex,
      } as Response;
    };

    const first = await repo.fetchIndex(false);
    assert.deepEqual(first, mockIndex);
    assert.equal(callCount, 1);

    // Second call should hit the cache
    const second = await repo.fetchIndex(false);
    assert.deepEqual(second, mockIndex);
    assert.equal(callCount, 1);
  });

  it('fetches scope data and report data with normalized paths', async () => {
    const scopeData = {
      scope_type: 'monthly' as const,
      scope_key: '2026-09',
      date_range: { start: '2026-09-01', end: '2026-09-30', days_count: 30 },
      overview: {
        total_seats: 10,
        active_users: 8,
        idle_seats: 2,
        total_spend_usd: 190,
        idle_waste_usd: 38,
        active_ratio: 0.8,
        overall_acceptance_rate: 0.35,
        total_suggestions: 1000,
        total_acceptances: 350,
        total_chats: 100,
        total_pr_summaries: 20,
        total_cli_commands: 10,
      },
      daily_breakdown: [],
      breakdown_by_language: [],
      breakdown_by_editor: [],
      group_summaries: [],
      users: [],
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const urlStr = input.toString();
      if (urlStr.includes('monthly/2026-09.json')) {
        return {
          ok: true,
          json: async () => scopeData,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    };

    const res = await repo.fetchScopeData('monthly', '2026-09');
    assert.equal(res.scope_key, '2026-09');
  });

  it('handles 404 cleanly by throwing an informative error', async () => {
    globalThis.fetch = async () => {
      return { ok: false, status: 404 } as Response;
    };

    await assert.rejects(async () => {
      await repo.fetchIndex(false);
    }, /Failed to load JSON resource: index\.json/);
  });
});
