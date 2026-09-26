import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UsersPresenter } from '../../../adapters/presenters/UsersPresenter.js';
import { ScopeAggregatedData, MonthlyReportAggregatedData } from '../../../domain/entities/copilot.js';

describe('UsersPresenter Tests', () => {
  it('handles empty user data cleanly', () => {
    const vm = UsersPresenter.present({
      activeSource: 'live_metrics',
      currentData: null,
    });

    assert.strictEqual(vm.hasData, false);
    assert.strictEqual(vm.totalCount, 0);
    assert.strictEqual(vm.users.length, 0);
    assert.strictEqual(vm.statusCounts.active, 0);
  });

  it('filters live users by status and group correctly', () => {
    const mockLive: Partial<ScopeAggregatedData> = {
      users: [
        {
          login: 'user-a',
          display_name: 'User A',
          department: 'Dev',
          cost_center: 'CC-01',
          organization: 'Org1',
          status: 'active',
          monthly_cost_usd: 19.0,
          last_activity_at: '2026-09-20',
          tags: ['frontend', 'react'],
        } as any,
        {
          login: 'user-b',
          display_name: 'User B',
          department: 'Dev',
          cost_center: 'CC-02',
          organization: 'Org1',
          status: 'idle',
          monthly_cost_usd: 19.0,
          last_activity_at: null,
          tags: ['backend'],
        } as any,
        {
          login: 'user-c',
          display_name: 'User C',
          department: 'QA',
          cost_center: 'CC-01',
          organization: 'Org1',
          status: 'low_active',
          monthly_cost_usd: 19.0,
          last_activity_at: '2026-09-10',
          tags: [],
        } as any,
      ],
    };

    // 1. All users unfiltered
    const allVm = UsersPresenter.present({
      activeSource: 'live_metrics',
      currentData: mockLive as ScopeAggregatedData,
    });
    assert.strictEqual(allVm.totalCount, 3);
    assert.strictEqual(allVm.filteredCount, 3);
    assert.strictEqual(allVm.statusCounts.active, 1);
    assert.strictEqual(allVm.statusCounts.idle, 1);
    assert.strictEqual(allVm.statusCounts.low_active, 1);

    // 2. Filter by status: active
    const activeVm = UsersPresenter.present({
      activeSource: 'live_metrics',
      currentData: mockLive as ScopeAggregatedData,
      filterStatus: 'active',
    });
    assert.strictEqual(activeVm.totalCount, 3);
    assert.strictEqual(activeVm.filteredCount, 1);
    assert.strictEqual(activeVm.users[0].login, 'user-a');
    assert.strictEqual(activeVm.users[0].costFormatted, '$19.00');

    // 3. Filter by department: QA
    const deptVm = UsersPresenter.present({
      activeSource: 'live_metrics',
      currentData: mockLive as ScopeAggregatedData,
      selectedGroup: 'QA',
      grouping: 'department',
    });
    assert.strictEqual(deptVm.filteredCount, 1);
    assert.strictEqual(deptVm.users[0].login, 'user-c');
  });

  it('formats monthly report user details properly', () => {
    const mockReport: Partial<MonthlyReportAggregatedData> = {
      user_details: [
        {
          login: 'reporter-1',
          display_name: 'Reporter 1',
          department: 'Infra',
          cost_center: 'CC-99',
          organization: 'Org2',
          total_requests: 150,
          total_spend_usd: 45.2,
          primary_model: 'claude-3-7-sonnet',
          tags: ['cloud'],
        } as any,
      ],
    };

    const vm = UsersPresenter.present({
      activeSource: 'monthly_report',
      currentReportData: mockReport as MonthlyReportAggregatedData,
    });

    assert.strictEqual(vm.hasData, true);
    assert.strictEqual(vm.isReportSource, true);
    assert.strictEqual(vm.totalCount, 1);
    assert.strictEqual(vm.users[0].costFormatted, '$45.20');
    assert.strictEqual(vm.users[0].lastActivityText, '主要: claude-3-7-sonnet');
    assert.strictEqual(vm.statusCounts.active, 1);
  });
});
