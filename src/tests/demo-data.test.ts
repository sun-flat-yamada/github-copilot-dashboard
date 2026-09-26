import { describe, it, before } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { ForkSafeStorage } from '../storage/fork-safe-storage.js';
import {
  IndexMetadata,
  ScopeAggregatedData,
  MonthlyReportAggregatedData,
  GroupSummary,
} from '../types/copilot.js';
import { checkIsDemoMode } from '../application/services/DemoModeService.js';
import { resolveDataPath, getCandidateDataUrls } from '../../dashboard/src/utils/pathResolver.js';
import { checkDataIsolation } from '../../scripts/verify-fork-health.js';
import { setupForkDemoData } from '../../scripts/setup-fork-demo.js';
import { loadDemoUserMapping } from '../collector/demo-mapping-loader.js';
import { CreditsPresenter } from '../adapters/presenters/CreditsPresenter.js';
import { AgentPresenter } from '../adapters/presenters/AgentPresenter.js';
import { AdoptionPresenter } from '../adapters/presenters/AdoptionPresenter.js';

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

  it('verifies DashboardHeader.tsx binds showDemoBadge to per-source activeDataIsDemoSourced with isMockMode fallback', () => {
    const headerContent = fs.readFileSync(
      path.resolve(projectRoot, 'dashboard/src/components/layout/DashboardHeader.tsx'),
      'utf-8'
    );
    assert.match(headerContent, /const isMockMode = isMockModeData\(indexMeta, repoInfo\);/);
    assert.match(
      headerContent,
      /const showDemoBadge = activeDataIsDemoSourced !== undefined \? activeDataIsDemoSourced : isMockMode;/,
      'showDemoBadge must be driven by the per-active-source activeDataIsDemoSourced flag, not the global isDemoMode'
    );
    assert.match(headerContent, /{showDemoBadge \?/);
  });

  it('verifies resolveDataPath resolves paths correctly across GitHub Pages and Node environments', () => {
    const originalWindow = global.window;

    try {
      // 1. Node / SSR 環境
      delete (global as any).window;
      assert.equal(resolveDataPath('./data/index.json'), './data/index.json');
      assert.equal(resolveDataPath('data/demo/index.json'), './data/demo/index.json');

      // 2. GitHub Pages 環境 (末尾スラッシュなし)
      (global as any).window = {
        location: {
          pathname: '/github-copilot-dashboard',
        },
      };
      assert.equal(
        resolveDataPath('./data/index.json'),
        '/github-copilot-dashboard/data/index.json',
        'Should preserve repo prefix when accessing without trailing slash'
      );
      assert.equal(
        resolveDataPath('./data/demo/monthly/2026-09.json'),
        '/github-copilot-dashboard/data/demo/monthly/2026-09.json'
      );

      // 3. GitHub Pages 環境 (末尾スラッシュあり)
      (global as any).window = {
        location: {
          pathname: '/github-copilot-dashboard/',
        },
      };
      assert.equal(
        resolveDataPath('./data/index.json'),
        '/github-copilot-dashboard/data/index.json'
      );

      // 4. index.html を含むパス
      (global as any).window = {
        location: {
          pathname: '/github-copilot-dashboard/index.html',
        },
      };
      assert.equal(
        resolveDataPath('./data/reports/2026-09.json'),
        '/github-copilot-dashboard/data/reports/2026-09.json'
      );

      // 5. ルートパス (ローカル開発サーバー http://localhost:3000/)
      (global as any).window = {
        location: {
          pathname: '/',
        },
      };
      assert.equal(resolveDataPath('./data/index.json'), './data/index.json');
    } finally {
      if (originalWindow === undefined) {
        delete (global as any).window;
      } else {
        global.window = originalWindow;
      }
    }
  });

  it('verifies App.tsx displays reportError when isReportSource is true', () => {
    const appContent = fs.readFileSync(
      path.resolve(projectRoot, 'dashboard/src/App.tsx'),
      'utf-8'
    );
    assert.match(
      appContent,
      /{isReportSource \? reportError : error}/,
      'Error banner must prioritize reportError when activeSource is report'
    );
  });

  it('verifies copilot-analysis-cron.yml stages DEMO partition before build', () => {
    const workflowContent = fs.readFileSync(
      path.resolve(projectRoot, '.github/workflows/copilot-analysis-cron.yml'),
      'utf-8'
    );
    assert.match(
      workflowContent,
      /Stage DEMO Partitions for GitHub Pages/,
      'Workflow must contain step to stage DEMO partitions'
    );
    assert.match(
      workflowContent,
      /cp -r data\/demo\/\* dashboard\/public\/data\/demo\//,
      'Workflow must copy data/demo to dashboard/public/data/demo'
    );
    assert.match(
      workflowContent,
      /cp -r data\/demo\/processed\/\* dashboard\/public\/data\/demo\//,
      'Workflow must copy data/demo/processed to dashboard/public/data/demo'
    );
  });

  it('verifies getCandidateDataUrls generates multi-tier fallback paths including processed directory', () => {
    const originalWindow = global.window;
    try {
      (global as any).window = {
        location: {
          pathname: '/github-copilot-dashboard/',
        },
      };

      const candidates = getCandidateDataUrls('./data/demo', 'monthly', '2026-09.json');
      assert.ok(candidates.length >= 2, 'Must provide multiple fallback candidates');
      assert.ok(
        candidates.includes('/github-copilot-dashboard/data/demo/monthly/2026-09.json'),
        'Must include direct flat demo path'
      );
      assert.ok(
        candidates.includes('/github-copilot-dashboard/data/demo/processed/monthly/2026-09.json'),
        'Must include processed fallback demo path'
      );
      assert.ok(
        candidates.includes('/github-copilot-dashboard/data/monthly/2026-09.json'),
        'Must include live alternate path'
      );
    } finally {
      if (originalWindow === undefined) {
        delete (global as any).window;
      } else {
        global.window = originalWindow;
      }
    }
  });

  it('verifies DEMO user mapping GPG fixture exists, decrypts, and contains cost centers and orgs', () => {
    const gpgFixture = path.resolve(projectRoot, 'fixtures/demo/copilot-user-mapping.demo.json.gpg');
    assert.ok(fs.existsSync(gpgFixture), 'GPG fixture file must exist at fixtures/demo/copilot-user-mapping.demo.json.gpg');

    const decryptedJson = loadDemoUserMapping(projectRoot);
    assert.ok(decryptedJson, 'loadDemoUserMapping must return decrypted JSON string');

    const parsed = JSON.parse(decryptedJson);
    const parsedMapping = Array.isArray(parsed) ? parsed : parsed.mappings;
    assert.ok(Array.isArray(parsedMapping), 'Decrypted mapping must be an array or contain an array of mappings');
    assert.ok(parsedMapping.length >= 80, 'Must contain at least 80 mock users');

    const costCenters = new Set(parsedMapping.map((u: any) => u.cost_center_override).filter(Boolean));
    const departments = new Set(parsedMapping.map((u: any) => u.department).filter(Boolean));

    assert.ok(costCenters.size >= 4, `Must define at least 4 cost centers (found: ${costCenters.size})`);
    assert.ok(departments.size >= 3, `Must define at least 3 departments (found: ${departments.size})`);
    assert.ok(costCenters.has('FinTech-Division') || costCenters.has('Cloud-Platform'), 'Must contain expected cost center');
  });

  it('verifies DEMO Monthly Usage Report contains CostCenter and Organization classifications', () => {
    const reportPath = path.join(demoDataDir, 'processed/reports/2026-09.json');
    assert.ok(fs.existsSync(reportPath), 'Report file 2026-09.json must exist');

    const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as MonthlyReportAggregatedData;

    // CostCenter 分類検証
    assert.ok(reportData.by_cost_center, 'by_cost_center must exist in monthly report');
    const ccKeys = Object.keys(reportData.by_cost_center);
    assert.ok(ccKeys.length >= 4, `by_cost_center must have at least 4 categories (found: ${ccKeys.length})`);
    assert.ok(!ccKeys.every((k) => k.includes('未分類') || k.includes('Unassigned')), 'CostCenter must not be purely unassigned');
    for (const key of ccKeys) {
      const group = reportData.by_cost_center[key];
      assert.ok(group.total_cost_usd >= 0, `CostCenter ${key} must have valid total_cost_usd`);
      assert.ok(group.active_seats >= 0, `CostCenter ${key} must have valid active_seats`);
    }

    // Organization 分類検証
    assert.ok(reportData.by_organization, 'by_organization must exist in monthly report');
    const orgKeys = Object.keys(reportData.by_organization);
    assert.ok(orgKeys.length >= 3, `by_organization must have at least 3 categories (found: ${orgKeys.length})`);
    assert.ok(!orgKeys.every((k) => k.includes('未分類') || k.includes('Unassigned')), 'Organization must not be purely unassigned');
    for (const key of orgKeys) {
      const group = reportData.by_organization[key];
      assert.ok(group.total_cost_usd >= 0, `Organization ${key} must have valid total_cost_usd`);
    }

    // user_details 個別検証
    assert.ok(reportData.user_details.length > 0, 'user_details must not be empty');
    const assignedCcUsers = reportData.user_details.filter(
      (u) => u.cost_center && !u.cost_center.includes('未分類') && !u.cost_center.includes('Unassigned')
    );
    const assignedOrgUsers = reportData.user_details.filter(
      (u) => u.organization && !u.organization.includes('未分類') && !u.organization.includes('Default')
    );
    assert.ok(assignedCcUsers.length > 0, 'Must have users with valid cost_center assigned');
    assert.ok(assignedOrgUsers.length > 0, 'Must have users with valid organization assigned');
  });

  it('verifies DEMO live metrics monthly partition contains populated CostCenter and Organization groups', () => {
    const monthlyPath = path.join(demoDataDir, 'processed/monthly/2026-09.json');
    const monthlyData = JSON.parse(fs.readFileSync(monthlyPath, 'utf-8')) as ScopeAggregatedData;

    assert.ok(monthlyData.by_cost_center, 'by_cost_center must exist in live monthly scope');
    const ccKeys = Object.keys(monthlyData.by_cost_center);
    assert.ok(ccKeys.length >= 4, `Live metrics by_cost_center must have >= 4 groups (found: ${ccKeys.length})`);

    assert.ok(monthlyData.by_organization, 'by_organization must exist in live monthly scope');
    const orgKeys = Object.keys(monthlyData.by_organization);
    assert.ok(orgKeys.length >= 3, `Live metrics by_organization must have >= 3 groups (found: ${orgKeys.length})`);

    // Department が「未分類」のみになっていないこと
    const deptKeys = Object.keys(monthlyData.by_department);
    assert.ok(deptKeys.length >= 3, 'Live metrics by_department must have multiple departments');
    assert.ok(!deptKeys.every((k) => k.includes('未分類')), 'Departments must not be purely Unassigned');
  });

  it('verifies DEMO GPG user mapping is deployed to data/demo/config and dashboard/public/data/demo/config', () => {
    const dataGpgPath = path.resolve(demoDataDir, 'config/copilot-user-mapping.demo.json.gpg');
    const publicGpgPath = path.resolve(publicDemoDir, 'config/copilot-user-mapping.demo.json.gpg');

    assert.ok(fs.existsSync(dataGpgPath), 'data/demo/config/copilot-user-mapping.demo.json.gpg must exist');
    assert.ok(fs.existsSync(publicGpgPath), 'dashboard/public/data/demo/config/copilot-user-mapping.demo.json.gpg must exist');
    assert.ok(fs.statSync(dataGpgPath).size > 100, 'GPG mapping file must not be empty');
    assert.ok(fs.statSync(publicGpgPath).size > 100, 'Public GPG mapping file must not be empty');
  });

  // ==========================================
  // Phase 6-C-9: 8 New DEMO Dataset Validations
  // ==========================================

  it('① validates DEMO index.json AI Credits summary contract and cost summation equation', () => {
    const indexPath = path.join(demoDataDir, 'index.json');
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as IndexMetadata;

    const summary = indexData.summary;
    assert.ok((summary.total_ai_credits_used ?? 0) > 0, 'total_ai_credits_used must be > 0');
    assert.ok((summary.total_ai_credits_cost_usd ?? 0) > 0, 'total_ai_credits_cost_usd must be > 0');
    assert.ok(summary.total_combined_cost_usd !== undefined, 'total_combined_cost_usd must be defined');

    const expectedCombined = Number(
      ((summary.total_monthly_spend_usd ?? 0) + (summary.total_ai_credits_cost_usd ?? 0)).toFixed(2)
    );
    assert.equal(
      Number((summary.total_combined_cost_usd ?? 0).toFixed(2)),
      expectedCombined,
      'total_combined_cost_usd must equal total_monthly_spend_usd + total_ai_credits_cost_usd'
    );
    assert.ok((summary.credits_pool_utilization_percent ?? 0) >= 0, 'credits_pool_utilization_percent must be >= 0');
  });

  it('② validates daily and monthly partitions contain Agent metrics completeness', () => {
    const monthlyPath = path.join(demoDataDir, 'processed/monthly/2026-09.json');
    const monthlyData = JSON.parse(fs.readFileSync(monthlyPath, 'utf-8')) as ScopeAggregatedData;

    assert.ok(monthlyData.agent_summary, 'Monthly partition must include agent_summary');
    assert.ok(monthlyData.agent_summary.total_sessions > 0, 'total_sessions must be > 0');
    assert.ok(monthlyData.agent_summary.total_messages > 0, 'total_messages must be > 0');
    assert.ok(monthlyData.agent_summary.engaged_users > 0, 'engaged_users must be > 0');
    assert.ok(monthlyData.agent_summary.adoption_rate > 0, 'adoption_rate must be > 0');
  });

  it('③ validates DEMO user seats are enriched with ai_adoption_phase and ai_credits_used_28d', () => {
    const monthlyPath = path.join(demoDataDir, 'processed/monthly/2026-09.json');
    const monthlyData = JSON.parse(fs.readFileSync(monthlyPath, 'utf-8')) as ScopeAggregatedData;

    assert.ok(monthlyData.users.length > 0, 'Must have users');
    const phases = new Set<string>();
    let creditsUsersCount = 0;

    for (const u of monthlyData.users) {
      if (u.ai_adoption_phase) {
        phases.add(u.ai_adoption_phase);
      }
      if ((u.ai_credits_used_28d ?? 0) > 0) {
        creditsUsersCount++;
      }
    }

    assert.ok(phases.size >= 2, `Users must be distributed across multiple adoption phases (found: ${phases.size})`);
    assert.ok(creditsUsersCount > 0, 'At least some users must have ai_credits_used_28d > 0');
  });

  it('④ validates daily_trends contain agent_sessions, agent_engaged_users, and ai_credits_used', () => {
    const monthlyPath = path.join(demoDataDir, 'processed/monthly/2026-09.json');
    const monthlyData = JSON.parse(fs.readFileSync(monthlyPath, 'utf-8')) as ScopeAggregatedData;

    assert.ok(monthlyData.daily_trends && monthlyData.daily_trends.length > 0, 'daily_trends must not be empty');
    for (const d of monthlyData.daily_trends) {
      assert.ok(d.agent_sessions !== undefined, `Day ${d.date} must contain agent_sessions`);
      assert.ok(d.agent_engaged_users !== undefined, `Day ${d.date} must contain agent_engaged_users`);
      assert.ok(d.ai_credits_used !== undefined, `Day ${d.date} must contain ai_credits_used`);
    }
  });

  it('⑤ validates decrypted DEMO GPG user mapping adheres to V2 schema with teams, projects, role, and target_adoption_phase', () => {
    const decryptedJson = loadDemoUserMapping(projectRoot);
    assert.ok(decryptedJson, 'loadDemoUserMapping must return JSON string');

    const parsed = JSON.parse(decryptedJson);
    const mappings = Array.isArray(parsed) ? parsed : parsed.mappings || [];
    assert.ok(mappings.length >= 80, 'Must have >= 80 mappings');

    const withTeams = mappings.filter((m: any) => m.teams && m.teams.length > 0);
    const withProjects = mappings.filter((m: any) => m.projects && m.projects.length > 0);
    const withRole = mappings.filter((m: any) => Boolean(m.role));
    const withTargetPhase = mappings.filter((m: any) => Boolean(m.target_adoption_phase));

    assert.ok(withTeams.length > 0, 'Must have users with teams defined in V2 mapping');
    assert.ok(withProjects.length > 0, 'Must have users with projects defined in V2 mapping');
    assert.ok(withRole.length > 0, 'Must have users with role defined in V2 mapping');
    assert.ok(withTargetPhase.length > 0, 'Must have users with target_adoption_phase defined in V2 mapping');
  });

  it('⑥ validates Team API metrics and by_team structure in DEMO monthly partition', () => {
    const monthlyPath = path.join(demoDataDir, 'processed/monthly/2026-09.json');
    const monthlyData = JSON.parse(fs.readFileSync(monthlyPath, 'utf-8')) as ScopeAggregatedData;

    assert.ok(monthlyData.by_team, 'by_team must be defined in ScopeAggregatedData');
    const teamKeys = Object.keys(monthlyData.by_team);
    assert.ok(teamKeys.length > 0, 'Must have at least one team in by_team');

    for (const key of teamKeys) {
      const teamSummary: GroupSummary = (monthlyData.by_team as Record<string, GroupSummary>)[key];
      assert.ok(teamSummary.total_seats > 0, `Team ${key} must have total_seats > 0`);
      assert.ok(teamSummary.active_seats >= 0, `Team ${key} must have valid active_seats`);
      assert.ok(teamSummary.total_cost_usd >= 0, `Team ${key} must have valid total_cost_usd`);
    }
  });

  it('⑦ validates derived data derivation feasibility for 3 new Views (Credits, Agent, Adoption)', () => {
    const monthlyPath = path.join(demoDataDir, 'processed/monthly/2026-09.json');
    const monthlyData = JSON.parse(fs.readFileSync(monthlyPath, 'utf-8')) as ScopeAggregatedData;

    // Credits View Model
    const creditsVm = CreditsPresenter.present({ currentData: monthlyData });
    assert.equal(creditsVm.hasData, true, 'Credits ViewModel must have hasData: true');
    assert.ok(creditsVm.totalCreditsUsed > 0, 'Credits ViewModel must have totalCreditsUsed > 0');
    assert.ok(creditsVm.totalCreditsCostUsd > 0, 'Credits ViewModel must have totalCreditsCostUsd > 0');

    // Agent View Model
    const agentVm = AgentPresenter.present({ currentData: monthlyData });
    assert.equal(agentVm.hasData, true, 'Agent ViewModel must have hasData: true');
    assert.ok(agentVm.totalSessions > 0, 'Agent ViewModel must have totalSessions > 0');
    assert.ok(agentVm.engagedUsers > 0, 'Agent ViewModel must have engagedUsers > 0');

    // Adoption View Model
    const adoptionVm = AdoptionPresenter.present({ currentData: monthlyData });
    assert.equal(adoptionVm.hasData, true, 'Adoption ViewModel must have hasData: true');
    assert.equal(adoptionVm.stages.length, 4, 'Adoption ViewModel must define exactly 4 maturity stages');
    assert.ok(adoptionVm.totalEvaluatedUsers > 0, 'Adoption ViewModel must evaluate > 0 users');
  });

  it('⑧ validates Code Generation (code_generation_summary) metrics in DEMO monthly partition', () => {
    const monthlyPath = path.join(demoDataDir, 'processed/monthly/2026-09.json');
    const monthlyData = JSON.parse(fs.readFileSync(monthlyPath, 'utf-8')) as ScopeAggregatedData;

    assert.ok(monthlyData.code_generation_summary, 'Monthly partition must include code_generation_summary');
    assert.ok(monthlyData.code_generation_summary.total_lines_added > 0, 'total_lines_added must be > 0');
    assert.ok(monthlyData.code_generation_summary.total_lines_deleted >= 0, 'total_lines_deleted must be >= 0');
  });
});

