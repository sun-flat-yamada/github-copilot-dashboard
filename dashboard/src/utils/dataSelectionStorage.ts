import {
  AnalysisScopeType,
  DataSourceType,
  DEFAULT_FILTER_CRITERIA,
  FilterCriteria,
  IndexMetadata,
  MonthlyReportAggregatedData,
} from '../../../src/types/copilot';
import { DATA_SELECTION_STORAGE_KEY } from '../../../src/application/services/DemoModeService';
import { validatePattern } from '../query';

export { DATA_SELECTION_STORAGE_KEY };
export const UPLOADED_DATA_STORAGE_KEY = 'copilot_dashboard_uploaded_data';

export interface PersistedDataSelection {
  version: 1;
  activeSource: DataSourceType;
  scopeType: AnalysisScopeType;
  selectedKey: string;
  selectedReportMonth: string;
  filterCriteria: FilterCriteria;
  isDemoMode: boolean;
}

const VALID_SOURCES: ReadonlySet<string> = new Set<DataSourceType>([
  'live_metrics',
  'monthly_report',
  'user_upload',
]);

const VALID_SCOPE_TYPES: ReadonlySet<string> = new Set<AnalysisScopeType>([
  'monthly',
  'daily',
  'custom',
]);

/**
 * 任意の入力オブジェクトから安全な FilterCriteria を復元・正規化する。
 * 不正な正規表現パターンが含まれる場合はパターン条件のみ安全に初期化する。
 */
export function sanitizeFilterCriteria(raw: unknown): FilterCriteria {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FILTER_CRITERIA, tags: [] };
  }
  const obj = raw as Record<string, unknown>;
  const costCenter =
    typeof obj.costCenter === 'string' && obj.costCenter.trim().length > 0
      ? obj.costCenter
      : DEFAULT_FILTER_CRITERIA.costCenter;
  const organization =
    typeof obj.organization === 'string' && obj.organization.trim().length > 0
      ? obj.organization
      : DEFAULT_FILTER_CRITERIA.organization;
  const group =
    typeof obj.group === 'string' && obj.group.trim().length > 0
      ? obj.group
      : DEFAULT_FILTER_CRITERIA.group;
  const tags = Array.isArray(obj.tags)
    ? Array.from(
        new Set(
          obj.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        )
      )
    : [];

  let userPattern = typeof obj.userPattern === 'string' ? obj.userPattern : '';
  let userPatternIsRegex =
    typeof obj.userPatternIsRegex === 'boolean' ? obj.userPatternIsRegex : false;

  if (userPattern) {
    const validation = validatePattern(userPattern, userPatternIsRegex);
    if (!validation.isValid) {
      userPattern = '';
      userPatternIsRegex = false;
    }
  }

  return {
    costCenter,
    organization,
    group,
    tags,
    userPattern,
    userPatternIsRegex,
  };
}

/**
 * localStorage から最後に保存されたデータ選択状態を読み込む。
 */
export function loadPersistedDataSelection(): PersistedDataSelection | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(DATA_SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const activeSource: DataSourceType = VALID_SOURCES.has(parsed.activeSource)
      ? (parsed.activeSource as DataSourceType)
      : 'live_metrics';
    const scopeType: AnalysisScopeType = VALID_SCOPE_TYPES.has(parsed.scopeType)
      ? (parsed.scopeType as AnalysisScopeType)
      : 'monthly';
    const selectedKey = typeof parsed.selectedKey === 'string' ? parsed.selectedKey : '';
    const selectedReportMonth =
      typeof parsed.selectedReportMonth === 'string' ? parsed.selectedReportMonth : '';
    const filterCriteria = sanitizeFilterCriteria(parsed.filterCriteria);
    const isDemoMode = typeof parsed.isDemoMode === 'boolean' ? parsed.isDemoMode : false;

    return {
      version: 1,
      activeSource,
      scopeType,
      selectedKey,
      selectedReportMonth,
      filterCriteria,
      isDemoMode,
    };
  } catch {
    return null;
  }
}

/**
 * 現在のデータ選択状態を localStorage に保存する。
 */
export function savePersistedDataSelection(
  selection: Omit<PersistedDataSelection, 'version'>
): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const payload: PersistedDataSelection = {
      version: 1,
      ...selection,
    };
    window.localStorage.setItem(DATA_SELECTION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // セキュリティサンドボックスや容量超過時は無視
  }
}

/**
 * localStorage からオンデマンドCSVの集計済みデータを復元する。
 */
export function loadPersistedUploadedData(): MonthlyReportAggregatedData | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(UPLOADED_DATA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.report_month !== 'string' ||
      !parsed.overview ||
      typeof parsed.overview !== 'object' ||
      !Array.isArray(parsed.user_details) ||
      !Array.isArray(parsed.model_breakdown) ||
      !Array.isArray(parsed.sku_breakdown) ||
      !Array.isArray(parsed.daily_trends)
    ) {
      return null;
    }
    return parsed as MonthlyReportAggregatedData;
  } catch {
    return null;
  }
}

/**
 * オンデマンドCSVの集計済みデータを localStorage に保存（null の場合は削除）する。
 * 容量制限 (QuotaExceededError) 時はデータキーを削除し false を返す。
 */
export function savePersistedUploadedData(data: MonthlyReportAggregatedData | null): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    if (data === null) {
      window.localStorage.removeItem(UPLOADED_DATA_STORAGE_KEY);
      return true;
    }
    window.localStorage.setItem(UPLOADED_DATA_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    try {
      window.localStorage.removeItem(UPLOADED_DATA_STORAGE_KEY);
    } catch {
      // ignore
    }
    return false;
  }
}

/**
 * index.json のメタデータと保存済みスコープ選択を照合し、有効な初期スコープを決定する。
 * 保存された期間キーが index.json に存在しない場合は最新月へ安全にフォールバックする。
 */
export function resolveInitialScopeSelection(
  meta: IndexMetadata,
  persisted?: { scopeType?: AnalysisScopeType; selectedKey?: string } | null
): { scopeType: AnalysisScopeType; selectedKey: string; hasLiveData: boolean } {
  const defaultMonth = meta.default_scopes?.latest_month || meta.available_months?.[0] || '';
  if (!defaultMonth) {
    return { scopeType: 'monthly', selectedKey: '', hasLiveData: false };
  }

  if (persisted?.scopeType && persisted?.selectedKey) {
    const { scopeType, selectedKey } = persisted;
    if (scopeType === 'monthly') {
      const validMonths = new Set<string>([
        ...(meta.available_months ?? []),
        ...(meta.all_recorded_months ?? []),
        defaultMonth,
      ]);
      if (validMonths.has(selectedKey)) {
        return { scopeType: 'monthly', selectedKey, hasLiveData: true };
      }
    } else if (scopeType === 'daily') {
      const validDays = new Set<string>(meta.available_days ?? []);
      if (validDays.has(selectedKey)) {
        return { scopeType: 'daily', selectedKey, hasLiveData: true };
      }
    } else if (scopeType === 'custom') {
      if (selectedKey === 'latest-30d') {
        return { scopeType: 'custom', selectedKey: 'latest-30d', hasLiveData: true };
      }
      const match = /^custom:(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(selectedKey);
      if (match && match[1] <= match[2]) {
        return { scopeType: 'custom', selectedKey, hasLiveData: true };
      }
    }
  }

  return { scopeType: 'monthly', selectedKey: defaultMonth, hasLiveData: true };
}

/**
 * index.json のメタデータと保存済みレポート月を照合し、有効な初期レポート月を決定する。
 */
export function resolveInitialReportMonth(
  meta: IndexMetadata,
  persistedMonth?: string | null
): string {
  const availableReports = meta.available_reports ?? [];
  const defaultReport = meta.default_scopes?.latest_report || availableReports[0] || '';

  if (persistedMonth && persistedMonth.trim().length > 0) {
    if (availableReports.includes(persistedMonth) || persistedMonth === defaultReport) {
      return persistedMonth;
    }
  }

  return defaultReport;
}
