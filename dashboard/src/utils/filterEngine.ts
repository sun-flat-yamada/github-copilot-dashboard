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
  // 1. Cost Center (組織・財務軸)
  if (criteria.costCenter !== 'all') {
    const userCc = (user.cost_center || '').trim();
    if (criteria.costCenter === '__unassigned__') {
      if (userCc && userCc !== 'Unassigned' && userCc !== '未設定') {
        return false;
      }
    } else {
      if (userCc !== criteria.costCenter) {
        return false;
      }
    }
  }

  // 2. Organization (組織・財務軸)
  if (criteria.organization !== 'all') {
    const userOrg = (user.organization || '').trim();
    if (criteria.organization === '__unassigned__') {
      if (userOrg && userOrg !== 'Unassigned' && userOrg !== '未設定') {
        return false;
      }
    } else {
      if (userOrg !== criteria.organization) {
        return false;
      }
    }
  }

  // 3. ユーザー定義グループ / Department (プロジェクト・属性軸)
  if (criteria.group !== 'all') {
    const userGroup = (user.department || '').trim();
    if (criteria.group === '__unassigned__') {
      if (userGroup && userGroup !== 'Unassigned' && userGroup !== '未設定') {
        return false;
      }
    } else {
      if (userGroup !== criteria.group) {
        return false;
      }
    }
  }

  // 4. Tag (プロジェクト・属性軸 - AND一致)
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
      criteria.costCenter === '__unassigned__'
        ? 'CC: 未割当'
        : `CC: ${criteria.costCenter}`;
    badges.push({ key: 'costCenter', label: text, type: 'costCenter' });
  }

  if (criteria.organization !== 'all') {
    const text =
      criteria.organization === '__unassigned__'
        ? 'Org: 未割当'
        : `Org: ${criteria.organization}`;
    badges.push({ key: 'organization', label: text, type: 'organization' });
  }

  if (criteria.group !== 'all') {
    const text =
      criteria.group === '__unassigned__'
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
 */
function buildGroupSummaries(
  users: EnrichedUserSeat[],
  field: 'department' | 'cost_center' | 'organization'
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
        acceptance_rate: 0.35,
        total_suggestions: 0,
        total_acceptances: 0,
        total_chats: 0,
        total_pr_summaries: 0,
      };
    }
    res[key].total_seats += 1;
    if (u.status === 'active' || u.status === 'low_active') {
      res[key].active_seats += 1;
    }
    if (u.status === 'idle' || u.status === 'never_used') {
      res[key].idle_seats += 1;
      res[key].potential_savings_usd += u.monthly_cost_usd;
    }
    res[key].total_cost_usd += u.monthly_cost_usd;
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
 */
export function applyFilterCriteriaToLiveScope(
  data: ScopeAggregatedData,
  criteria: FilterCriteria
): ScopeAggregatedData {
  if (!isFilterCriteriaActive(criteria)) {
    return data;
  }

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

  // 3. overview 再計算
  const activeUsers = filteredUsers.filter(
    (u) => u.status === 'active' || u.status === 'low_active'
  ).length;
  const idleUsers = filteredUsers.filter(
    (u) => u.status === 'idle' || u.status === 'never_used'
  ).length;
  const totalSpend = filteredUsers.reduce(
    (sum, u) => sum + u.monthly_cost_usd,
    0
  );
  const idleWaste = filteredUsers
    .filter((u) => u.status === 'idle' || u.status === 'never_used')
    .reduce((sum, u) => sum + u.monthly_cost_usd, 0);

  // 4. グループ別再集計
  const byDept = buildGroupSummaries(filteredUsers, 'department');
  const byCostCenter = buildGroupSummaries(filteredUsers, 'cost_center');
  const byOrg = buildGroupSummaries(filteredUsers, 'organization');

  // 5. cost_center_budgets の更新
  const updatedBudgets = data.cost_center_budgets?.map((b) => {
    const matchingSpend = filteredUsers
      .filter((u) => (u.cost_center || '').trim() === b.cost_center_name)
      .reduce((sum, u) => sum + u.monthly_cost_usd, 0);
    return {
      ...b,
      net_billable_spend_usd: Number(matchingSpend.toFixed(2)),
      remaining_budget_usd: Number((b.spending_limit_usd - matchingSpend).toFixed(2)),
    };
  });

  return {
    ...data,
    overview: {
      ...data.overview,
      total_seats: filteredUsers.length,
      active_users: activeUsers,
      idle_seats: idleUsers,
      total_spend_usd: Number(totalSpend.toFixed(2)),
      idle_waste_usd: Number(idleWaste.toFixed(2)),
      active_ratio:
        filteredUsers.length > 0
          ? Number((activeUsers / filteredUsers.length).toFixed(2))
          : 0,
    },
    users: filteredUsers,
    user_profiles: filteredProfiles,
    by_department: byDept,
    by_cost_center: byCostCenter,
    by_organization: byOrg,
    cost_center_budgets: updatedBudgets,
  };
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
          potential_savings_usd: 0,
          active_ratio: 1.0,
          acceptance_rate: 0.35,
          total_suggestions: 0,
          total_acceptances: 0,
          total_chats: 0,
          total_pr_summaries: 0,
        };
      }
      res[key].total_seats += 1;
      res[key].active_seats += 1;
      res[key].total_cost_usd += u.total_spend_usd;
      res[key].total_chats += u.total_requests;
    }
    for (const g of Object.values(res)) {
      g.total_cost_usd = Number(g.total_cost_usd.toFixed(2));
    }
    return res;
  };

  const byDept = buildReportGroupMap('department');
  const byCostCenter = buildReportGroupMap('cost_center');
  const byOrg = buildReportGroupMap('organization');

  // 4. model_breakdown 再集計
  const filteredModelBreakdown = buildFilteredModelBreakdown(filteredUsers);

  return {
    ...data,
    overview: {
      ...data.overview,
      total_active_users: filteredUsers.length,
      total_net_spend_usd: Number(totalNetSpend.toFixed(2)),
      total_gross_spend_usd: Number(totalGrossSpend.toFixed(2)),
      total_discount_usd: Number(totalDiscount.toFixed(2)),
      total_requests: totalRequests,
    },
    user_details: filteredUsers,
    by_department: byDept,
    by_cost_center: byCostCenter,
    by_organization: byOrg,
    model_breakdown: filteredModelBreakdown,
  };
}

export const computeDatasetVersionKey = generateDatasetVersionKey;

