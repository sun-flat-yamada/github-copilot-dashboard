import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { IndexMetadata } from '../types/copilot.js';

describe('Header Mock/DEMO Mode Status Tests', () => {
  it('validates IndexMetadata type contract with is_mock_mode', () => {
    const mockMeta: IndexMetadata = {
      repository: { owner: 'proud-corp', name: 'dashboard', is_fork: false },
      generated_at: new Date().toISOString(),
      data_retention_days: 365,
      available_months: ['2026-09'],
      available_days: ['2026-09-10'],
      is_mock_mode: true,
      default_scopes: {
        latest_month: '2026-09',
      },
      summary: {
        total_seats: 10,
        active_seats_30d: 8,
        idle_seats_30d: 2,
        total_monthly_spend_usd: 300,
        idle_waste_spend_usd: 42,
      },
    };

    assert.equal(mockMeta.is_mock_mode, true);

    const liveMeta: IndexMetadata = {
      ...mockMeta,
      is_mock_mode: false,
    };
    assert.equal(liveMeta.is_mock_mode, false);
  });

  it('verifies run-pipeline.ts binds is_mock_mode to indexMeta', () => {
    const pipelinePath = path.resolve('src/cli/run-pipeline.ts');
    const content = fs.readFileSync(pipelinePath, 'utf-8');
    assert.match(
      content,
      /is_mock_mode:\s*isMock/,
      'run-pipeline.ts must set is_mock_mode: isMock in indexMeta'
    );
  });

  it('verifies dashboard public index.json has is_mock_mode: true if present', () => {
    const indexPath = path.resolve('dashboard/public/data/index.json');
    if (fs.existsSync(indexPath)) {
      const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      assert.equal(
        indexData.is_mock_mode,
        true,
        'Public demo index.json must declare is_mock_mode: true'
      );
    }
  });

  it('verifies DashboardHeader.tsx contains compact DEMO (Mock) and LIVE badge logic', () => {
    const headerPath = path.resolve('dashboard/src/components/layout/DashboardHeader.tsx');
    const content = fs.readFileSync(headerPath, 'utf-8');

    // isMockMode 導出ロジック
    assert.match(content, /const isMockMode =/);
    assert.match(content, /indexMeta\?\.is_mock_mode/);

    // DEMO (Mock) バッジ
    assert.match(content, /data-testid="mock-mode-badge"/);
    assert.match(content, /DEMO \(Mock\)/);
    assert.match(content, /animate-ping/);
    assert.match(content, /bg-amber-500/);

    // LIVE バッジ
    assert.match(content, /data-testid="live-mode-badge"/);
    assert.match(content, />LIVE</);
    assert.match(content, /bg-emerald-500/);
  });

  it('verifies AboutModal.tsx displays operational mode (Mock vs Live)', () => {
    const aboutPath = path.resolve('dashboard/src/components/AboutModal.tsx');
    const content = fs.readFileSync(aboutPath, 'utf-8');

    assert.match(content, /const isMockMode =/);
    assert.match(content, /仕様バージョン & 動作モード/);
    assert.match(content, /DEMO \(Mock\)/);
  });
});
