import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TrendPresenter } from '../../../adapters/presenters/TrendPresenter.js';
import { UserUsageProfile } from '../../../domain/entities/copilot.js';

describe('TrendPresenter Tests', () => {
  it('handles empty profiles gracefully', () => {
    const vm = TrendPresenter.present({ profiles: [] });
    assert.strictEqual(vm.hasData, false);
    assert.strictEqual(vm.availableLogins.length, 0);
    assert.strictEqual(vm.selectedUser, null);
    assert.strictEqual(vm.dailyPoints.length, 0);
  });

  it('selects active user profile, finds primary model and formats daily points', () => {
    const mockProfiles: UserUsageProfile[] = [
      {
        login: 'bob',
        display_name: 'Bob Ross',
        avatar_url: 'https://example.com/avatar.png',
        department: 'Art',
        cost_center: 'CC-03',
        organization: 'PBS',
        plan_type: 'business',
        total_chats: 40,
        total_suggestions: 100,
        total_acceptances: 35,
        acceptance_rate: 0.35,
        total_cost_usd: 19.0,
        model_usage_totals: {
          'gpt-4o': 10,
          'claude-3-7-sonnet': 25,
          'gemini-2-0-flash': 5,
        },
        daily_history: [
          {
            date: '2026-09-01',
            total_chats: 10,
            suggestions: 20,
            acceptances: 8,
            model_breakdown: { 'claude-3-7-sonnet': 10 },
          } as any,
          {
            date: '2026-09-02',
            total_chats: 15,
            suggestions: 30,
            acceptances: 12,
            model_breakdown: { 'gpt-4o': 8, 'claude-3-7-sonnet': 7 },
          } as any,
        ],
      },
      {
        login: 'alice',
        display_name: 'Alice Cooper',
        avatar_url: '',
        department: 'Music',
        cost_center: 'CC-04',
        organization: 'Band',
        plan_type: 'enterprise',
        total_chats: 10,
        total_suggestions: 50,
        total_acceptances: 20,
        acceptance_rate: 0.4,
        total_cost_usd: 39.0,
        model_usage_totals: {},
        daily_history: [],
      },
    ];

    // Default select first user (bob)
    const vm = TrendPresenter.present({
      profiles: mockProfiles,
      sourceInfo: 'Live Profiles Sourced',
    });

    assert.strictEqual(vm.hasData, true);
    assert.strictEqual(vm.availableLogins.length, 2);
    assert.strictEqual(vm.sourceBadgeText, 'Live Profiles Sourced');
    assert.ok(vm.selectedUser);
    assert.strictEqual(vm.selectedUser?.login, 'bob');
    assert.strictEqual(vm.selectedUser?.displayName, 'Bob Ross');
    assert.strictEqual(vm.selectedUser?.primaryModel, 'claude-3-7-sonnet');
    assert.strictEqual(vm.selectedUser?.overallAcceptanceRateFormatted, '35%');
    assert.strictEqual(vm.selectedUser?.totalCostFormatted, '$19.00');

    assert.strictEqual(vm.dailyPoints.length, 2);
    assert.strictEqual(vm.dailyPoints[0].date, '2026-09-01');
    assert.strictEqual(vm.dailyPoints[0].acceptanceRateFormatted, '40%');
    assert.strictEqual(vm.dailyPoints[0].models['claude-3-7-sonnet'], 10);

    // Explicitly select alice
    const vmAlice = TrendPresenter.present({
      profiles: mockProfiles,
      selectedLogin: 'alice',
    });
    assert.strictEqual(vmAlice.selectedUser?.login, 'alice');
    assert.strictEqual(vmAlice.selectedUser?.primaryModel, 'N/A');
    assert.strictEqual(vmAlice.dailyPoints.length, 0);
  });
});
