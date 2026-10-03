import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validatePattern,
  safeMatchPattern,
  matchUserWithCriteria,
  isFilterCriteriaActive,
  countActiveFilterConditions,
  getFilterSummaryBadges,
  generateDatasetVersionKey,
  applyFilterCriteriaToLiveScope,
  applyFilterCriteriaToMonthlyReport,
} from '../../dashboard/src/query/filterEngine.js';
import {
  FilterCriteria,
  DEFAULT_FILTER_CRITERIA,
  ScopeAggregatedData,
  MonthlyReportAggregatedData,
  EnrichedUserSeat,
  ReportUserDetail,
} from '../types/copilot.js';

describe('FilterEngine & Reactivity Guarantees Tests (SDD-15)', () => {
  describe('Pattern Validation & Safe Regex Matching', () => {
    it('validates plain text and safe regex patterns', () => {
      assert.strictEqual(validatePattern('alice', false).isValid, true);
      assert.strictEqual(validatePattern('^dev-[0-9]+$', true).isValid, true);
      assert.strictEqual(validatePattern('', true).isValid, true);

      // 不正な正規表現
      const invalid = validatePattern('[a-z(', true);
      assert.strictEqual(invalid.isValid, false);
      assert.match(invalid.error || '', /正規表現構文エラー/);

      // 長すぎるパターン (> 100 文字)
      const tooLong = 'a'.repeat(101);
      const longCheck = validatePattern(tooLong, false);
      assert.strictEqual(longCheck.isValid, false);
      assert.match(longCheck.error || '', /長すぎます/);
    });

    it('matches plain text case-insensitively', () => {
      assert.strictEqual(safeMatchPattern('dev-Alice', 'alice', false), true);
      assert.strictEqual(safeMatchPattern('dev-Bob', 'alice', false), false);
      assert.strictEqual(safeMatchPattern('', 'alice', false), false);
      assert.strictEqual(safeMatchPattern('dev-Alice', '', false), true);
    });

    it('matches regex patterns safely with case-insensitivity and catches syntax errors', () => {
      assert.strictEqual(safeMatchPattern('dev-alice-01', '^dev-.*', true), true);
      assert.strictEqual(safeMatchPattern('prod-alice-01', '^dev-.*', true), false);
      assert.strictEqual(safeMatchPattern('partner-bob', '^(dev|partner)-.*', true), true);

      // 不正な正規表現を渡しても例外を投げず安全に false を返す
      assert.strictEqual(safeMatchPattern('anything', '[unclosed-regex(', true), false);
    });
  });

  describe('Multi-axis AND Filtering Logic (matchUserWithCriteria)', () => {
    const sampleUser = {
      login: 'dev-alice',
      display_name: 'Alice Smith',
      cost_center: 'CC-Engineering',
      organization: 'proud-frontend',
      department: 'Mobile-Dev',
      tags: ['正社員', 'リモート', 'AI推進'],
    };

    it('passes default criteria (all / empty)', () => {
      assert.strictEqual(matchUserWithCriteria(sampleUser, DEFAULT_FILTER_CRITERIA), true);
    });

    it('filters by CostCenter (specific match & unassigned)', () => {
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, costCenter: 'CC-Engineering' }),
        true
      );
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, costCenter: 'CC-Design' }),
        false
      );

      const unassignedUser = { ...sampleUser, cost_center: '' };
      assert.strictEqual(
        matchUserWithCriteria(unassignedUser, { ...DEFAULT_FILTER_CRITERIA, costCenter: '__unassigned__' }),
        true
      );
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, costCenter: '__unassigned__' }),
        false
      );
    });

    it('filters by Organization & User Defined Group', () => {
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, organization: 'proud-frontend' }),
        true
      );
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, organization: 'proud-backend' }),
        false
      );
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, group: 'Mobile-Dev' }),
        true
      );
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, group: 'Backend-Dev' }),
        false
      );
    });

    it('filters by multiple Tags using strict AND logic', () => {
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, tags: ['正社員', 'AI推進'] }),
        true
      );
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, tags: ['正社員', '業務委託'] }),
        false
      );
    });

    it('filters by user pattern & regex on login and display name', () => {
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, userPattern: 'alice', userPatternIsRegex: false }),
        true
      );
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, userPattern: 'Smith', userPatternIsRegex: false }),
        true
      );
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, userPattern: '^dev-[a-z]+$', userPatternIsRegex: true }),
        true
      );
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...DEFAULT_FILTER_CRITERIA, userPattern: '^prod-.*', userPatternIsRegex: true }),
        false
      );
    });

    it('combines all 5 criteria in strict AND manner', () => {
      const strictCriteria: FilterCriteria = {
        costCenter: 'CC-Engineering',
        organization: 'proud-frontend',
        group: 'Mobile-Dev',
        tags: ['正社員'],
        userPattern: 'alice',
        userPatternIsRegex: false,
      };
      assert.strictEqual(matchUserWithCriteria(sampleUser, strictCriteria), true);

      // 1つでも不一致なら false
      assert.strictEqual(
        matchUserWithCriteria(sampleUser, { ...strictCriteria, costCenter: 'CC-Other' }),
        false
      );
    });
  });

  describe('Derived Dataset Completeness & Live Scope Aggregation', () => {
    const mockLiveScope: ScopeAggregatedData = {
      scope_type: 'monthly',
      scope_key: '2026-09',
      date_range: { start: '2026-09-01', end: '2026-09-30', days_count: 30 },
      overview: {
        total_seats: 3,
        active_users: 2,
        idle_seats: 1,
        total_spend_usd: 57.0,
        idle_waste_usd: 19.0,
        active_ratio: 0.67,
        overall_acceptance_rate: 0.35,
        total_suggestions: 1000,
        total_acceptances: 350,
        total_chats: 200,
        total_pr_summaries: 10,
        total_cli_commands: 50,
      },
      by_department: {
        Mobile: { group_name: 'Mobile', total_seats: 2, active_seats: 2, idle_seats: 0, total_cost_usd: 38, potential_savings_usd: 0, active_ratio: 1, acceptance_rate: 0.35, total_suggestions: 0, total_acceptances: 0, total_chats: 0, total_pr_summaries: 0 },
        Backend: { group_name: 'Backend', total_seats: 1, active_seats: 0, idle_seats: 1, total_cost_usd: 19, potential_savings_usd: 19, active_ratio: 0, acceptance_rate: 0.35, total_suggestions: 0, total_acceptances: 0, total_chats: 0, total_pr_summaries: 0 },
      },
      by_cost_center: {
        Eng: { group_name: 'Eng', total_seats: 3, active_seats: 2, idle_seats: 1, total_cost_usd: 57, potential_savings_usd: 19, active_ratio: 0.67, acceptance_rate: 0.35, total_suggestions: 0, total_acceptances: 0, total_chats: 0, total_pr_summaries: 0 },
      },
      by_organization: {
        OrgA: { group_name: 'OrgA', total_seats: 3, active_seats: 2, idle_seats: 1, total_cost_usd: 57, potential_savings_usd: 19, active_ratio: 0.67, acceptance_rate: 0.35, total_suggestions: 0, total_acceptances: 0, total_chats: 0, total_pr_summaries: 0 },
      },
      users: [
        {
          login: 'user-alice',
          display_name: 'Alice',
          department: 'Mobile',
          cost_center: 'Eng',
          organization: 'OrgA',
          tags: ['正社員', 'Mobile'],
          status: 'active',
          plan_type: 'enterprise',
          monthly_cost_usd: 19,
          prorated_daily_cost_usd: 0.63,
          created_at: '2026-01-01',
          days_inactive: 0,
        } as EnrichedUserSeat,
        {
          login: 'user-bob',
          display_name: 'Bob',
          department: 'Mobile',
          cost_center: 'Eng',
          organization: 'OrgA',
          tags: ['業務委託', 'Mobile'],
          status: 'active',
          plan_type: 'enterprise',
          monthly_cost_usd: 19,
          prorated_daily_cost_usd: 0.63,
          created_at: '2026-01-01',
          days_inactive: 1,
        } as EnrichedUserSeat,
        {
          login: 'user-charlie',
          display_name: 'Charlie',
          department: 'Backend',
          cost_center: 'Eng',
          organization: 'OrgA',
          tags: ['正社員', 'Backend'],
          status: 'idle',
          plan_type: 'enterprise',
          monthly_cost_usd: 19,
          prorated_daily_cost_usd: 0.63,
          created_at: '2026-01-01',
          days_inactive: 35,
        } as EnrichedUserSeat,
      ],
      user_profiles: [
        { login: 'user-alice', acceptance_rate: 0.4 } as any,
        { login: 'user-bob', acceptance_rate: 0.3 } as any,
        { login: 'user-charlie', acceptance_rate: 0.0 } as any,
      ],
      daily_trends: [],
      top_languages: [],
      cost_center_budgets: [
        {
          cost_center_name: 'Eng',
          spending_limit_usd: 100,
          net_billable_spend_usd: 57,
          remaining_budget_usd: 43,
        } as any,
      ],
    };

    it('completely recalculates overview, users, groups, and budgets without leaky pass-through', () => {
      // タグ「正社員」で絞り込み -> alice(active) と charlie(idle) の2名
      const filtered = applyFilterCriteriaToLiveScope(mockLiveScope, {
        ...DEFAULT_FILTER_CRITERIA,
        tags: ['正社員'],
      });

      assert.strictEqual(filtered.users.length, 2);
      assert.strictEqual(filtered.overview.total_seats, 2);
      assert.strictEqual(filtered.overview.active_users, 1);
      assert.strictEqual(filtered.overview.idle_seats, 1);
      assert.strictEqual(filtered.overview.total_spend_usd, 38.0);
      assert.strictEqual(filtered.overview.idle_waste_usd, 19.0);
      assert.strictEqual(filtered.overview.active_ratio, 0.5);

      // グループ集計も完全に再計算される
      assert.strictEqual(filtered.by_department['Mobile'].total_seats, 1);
      assert.strictEqual(filtered.by_department['Backend'].total_seats, 1);

      // プロファイルも連動して絞り込まれる
      assert.strictEqual(filtered.user_profiles?.length, 2);

      // 予算も連動して再集計される
      assert.strictEqual(filtered.cost_center_budgets?.[0].net_billable_spend_usd, 38.0);
      assert.strictEqual(filtered.cost_center_budgets?.[0].remaining_budget_usd, 62.0);
    });
  });

  describe('Derived Dataset Completeness & Monthly Report Aggregation', () => {
    const mockReport: MonthlyReportAggregatedData = {
      report_month: '2026-08',
      source_type: 'persisted',
      file_name: 'UsageReport-2026-08.csv',
      parsed_at: '2026-09-01T00:00:00Z',
      overview: {
        total_net_spend_usd: 100,
        total_gross_spend_usd: 120,
        total_discount_usd: 20,
        total_requests: 500,
        total_active_users: 2,
        top_model: 'Claude 3.7 Sonnet',
        top_sku: 'copilot_enterprise',
      },
      by_department: {},
      by_cost_center: {},
      by_organization: {},
      model_breakdown: [
        { model_name: 'Claude 3.7 Sonnet', total_requests: 300, total_spend_usd: 60, active_users: 1, percentage: 60 },
        { model_name: 'GPT-4o', total_requests: 200, total_spend_usd: 40, active_users: 1, percentage: 40 },
      ],
      sku_breakdown: [],
      daily_trends: [],
      user_details: [
        {
          login: 'user-alice',
          display_name: 'Alice',
          department: 'AI-Lab',
          cost_center: 'CC-AI',
          organization: 'OrgX',
          total_requests: 300,
          total_spend_usd: 60,
          gross_spend_usd: 70,
          net_spend_usd: 60,
          primary_model: 'Claude 3.7 Sonnet',
          tags: ['AI推進'],
        } as ReportUserDetail,
        {
          login: 'user-bob',
          display_name: 'Bob',
          department: 'Ops',
          cost_center: 'CC-Ops',
          organization: 'OrgX',
          total_requests: 200,
          total_spend_usd: 40,
          gross_spend_usd: 50,
          net_spend_usd: 40,
          primary_model: 'GPT-4o',
          tags: ['インフラ'],
        } as ReportUserDetail,
      ],
    };

    it('completely recalculates overview, user_details, departments, and model_breakdown', () => {
      // 部署「AI-Lab」で絞り込み -> user-alice のみ
      const filtered = applyFilterCriteriaToMonthlyReport(mockReport, {
        ...DEFAULT_FILTER_CRITERIA,
        group: 'AI-Lab',
      });

      assert.strictEqual(filtered.user_details.length, 1);
      assert.strictEqual(filtered.overview.total_active_users, 1);
      assert.strictEqual(filtered.overview.total_requests, 300);
      assert.strictEqual(filtered.overview.total_net_spend_usd, 60);
      assert.strictEqual(filtered.overview.total_gross_spend_usd, 70);
      assert.strictEqual(filtered.overview.total_discount_usd, 10);

      // model_breakdown も再集計される (Claude 3.7 Sonnet のみ 100%)
      assert.strictEqual(filtered.model_breakdown.length, 1);
      assert.strictEqual(filtered.model_breakdown[0].model_name, 'Claude 3.7 Sonnet');
      assert.strictEqual(filtered.model_breakdown[0].percentage, 100);
    });
  });

  describe('Version Key Generation & Summary Badges', () => {
    it('generates deterministic dataset version keys and detects differences', () => {
      const key1 = generateDatasetVersionKey('live_metrics', '2026-09', DEFAULT_FILTER_CRITERIA);
      const key2 = generateDatasetVersionKey('live_metrics', '2026-09', DEFAULT_FILTER_CRITERIA);
      assert.strictEqual(key1, key2);

      const key3 = generateDatasetVersionKey('live_metrics', '2026-09', {
        ...DEFAULT_FILTER_CRITERIA,
        costCenter: 'CC-Eng',
      });
      assert.notStrictEqual(key1, key3);

      const key4 = generateDatasetVersionKey('monthly_report', '2026-08', DEFAULT_FILTER_CRITERIA);
      assert.notStrictEqual(key1, key4);
    });

    it('generates summary badges and condition counts', () => {
      const criteria: FilterCriteria = {
        costCenter: 'CC-Eng',
        organization: '__unassigned__',
        group: 'Mobile',
        tags: ['正社員', 'AI'],
        userPattern: '^dev-.*',
        userPatternIsRegex: true,
      };

      assert.strictEqual(isFilterCriteriaActive(criteria), true);
      assert.strictEqual(countActiveFilterConditions(criteria), 6); // 1 + 1 + 1 + 2 + 1 = 6

      const badges = getFilterSummaryBadges(criteria);
      assert.strictEqual(badges.length, 6);
      assert.strictEqual(badges.find((b) => b.key === 'costCenter')?.label, 'CC: CC-Eng');
      assert.strictEqual(badges.find((b) => b.key === 'organization')?.label, 'Org: 未割当');
      assert.strictEqual(badges.find((b) => b.key === 'group')?.label, '部署: Mobile');
      assert.strictEqual(badges.find((b) => b.key === 'userPattern')?.label, '👤 /^dev-.*/');
    });
  });
});
