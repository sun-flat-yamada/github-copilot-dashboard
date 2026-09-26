import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ScopeManager } from '../../application/services/ScopeManager.js';
import { IndexMetadata } from '../../domain/entities/copilot.js';

describe('ScopeManager Tests', () => {
  const mockIndexMeta: IndexMetadata = {
    repository: { owner: 'sun-flat-yamada', name: 'github-copilot-dashboard', is_fork: false },
    generated_at: '2026-09-01T00:00:00Z',
    data_retention_days: 365,
    available_months: ['2026-08', '2026-09'],
    all_recorded_months: ['2026-08', '2026-09'],
    available_days: ['2026-09-01', '2026-09-02'],
    default_scopes: {
      latest_day: '2026-09-02',
      latest_month: '2026-09',
    },
    summary: {
      total_seats: 10,
      active_seats_30d: 8,
      idle_seats_30d: 2,
      total_monthly_spend_usd: 390,
      idle_waste_spend_usd: 78,
    },
  };

  it('resolves latest_month as primary default scope', () => {
    const scope = ScopeManager.resolveDefaultScope(mockIndexMeta);
    assert.equal(scope.scopeType, 'monthly');
    assert.equal(scope.key, '2026-09');
  });

  it('falls back to latest_day when latest_month is missing', () => {
    const metaWithoutMonth: IndexMetadata = {
      ...mockIndexMeta,
      default_scopes: {
        latest_day: '2026-09-02',
      },
    };
    const scope = ScopeManager.resolveDefaultScope(metaWithoutMonth);
    assert.equal(scope.scopeType, 'daily');
    assert.equal(scope.key, '2026-09-02');
  });

  it('checks scope availability accurately', () => {
    assert.equal(ScopeManager.isScopeAvailable(mockIndexMeta, 'monthly', '2026-09'), true);
    assert.equal(ScopeManager.isScopeAvailable(mockIndexMeta, 'monthly', '2025-01'), false);
    assert.equal(ScopeManager.isScopeAvailable(mockIndexMeta, 'daily', '2026-09-01'), true);
    assert.equal(ScopeManager.isScopeAvailable(mockIndexMeta, 'daily', '2026-01-01'), false);
    assert.equal(ScopeManager.isScopeAvailable(mockIndexMeta, 'custom', 'latest-30d'), true);
  });
});
