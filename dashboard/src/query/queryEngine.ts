/**
 * Query 層 (SDD-15 §7 / ADR-0001)
 *
 * 全ビューが同じ「Dataset + FilterCriteria → 結果」の契約を使うための入口。
 * フィルターの判定 (matchUserWithCriteria) と再集計 (applyFilterCriteriaTo*) は ./filterEngine の
 * 唯一の実装で、この層はそれを呼ぶだけ。ビューや hook はフィルターを再実装しない。
 *
 * フィルターに追従できない指標 (ユーザー別の実測を持たないセクション) は capabilities で明示する。
 * DuckDB-WASM による SQL 集計は ./duckdb/duckdbLoader を dynamic import で遅延ロードする (初期バンドルに含めない)。
 * 最初の利用ビューが入るまでは、どのビューからも参照しない (参照が無い間は配信物にも含まれない)。
 */

import type {
  DataSourceType,
  FilterCriteria,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
} from '../../../src/types/copilot';
import { LIVE_UNFILTERABLE_SECTIONS, REPORT_UNFILTERABLE_SECTIONS } from '../../../src/domain/constants/filter-scope';
import { isUnassignedValue } from '../../../src/domain/constants/unassigned';
import {
  applyFilterCriteriaToLiveScope,
  applyFilterCriteriaToMonthlyReport,
  isFilterCriteriaActive,
  matchUserWithCriteria,
  type FilterableUser,
} from './filterEngine';

/** クエリの対象。ソース種別とデータの組 (データ未取得は null) */
export type QueryDataset =
  | { source: 'live_metrics'; data: ScopeAggregatedData | null }
  | { source: Exclude<DataSourceType, 'live_metrics'>; data: MonthlyReportAggregatedData | null };

export interface QueryCapabilities {
  /** 条件に追従して再集計されるか (false = 全社値のまま) を、セクション名で明示する */
  unfilterableSections: readonly string[];
}

/** 該当件数 (画面間で共有する数値の契約) */
export interface PopulationResult {
  /** 条件に該当するユーザー数 */
  matched: number;
  /** 条件適用前のユーザー数 */
  total: number;
  /** 条件が 1 つでも指定されているか */
  filtered: boolean;
}

export interface FilterOptions {
  costCenters: string[];
  organizations: string[];
  groups: string[];
  tags: string[];
}

type ReportUser = MonthlyReportAggregatedData['user_details'][number];

function toFilterable(u: ReportUser): FilterableUser {
  return {
    login: u.login,
    display_name: u.display_name,
    cost_center: u.cost_center,
    organization: u.organization,
    department: u.department,
    tags: u.tags,
  };
}

/** データセットのフィルター対象ユーザー (Live は users、Report は user_details) */
function usersOf(dataset: QueryDataset): FilterableUser[] {
  if (!dataset.data) return [];
  return dataset.source === 'live_metrics'
    ? (dataset.data as ScopeAggregatedData).users
    : (dataset.data as MonthlyReportAggregatedData).user_details.map(toFilterable);
}

/** Live Metrics にフィルターを適用する (全派生フィールドを再集計) */
export function queryLiveScope(data: ScopeAggregatedData, criteria: FilterCriteria): ScopeAggregatedData {
  return applyFilterCriteriaToLiveScope(data, criteria);
}

/** Monthly Report / User Upload にフィルターを適用する (全派生フィールドを再集計) */
export function queryReport(
  data: MonthlyReportAggregatedData,
  criteria: FilterCriteria
): MonthlyReportAggregatedData {
  return applyFilterCriteriaToMonthlyReport(data, criteria);
}

/**
 * 条件に該当するユーザー数。どの画面も「該当 N / 全 M」をここから得る。
 * 判定はフィルターエンジンと同じ述語 (matchUserWithCriteria) なので、
 * 再集計後のユーザー数 (queryLiveScope / queryReport の結果) と必ず一致する。
 */
export function queryPopulation(dataset: QueryDataset, criteria: FilterCriteria): PopulationResult {
  const users = usersOf(dataset);
  const filtered = isFilterCriteriaActive(criteria);
  const matched = filtered ? users.filter((u) => matchUserWithCriteria(u, criteria)).length : users.length;
  return { matched, total: users.length, filtered };
}

/** フィルターの選択肢。未割当は専用の選択肢があるため含めない (isUnassignedValue) */
export function queryFilterOptions(dataset: QueryDataset): FilterOptions {
  const costCenters = new Set<string>();
  const organizations = new Set<string>();
  const groups = new Set<string>();
  const tags = new Set<string>();

  for (const u of usersOf(dataset)) {
    if (u.cost_center && !isUnassignedValue(u.cost_center)) costCenters.add(u.cost_center.trim());
    if (u.organization && !isUnassignedValue(u.organization)) organizations.add(u.organization.trim());
    if (u.department && !isUnassignedValue(u.department)) groups.add(u.department.trim());
    for (const t of u.tags || []) {
      if (t && t.trim()) tags.add(t.trim());
    }
  }

  return {
    costCenters: Array.from(costCenters).sort(),
    organizations: Array.from(organizations).sort(),
    groups: Array.from(groups).sort(),
    tags: Array.from(tags).sort(),
  };
}

/** そのソースでフィルターに追従しないセクション (全社値のまま表示される) */
export function queryCapabilities(source: DataSourceType): QueryCapabilities {
  return {
    unfilterableSections: source === 'live_metrics' ? LIVE_UNFILTERABLE_SECTIONS : REPORT_UNFILTERABLE_SECTIONS,
  };
}
