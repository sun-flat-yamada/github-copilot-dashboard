import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_FILTER_CRITERIA,
  DATA_SOURCE_LABELS,
  FilterCriteria,
} from '../domain/entities/copilot';
import {
  validatePattern,
  matchUserWithCriteria,
  isFilterCriteriaActive,
  getFilterSummaryBadges,
  computeDatasetVersionKey,
} from '../../dashboard/src/utils/filterEngine';

describe('Data Selection & Hierarchical AND Filtering Tests', () => {
  const modalComponentPath = path.resolve(
    process.cwd(),
    'dashboard/src/components/layout/DataSelectionModal.tsx'
  );
  const selectorComponentPath = path.resolve(
    process.cwd(),
    'dashboard/src/components/layout/ActiveDataSelector.tsx'
  );
  const hookPath = path.resolve(
    process.cwd(),
    'dashboard/src/hooks/useDashboardData.ts'
  );
  const appPath = path.resolve(
    process.cwd(),
    'dashboard/src/App.tsx'
  );

  describe('Domain & FilterEngine Contracts', () => {
    it('verifies default filter criteria state and data source labels', () => {
      assert.strictEqual(DEFAULT_FILTER_CRITERIA.costCenter, 'all');
      assert.strictEqual(DEFAULT_FILTER_CRITERIA.organization, 'all');
      assert.strictEqual(DEFAULT_FILTER_CRITERIA.group, 'all');
      assert.deepStrictEqual(DEFAULT_FILTER_CRITERIA.tags, []);
      assert.strictEqual(DEFAULT_FILTER_CRITERIA.userPattern, '');
      assert.strictEqual(DEFAULT_FILTER_CRITERIA.userPatternIsRegex, false);

      assert.ok(DATA_SOURCE_LABELS.live_metrics);
      assert.ok(DATA_SOURCE_LABELS.monthly_report);
      assert.ok(DATA_SOURCE_LABELS.user_upload);
      // Ensure "Live Metrics" phrasing is replaced with proper Japanese title
      assert.match(DATA_SOURCE_LABELS.live_metrics.shortTitle, /自動収集/);

      // Verify filter active check & badges
      assert.strictEqual(isFilterCriteriaActive(DEFAULT_FILTER_CRITERIA), false);
      const activeCriteria: FilterCriteria = {
        ...DEFAULT_FILTER_CRITERIA,
        costCenter: 'CC-AI',
        tags: ['backend'],
      };
      assert.strictEqual(isFilterCriteriaActive(activeCriteria), true);
      const badges = getFilterSummaryBadges(activeCriteria);
      assert.strictEqual(badges.length, 2);
      assert.ok(badges.some((b) => b.label.includes('CC-AI')));
      assert.ok(badges.some((b) => b.label === 'backend'));
    });

    it('verifies regex validation guards against invalid syntax, excessive length, and ReDoS', () => {
      // Plain text is always valid
      assert.strictEqual(validatePattern('normal text', false).isValid, true);

      // Valid regex
      assert.strictEqual(validatePattern('^(dev|sre)-.*', true).isValid, true);

      // Unclosed parenthesis (Syntax error)
      const invalid = validatePattern('^(dev|sre-', true);
      assert.strictEqual(invalid.isValid, false);
      assert.ok(invalid.error?.includes('正規表現構文エラー'));

      // Pattern exceeding max length (100 chars)
      const longPattern = 'a'.repeat(101);
      const lengthErr = validatePattern(longPattern, false);
      assert.strictEqual(lengthErr.isValid, false);
      assert.ok(lengthErr.error?.includes('100 文字'));

      // Potential ReDoS nested quantifier pattern
      const redosPattern = '((a+)+)+$';
      const redosErr = validatePattern(redosPattern, true);
      assert.strictEqual(redosErr.isValid, false);
      assert.ok(redosErr.error?.includes('ReDoS'));
    });

    it('verifies multi-tier AND criteria matches across all axes including unassigned and regex', () => {
      const user = {
        login: 'octocat-lead',
        display_name: 'Mona Lisa (Team Lead)',
        cost_center: 'CC-ENGINEERING',
        organization: 'github-enterprise',
        department: 'Platform-Team',
        tags: ['backend', 'go', 'core'],
      };

      // 1. Matches everything with default
      assert.strictEqual(matchUserWithCriteria(user, DEFAULT_FILTER_CRITERIA), true);

      // 2. Matches exact CostCenter & Org
      const matchCriteria: FilterCriteria = {
        ...DEFAULT_FILTER_CRITERIA,
        costCenter: 'CC-ENGINEERING',
        organization: 'github-enterprise',
        group: 'Platform-Team',
        tags: ['backend', 'go'],
        userPattern: '^(octocat|mona).*',
        userPatternIsRegex: true,
      };
      assert.strictEqual(matchUserWithCriteria(user, matchCriteria), true);

      // 3. Fails if single AND criterion does not match
      const failedCriteria: FilterCriteria = {
        ...matchCriteria,
        costCenter: 'CC-SALES',
      };
      assert.strictEqual(matchUserWithCriteria(user, failedCriteria), false);

      // 4. Test unassigned matches
      const unassignedUser = {
        login: 'guest-coder',
        display_name: 'Guest',
        cost_center: undefined,
        organization: '',
        tags: [],
      };
      assert.strictEqual(
        matchUserWithCriteria(unassignedUser, {
          ...DEFAULT_FILTER_CRITERIA,
          costCenter: '__unassigned__',
          organization: '__unassigned__',
        }),
        true
      );
    });

    it('verifies datasetVersionKey changes when data source, scope or filter changes', () => {
      const key1 = computeDatasetVersionKey('live_metrics', '2026-09', DEFAULT_FILTER_CRITERIA);
      const key2 = computeDatasetVersionKey('live_metrics', '2026-08', DEFAULT_FILTER_CRITERIA);
      const key3 = computeDatasetVersionKey('monthly_report', '2026-09', DEFAULT_FILTER_CRITERIA);
      const key4 = computeDatasetVersionKey('live_metrics', '2026-09', {
        ...DEFAULT_FILTER_CRITERIA,
        tags: ['backend'],
      });

      assert.notStrictEqual(key1, key2);
      assert.notStrictEqual(key1, key3);
      assert.notStrictEqual(key1, key4);
    });
  });

  describe('Component Structure & Reactivity Contracts', () => {
    it('verifies DataSelectionModal contains 2-column layout and all filter categories', () => {
      const content = fs.readFileSync(modalComponentPath, 'utf-8');

      // 2-column layout
      assert.match(content, /grid-cols-1 md:grid-cols-12/);
      assert.match(content, /Step 1: 分析対象データソース/);
      assert.match(content, /Step 2: ANDフィルター条件/);

      // Categories
      assert.match(content, /カテゴリ A: 組織・財務軸/);
      assert.match(content, /カテゴリ B: プロジェクト・属性軸/);
      assert.match(content, /カテゴリ C: アカウント・個別軸/);

      // Keyboard shortcuts
      assert.match(content, /handleKeyDown/);
      assert.match(content, /e\.key === 'Escape'/);
      assert.match(content, /e\.key === 'Enter'/);

      // Zero-Leakage client-side parser
      assert.match(content, /ReportParser/);
      assert.match(content, /readAsText/);
      assert.match(content, /Zero-Leakage/);

      // Header preview section with '選択ユーザー数'
      assert.match(content, /選択ユーザー数:/);
      assert.doesNotMatch(content, /集計対象プレビュー:/);
    });

    it('verifies ActiveDataSelector displays active summary pills and one-click clear button', () => {
      const content = fs.readFileSync(selectorComponentPath, 'utf-8');

      // Badges and labels
      assert.match(content, /isFilterCriteriaActive/);
      assert.match(content, /getFilterSummaryBadges/);
      assert.match(content, /onResetFilterCriteria/);

      // Keyboard shortcuts trigger
      assert.match(content, /handleGlobalKeyDown/);
      assert.match(content, /e\.key\.toLowerCase\(\) === 'k'/);
    });

    it('verifies useDashboardData binds filterCriteria and datasetVersionKey', () => {
      const content = fs.readFileSync(hookPath, 'utf-8');

      assert.match(content, /filterCriteria/);
      assert.match(content, /datasetVersionKey/);
      assert.match(content, /matchUserWithCriteria/);
      assert.match(content, /availableCostCenters/);
      assert.match(content, /availableOrganizations/);
      assert.match(content, /availableGroups/);
      assert.match(content, /availableTags/);
    });

    it('verifies App.tsx keys the main element with datasetVersionKey to guarantee view re-rendering', () => {
      const content = fs.readFileSync(appPath, 'utf-8');

      assert.match(content, /key=\{datasetVersionKey\}/);
      assert.match(content, /filterCriteria=\{filterCriteria\}/);
      assert.match(content, /onApplyFilterCriteria=\{setFilterCriteria\}/);
      assert.match(content, /onResetFilterCriteria=\{resetFilterCriteria\}/);
    });
  });
});
