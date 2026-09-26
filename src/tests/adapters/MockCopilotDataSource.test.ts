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

    const teamMetrics = await dataSource.fetchTeamMetrics('dev-team');
    assert.equal(teamMetrics.length, 1);
    assert.equal(teamMetrics[0].team_slug, 'dev-team');

    const issues = dataSource.getIssues();
    assert.equal(issues.length, 0);
  });
});
