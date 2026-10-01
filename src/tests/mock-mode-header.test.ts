import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { IndexMetadata } from '../types/copilot.js';
import { isMockModeData } from '../../dashboard/src/utils/dataStatus.js';

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

    // isMockModeData は共通ユーティリティ (utils/dataStatus) の単一実装を使い、
    // リポジトリ所有者名 (proud-corp 等) を判定に使わない
    assert.match(content, /import \{ isMockModeData \} from '\.\.\/\.\.\/utils\/dataStatus';/);
    assert.doesNotMatch(content, /export function isMockModeData/);
    assert.doesNotMatch(content, /proud-corp/);
    assert.match(content, /const isMockMode = isMockModeData\(indexMeta\);/);

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

  it('verifies DashboardHeader.tsx badge reflects the per-active-source activeDataIsDemoSourced prop', () => {
    // Regression test: the badge must reflect the currently active data source's own fetch status,
    // not a single global isDemoMode flag shared across Live Metrics / Monthly Report / User Upload.
    const headerPath = path.resolve('dashboard/src/components/layout/DashboardHeader.tsx');
    const content = fs.readFileSync(headerPath, 'utf-8');

    assert.match(
      content,
      /activeDataIsDemoSourced\?:\s*boolean;/,
      'DashboardHeaderProps must declare an activeDataIsDemoSourced prop'
    );
    assert.match(
      content,
      /const showDemoBadge = activeDataIsDemoSourced !== undefined \? activeDataIsDemoSourced : isMockMode;/,
      'showDemoBadge must prioritize activeDataIsDemoSourced over the global isDemoMode/isMockMode heuristic'
    );
  });

  describe('isMockModeData: DEMO 判定は index.json の明示的な宣言だけで行う', () => {
    it('is true only when the data declares is_mock_mode: true', () => {
      assert.equal(
        isMockModeData({ repository: { owner: 'anyone', name: 'x', is_fork: false }, is_mock_mode: true } as IndexMetadata),
        true
      );
    });

    it('does not infer DEMO from the repository owner name', () => {
      // 旧: owner === 'proud-corp' でデモと推測していた
      assert.equal(
        isMockModeData({ repository: { owner: 'proud-corp', name: 'dashboard', is_fork: false } } as IndexMetadata),
        false
      );
    });

    it('does not infer DEMO from empty metrics (zero seats / zero days)', () => {
      // 旧: シート数 0 / データ日数 0 でデモと推測していた。取得失敗や未設定の実運用データが
      // 黙ってデモ表示に切り替わり、架空データを実データと誤認させていた。
      const failedCollection: Partial<IndexMetadata> = {
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
      assert.equal(isMockModeData(failedCollection as IndexMetadata), false);
    });

    it('is false before the index is loaded', () => {
      assert.equal(isMockModeData(null), false);
    });

    it('is false for production data with real seats', () => {
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
      assert.equal(isMockModeData(productionLiveData as IndexMetadata), false);
    });
  });

  it('verifies the badge click passes an explicit target mode (not the MouseEvent) to the toggle handler', () => {
    // 旧: onClick={onToggleDemoMode} で MouseEvent が forcedMode として渡り、常にデモへ切り替わっていた
    const headerPath = path.resolve('dashboard/src/components/layout/DashboardHeader.tsx');
    const content = fs.readFileSync(headerPath, 'utf-8');
    assert.doesNotMatch(content, /onClick=\{onToggleDemoMode\}/);
    assert.match(content, /onClick=\{onToggleDemoMode \? \(\) => onToggleDemoMode\(false\) : undefined\}/);
    assert.match(content, /onClick=\{onToggleDemoMode \? \(\) => onToggleDemoMode\(true\) : undefined\}/);
  });

  it('verifies AboutModal.tsx displays operational mode (Mock vs Live)', () => {
    const aboutPath = path.resolve('dashboard/src/components/AboutModal.tsx');
    const content = fs.readFileSync(aboutPath, 'utf-8');

    assert.match(content, /isMockModeData/);
    assert.match(content, /仕様バージョン & 動作モード/);
    assert.match(content, /DEMO \(Mock\)/);
  });
});
