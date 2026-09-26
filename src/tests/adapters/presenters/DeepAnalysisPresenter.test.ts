import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DeepAnalysisPresenter } from '../../../adapters/presenters/DeepAnalysisPresenter.js';
import { UserUsageProfile } from '../../../domain/entities/copilot.js';

describe('DeepAnalysisPresenter Tests', () => {
  it('handles empty profiles list', () => {
    const vm = DeepAnalysisPresenter.present({ profiles: [] });
    assert.strictEqual(vm.hasProfiles, false);
    assert.strictEqual(vm.summary.totalAnalyzed, 0);
    assert.strictEqual(vm.users.length, 0);
    assert.strictEqual(vm.selectedUser, null);
  });

  it('evaluates health scores and detects anti-pattern issues', () => {
    const mockProfiles: UserUsageProfile[] = [
      {
        login: 'clean-user',
        display_name: 'Clean Developer',
        avatar_url: '',
        department: 'Core',
        cost_center: 'CC-01',
        organization: 'Org',
        plan_type: 'business',
        total_chats: 20,
        total_suggestions: 100,
        total_acceptances: 45,
        acceptance_rate: 0.45,
        total_cost_usd: 19.0,
        model_usage_totals: {},
        daily_history: [],
      },
      {
        login: 'roulette-user',
        display_name: 'Tab Spammer',
        avatar_url: '',
        department: 'Core',
        cost_center: 'CC-01',
        organization: 'Org',
        plan_type: 'business',
        total_chats: 5,
        total_suggestions: 300,
        total_acceptances: 20,
        acceptance_rate: 0.067,
        total_cost_usd: 19.0,
        model_usage_totals: {},
        daily_history: [],
      },
      {
        login: 'passive-user',
        display_name: 'Passive Account',
        avatar_url: '',
        department: 'Sales',
        cost_center: 'CC-02',
        organization: 'Org',
        plan_type: 'business',
        total_chats: 0,
        total_suggestions: 0,
        total_acceptances: 0,
        acceptance_rate: 0,
        total_cost_usd: 19.0,
        model_usage_totals: {},
        daily_history: [],
      },
    ];

    const vm = DeepAnalysisPresenter.present({
      profiles: mockProfiles,
      selectedLogin: 'roulette-user',
    });

    assert.strictEqual(vm.hasProfiles, true);
    assert.strictEqual(vm.summary.totalAnalyzed, 3);
    assert.strictEqual(vm.users.length, 3);

    // Clean user: healthy
    const cleanUser = vm.users.find((u) => u.login === 'clean-user');
    assert.ok(cleanUser);
    assert.strictEqual(cleanUser?.healthScore, 100);
    assert.strictEqual(cleanUser?.status, 'healthy');

    // Roulette user: warning or critical with detected issue
    const rouletteUser = vm.users.find((u) => u.login === 'roulette-user');
    assert.ok(rouletteUser);
    assert.ok((rouletteUser?.healthScore || 0) < 80);
    assert.ok(rouletteUser?.detectedIssue?.includes('Tab Roulette'));

    // Passive user: critical with passive issue
    const passiveUser = vm.users.find((u) => u.login === 'passive-user');
    assert.ok(passiveUser);
    assert.strictEqual(passiveUser?.healthScore, 40);
    assert.strictEqual(passiveUser?.status, 'warning');
    assert.ok(passiveUser?.detectedIssue?.includes('Passive Seat'));

    // Selected user
    assert.strictEqual(vm.selectedUser?.login, 'roulette-user');
  });
});
