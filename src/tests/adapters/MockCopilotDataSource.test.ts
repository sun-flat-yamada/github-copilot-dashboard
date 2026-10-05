import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { MockCopilotDataSource } from '../../adapters/github-api/MockCopilotDataSource.js';

describe('MockCopilotDataSource Tests', () => {
  it('satisfies ICopilotDataSource port contract and returns generated bundles', async () => {
    const dataSource = new MockCopilotDataSource({ days: 7, seatCount: 10 });

    const metrics = await dataSource.fetchMetrics();
    assert.equal(metrics.length, 7);

    const seats = await dataSource.fetchSeats();
    assert.equal(seats.length, 10);

    const costCenters = await dataSource.fetchCostCenters();
    assert.ok(costCenters.length > 0);

    const budgets = await dataSource.fetchCostCenterBudgets();
    assert.ok(budgets.length > 0);

    const profiles = await dataSource.fetchUserProfiles();
    assert.ok(profiles.length > 0);

    // DEMO のチーム指標もシートの assigning_team x 日次履歴から導出する (SDD-03 §2.4)
    const teamMetrics = await dataSource.fetchTeamMetrics('team-1');
    assert.ok(teamMetrics.length > 0);
    assert.ok(teamMetrics.every((t) => t.team_slug === 'team-1' && t.team_name === 'Team-1'));
    assert.ok(teamMetrics.every((t) => t.total_active_users > 0));
    assert.ok(teamMetrics.every((t) => t.total_agent_sessions === undefined), 'no invented agent session counts');
    const dates = teamMetrics.map((t) => t.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.deepEqual(await dataSource.fetchTeamMetrics('no-such-team'), []);

    const issues = dataSource.getIssues();
    // 画面の表示パターン用に、severity / category の異なる見本 issue を返す
    assert.ok(issues.length >= 4);
    assert.ok(issues.some((i) => i.severity === 'error') && issues.some((i) => i.severity === 'warning'));
    assert.ok(new Set(issues.map((i) => i.category)).size >= 4);

    const statuses = dataSource.getSourceStatuses().map((s) => s.status);
    assert.ok(statuses.includes('ok') && statuses.includes('partial') && statuses.includes('failed'));
  });
});
