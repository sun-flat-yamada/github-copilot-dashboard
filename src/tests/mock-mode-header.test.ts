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

    // isMockModeData 定義と導出ロジック
    assert.match(content, /export function isMockModeData/);
    assert.match(content, /proud-corp/);
    assert.match(content, /const isMockMode = isMockModeData\(indexMeta, repoInfo\);/);

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

  it('verifies proud-corp simulation dataset fallback heuristic logic', () => {
    // 判定ロジックの契約テスト: is_mock_mode が未指定でも proud-corp であれば DEMO
    const simulateCheck = (meta: Partial<IndexMetadata> | null, repo?: { owner: string }) => {
      if (typeof meta?.is_mock_mode === 'boolean') return meta.is_mock_mode;
      if (meta?.repository?.owner === 'proud-corp') return true;
      if (repo?.owner === 'proud-corp') return true;
      return false;
    };

    // 1. 古いデータで is_mock_mode が未定義でも owner が proud-corp なら DEMO
    assert.equal(
      simulateCheck({ repository: { owner: 'proud-corp', name: 'dashboard', is_fork: false } }),
      true,
      'Legacy proud-corp index without is_mock_mode must be detected as DEMO'
    );

    // 2. indexMeta がまだロードされていない初期状態でも repoInfo が proud-corp なら DEMO
    assert.equal(
      simulateCheck(null, { owner: 'proud-corp' }),
      true,
      'Initial loading state with default proud-corp repoInfo must be detected as DEMO'
    );

    // 3. 明示的な is_mock_mode: true
    assert.equal(
      simulateCheck({ is_mock_mode: true }),
      true
    );

    // 4. 明示的な is_mock_mode: false (実データ)
    assert.equal(
      simulateCheck({ is_mock_mode: false, repository: { owner: 'proud-corp', name: 'dashboard', is_fork: false } }),
      false,
      'Explicit is_mock_mode: false must override proud-corp owner'
    );

    // 5. 実運用の別組織 (例: acme-corp) で is_mock_mode 未定義の場合は LIVE (false)
    assert.equal(
      simulateCheck({ repository: { owner: 'acme-corp', name: 'copilot-dash', is_fork: true } }),
      false,
      'Production non-proud-corp repository must default to LIVE'
    );
  });

  it('verifies AboutModal.tsx displays operational mode (Mock vs Live)', () => {
    const aboutPath = path.resolve('dashboard/src/components/AboutModal.tsx');
    const content = fs.readFileSync(aboutPath, 'utf-8');

    assert.match(content, /isMockModeData/);
    assert.match(content, /仕様バージョン & 動作モード/);
    assert.match(content, /DEMO \(Mock\)/);
  });
});
