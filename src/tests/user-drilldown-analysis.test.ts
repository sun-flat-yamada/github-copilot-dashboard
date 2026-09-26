import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { InefficiencyDiagnosticEngine } from '../processor/inefficiency-diagnostic.js';
import { MonthlyReportAggregatedData, UserUsageProfile } from '../types/copilot.js';
import { adaptReportToProfiles } from '../../dashboard/src/utils/deepAnalysisAdapter.js';

describe('User Detail Table Inline Drilldown Analysis Tests', () => {
  const panelPath = path.resolve(
    process.cwd(),
    'dashboard/src/components/UserDrilldownPanel.tsx'
  );
  const userDetailTablePath = path.resolve(
    process.cwd(),
    'dashboard/src/components/UserDetailTable.tsx'
  );
  const monthlyReportTablePath = path.resolve(
    process.cwd(),
    'dashboard/src/components/monthly-report/MonthlyReportUserTable.tsx'
  );
  const appPath = path.resolve(
    process.cwd(),
    'dashboard/src/App.tsx'
  );

  it('verifies UserDrilldownPanel component file exists and contains expected structure', () => {
    assert.ok(fs.existsSync(panelPath), 'UserDrilldownPanel.tsx must exist');
    const content = fs.readFileSync(panelPath, 'utf-8');

    // Multi-tab design
    assert.match(content, /setActiveTab\('overview'\)/, 'Must support overview tab');
    assert.match(content, /setActiveTab\('trend'\)/, 'Must support trend tab');
    assert.match(content, /setActiveTab\('diagnostic'\)/, 'Must support diagnostic tab');

    // Diagnostic engine integration
    assert.match(
      content,
      /InefficiencyDiagnosticEngine\.diagnoseUser/,
      'Must call InefficiencyDiagnosticEngine.diagnoseUser'
    );
    assert.match(content, /diagnostic\.healthScore/, 'Must display overall health score');

    // Charts integration
    assert.match(content, /<ComposedChart/, 'Must render ComposedChart for daily trends');
    assert.match(content, /<PieChart/, 'Must render PieChart for model breakdown');

    // Navigation and close actions
    assert.match(content, /onSelectUserForTrend/, 'Must handle onSelectUserForTrend');
    assert.match(content, /onSelectUserForDeepAnalysis/, 'Must handle onSelectUserForDeepAnalysis');
    assert.match(content, /onClose/, 'Must provide onClose callback');
  });

  it('verifies UserDetailTable integrates row click selection and inline UserDrilldownPanel', () => {
    assert.ok(fs.existsSync(userDetailTablePath), 'UserDetailTable.tsx must exist');
    const content = fs.readFileSync(userDetailTablePath, 'utf-8');

    // Selection state
    assert.match(
      content,
      /const \[selectedUserLogin, setSelectedUserLogin\] = useState<string \| null>/,
      'UserDetailTable must maintain selectedUserLogin state'
    );

    // Row selection and toggle handler
    assert.match(
      content,
      /handleToggleUserDrilldown/,
      'UserDetailTable must have handleToggleUserDrilldown'
    );
    assert.match(
      content,
      /onClick=\{\(\) => handleToggleUserDrilldown\(u\.login\)\}/,
      'User table rows must trigger drilldown toggle on click'
    );

    // Inline drilldown panel rendering
    assert.match(
      content,
      /<UserDrilldownPanel/,
      'UserDetailTable must render UserDrilldownPanel on selection'
    );
    assert.match(
      content,
      /colSpan=\{hasUsageMetrics \? 14 : 10\}/,
      'Drilldown row must span full table columns'
    );
  });

  it('verifies MonthlyReportUserTable integrates row click selection and inline UserDrilldownPanel', () => {
    assert.ok(fs.existsSync(monthlyReportTablePath), 'MonthlyReportUserTable.tsx must exist');
    const content = fs.readFileSync(monthlyReportTablePath, 'utf-8');

    // Selection state & handler
    assert.match(
      content,
      /const \[selectedUserLogin, setSelectedUserLogin\] = useState<string \| null>/,
      'MonthlyReportUserTable must maintain selectedUserLogin state'
    );
    assert.match(
      content,
      /handleToggleUserDrilldown/,
      'MonthlyReportUserTable must have handleToggleUserDrilldown'
    );

    // Dynamic profile adaptation for monthly report data
    assert.match(
      content,
      /adaptReportToProfiles\(reportData\)/,
      'MonthlyReportUserTable must adapt report data to profiles for diagnostic drilldown'
    );

    // Inline drilldown panel rendering
    assert.match(
      content,
      /<UserDrilldownPanel/,
      'MonthlyReportUserTable must render UserDrilldownPanel on selection'
    );
  });

  it('verifies App.tsx passes deepAnalysisProfiles to user tables for unified multi-source diagnostics', () => {
    assert.ok(fs.existsSync(appPath), 'App.tsx must exist');
    const content = fs.readFileSync(appPath, 'utf-8');

    assert.match(
      content,
      /<UserDetailTable[\s\S]*?userProfiles=\{deepAnalysisProfiles\}/,
      'App.tsx must pass deepAnalysisProfiles to UserDetailTable'
    );
    assert.match(
      content,
      /<MonthlyReportUserTable[\s\S]*?userProfiles=\{deepAnalysisProfiles\}/,
      'App.tsx must pass deepAnalysisProfiles to MonthlyReportUserTable'
    );
  });

  it('verifies adaptReportToProfiles converts monthly report data and runs diagnostic drilldown', () => {
    const mockReportData: MonthlyReportAggregatedData = {
      report_month: '2026-08',
      source_type: 'persisted',
      file_name: 'test.csv',
      parsed_at: '2026-08-31T23:59:59Z',
      overview: {
        total_net_spend_usd: 39.0,
        total_gross_spend_usd: 39.0,
        total_discount_usd: 0,
        total_requests: 120,
        total_active_users: 1,
        top_model: 'Claude 3.7 Sonnet',
        top_sku: 'Copilot Enterprise',
      },
      model_breakdown: [],
      sku_breakdown: [],
      daily_trends: [
        { date: '2026-08-01', requests: 40, spend_usd: 13.0, active_users: 1 },
        { date: '2026-08-02', requests: 40, spend_usd: 13.0, active_users: 1 },
        { date: '2026-08-03', requests: 40, spend_usd: 13.0, active_users: 1 },
      ],
      by_department: {},
      by_cost_center: {},
      by_organization: {},
      user_details: [
        {
          login: 'yamada-taro',
          display_name: 'Yamada Taro',
          department: 'Platform Engineering',
          cost_center: 'CC-ENG-101',
          organization: 'proud-org',
          primary_model: 'Claude 3.7 Sonnet',
          total_requests: 120,
          total_spend_usd: 39.0,
          net_spend_usd: 39.0,
          last_activity_date: '2026-08-03',
          surface: 'VS Code',
        },
      ],
    };

    const adaptedProfiles = adaptReportToProfiles(mockReportData);
    assert.strictEqual(adaptedProfiles.length, 1);
    assert.strictEqual(adaptedProfiles[0].login, 'yamada-taro');
    assert.ok(adaptedProfiles[0].daily_history.length > 0);

    const diagnostic = InefficiencyDiagnosticEngine.diagnoseUser(
      adaptedProfiles[0],
      '30d',
      undefined,
      adaptedProfiles
    );
    assert.ok(diagnostic);
    assert.strictEqual(typeof diagnostic.healthScore, 'number');
    assert.strictEqual(diagnostic.patterns.length, 9);
  });

  it('verifies InefficiencyDiagnosticEngine correctly computes metrics for an adapted profile', () => {
    const mockProfile: UserUsageProfile = {
      login: 'yamada-taro',
      display_name: 'Yamada Taro',
      avatar_url: 'https://github.com/yamada-taro.png',
      department: 'Platform Engineering',
      cost_center: 'CC-ENG-101',
      organization: 'proud-org',
      plan_type: 'enterprise',
      total_chats: 45,
      total_suggestions: 120,
      total_acceptances: 42,
      acceptance_rate: 0.35,
      total_cost_usd: 39.0,
      model_usage_totals: { 'claude-3-7-sonnet': 35, 'gpt-4o': 5, 'o1': 5 },
      daily_history: [
        {
          date: '2026-09-01',
          total_chats: 15,
          suggestions: 40,
          acceptances: 14,
          lines_suggested: 320,
          lines_accepted: 112,
          acceptance_rate: 0.35,
          daily_cost_usd: 13.0,
          model_breakdown: { 'claude-3-7-sonnet': 10, 'gpt-4o': 5 },
        },
        {
          date: '2026-09-02',
          total_chats: 15,
          suggestions: 40,
          acceptances: 14,
          lines_suggested: 320,
          lines_accepted: 112,
          acceptance_rate: 0.35,
          daily_cost_usd: 13.0,
          model_breakdown: { 'claude-3-7-sonnet': 10, 'o1': 5 },
        },
        {
          date: '2026-09-03',
          total_chats: 15,
          suggestions: 40,
          acceptances: 14,
          lines_suggested: 320,
          lines_accepted: 112,
          acceptance_rate: 0.35,
          daily_cost_usd: 13.0,
          model_breakdown: { 'claude-3-7-sonnet': 15 },
        },
      ],
    };

    const diagnostic = InefficiencyDiagnosticEngine.diagnoseUser(mockProfile, '30d', undefined, [mockProfile]);
    assert.ok(diagnostic, 'Diagnostic must return a result');
    assert.strictEqual(typeof diagnostic.healthScore, 'number');
    assert.ok(diagnostic.healthScore >= 0 && diagnostic.healthScore <= 100);
    assert.strictEqual(diagnostic.patterns.length, 9, 'Must evaluate all 9 anti-patterns');
    assert.ok(diagnostic.drilldown.dailyActivity.length > 0);
  });
});
