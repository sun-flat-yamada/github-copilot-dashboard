import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createAutoCollectedTestDataset,
} from './fixtures/auto-collected-data-fixtures.js';
import {
  DEFAULT_FILTER_CRITERIA,
  FilterCriteria,
} from '../domain/entities/copilot.js';
import {
  validatePattern,
  safeMatchPattern,
  matchUserWithCriteria,
  applyFilterCriteriaToLiveScope,
  generateDatasetVersionKey,
  isFilterCriteriaActive,
  getFilterSummaryBadges,
} from '../../dashboard/src/query/filterEngine.js';

describe('Auto-Collected Data Selection Pattern Matrix Tests (#90)', () => {
  const dataset = createAutoCollectedTestDataset();

  describe('Tier 1: Period Scope Selection Patterns (第1階層: 期間範囲指定)', () => {
    it('switches between monthly scopes and reflects corresponding user populations', () => {
      // 2026-09 (Full 13 users)
      const scope09 = dataset.monthlyScopes['2026-09'];
      assert.ok(scope09);
      assert.strictEqual(scope09.users.length, 13);
      assert.strictEqual(scope09.overview.total_seats, 13);

      // 2026-08 (11 users - before U12, U13 joined)
      const scope08 = dataset.monthlyScopes['2026-08'];
      assert.ok(scope08);
      assert.strictEqual(scope08.users.length, 11);
      assert.strictEqual(scope08.overview.total_seats, 11);

      // 2026-07 (8 core users)
      const scope07 = dataset.monthlyScopes['2026-07'];
      assert.ok(scope07);
      assert.strictEqual(scope07.users.length, 8);
      assert.strictEqual(scope07.overview.total_seats, 8);

      // All months are recorded in index metadata
      assert.deepStrictEqual(dataset.indexMeta.available_months, ['2026-09', '2026-08', '2026-07']);
    });

    it('switches between daily scopes and reflects weekday vs weekend activity differences', () => {
      // 2026-09-10 (Weekday: Regular high activity)
      const dailyWeekday = dataset.dailyScopes['2026-09-10'];
      assert.ok(dailyWeekday);
      assert.strictEqual(dailyWeekday.users.length, 13);
      const activeCountWeekday = dailyWeekday.users.filter((u) => u.status === 'active').length;
      assert.ok(activeCountWeekday >= 8);

      // 2026-09-06 (Weekend: Reduced active seats)
      const dailyWeekend = dataset.dailyScopes['2026-09-06'];
      assert.ok(dailyWeekend);
      assert.strictEqual(dailyWeekend.users.length, 13);
      const activeCountWeekend = dailyWeekend.users.filter((u) => u.status === 'active').length;
      assert.ok(activeCountWeekend < activeCountWeekday);
    });

    it('verifies default scope metadata configuration', () => {
      assert.strictEqual(dataset.indexMeta.default_scopes.latest_month, '2026-09');
      assert.strictEqual(dataset.indexMeta.default_scopes.latest_day, '2026-09-10');
    });
  });

  describe('Tier 2: Category A - Organization & Finance Selection Patterns (組織・財務軸)', () => {
    const scopeData = dataset.monthlyScopes['2026-09'];

    it('filters by each specific CostCenter accurately', () => {
      // FinTech-Division: U01, U04, U06, U09, U13 (5 users)
      const fintechResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        costCenter: 'FinTech-Division',
      });
      assert.strictEqual(fintechResult.users.length, 5);
      const logins = fintechResult.users.map((u) => u.login).sort();
      assert.deepStrictEqual(logins, [
        'contractor-alex',
        'contractor-carol',
        'dev-lead-taro',
        'mobile-yuki',
        'super-fullstack',
      ]);

      // Cloud-Platform: U03, U07 (2 users)
      const cloudResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        costCenter: 'Cloud-Platform',
      });
      assert.strictEqual(cloudResult.users.length, 2);
      assert.deepStrictEqual(cloudResult.users.map((u) => u.login).sort(), ['infra-daiki', 'sre-kenji-sato']);

      // Research-and-AI: U02, U11 (2 users)
      const aiResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        costCenter: 'Research-and-AI',
      });
      assert.strictEqual(aiResult.users.length, 2);
      assert.deepStrictEqual(aiResult.users.map((u) => u.login).sort(), ['dev-hanako', 'notag-frank']);

      // Enterprise-IT: U05, U10 (2 users)
      const itResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        costCenter: 'Enterprise-IT',
      });
      assert.strictEqual(itResult.users.length, 2);
      assert.deepStrictEqual(itResult.users.map((u) => u.login).sort(), ['dx-mika-ito', 'shadow-dave']);
    });

    it('filters by Unassigned CostCenter (__unassigned__)', () => {
      // Unassigned CostCenter: U08 (guest-intern-bob), U12 (ghost-anonymous)
      const unassignedResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        costCenter: '__unassigned__',
      });
      assert.strictEqual(unassignedResult.users.length, 2);
      assert.deepStrictEqual(unassignedResult.users.map((u) => u.login).sort(), [
        'ghost-anonymous',
        'guest-intern-bob',
      ]);
    });

    it('filters by each specific Organization accurately', () => {
      // proud-fintech: U01, U04, U06, U08, U13 (5 users)
      const fintechOrgResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        organization: 'proud-fintech',
      });
      assert.strictEqual(fintechOrgResult.users.length, 5);
      assert.deepStrictEqual(fintechOrgResult.users.map((u) => u.login).sort(), [
        'contractor-alex',
        'dev-lead-taro',
        'guest-intern-bob',
        'mobile-yuki',
        'super-fullstack',
      ]);

      // proud-cloud-core: U03, U07 (2 users)
      const cloudOrgResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        organization: 'proud-cloud-core',
      });
      assert.strictEqual(cloudOrgResult.users.length, 2);
      assert.deepStrictEqual(cloudOrgResult.users.map((u) => u.login).sort(), ['infra-daiki', 'sre-kenji-sato']);
    });

    it('filters by Unassigned Organization (__unassigned__)', () => {
      // Unassigned Organization: U09 (contractor-carol), U12 (ghost-anonymous)
      const unassignedOrgResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        organization: '__unassigned__',
      });
      assert.strictEqual(unassignedOrgResult.users.length, 2);
      assert.deepStrictEqual(unassignedOrgResult.users.map((u) => u.login).sort(), [
        'contractor-carol',
        'ghost-anonymous',
      ]);
    });
  });

  describe('Tier 2: Category B - Project & Attributes Selection Patterns (プロジェクト・属性軸)', () => {
    const scopeData = dataset.monthlyScopes['2026-09'];

    it('filters by User Defined Groups (Department)', () => {
      // コア決済基盤チーム: U01, U06, U08, U09, U13 (5 users)
      const corePayResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        group: 'コア決済基盤チーム',
      });
      assert.strictEqual(corePayResult.users.length, 5);
      assert.deepStrictEqual(corePayResult.users.map((u) => u.login).sort(), [
        'contractor-alex',
        'contractor-carol',
        'dev-lead-taro',
        'guest-intern-bob',
        'super-fullstack',
      ]);

      // SRE & クラウド基盤部: U03, U07 (2 users)
      const sreResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        group: 'SRE & クラウド基盤部',
      });
      assert.strictEqual(sreResult.users.length, 2);
      assert.deepStrictEqual(sreResult.users.map((u) => u.login).sort(), ['infra-daiki', 'sre-kenji-sato']);

      // Unassigned Group: U10 (shadow-dave), U12 (ghost-anonymous)
      const unassignedDeptResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        group: '__unassigned__',
      });
      assert.strictEqual(unassignedDeptResult.users.length, 2);
      assert.deepStrictEqual(unassignedDeptResult.users.map((u) => u.login).sort(), [
        'ghost-anonymous',
        'shadow-dave',
      ]);
    });

    it('filters by single tag', () => {
      // Tag: 'backend' -> U01, U06, U13 (3 users)
      const backendResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        tags: ['backend'],
      });
      assert.strictEqual(backendResult.users.length, 3);
      assert.deepStrictEqual(backendResult.users.map((u) => u.login).sort(), [
        'contractor-alex',
        'dev-lead-taro',
        'super-fullstack',
      ]);

      // Tag: 'sre' -> U03, U13 (2 users)
      const sreResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        tags: ['sre'],
      });
      assert.strictEqual(sreResult.users.length, 2);
      assert.deepStrictEqual(sreResult.users.map((u) => u.login).sort(), [
        'sre-kenji-sato',
        'super-fullstack',
      ]);
    });

    it('filters by multiple tags using strict AND logic', () => {
      // Tags: ['backend', 'lead']
      // U01 has ['backend', 'lead', 'typescript'] -> MATCH
      // U06 has ['contractor', 'backend'] -> DOES NOT have 'lead' -> EXCLUDED
      // U13 has ['backend', 'frontend', 'ai-ml', 'sre', 'lead', 'dx'] -> MATCH
      const multiTagResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        tags: ['backend', 'lead'],
      });
      assert.strictEqual(multiTagResult.users.length, 2);
      assert.deepStrictEqual(multiTagResult.users.map((u) => u.login).sort(), [
        'dev-lead-taro',
        'super-fullstack',
      ]);

      // Tags: all 6 tags of U13
      const allTagResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        tags: ['backend', 'frontend', 'ai-ml', 'sre', 'lead', 'dx'],
      });
      assert.strictEqual(allTagResult.users.length, 1);
      assert.strictEqual(allTagResult.users[0].login, 'super-fullstack');
    });

    it('returns zero users when selecting a non-existent tag or impossible tag combination', () => {
      const nonExistentResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        tags: ['quantum-computing-nonexistent'],
      });
      assert.strictEqual(nonExistentResult.users.length, 0);

      // Combination of mutually exclusive tags
      const impossibleComboResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        tags: ['intern', 'manager'],
      });
      assert.strictEqual(impossibleComboResult.users.length, 0);
    });

    it('retains untagged users when tag filter is empty (all)', () => {
      const allResult = applyFilterCriteriaToLiveScope(scopeData, DEFAULT_FILTER_CRITERIA);
      assert.strictEqual(allResult.users.length, 13);
      // Untagged users U11, U12 are present
      const logins = allResult.users.map((u) => u.login);
      assert.ok(logins.includes('notag-frank'));
      assert.ok(logins.includes('ghost-anonymous'));
    });
  });

  describe('Tier 2: Category C - Account & Individual Selection Patterns (アカウント・個別軸)', () => {
    const scopeData = dataset.monthlyScopes['2026-09'];

    it('filters by plain text pattern (case-insensitive substring match on login and display_name)', () => {
      // Substring 'taro' on login
      const taroResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        userPattern: 'taro',
        userPatternIsRegex: false,
      });
      assert.strictEqual(taroResult.users.length, 1);
      assert.strictEqual(taroResult.users[0].login, 'dev-lead-taro');

      // Upper case 'TARO'
      const upperTaroResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        userPattern: 'TARO',
        userPatternIsRegex: false,
      });
      assert.strictEqual(upperTaroResult.users.length, 1);
      assert.strictEqual(upperTaroResult.users[0].login, 'dev-lead-taro');

      // Japanese display name match '田中'
      const nameResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        userPattern: '田中',
        userPatternIsRegex: false,
      });
      assert.strictEqual(nameResult.users.length, 1);
      assert.strictEqual(nameResult.users[0].login, 'dev-lead-taro');
    });

    it('filters by regular expression: prefix patterns (^pattern)', () => {
      // ^dev-.* -> U01 (dev-lead-taro), U02 (dev-hanako)
      const prefixResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        userPattern: '^dev-.*',
        userPatternIsRegex: true,
      });
      assert.strictEqual(prefixResult.users.length, 2);
      assert.deepStrictEqual(prefixResult.users.map((u) => u.login).sort(), ['dev-hanako', 'dev-lead-taro']);
    });

    it('filters by regular expression: suffix patterns (pattern$)', () => {
      // .*-sato$ -> U03 (sre-kenji-sato)
      const suffixResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        userPattern: '.*-sato$',
        userPatternIsRegex: true,
      });
      assert.strictEqual(suffixResult.users.length, 1);
      assert.strictEqual(suffixResult.users[0].login, 'sre-kenji-sato');
    });

    it('filters by regular expression: multi-user OR patterns (u1|u2|u3)', () => {
      // taro|hanako|kenji -> U01, U02, U03
      const orResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        userPattern: 'taro|hanako|kenji',
        userPatternIsRegex: true,
      });
      assert.strictEqual(orResult.users.length, 3);
      assert.deepStrictEqual(orResult.users.map((u) => u.login).sort(), [
        'dev-hanako',
        'dev-lead-taro',
        'sre-kenji-sato',
      ]);
    });

    it('filters by regular expression against Japanese display names', () => {
      // ^(田中|佐藤).* -> U01 (田中 太郎), U03 (佐藤 健二)
      const jpResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        userPattern: '^(田中|佐藤).*',
        userPatternIsRegex: true,
      });
      assert.strictEqual(jpResult.users.length, 2);
      assert.deepStrictEqual(jpResult.users.map((u) => u.login).sort(), [
        'dev-lead-taro',
        'sre-kenji-sato',
      ]);
    });

    it('filters by negative lookahead regular expressions', () => {
      // ^(?!(dev-|田中|鈴木)).* -> excludes users matching dev- / 田中 / 鈴木 on both login and display_name
      const negResult = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        userPattern: '^(?!(dev-|田中|鈴木)).*',
        userPatternIsRegex: true,
      });
      // 13 - 2 (dev-lead-taro, dev-hanako) = 11 users
      assert.strictEqual(negResult.users.length, 11);
      const logins = negResult.users.map((u) => u.login);
      assert.ok(!logins.includes('dev-lead-taro'));
      assert.ok(!logins.includes('dev-hanako'));
    });

    it('guards against regex syntax errors and ReDoS attacks', () => {
      // Syntax error validation
      const syntaxCheck = validatePattern('^(dev-[a-z', true);
      assert.strictEqual(syntaxCheck.isValid, false);
      assert.ok(syntaxCheck.error?.includes('正規表現構文エラー'));

      // Safe matching gracefully returns false on syntax error without throwing
      assert.strictEqual(safeMatchPattern('dev-lead-taro', '^(dev-[a-z', true), false);

      // ReDoS pattern rejection
      const redosCheck = validatePattern('((a+)+)+$', true);
      assert.strictEqual(redosCheck.isValid, false);
      assert.ok(redosCheck.error?.includes('ReDoS'));
    });
  });

  describe('Cross-cutting: Multi-Axis AND Combinations & Edge Cases (複合AND & エッジケース)', () => {
    const scopeData = dataset.monthlyScopes['2026-09'];

    it('strictly narrows down to a single user with 5-axis AND criteria', () => {
      // 5-axis criteria targeting U01 (dev-lead-taro):
      // CostCenter: FinTech-Division
      // Org: proud-fintech
      // Group: コア決済基盤チーム
      // Tags: ['backend', 'lead']
      // UserPattern: ^dev-lead.*
      const strict5AxisCriteria: FilterCriteria = {
        costCenter: 'FinTech-Division',
        organization: 'proud-fintech',
        group: 'コア決済基盤チーム',
        tags: ['backend', 'lead'],
        userPattern: '^dev-lead.*',
        userPatternIsRegex: true,
      };

      const result = applyFilterCriteriaToLiveScope(scopeData, strict5AxisCriteria);
      assert.strictEqual(result.users.length, 1);
      assert.strictEqual(result.users[0].login, 'dev-lead-taro');
      assert.strictEqual(result.overview.total_seats, 1);
    });

    it('returns 0 users if even a single AND criterion mismatches', () => {
      // Same as above, but CostCenter changed to 'Enterprise-IT'
      const mismatchedCriteria: FilterCriteria = {
        costCenter: 'Enterprise-IT', // Mismatch! U01 is FinTech-Division
        organization: 'proud-fintech',
        group: 'コア決済基盤チーム',
        tags: ['backend', 'lead'],
        userPattern: '^dev-lead.*',
        userPatternIsRegex: true,
      };

      const result = applyFilterCriteriaToLiveScope(scopeData, mismatchedCriteria);
      assert.strictEqual(result.users.length, 0);
      assert.strictEqual(result.overview.total_seats, 0);
      assert.strictEqual(result.overview.active_users, 0);
    });

    it('isolates the completely unassigned user using multiple __unassigned__ criteria', () => {
      // Targeting U12 (ghost-anonymous):
      // costCenter: __unassigned__
      // organization: __unassigned__
      // group: __unassigned__
      // userPattern: ghost
      const unassignedCriteria: FilterCriteria = {
        costCenter: '__unassigned__',
        organization: '__unassigned__',
        group: '__unassigned__',
        tags: [],
        userPattern: 'ghost',
        userPatternIsRegex: false,
      };

      const result = applyFilterCriteriaToLiveScope(scopeData, unassignedCriteria);
      assert.strictEqual(result.users.length, 1);
      assert.strictEqual(result.users[0].login, 'ghost-anonymous');
      assert.ok(!result.users[0].cost_center);
      assert.ok(!result.users[0].organization);
    });
  });

  describe('Architectural Guarantees: Derived Metric Completeness & Key Uniqueness (SDD-15)', () => {
    const scopeData = dataset.monthlyScopes['2026-09'];

    it('recalculates group summaries and budget overviews completely without data leakage', () => {
      // Filter for FinTech-Division (5 users: 4 active, 1 idle)
      const filtered = applyFilterCriteriaToLiveScope(scopeData, {
        ...DEFAULT_FILTER_CRITERIA,
        costCenter: 'FinTech-Division',
      });

      // 1. Overview seats
      assert.strictEqual(filtered.overview.total_seats, 5);
      assert.strictEqual(filtered.overview.active_users, 4);
      assert.strictEqual(filtered.overview.idle_seats, 1);
      assert.strictEqual(filtered.overview.total_spend_usd, 5 * 39);
      assert.strictEqual(filtered.overview.idle_waste_usd, 1 * 39);

      // 2. Department rollups: only departments with filtered users exist
      const deptKeys = Object.keys(filtered.by_department || {});
      assert.ok(deptKeys.includes('コア決済基盤チーム'));
      assert.ok(deptKeys.includes('モバイルアプリ開発部'));
      assert.ok(!deptKeys.includes('LLM応用プロダクトG')); // Filtered out!

      // 3. User profiles are also filtered to matching logins
      assert.strictEqual(filtered.user_profiles?.length, 5);
      const profileLogins = filtered.user_profiles?.map((p) => p.login).sort();
      assert.deepStrictEqual(profileLogins, [
        'contractor-alex',
        'contractor-carol',
        'dev-lead-taro',
        'mobile-yuki',
        'super-fullstack',
      ]);
    });

    it('produces unique datasetVersionKey for every change across source, scope, and filters', () => {
      const baseKey = generateDatasetVersionKey('live_metrics', '2026-09', DEFAULT_FILTER_CRITERIA);

      // 1. Scope change (monthly)
      const monthKey = generateDatasetVersionKey('live_metrics', '2026-08', DEFAULT_FILTER_CRITERIA);
      assert.notStrictEqual(baseKey, monthKey);

      // 2. Scope change (daily)
      const dailyKey = generateDatasetVersionKey('live_metrics', '2026-09-10', DEFAULT_FILTER_CRITERIA);
      assert.notStrictEqual(baseKey, dailyKey);

      // 3. CostCenter change
      const ccKey = generateDatasetVersionKey('live_metrics', '2026-09', {
        ...DEFAULT_FILTER_CRITERIA,
        costCenter: 'FinTech-Division',
      });
      assert.notStrictEqual(baseKey, ccKey);

      // 4. Org change
      const orgKey = generateDatasetVersionKey('live_metrics', '2026-09', {
        ...DEFAULT_FILTER_CRITERIA,
        organization: 'proud-fintech',
      });
      assert.notStrictEqual(baseKey, orgKey);

      // 5. Group change
      const groupKey = generateDatasetVersionKey('live_metrics', '2026-09', {
        ...DEFAULT_FILTER_CRITERIA,
        group: 'コア決済基盤チーム',
      });
      assert.notStrictEqual(baseKey, groupKey);

      // 6. Tag change
      const tagKey = generateDatasetVersionKey('live_metrics', '2026-09', {
        ...DEFAULT_FILTER_CRITERIA,
        tags: ['backend'],
      });
      assert.notStrictEqual(baseKey, tagKey);

      // 7. Regex pattern change
      const regexKey = generateDatasetVersionKey('live_metrics', '2026-09', {
        ...DEFAULT_FILTER_CRITERIA,
        userPattern: '^dev-.*',
        userPatternIsRegex: true,
      });
      assert.notStrictEqual(baseKey, regexKey);
    });

    it('generates summary badges and condition counters consistently for all criteria', () => {
      const complexCriteria: FilterCriteria = {
        costCenter: 'FinTech-Division',
        organization: 'proud-fintech',
        group: 'コア決済基盤チーム',
        tags: ['backend', 'lead'],
        userPattern: '^dev-.*',
        userPatternIsRegex: true,
      };

      assert.strictEqual(isFilterCriteriaActive(complexCriteria), true);

      const badges = getFilterSummaryBadges(complexCriteria);
      // costCenter, org, group, tag:backend, tag:lead, userPattern = 6 badges
      assert.strictEqual(badges.length, 6);
      assert.ok(badges.some((b) => b.label.includes('FinTech-Division')));
      assert.ok(badges.some((b) => b.label.includes('proud-fintech')));
      assert.ok(badges.some((b) => b.label.includes('コア決済基盤チーム')));
      assert.ok(badges.some((b) => b.label === 'backend'));
      assert.ok(badges.some((b) => b.label === 'lead'));
      assert.ok(badges.some((b) => b.label.includes('^dev-.*')));
    });
  });

  describe('UI Real-Time Preview Stats Verification with Test Dataset (モーダルプレビュー件数検証)', () => {
    const scopeData = dataset.monthlyScopes['2026-09'];

    // Helper simulating DataSelectionModal previewStats calculation
    function computeModalPreviewStats(criteria: FilterCriteria) {
      const users = scopeData.users;
      const totalCount = users.length;
      const matchedCount = users.filter((u) => matchUserWithCriteria(u, criteria)).length;
      return { totalCount, matchedCount };
    }

    it('computes exact preview counts for all selection patterns against test dataset', () => {
      // 1. Default (unfiltered) -> 13 / 13
      assert.deepStrictEqual(computeModalPreviewStats(DEFAULT_FILTER_CRITERIA), {
        totalCount: 13,
        matchedCount: 13,
      });

      // 2. Specific CostCenter -> 5 / 13
      assert.deepStrictEqual(
        computeModalPreviewStats({ ...DEFAULT_FILTER_CRITERIA, costCenter: 'FinTech-Division' }),
        { totalCount: 13, matchedCount: 5 }
      );

      // 3. Unassigned CostCenter -> 2 / 13
      assert.deepStrictEqual(
        computeModalPreviewStats({ ...DEFAULT_FILTER_CRITERIA, costCenter: '__unassigned__' }),
        { totalCount: 13, matchedCount: 2 }
      );

      // 4. Specific Org -> 5 / 13
      assert.deepStrictEqual(
        computeModalPreviewStats({ ...DEFAULT_FILTER_CRITERIA, organization: 'proud-fintech' }),
        { totalCount: 13, matchedCount: 5 }
      );

      // 5. Unassigned Org -> 2 / 13
      assert.deepStrictEqual(
        computeModalPreviewStats({ ...DEFAULT_FILTER_CRITERIA, organization: '__unassigned__' }),
        { totalCount: 13, matchedCount: 2 }
      );

      // 6. Specific Group -> 5 / 13
      assert.deepStrictEqual(
        computeModalPreviewStats({ ...DEFAULT_FILTER_CRITERIA, group: 'コア決済基盤チーム' }),
        { totalCount: 13, matchedCount: 5 }
      );

      // 7. Unassigned Group -> 2 / 13
      assert.deepStrictEqual(
        computeModalPreviewStats({ ...DEFAULT_FILTER_CRITERIA, group: '__unassigned__' }),
        { totalCount: 13, matchedCount: 2 }
      );

      // 8. Multi-Tag AND -> 2 / 13
      assert.deepStrictEqual(
        computeModalPreviewStats({ ...DEFAULT_FILTER_CRITERIA, tags: ['backend', 'lead'] }),
        { totalCount: 13, matchedCount: 2 }
      );

      // 9. Regex prefix -> 2 / 13
      assert.deepStrictEqual(
        computeModalPreviewStats({
          ...DEFAULT_FILTER_CRITERIA,
          userPattern: '^dev-.*',
          userPatternIsRegex: true,
        }),
        { totalCount: 13, matchedCount: 2 }
      );

      // 10. Complete unassigned user isolation -> 1 / 13
      assert.deepStrictEqual(
        computeModalPreviewStats({
          costCenter: '__unassigned__',
          organization: '__unassigned__',
          group: '__unassigned__',
          tags: [],
          userPattern: 'ghost',
          userPatternIsRegex: false,
        }),
        { totalCount: 13, matchedCount: 1 }
      );

      // 11. Impossible criteria (zero matches) -> 0 / 13
      assert.deepStrictEqual(
        computeModalPreviewStats({
          ...DEFAULT_FILTER_CRITERIA,
          tags: ['non-existent-impossible-tag'],
        }),
        { totalCount: 13, matchedCount: 0 }
      );
    });
  });
});
