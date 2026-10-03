/**
 * Analysis Dataset Filtering Engine & Reactivity Guarantees
 *
 * Implements SDD-15 (Data-Centric Reactivity Design Specification) as pure functions:
 * 1. Safe Pattern Matching & ReDoS protection
 * 2. Multi-axis AND condition evaluation (CostCenter, Org, Group, Tags, User)
 * 3. Derived aggregate completeness (Zero un-filtered pass-through)
 * 4. Deterministic dataset version keying for root-level re-render guarantees
 */

import {
  FilterCriteria,
  ScopeAggregatedData,
  MonthlyReportAggregatedData,
  EnrichedUserSeat,
  GroupSummary,
  DataSourceType,
} from '../../../src/types/copilot';
import { buildFilteredModelBreakdown } from './reportModelBreakdown';
import { UNASSIGNED_FILTER_SENTINEL, isUnassignedValue } from '../../../src/domain/constants/unassigned';
import { LIVE_UNFILTERABLE_SECTIONS, REPORT_UNFILTERABLE_SECTIONS } from '../../../src/domain/constants/filter-scope';
import { seatCostForScope } from '../../../src/domain/rules/ScopeCostRule';
import { BudgetUtilizationRule } from '../../../src/domain/rules/BudgetUtilizationRule';
import { isActiveSeatStatus, isIdleSeatStatus } from '../../../src/domain/rules/SeatClassificationRule';

/**
 * 最大許容正規表現長 (ReDoS緩和)
 */
export const MAX_REGEX_PATTERN_LENGTH = 100;

/**
 * パターン妥当性の検証
 */
export function validatePattern(
  pattern: string,
  isRegex: boolean
): { isValid: boolean; error?: string } {
  if (!pattern || !pattern.trim()) {
    return { isValid: true };
  }

  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    return {
      isValid: false,
      error: `パターンが長すぎます (最大 ${MAX_REGEX_PATTERN_LENGTH} 文字)`,
    };
  }

  if (!isRegex) {
    return { isValid: true };
  }

  // ReDoS (Catastrophic Backtracking) の原因となるネストされた量化子を事前検知
  if (/(\+|\*)\)+(\+|\*)/.test(pattern)) {
    return {
      isValid: false,
      error: '潜在的な ReDoS の危険があるため、ネストされた量化子は使用できません',
    };
  }

  try {
    new RegExp(pattern, 'i');
    return { isValid: true };
  } catch (err: any) {
    return {
      isValid: false,
      error: `正規表現構文エラー: ${err.message || '無効な構文です'}`,
    };
  }
}

/**
 * 安全なパターンマッチング (ReDoS耐性・大文字小文字無視・try/catch保護)
 */
export function safeMatchPattern(
  text: string,
  pattern: string,
  isRegex: boolean
): boolean {
  if (!pattern || !pattern.trim()) return true;
  if (!text) return false;

  const trimmed = pattern.trim();
  if (trimmed.length > MAX_REGEX_PATTERN_LENGTH) return false;

  if (!isRegex) {
    return text.toLowerCase().includes(trimmed.toLowerCase());
  }

  try {
    const regex = new RegExp(trimmed, 'i');
    return regex.test(text);
  } catch {
    // 構文エラー時は安全に false を返す
    return false;
  }
}

/**
 * 汎用ユーザー属性インターフェース
 */
export interface FilterableUser {
  login: string;
  display_name?: string;
  cost_center?: string;
  organization?: string;
  department?: string;
  tags?: string[];
}

/**
 * 単一ユーザーが FilterCriteria の全 AND 条件を満たすかを判定
 */
export function matchUserWithCriteria(
  user: FilterableUser,
  criteria: FilterCriteria
): boolean {
  // 「未割当」はセンチネル値で指定する。判定は isUnassignedValue (パイプラインが出力する
  // Default-CostCenter / Unassigned-CC / 未分類 (Unassigned) / Default-Org 等を含む単一の定義) に統一する。
  const matchesAxis = (criterion: string, actual: string | undefined): boolean => {
    if (criterion === 'all') return true;
    const value = (actual || '').trim();
    if (criterion === UNASSIGNED_FILTER_SENTINEL) return isUnassignedValue(value);
    return value === criterion;
  };

  // 1. Cost Center (組織・財務軸)
  if (!matchesAxis(criteria.costCenter, user.cost_center)) return false;

  // 2. Organization (組織・財務軸)
  if (!matchesAxis(criteria.organization, user.organization)) return false;

  // 3. ユーザー定義Gr / Department (プロジェクト・部署軸)
  if (!matchesAxis(criteria.group, user.department)) return false;

  // 4. Tag (タグ・属性軸 - AND一致)
  if (criteria.tags && criteria.tags.length > 0) {
    const userTags = user.tags || [];
    const allTagsPresent = criteria.tags.every((t) => userTags.includes(t));
    if (!allTagsPresent) {
      return false;
    }
  }

  // 5. ユーザーパターン / 正規表現 (アカウント・個別軸)
  if (criteria.userPattern && criteria.userPattern.trim()) {
    const matchLogin = safeMatchPattern(
      user.login,
      criteria.userPattern,
      criteria.userPatternIsRegex
    );
    const matchName = safeMatchPattern(
      user.display_name || '',
      criteria.userPattern,
      criteria.userPatternIsRegex
    );
    if (!matchLogin && !matchName) {
      return false;
    }
  }

  return true;
}

/**
 * フィルター条件が初期状態（すべて）から変更されているかを判定
 */
export function isFilterCriteriaActive(criteria: FilterCriteria): boolean {
  if (criteria.costCenter !== 'all') return true;
  if (criteria.organization !== 'all') return true;
  if (criteria.group !== 'all') return true;
  if (criteria.tags && criteria.tags.length > 0) return true;
  if (criteria.userPattern && criteria.userPattern.trim() !== '') return true;
  return false;
}

/**
 * 適用中のアクティブ条件数をカウント
 */
export function countActiveFilterConditions(criteria: FilterCriteria): number {
  let count = 0;
  if (criteria.costCenter !== 'all') count++;
  if (criteria.organization !== 'all') count++;
  if (criteria.group !== 'all') count++;
  if (criteria.tags && criteria.tags.length > 0) count += criteria.tags.length;
  if (criteria.userPattern && criteria.userPattern.trim() !== '') count++;
  return count;
}
export type FilterBadgeCategory =
  | 'costCenter'
  | 'organization'
  | 'group'
  | 'tag'
  | 'user'
  | 'org';

export interface FilterSummaryBadge {
  key: string;
  label: string;
  type: FilterBadgeCategory;
}

/**
 * ヘッダー用の要約ラベル一覧を生成
 */
export function getFilterSummaryBadges(
  criteria: FilterCriteria
): FilterSummaryBadge[] {
  const badges: FilterSummaryBadge[] = [];

  if (criteria.costCenter !== 'all') {
    const text =
      criteria.costCenter === UNASSIGNED_FILTER_SENTINEL
        ? 'CC: 未割当'
        : `CC: ${criteria.costCenter}`;
    badges.push({ key: 'costCenter', label: text, type: 'costCenter' });
  }

  if (criteria.organization !== 'all') {
    const text =
      criteria.organization === UNASSIGNED_FILTER_SENTINEL
        ? 'Org: 未割当'
        : `Org: ${criteria.organization}`;
    badges.push({ key: 'organization', label: text, type: 'organization' });
  }

  if (criteria.group !== 'all') {
    const text =
      criteria.group === UNASSIGNED_FILTER_SENTINEL
        ? '部署: 未割当'
        : `部署: ${criteria.group}`;
    badges.push({ key: 'group', label: text, type: 'group' });
  }

  if (criteria.tags && criteria.tags.length > 0) {
    for (const tag of criteria.tags) {
      badges.push({ key: `tag:${tag}`, label: tag, type: 'tag' });
    }
  }

  if (criteria.userPattern && criteria.userPattern.trim() !== '') {
    const prefix = criteria.userPatternIsRegex ? '/' : '';
    const suffix = criteria.userPatternIsRegex ? '/' : '';
    badges.push({
      key: 'userPattern',
      label: `👤 ${prefix}${criteria.userPattern.trim()}${suffix}`,
      type: 'user',
    });
  }

  return badges;
}

/**
 * 決定論的なデータセットバージョンキーを生成
 * (データソース + スコープ + フィルター条件の組み合わせから一意の文字列を生成)
 */
export function generateDatasetVersionKey(
  source: DataSourceType,
  scopeKey: string,
  criteria: FilterCriteria
): string {
  const tagsSorted = [...(criteria.tags || [])].sort().join(',');
  return [
    source,
    scopeKey,
    `cc=${criteria.costCenter}`,
    `org=${criteria.organization}`,
    `grp=${criteria.group}`,
    `tags=${tagsSorted}`,
    `pat=${criteria.userPattern}:${criteria.userPatternIsRegex ? '1' : '0'}`,
  ].join('|');
}

/**
 * グループ集計ビルダー (SDD-15 §3.2 完全性原則)
 *
 * シート・費用に関する項目だけを再集計する。利用指標 (受諾率・提案数・チャット数等) は
 * ユーザー別の実測を持たないため再計算できず、固定値 (旧: 受諾率 0.35) で埋めずに null とする。
 * 費用はスコープ種別 (日次 / 月次 / 期間) に応じて算出し、フィルターの有無で単位が変わらないようにする。
 */
function buildGroupSummaries(
  users: EnrichedUserSeat[],
  field: 'department' | 'cost_center' | 'organization',
  scopeType: ScopeAggregatedData['scope_type'],
  daysCount: number
): Record<string, GroupSummary> {
  const res: Record<string, GroupSummary> = {};
  for (const u of users) {
    const key = (u[field] || '').trim() || 'Unassigned';
    if (!res[key]) {
      res[key] = {
        group_name: key,
        total_seats: 0,
        active_seats: 0,
        idle_seats: 0,
        total_cost_usd: 0,
        potential_savings_usd: 0,
        active_ratio: 0,
        acceptance_rate: null,
        total_suggestions: null,
        total_acceptances: null,
        total_chats: null,
        total_pr_summaries: null,
      };
    }
    const cost = seatCostForScope(u, scopeType, daysCount);
    res[key].total_seats += 1;
    if (isActiveSeatStatus(u.status)) {
      res[key].active_seats += 1;
    }
    if (isIdleSeatStatus(u.status)) {
      res[key].idle_seats += 1;
      res[key].potential_savings_usd += cost;
    }
    res[key].total_cost_usd += cost;
  }

  for (const g of Object.values(res)) {
    g.active_ratio =
      g.total_seats > 0 ? Number((g.active_seats / g.total_seats).toFixed(2)) : 0;
    g.total_cost_usd = Number(g.total_cost_usd.toFixed(2));
    g.potential_savings_usd = Number(g.potential_savings_usd.toFixed(2));
  }

  return res;
}

/**
 * Live Metrics (自動定期収集データ) への FilterCriteria 適用
 * SDD-15 準拠: 全派生フィールドを完全再計算
 *
 * - 費用はスコープ種別 (daily / monthly / custom) に応じて再計算する (seatCostForScope)。
 *   旧実装は常に月額で再計算しており、日次・期間スコープでも月額に変わっていた。
 * - Cost Center 予算は BudgetUtilizationRule (唯一の実装) で再評価し、使用率・ステータスも更新する。
 * - 利用状況メトリクス・日次推移・言語別などユーザー別の実測を持たないセクションは再集計できないため、
 *   全社値のまま残し、filter_notice で「フィルター非対応」を明示する。
 */
export function applyFilterCriteriaToLiveScope(
  data: ScopeAggregatedData,
  criteria: FilterCriteria
): ScopeAggregatedData {
  if (!isFilterCriteriaActive(criteria)) {
    return data;
  }

  const scopeType = data.scope_type;
  const daysCount = data.date_range?.days_count ?? 1;

  // 1. users 絞り込み
  const filteredUsers = data.users.filter((u) =>
    matchUserWithCriteria(u, criteria)
  );
  const matchingLogins = new Set(
    filteredUsers.map((u) => u.login.toLowerCase())
  );

  // 2. user_profiles 絞り込み
  const filteredProfiles = data.user_profiles?.filter((p) =>
    matchingLogins.has(p.login.toLowerCase())
  );

  // 3. overview 再計算 (費用はスコープ種別に応じた単位)
  const costOf = (u: EnrichedUserSeat) => seatCostForScope(u, scopeType, daysCount);
  const activeUsers = filteredUsers.filter((u) => isActiveSeatStatus(u.status)).length;
  const idleUsers = filteredUsers.filter((u) => isIdleSeatStatus(u.status)).length;
  const onboardingUsers = filteredUsers.filter((u) => u.status === 'onboarding').length;
  const costUnconfirmedUsers = filteredUsers.filter((u) => u.cost_unconfirmed).length;
  const totalSpend = filteredUsers.reduce((sum, u) => sum + costOf(u), 0);
  const idleWaste = filteredUsers
    .filter((u) => isIdleSeatStatus(u.status))
    .reduce((sum, u) => sum + costOf(u), 0);

  // 4. グループ別再集計
  const byDept = buildGroupSummaries(filteredUsers, 'department', scopeType, daysCount);
  const byCostCenter = buildGroupSummaries(filteredUsers, 'cost_center', scopeType, daysCount);
  const byOrg = buildGroupSummaries(filteredUsers, 'organization', scopeType, daysCount);

  // 5. cost_center_budgets の更新 (予算は月次の枠なので、評価に使う使用額は月額ベース = パイプラインと同じ基準)
  const updatedBudgets = data.cost_center_budgets?.map((b) => {
    const matchingSpend = filteredUsers
      .filter((u) => (u.cost_center || '').trim() === b.cost_center_name)
      .reduce((sum, u) => sum + u.monthly_cost_usd, 0);
    return {
      ...b,
      current_spend_usd: Number(matchingSpend.toFixed(2)),
      ...BudgetUtilizationRule.evaluateUsd(b.spending_limit_usd, b.free_tier_budget_usd ?? 0, matchingSpend),
    };
  });

  const { onboarding_seats: _onboarding, cost_unconfirmed_seats: _unconfirmed, ...overviewRest } = data.overview;

  return {
    ...data,
    overview: {
      ...overviewRest,
      total_seats: filteredUsers.length,
      active_users: activeUsers,
      idle_seats: idleUsers,
      ...(onboardingUsers > 0 ? { onboarding_seats: onboardingUsers } : {}),
      ...(costUnconfirmedUsers > 0 ? { cost_unconfirmed_seats: costUnconfirmedUsers } : {}),
      total_spend_usd: Number(totalSpend.toFixed(2)),
      idle_waste_usd: Number(idleWaste.toFixed(2)),
      active_ratio:
        filteredUsers.length > 0
          ? Number((activeUsers / filteredUsers.length).toFixed(2))
          : 0,
      ...(updatedBudgets && updatedBudgets.length > 0
        ? {
            total_net_billable_usd: Number(
              updatedBudgets.reduce((sum, b) => sum + b.net_billable_spend_usd, 0).toFixed(2)
            ),
          }
        : {}),
    },
    users: filteredUsers,
    user_profiles: filteredProfiles,
    by_department: byDept,
    by_cost_center: byCostCenter,
    by_organization: byOrg,
    ...(data.by_team
      ? { by_team: buildTeamSummaries(filteredUsers, scopeType, daysCount) }
      : {}),
    cost_center_budgets: updatedBudgets,
    filter_notice: { unfiltered_sections: [...LIVE_UNFILTERABLE_SECTIONS] },
  };
}

/** チーム別 (teams[0]) の再集計。パイプライン (MetricsAggregator) と同じキー導出 */
function buildTeamSummaries(
  users: EnrichedUserSeat[],
  scopeType: ScopeAggregatedData['scope_type'],
  daysCount: number
): Record<string, GroupSummary> {
  const withTeamKey = users.map((u) => ({
    ...u,
    department: u.teams && u.teams.length > 0 ? u.teams[0] : 'General',
  }));
  return buildGroupSummaries(withTeamKey, 'department', scopeType, daysCount);
}

/**
 * Monthly Usage Report (確定月次レポート/オンデマンドCSV) への FilterCriteria 適用
 * SDD-15 準拠: overview, user_details, by_department, by_cost_center, by_organization, model_breakdown 完全再計算
 */
export function applyFilterCriteriaToMonthlyReport(
  data: MonthlyReportAggregatedData,
  criteria: FilterCriteria
): MonthlyReportAggregatedData {
  if (!isFilterCriteriaActive(criteria)) {
    return data;
  }

  // 1. user_details 絞り込み
  const filteredUsers = data.user_details.filter((u) => {
    const userItem: FilterableUser = {
      login: u.login,
      display_name: u.display_name,
      cost_center: u.cost_center,
      organization: u.organization,
      department: u.department,
      tags: u.tags,
    };
    return matchUserWithCriteria(userItem, criteria);
  });

  // 2. overview 再計算
  const totalNetSpend = filteredUsers.reduce(
    (sum, u) => sum + (u.net_spend_usd ?? u.total_spend_usd),
    0
  );
  const totalGrossSpend = filteredUsers.reduce(
    (sum, u) => sum + (u.gross_spend_usd ?? u.total_spend_usd),
    0
  );
  const totalDiscount = totalGrossSpend - totalNetSpend;
  const totalRequests = filteredUsers.reduce(
    (sum, u) => sum + u.total_requests,
    0
  );

  // 3. グループ別再集計 (department, cost_center, organization)
  //    月次レポート CSV には提案数・受諾数・チャット数が存在しないため、これらは null (旧: 受諾率 0.35 の固定値、
  //    リクエスト数を提案数・チャット数へ代入していた)。リクエスト数は total_requests に保持する。
  const buildReportGroupMap = (field: 'department' | 'cost_center' | 'organization') => {
    const res: Record<string, GroupSummary> = {};
    for (const u of filteredUsers) {
      const key = (u[field] || '').trim() || 'Unassigned';
      if (!res[key]) {
        res[key] = {
          group_name: key,
          total_seats: 0,
          active_seats: 0,
          idle_seats: 0,
          total_cost_usd: 0,
          net_cost_usd: 0,
          potential_savings_usd: 0,
          active_ratio: 1.0,
          acceptance_rate: null,
          total_suggestions: null,
          total_acceptances: null,
          total_chats: null,
          total_pr_summaries: null,
          total_requests: 0,
        };
      }
      res[key].total_seats += 1;
      res[key].active_seats += 1;
      res[key].total_cost_usd += u.gross_spend_usd ?? u.total_spend_usd;
      res[key].net_cost_usd = (res[key].net_cost_usd ?? 0) + (u.net_spend_usd ?? u.total_spend_usd);
      res[key].total_requests = (res[key].total_requests ?? 0) + u.total_requests;
    }
    for (const g of Object.values(res)) {
      g.total_cost_usd = Number(g.total_cost_usd.toFixed(2));
      g.net_cost_usd = Number((g.net_cost_usd ?? 0).toFixed(2));
    }
    return res;
  };

  const byDept = buildReportGroupMap('department');
  const byCostCenter = buildReportGroupMap('cost_center');
  const byOrg = buildReportGroupMap('organization');

  // 4. model_breakdown 再集計
  const filteredModelBreakdown = buildFilteredModelBreakdown(filteredUsers);

  // 単位別の数量 (quantity_by_unit) はユーザー明細から再計算できないため、絞り込み後は出力しない
  const { quantity_by_unit: _quantityByUnit, ...overviewRest } = data.overview;

  return {
    ...data,
    overview: {
      ...overviewRest,
      total_active_users: filteredUsers.length,
      total_net_spend_usd: Number(totalNetSpend.toFixed(2)),
      total_gross_spend_usd: Number(totalGrossSpend.toFixed(2)),
      total_discount_usd: Number(totalDiscount.toFixed(2)),
      total_requests: totalRequests,
      top_model: filteredModelBreakdown[0]?.model_name || 'N/A',
    },
    user_details: filteredUsers,
    by_department: byDept,
    by_cost_center: byCostCenter,
    by_organization: byOrg,
    model_breakdown: filteredModelBreakdown,
    // 日別推移・SKU 内訳はユーザー別の明細を持たないため再集計できない (全体値のまま)。画面で明示する
    filter_notice: { unfiltered_sections: [...REPORT_UNFILTERABLE_SECTIONS] },
  };
}

export const computeDatasetVersionKey = generateDatasetVersionKey;

