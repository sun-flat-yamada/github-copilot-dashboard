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

  it('verifies proud-corp and zero-live-metrics fallback heuristic logic', () => {
    // 判定ロジックの契約テスト: DashboardHeader の isMockModeData と同等の判定
    const simulateCheck = (meta: Partial<IndexMetadata> | null, repo?: { owner: string }) => {
      if (meta?.is_mock_mode === true) return true;
      if (meta?.repository?.owner === 'proud-corp' || repo?.owner === 'proud-corp') return true;

      const totalSeats = meta?.summary?.total_seats ?? 0;
      const availableDaysCount = meta?.available_days?.length ?? 0;
      const hasRealLiveMetrics = totalSeats > 0 || availableDaysCount > 0;

      if (!hasRealLiveMetrics) return true;
      if (meta?.is_mock_mode === false && hasRealLiveMetrics) return false;
      return !hasRealLiveMetrics;
    };

    // 1. 公開デモサイト (sun-flat-yamada) の実際のペイロード:
    //    is_mock_mode: false でも、total_seats: 0, available_days: [] のため DEMO (true) と判定されること
    const deployedPayload: Partial<IndexMetadata> = {
      repository: { owner: 'sun-flat-yamada', name: 'github-copilot-dashboard', is_fork: false },
      is_mock_mode: false,
      available_days: [],
      available_reports: ['2026-09', '2026-08'],
      summary: {
        total_seats: 0,
        active_seats_30d: 0,
        idle_seats_30d: 0,
        total_monthly_spend_usd: 0,
        idle_waste_spend_usd: 0,
      },
    };
    assert.equal(
      simulateCheck(deployedPayload, { owner: 'sun-flat-yamada' }),
      true,
      'Deployed public site without live metrics must be classified as DEMO (Mock)'
    );

    // 2. proud-corp のシミュレーションデータは常に DEMO
    assert.equal(
      simulateCheck({ repository: { owner: 'proud-corp', name: 'dashboard', is_fork: false } }),
      true,
      'Legacy proud-corp index must be detected as DEMO'
    );

    // 3. 初期未ロード状態でも repoInfo が proud-corp なら DEMO
    assert.equal(
      simulateCheck(null, { owner: 'proud-corp' }),
      true,
      'Initial loading state with default proud-corp repoInfo must be detected as DEMO'
    );

    // 4. 実エンタープライズの正規ライブデータ (シート数 > 0, 日数 > 0, is_mock_mode: false) は LIVE (false)
    const productionLiveData: Partial<IndexMetadata> = {
      repository: { owner: 'enterprise-org', name: 'copilot-dashboard', is_fork: true },
      is_mock_mode: false,
      available_days: ['2026-09-10', '2026-09-09'],
      summary: {
        total_seats: 120,
        active_seats_30d: 110,
        idle_seats_30d: 10,
        total_monthly_spend_usd: 4200,
        idle_waste_spend_usd: 350,
      },
    };
    assert.equal(
      simulateCheck(productionLiveData, { owner: 'enterprise-org' }),
      false,
      'Production enterprise data with real seats must be classified as LIVE'
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
