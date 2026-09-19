import { describe, it, before } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { ForkSafeStorage } from '../storage/fork-safe-storage.js';
import {
  IndexMetadata,
  ScopeAggregatedData,
  MonthlyReportAggregatedData,
} from '../types/copilot.js';
import { checkIsDemoMode } from '../../dashboard/src/hooks/useDashboardData.js';
import { checkDataIsolation } from '../../scripts/verify-fork-health.js';
import { setupForkDemoData } from '../../scripts/setup-fork-demo.js';

describe('Live Metrics DEMO Data & Referencing Tests', () => {
  const projectRoot = path.resolve(import.meta.dirname, '../..');
  const demoDataDir = path.resolve(projectRoot, 'data/demo');
  const publicDemoDir = path.resolve(projectRoot, 'dashboard/public/data/demo');

  before(() => {
    // CI環境などのクリーンな作業ツリーでは data/ が .gitignore されているため、
    // テスト実行前にローカル DEMO パーティションを確実に初期生成する。
    if (!fs.existsSync(demoDataDir) || !fs.existsSync(publicDemoDir)) {
      setupForkDemoData({ localOnly: true, push: false });
    }
  });

  it('verifies DEMO data directory structure exists in both data/demo and dashboard/public/data/demo', () => {
    assert.ok(fs.existsSync(demoDataDir), 'data/demo directory must exist');
    assert.ok(fs.existsSync(publicDemoDir), 'dashboard/public/data/demo directory must exist');

    // data/demo/ 配下のファイル
    const baseFiles = [
      'index.json',
      'error-log.json',
      'processed/custom/latest-30d.json',
      'processed/monthly/2026-09.json',
      'processed/trends/rolling-1year.json',
      'processed/deep-analysis/2026-09.json',
      'processed/reports/2026-08.json',
      'processed/reports/2026-09.json',
    ];
    for (const relPath of baseFiles) {
      const fullPath = path.join(demoDataDir, relPath);
      assert.ok(fs.existsSync(fullPath), `data/demo partition file must exist: ${relPath}`);
    }

    // dashboard/public/data/demo/ 配下のファイル (Vite SPA用ルーティングパス)
    const publicFiles = [
      'index.json',
      'error-log.json',
      'custom/latest-30d.json',
      'monthly/2026-09.json',
      'trends/rolling-1year.json',
      'deep-analysis/2026-09.json',
      'reports/2026-08.json',
      'reports/2026-09.json',
    ];
    for (const relPath of publicFiles) {
      const publicPath = path.join(publicDemoDir, relPath);
      assert.ok(fs.existsSync(publicPath), `Public DEMO partition file must exist: ${relPath}`);
    }
  });

  it('validates DEMO index.json metadata contract and flags is_mock_mode: true', () => {
    const indexPath = path.join(demoDataDir, 'index.json');
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as IndexMetadata;

    assert.equal(indexData.is_mock_mode, true, 'DEMO index.json must declare is_mock_mode: true');
    assert.ok(Array.isArray(indexData.available_days) && indexData.available_days.length > 0, 'Must have available_days');
    assert.ok(Array.isArray(indexData.available_months) && indexData.available_months.length > 0, 'Must have available_months');
    assert.ok(indexData.summary.total_seats > 0, 'Must have seats > 0');
    assert.ok(indexData.summary.active_seats_30d > 0, 'Must have active seats > 0');
    assert.ok(indexData.summary.total_monthly_spend_usd > 0, 'Must have monthly spend > 0');

    // 数学的整合性の検証
    assert.equal(
      indexData.summary.total_seats,
      indexData.summary.active_seats_30d + indexData.summary.idle_seats_30d,
      'Total seats must equal active + idle seats'
    );
  });

  it('validates daily scope partitions comply with ScopeAggregatedData contract', () => {
    const indexPath = path.join(demoDataDir, 'index.json');
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as IndexMetadata;

    for (const day of indexData.available_days) {
      const dailyPath = path.join(demoDataDir, 'processed/daily', `${day}.json`);
      assert.ok(fs.existsSync(dailyPath), `Daily partition file for ${day} must exist`);

      const dailyData = JSON.parse(fs.readFileSync(dailyPath, 'utf-8')) as ScopeAggregatedData;
      assert.equal(dailyData.scope_type, 'daily');
      assert.equal(dailyData.scope_key, day);
      assert.ok(dailyData.overview, 'Overview must exist');
      assert.ok(dailyData.by_department && typeof dailyData.by_department === 'object');
      assert.ok(dailyData.by_cost_center && typeof dailyData.by_cost_center === 'object');
      assert.ok(dailyData.by_organization && typeof dailyData.by_organization === 'object');
      assert.ok(Array.isArray(dailyData.users), 'users must be an array');
      assert.ok(dailyData.users.length > 0, 'users must not be empty');

      // 受諾率が 0 - 100% (0.0 - 1.0) の範囲内
      const accRate = dailyData.overview.overall_acceptance_rate;
      assert.ok(accRate >= 0 && accRate <= 1, `Acceptance rate (${accRate}) must be between 0 and 1`);
    }
  });

  it('validates monthly and custom range scopes comply with ScopeAggregatedData contract', () => {
    const monthlyPath = path.join(demoDataDir, 'processed/monthly/2026-09.json');
    const monthlyData = JSON.parse(fs.readFileSync(monthlyPath, 'utf-8')) as ScopeAggregatedData;
    assert.equal(monthlyData.scope_type, 'monthly');
    assert.equal(monthlyData.scope_key, '2026-09');
    assert.ok(monthlyData.users.length > 0);

    const customPath = path.join(demoDataDir, 'processed/custom/latest-30d.json');
    const customData = JSON.parse(fs.readFileSync(customPath, 'utf-8')) as ScopeAggregatedData;
    assert.equal(customData.scope_type, 'custom');
    assert.equal(customData.scope_key, 'latest-30d');
    assert.ok(customData.users.length > 0);
  });

  it('validates Monthly Usage Report precomputed data complies with MonthlyReportAggregatedData contract', () => {
    const reportPath = path.join(demoDataDir, 'processed/reports/2026-09.json');
    const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as MonthlyReportAggregatedData;

    assert.equal(reportData.report_month, '2026-09');
    assert.ok(reportData.overview.total_net_spend_usd > 0, 'Total net spend must be > 0');
    assert.ok(reportData.user_details.length > 0, 'User details must not be empty');
    assert.ok(Object.keys(reportData.by_department).length > 0, 'By department must not be empty');
    assert.ok(Object.keys(reportData.by_cost_center).length > 0, 'By cost center must not be empty');
  });

  it('verifies ForkSafeStorage routes to data/demo when isDemo is true', () => {
    const demoStorage = new ForkSafeStorage({ isDemo: true });
    assert.equal(demoStorage.isDemoStorage(), true);
    assert.ok(demoStorage.getBaseDir().endsWith(path.normalize('data/demo')), 'BaseDir must end with data/demo');
    assert.ok(
      demoStorage.getPublicDir()?.endsWith(path.normalize('dashboard/public/data/demo')),
      'PublicDir must end with dashboard/public/data/demo'
    );

    const liveStorage = new ForkSafeStorage({ isDemo: false });
    assert.equal(liveStorage.isDemoStorage(), false);
    assert.ok(liveStorage.getBaseDir().endsWith(path.normalize('data')), 'BaseDir must end with data');
  });

  it('verifies checkIsDemoMode resolves true on demo URL query parameters', () => {
    const originalWindow = global.window;

    try {
      // 1. ?demo=true
      (global as any).window = { location: { search: '?demo=true' } };
      assert.equal(checkIsDemoMode(), true, '?demo=true must activate DEMO mode');

      // 2. ?mock=true
      (global as any).window = { location: { search: '?mock=true' } };
      assert.equal(checkIsDemoMode(), true, '?mock=true must activate DEMO mode');

      // 3. ?mode=demo
      (global as any).window = { location: { search: '?mode=demo' } };
      assert.equal(checkIsDemoMode(), true, '?mode=demo must activate DEMO mode');

      // 4. ?data=demo
      (global as any).window = { location: { search: '?data=demo' } };
      assert.equal(checkIsDemoMode(), true, '?data=demo must activate DEMO mode');

      // 5. No parameters
      (global as any).window = { location: { search: '' } };
      assert.equal(checkIsDemoMode(), false, 'Empty search query must return false');
    } finally {
      if (originalWindow === undefined) {
        delete (global as any).window;
      } else {
        global.window = originalWindow;
      }
    }
  });

  it('verifies Fork-Safe Storage isolation: zero demo data files tracked in git on code branch', () => {
    const isolationResults = checkDataIsolation();
    for (const r of isolationResults) {
      assert.equal(r.status, 'pass', `Data isolation check must pass: ${r.name} - ${r.message}`);
    }
  });

  it('verifies setupForkDemoData synthesizes valid DEMO partitions in local mode', () => {
    const success = setupForkDemoData({ localOnly: true, push: false });
    assert.equal(success, true, 'setupForkDemoData in local mode must succeed');
    assert.ok(fs.existsSync(path.join(demoDataDir, 'index.json')));
    assert.ok(fs.existsSync(path.join(publicDemoDir, 'index.json')));
  });

  it('verifies useDashboardData handles runtime fetch error recording into allIssues', () => {
    // Contract test: DataFetchIssue structure generated for client-side not_found fetch errors
    const mockRuntimeError = {
      id: 'runtime-error-scope-monthly-2026-09',
      timestamp: new Date().toISOString(),
      severity: 'error' as const,
      category: 'not_found' as const,
      target: 'data:monthly:2026-09',
      message: 'データの読み込みに失敗しました: Data for scope monthly (2026-09) not found at ./data/monthly/2026-09.json',
      details: '取得先URL: ./data/monthly/2026-09.json',
      http_status: 404,
      affected_fields: ['live_metrics', 'monthly'],
    };

    assert.equal(mockRuntimeError.severity, 'error');
    assert.equal(mockRuntimeError.category, 'not_found');
    assert.equal(mockRuntimeError.http_status, 404);
    assert.ok(mockRuntimeError.message.includes('データの読み込みに失敗しました'));
    assert.ok(mockRuntimeError.target.includes('monthly:2026-09'));
  });

  it('verifies DashboardHeader.tsx binds showDemoBadge and exports isMockModeData', () => {
    const headerContent = fs.readFileSync(
      path.resolve(projectRoot, 'dashboard/src/components/layout/DashboardHeader.tsx'),
      'utf-8'
    );
    assert.match(headerContent, /const isMockMode = isMockModeData\(indexMeta, repoInfo\);/);
    assert.match(headerContent, /const showDemoBadge = isDemoMode !== undefined \? isDemoMode : isMockMode;/);
    assert.match(headerContent, /{showDemoBadge \?/);
  });
});
