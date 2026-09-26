import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FsJsonMetricsRepository } from '../../adapters/storage/FsJsonMetricsRepository.js';

describe('FsJsonMetricsRepository Tests', () => {
  let tempDir: string;
  let repo: FsJsonMetricsRepository;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-repo-test-'));
    const dataDir = path.join(tempDir, 'dashboard', 'public', 'data');
    fs.mkdirSync(path.join(dataDir, 'monthly'), { recursive: true });

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
    fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify(mockIndex));

    const mockScope = {
      scope_type: 'monthly',
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
    fs.writeFileSync(path.join(dataDir, 'monthly', '2026-09.json'), JSON.stringify(mockScope));

    repo = new FsJsonMetricsRepository(tempDir);
  });

  after(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reads index.json from disk and caches result', async () => {
    const index = await repo.fetchIndex();
    assert.equal(index.generated_at, '2026-09-26T00:00:00Z');
    assert.deepEqual(index.available_months, ['2026-09']);

    // Check second read hits cache
    const second = await repo.fetchIndex();
    assert.deepEqual(second, index);
  });

  it('reads monthly scope data from disk', async () => {
    const scope = await repo.fetchScopeData('monthly', '2026-09');
    assert.equal(scope.scope_key, '2026-09');
    assert.equal(scope.scope_type, 'monthly');
  });

  it('throws error when resource does not exist', async () => {
    await assert.rejects(async () => {
      await repo.fetchScopeData('monthly', '9999-99');
    }, /Failed to read JSON resource from disk/);
  });
});
