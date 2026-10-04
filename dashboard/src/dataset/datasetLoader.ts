/**
 * Dataset Loader (SDD-15 §7 / ADR-0001)
 *
 * データの「取得」を一箇所に集約する。views / hooks は URL の組み立てやフォールバックを知らず、
 * 取得結果とその状態 (ok / partial / failed / demo) だけを受け取る。
 *
 * - パス解決は resolveDataPath と複数階層フォールバック (getCandidateDataUrls) を使う (SDD-05 §2.2)。
 * - 取得失敗を空データや DEMO に黙って置き換えない。失敗は state: 'failed' で返す。
 * - 実データのうち一部が欠けている (取得失敗・隔離レコードあり) ときは state: 'partial'。
 * - DEMO 由来 (取得元が /demo/ パス、または index.json が is_mock_mode を宣言) は state: 'demo'。
 *
 * フィルター・集計は行わない (Query 層の責務: ../query)。
 */

import type {
  AnalysisScopeType,
  IndexMetadata,
  MonthlyReportAggregatedData,
  RollingTrendDataset,
  ScopeAggregatedData,
} from '../../../src/types/copilot';
import type { DataQualityHistory } from '../../../src/domain/entities/data-quality';
import { fetchDataWithFallback, getCandidateDataUrls, resolveDataPath } from '../utils/pathResolver';

export type DatasetState = 'ok' | 'partial' | 'failed' | 'demo';

export interface DatasetResult<T> {
  state: DatasetState;
  /** failed のとき null */
  data: T | null;
  /** 実際に取得できた URL (failed のとき null) */
  url: string | null;
  /** 取得元が DEMO か (state が partial でも DEMO 由来なら true) */
  demoSourced: boolean;
  /** failed のときの理由 */
  error: string | null;
}

export interface LoadOptions {
  /** index.json が is_mock_mode: true を宣言しているか (データ自身の宣言) */
  mockDeclared?: boolean;
}

function failed<T>(error: string): DatasetResult<T> {
  return { state: 'failed', data: null, url: null, demoSourced: false, error };
}

/** 取得済みデータの状態を決める。DEMO は誤認を避けるため partial / ok より優先する */
export function deriveDatasetState(input: {
  demoSourced: boolean;
  partial: boolean;
}): Exclude<DatasetState, 'failed'> {
  if (input.demoSourced) return 'demo';
  return input.partial ? 'partial' : 'ok';
}

function isDemoUrl(url: string): boolean {
  return url.includes('/demo/');
}

/** index.json: ソースの取得失敗・一部失敗があれば partial */
function indexIsPartial(meta: IndexMetadata): boolean {
  return (meta.source_status ?? []).some((s) => s.status === 'failed' || s.status === 'partial');
}

/** スコープ / レポート: error の異常 (issues) を含む、または隔離で欠けていれば partial */
function aggregateIsPartial(data: { issues?: Array<{ severity: string }> }): boolean {
  return (data.issues ?? []).some((i) => i.severity === 'error');
}

async function fetchJson<T>(candidateUrls: string[]): Promise<{ data: T; url: string } | { error: string }> {
  try {
    const { res, finalUrl } = await fetchDataWithFallback(candidateUrls);
    if (!res.ok) {
      return { error: `HTTP ${res.status}: ${candidateUrls[0]}` };
    }
    return { data: (await res.json()) as T, url: finalUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** index.json (データセットの目録) を取得する。暗黙に別モードへ切り替えない */
export async function loadIndexDataset(baseDir: string): Promise<DatasetResult<IndexMetadata>> {
  const url = resolveDataPath(`${baseDir}/index.json`);
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    return failed(e instanceof Error ? e.message : String(e));
  }
  if (!res.ok) return failed(`Failed to load index.json: ${res.status}`);
  try {
    const data = (await res.json()) as IndexMetadata;
    const demoSourced = isDemoUrl(url) || data.is_mock_mode === true;
    return {
      state: deriveDatasetState({ demoSourced, partial: indexIsPartial(data) }),
      data,
      url,
      demoSourced,
      error: null,
    };
  } catch (e) {
    return failed(e instanceof Error ? e.message : String(e));
  }
}

/** スコープ (daily / monthly / custom) の取得候補 URL。優先順に並ぶ */
export function scopeCandidateUrls(baseDir: string, scopeType: AnalysisScopeType, key: string): string[] {
  if (scopeType === 'monthly') {
    return getCandidateDataUrls(baseDir, 'monthly', `${key}.json`);
  }
  if (scopeType === 'custom') {
    const fileName = `${key.replace(/[:/]/g, '_')}.json`;
    if (key.startsWith('custom:')) {
      return [
        ...getCandidateDataUrls(baseDir, 'custom', fileName),
        ...getCandidateDataUrls(baseDir, 'custom', 'latest-30d.json'),
      ];
    }
    return getCandidateDataUrls(baseDir, 'custom', fileName);
  }
  return getCandidateDataUrls(baseDir, 'daily', `${key}.json`);
}

/** `custom:<start>_<end>` から期間を取り出す。解釈できなければ null */
export function parseCustomRange(key: string): { start: string; end: string } | null {
  if (!key.startsWith('custom:')) return null;
  const parts = key.slice('custom:'.length).split('_');
  return parts.length === 2 && parts[0] && parts[1] ? { start: parts[0], end: parts[1] } : null;
}

/** 日次トレンド・ユーザー履歴を期間で切り出し、期間内の合計で overview を作り直す */
export function sliceScopeDataByDateRange(
  baseData: ScopeAggregatedData,
  startDate: string,
  endDate: string
): ScopeAggregatedData {
  const filteredTrends = (baseData.daily_trends || []).filter(
    (d) => d.date >= startDate && d.date <= endDate
  );
  const daysCount = filteredTrends.length || 1;

  const totalSpend = filteredTrends.reduce((sum, d) => sum + (d.daily_cost_usd || 0), 0);
  const totalSuggestions = filteredTrends.reduce((sum, d) => sum + (d.suggestions || 0), 0);
  const totalAcceptances = filteredTrends.reduce((sum, d) => sum + (d.acceptances || 0), 0);
  const totalChats = filteredTrends.reduce((sum, d) => sum + (d.chats || 0), 0);
  const totalPrSummaries = filteredTrends.reduce((sum, d) => sum + (d.pr_summaries || 0), 0);
  const acceptanceRate = totalSuggestions > 0 ? totalAcceptances / totalSuggestions : 0;

  // 期間内に日次の利用実績が 1 日も無い (利用状況メトリクスが取得できていない) 場合、
  // 利用指標を 0 で埋めず欠損 (null) のままにする
  const hasDailyUsage = filteredTrends.length > 0;

  const filteredUserProfiles = (baseData.user_profiles || []).map((p) => {
    const history = (p.daily_history || []).filter(
      (h) => h.date >= startDate && h.date <= endDate
    );
    const userSuggestions = history.reduce((s, h) => s + (h.suggestions || 0), 0);
    const userAcceptances = history.reduce((s, h) => s + (h.acceptances || 0), 0);
    const userChats = history.reduce((s, h) => s + (h.total_chats || 0), 0);
    const userSpend = history.reduce((s, h) => s + (h.daily_cost_usd || 0), 0);
    const userRate = userSuggestions > 0 ? userAcceptances / userSuggestions : 0;
    return {
      ...p,
      daily_history: history,
      total_suggestions: userSuggestions,
      total_acceptances: userAcceptances,
      total_chats: userChats,
      acceptance_rate: userRate,
      total_cost_usd: Math.round(userSpend * 100) / 100,
    };
  });

  const activeUsersCount = filteredUserProfiles.filter(
    (p) => (p.total_suggestions || 0) > 0 || (p.total_chats || 0) > 0
  ).length;

  return {
    ...baseData,
    scope_type: 'custom',
    scope_key: `custom:${startDate}_${endDate}`,
    date_range: {
      start: startDate,
      end: endDate,
      days_count: daysCount,
    },
    daily_trends: filteredTrends,
    user_profiles: filteredUserProfiles,
    overview: {
      ...baseData.overview,
      total_spend_usd: Math.round(totalSpend * 100) / 100,
      total_suggestions: hasDailyUsage ? totalSuggestions : null,
      total_acceptances: hasDailyUsage ? totalAcceptances : null,
      overall_acceptance_rate: hasDailyUsage ? Math.round(acceptanceRate * 10000) / 10000 : null,
      total_chats: hasDailyUsage ? totalChats : null,
      total_pr_summaries: hasDailyUsage ? totalPrSummaries : null,
      active_users: activeUsersCount,
    },
  };
}

/** スコープデータを取得する。custom:<start>_<end> は取得後に期間で切り出す */
export async function loadScopeDataset(
  baseDir: string,
  scopeType: AnalysisScopeType,
  key: string,
  options: LoadOptions = {}
): Promise<DatasetResult<ScopeAggregatedData>> {
  const candidates = scopeCandidateUrls(baseDir, scopeType, key);
  const fetched = await fetchJson<ScopeAggregatedData>(candidates);
  if ('error' in fetched) {
    return failed(`Data for scope ${scopeType} (${key}) not found at ${candidates[0]} (${fetched.error})`);
  }
  let data = fetched.data;
  const range = scopeType === 'custom' ? parseCustomRange(key) : null;
  if (range) data = sliceScopeDataByDateRange(data, range.start, range.end);
  const demoSourced = isDemoUrl(fetched.url) || options.mockDeclared === true;
  return {
    state: deriveDatasetState({ demoSourced, partial: aggregateIsPartial(data) }),
    data,
    url: fetched.url,
    demoSourced,
    error: null,
  };
}

/** 月次レポートを取得する */
export async function loadReportDataset(
  baseDir: string,
  month: string,
  options: LoadOptions = {}
): Promise<DatasetResult<MonthlyReportAggregatedData>> {
  const candidates = getCandidateDataUrls(baseDir, 'reports', `${month}.json`);
  const fetched = await fetchJson<MonthlyReportAggregatedData>(candidates);
  if ('error' in fetched) {
    return failed(`Monthly report for ${month} not found at ${candidates[0]} (${fetched.error})`);
  }
  const demoSourced = isDemoUrl(fetched.url) || options.mockDeclared === true;
  return {
    state: deriveDatasetState({ demoSourced, partial: false }),
    data: fetched.data,
    url: fetched.url,
    demoSourced,
    error: null,
  };
}


/**
 * 1 年推移 (trends/rolling-1year.json, P3-6)。
 * 反対モード (LIVE <=> DEMO) へは暗黙に切り替えない。無い・読めないときは failed (空の推移を作らない)。
 */
export async function loadYearlyTrendDataset(baseDir: string): Promise<DatasetResult<RollingTrendDataset>> {
  const candidates = getCandidateDataUrls(baseDir, 'trends', 'rolling-1year.json');
  const result = await fetchJson<RollingTrendDataset>(candidates);
  if ('error' in result) return failed(result.error);
  const demoSourced = isDemoUrl(result.url) || baseDir.includes('/demo');
  return {
    state: deriveDatasetState({ demoSourced, partial: false }),
    data: result.data,
    url: result.url,
    demoSourced,
    error: null,
  };
}

/**
 * データ品質の実行履歴 (quality/history.json, P1-7 / P4-1)。
 * 件数・日付・ソース名だけを持つ公開してよいファイル。無い・読めないときは failed (空の履歴を作らない)。
 * モック (DEMO) の収集は履歴を記録しないため、DEMO では通常 failed になる。
 */
export async function loadQualityHistoryDataset(baseDir: string): Promise<DatasetResult<DataQualityHistory>> {
  const candidates = getCandidateDataUrls(baseDir, 'quality', 'history.json');
  const result = await fetchJson<DataQualityHistory>(candidates);
  if ('error' in result) return failed(result.error);
  const demoSourced = isDemoUrl(result.url) || baseDir.includes('/demo');
  return {
    state: deriveDatasetState({ demoSourced, partial: false }),
    data: result.data,
    url: result.url,
    demoSourced,
    error: null,
  };
}
