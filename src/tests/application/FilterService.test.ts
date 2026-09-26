import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { FilterService } from '../../application/services/FilterService.js';
import { EnrichedUserSeat, ReportUserDetail } from '../../domain/entities/copilot.js';

describe('FilterService Tests', () => {
  const mockSeats: EnrichedUserSeat[] = [
    {
      login: 'alice',
      display_name: 'Alice',
      avatar_url: '',
      department: 'Frontend',
      cost_center: 'CC-1',
      organization: 'OrgA',
      plan_type: 'enterprise',
      monthly_cost_usd: 39,
      prorated_daily_cost_usd: 1.3,
      created_at: '2026-01-01',
      last_activity_at: '2026-09-01',
      last_activity_editor: 'vscode',
      days_inactive: 0,
      status: 'active',
      tags: ['正社員', 'リード'],
    },
    {
      login: 'bob',
      display_name: 'Bob',
      avatar_url: '',
      department: 'Backend',
      cost_center: 'CC-2',
      organization: 'OrgA',
      plan_type: 'enterprise',
      monthly_cost_usd: 39,
      prorated_daily_cost_usd: 1.3,
      created_at: '2026-01-01',
      last_activity_at: '2026-09-01',
      last_activity_editor: 'vscode',
      days_inactive: 0,
      status: 'active',
      tags: ['業務委託'],
    },
  ];

  it('filters seats using AND condition across multiple tags', () => {
    const filteredOne = FilterService.filterSeatsByTags(mockSeats, ['正社員']);
    assert.equal(filteredOne.length, 1);
    assert.equal(filteredOne[0].login, 'alice');

    const filteredBoth = FilterService.filterSeatsByTags(mockSeats, ['正社員', 'リード']);
    assert.equal(filteredBoth.length, 1);
    assert.equal(filteredBoth[0].login, 'alice');

    const filteredMismatch = FilterService.filterSeatsByTags(mockSeats, ['正社員', '業務委託']);
    assert.equal(filteredMismatch.length, 0);

    const emptyFilter = FilterService.filterSeatsByTags(mockSeats, []);
    assert.equal(emptyFilter.length, 2);
  });

  it('filters report users using tags', () => {
    const mockReportUsers: ReportUserDetail[] = [
      {
        login: 'alice',
        display_name: 'Alice',
        department: 'Frontend',
        cost_center: 'CC-1',
        organization: 'OrgA',
        total_requests: 100,
        total_spend_usd: 10,
        primary_model: 'Claude 3.7 Sonnet',
        tags: ['リモート'],
      },
    ];

    const filtered = FilterService.filterReportUsersByTags(mockReportUsers, ['リモート']);
    assert.equal(filtered.length, 1);

    const noMatch = FilterService.filterReportUsersByTags(mockReportUsers, ['出社']);
    assert.equal(noMatch.length, 0);
  });
});
