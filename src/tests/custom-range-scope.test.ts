import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ScopeManager } from '../application/services/ScopeManager.js';
import { IndexMetadata, ScopeAggregatedData } from '../domain/entities/copilot.js';
import { sliceScopeDataByDateRange } from '../../dashboard/src/hooks/useDashboardData.js';

describe('Custom Range Scope & Slicing Tests (#94)', () => {
  const mockIndexMeta: IndexMetadata = {
    repository: { owner: 'sun-flat-yamada', name: 'github-copilot-dashboard', is_fork: false },
    generated_at: '2026-09-10T00:00:00Z',
    data_retention_days: 365,
    available_months: ['2026-08', '2026-09'],
    available_days: ['2026-09-01', '2026-09-02'],
    default_scopes: {
      latest_day: '2026-09-02',
      latest_month: '2026-09',
      latest_range: {
        start: '2026-08-12',
        end: '2026-09-10',
      },
    },
    summary: {
      total_seats: 10,
      active_seats_30d: 8,
      idle_seats_30d: 2,
      total_monthly_spend_usd: 390,
      idle_waste_spend_usd: 78,
    },
  };

  it('validates custom date range format in ScopeManager', () => {
    assert.equal(ScopeManager.isScopeAvailable(mockIndexMeta, 'custom', 'latest-30d'), true);
    assert.equal(ScopeManager.isScopeAvailable(mockIndexMeta, 'custom', 'custom:2026-08-15_2026-09-05'), true);
    assert.equal(ScopeManager.isScopeAvailable(mockIndexMeta, 'custom', 'custom:2026-09-05_2026-08-15'), false); // start > end
    assert.equal(ScopeManager.isScopeAvailable(mockIndexMeta, 'custom', 'custom:invalid'), false);
    assert.equal(ScopeManager.isScopeAvailable(mockIndexMeta, 'custom', 'invalid-key'), false);
  });

  it('correctly slices ScopeAggregatedData to specified custom date range', () => {
    const mockBaseData: ScopeAggregatedData = {
      scope_type: 'custom',
      scope_key: 'latest-30d',
      date_range: {
        start: '2026-08-10',
        end: '2026-08-14',
        days_count: 5,
      },
      overview: {
        total_seats: 2,
        active_users: 2,
        idle_seats: 0,
        total_spend_usd: 50,
        idle_waste_usd: 0,
        active_ratio: 1,
        overall_acceptance_rate: 0.5,
        total_suggestions: 100,
        total_acceptances: 50,
        total_chats: 20,
        total_pr_summaries: 5,
        total_cli_commands: 10,
      },
      daily_trends: [
        { date: '2026-08-10', active_users: 1, suggestions: 20, acceptances: 10, acceptance_rate: 0.5, chats: 4, pr_summaries: 1, daily_cost_usd: 10 },
        { date: '2026-08-11', active_users: 2, suggestions: 20, acceptances: 10, acceptance_rate: 0.5, chats: 4, pr_summaries: 1, daily_cost_usd: 10 },
        { date: '2026-08-12', active_users: 2, suggestions: 20, acceptances: 10, acceptance_rate: 0.5, chats: 4, pr_summaries: 1, daily_cost_usd: 10 },
        { date: '2026-08-13', active_users: 1, suggestions: 20, acceptances: 10, acceptance_rate: 0.5, chats: 4, pr_summaries: 1, daily_cost_usd: 10 },
        { date: '2026-08-14', active_users: 2, suggestions: 20, acceptances: 10, acceptance_rate: 0.5, chats: 4, pr_summaries: 1, daily_cost_usd: 10 },
      ],
      user_profiles: [
        {
          login: 'alice',
          display_name: 'Alice',
          avatar_url: 'https://github.com/alice.png',
          cost_center: 'CC1',
          organization: 'Org1',
          department: 'Engineering',
          total_suggestions: 50,
          total_acceptances: 25,
          total_chats: 10,
          acceptance_rate: 0.5,
          total_cost_usd: 25,
          model_usage_totals: {},
          plan_type: 'enterprise',
          daily_history: [
            { date: '2026-08-10', suggestions: 10, acceptances: 5, acceptance_rate: 0.5, total_chats: 2, daily_cost_usd: 5, lines_suggested: 50, lines_accepted: 25, model_breakdown: {} },
            { date: '2026-08-11', suggestions: 10, acceptances: 5, acceptance_rate: 0.5, total_chats: 2, daily_cost_usd: 5, lines_suggested: 50, lines_accepted: 25, model_breakdown: {} },
            { date: '2026-08-12', suggestions: 10, acceptances: 5, acceptance_rate: 0.5, total_chats: 2, daily_cost_usd: 5, lines_suggested: 50, lines_accepted: 25, model_breakdown: {} },
            { date: '2026-08-13', suggestions: 10, acceptances: 5, acceptance_rate: 0.5, total_chats: 2, daily_cost_usd: 5, lines_suggested: 50, lines_accepted: 25, model_breakdown: {} },
            { date: '2026-08-14', suggestions: 10, acceptances: 5, acceptance_rate: 0.5, total_chats: 2, daily_cost_usd: 5, lines_suggested: 50, lines_accepted: 25, model_breakdown: {} },
          ],
        },
      ],
      by_department: {},
      by_cost_center: {},
      by_organization: {},
      users: [],
      top_languages: [],
    };

    const sliced = sliceScopeDataByDateRange(mockBaseData, '2026-08-11', '2026-08-13');

    assert.equal(sliced.scope_key, 'custom:2026-08-11_2026-08-13');
    assert.equal(sliced.date_range.start, '2026-08-11');
    assert.equal(sliced.date_range.end, '2026-08-13');
    assert.equal(sliced.date_range.days_count, 3);
    assert.equal(sliced.daily_trends?.length, 3);
    assert.equal(sliced.overview.total_spend_usd, 30);
    assert.equal(sliced.overview.total_suggestions, 60);
    assert.equal(sliced.overview.total_acceptances, 30);
    assert.equal(sliced.overview.total_chats, 12);

    const userAlice = sliced.user_profiles?.[0];
    assert.equal(userAlice?.daily_history?.length, 3);
    assert.equal(userAlice?.total_suggestions, 30);
    assert.equal(userAlice?.total_acceptances, 15);
    assert.equal(userAlice?.total_cost_usd, 15);
  });
});
