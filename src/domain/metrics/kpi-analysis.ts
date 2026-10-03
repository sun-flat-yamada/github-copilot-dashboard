/**
 * KPI 分析 (P3-2 / D-02): 前期比と月末着地予測の純関数。
 *
 * - 日付は UTC の `YYYY-MM-DD` で扱う (集計基準タイムゾーン = UTC, SDD-06)。
 * - 予測は観測済みの日次値だけを入力とし、同じ入力から同じ出力を返す (現在時刻は `now` で注入)。
 * - データ不足の場合は 0 や推測値で埋めず、理由付きの `unavailable` を返す。
 */
import type { AnalysisScopeType } from '../entities/copilot.js';

export interface DailyPoint {
  /** `YYYY-MM-DD` (UTC) */
  date: string;
  /** 欠損は null / undefined (0 として扱わない) */
  value: number | null | undefined;
}

/** 予測に必要な最小観測日数 (これ未満は月初扱いで予測しない) */
export const FORECAST_MIN_OBSERVED_DAYS = 7;
/** 直近ペースの算出に使う観測日数 */
export const FORECAST_PACE_WINDOW_DAYS = 7;
/** 月初からの経過日数に対する観測日数の最小割合 (これ未満は欠損が多く予測しない) */
export const FORECAST_MIN_COVERAGE = 0.5;

export type ForecastConfidence = 'high' | 'medium' | 'low';

export const CONFIDENCE_LABEL_JA: Record<ForecastConfidence, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export type ForecastResult =
  | {
      status: 'forecast';
      /** 月末着地の予測値 */
      projected: number;
      /** 予測レンジ (直近ペースの平均 ± 標準偏差。下限は実績累計) */
      low: number;
      high: number;
      /** 当月の観測済み実績累計 */
      actualToDate: number;
      observedDays: number;
      remainingDays: number;
      /** 直近ペース (1 日あたり) */
      dailyPace: number;
      confidence: ForecastConfidence;
      /** 算出式 (画面表示用) */
      formula: string;
      /** 窓 (画面表示用) */
      window: string;
    }
  | {
      status: 'closed';
      /** 締め済み月の実績 (予測ではない) */
      actual: number;
      observedDays: number;
      window: string;
    }
  | {
      status: 'unavailable';
      /** 「—（理由）」の理由 */
      reason: string;
    };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(date: string): { y: number; m: number; d: number } | null {
  const match = DATE_RE.exec(date);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** 月の日数 (`YYYY-MM`)。不正な月は null */
export function daysInMonth(month: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const m = Number(match[2]);
  if (m < 1 || m > 12) return null;
  return new Date(Date.UTC(Number(match[1]), m, 0)).getUTCDate();
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mu = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - mu) ** 2, 0) / (values.length - 1));
}

export interface ForecastOptions {
  /** 対象月 `YYYY-MM` */
  month: string;
  /** 現在時刻 (UTC)。当月より前の月を「締め済み」と判定する。省略時は観測データだけで判定する */
  now?: Date;
}

/**
 * 月末着地予測。
 * 式: 当月実績累計 + 直近 7 観測日の平均 × 残日数 (残日数 = 月の日数 - 最終観測日の日)
 */
export function forecastMonthEnd(series: DailyPoint[], options: ForecastOptions): ForecastResult {
  const total = daysInMonth(options.month);
  if (total === null) return { status: 'unavailable', reason: '対象月を特定できません' };

  const prefix = `${options.month}-`;
  const byDate = new Map<string, number>();
  for (const p of series) {
    if (!p.date.startsWith(prefix) || !parseDate(p.date)) continue;
    if (typeof p.value !== 'number' || !Number.isFinite(p.value)) continue;
    byDate.set(p.date, p.value);
  }
  const observed = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const window = `${options.month} (UTC)`;
  if (observed.length === 0) {
    return { status: 'unavailable', reason: '当月の観測データがありません' };
  }

  const lastDay = parseDate(observed[observed.length - 1][0])!.d;
  const actualToDate = observed.reduce((sum, [, v]) => sum + v, 0);
  const nowMonth = options.now ? options.now.toISOString().slice(0, 7) : null;
  const isPastMonth = nowMonth !== null && options.month < nowMonth;

  if (lastDay >= total || isPastMonth) {
    return { status: 'closed', actual: actualToDate, observedDays: observed.length, window };
  }
  if (observed.length < FORECAST_MIN_OBSERVED_DAYS) {
    return {
      status: 'unavailable',
      reason: `観測 ${observed.length} 日 (${FORECAST_MIN_OBSERVED_DAYS} 日未満) のため月末予測を出しません`,
    };
  }
  const coverage = observed.length / lastDay;
  if (coverage < FORECAST_MIN_COVERAGE) {
    return {
      status: 'unavailable',
      reason: `欠損が多い (${lastDay} 日中 ${observed.length} 日のみ観測) ため月末予測を出しません`,
    };
  }

  const recent = observed.slice(-FORECAST_PACE_WINDOW_DAYS).map(([, v]) => v);
  const dailyPace = mean(recent);
  const sd = stdev(recent);
  const remainingDays = total - lastDay;
  const projected = actualToDate + dailyPace * remainingDays;
  const low = Math.max(actualToDate, actualToDate + (dailyPace - sd) * remainingDays);
  const high = Math.max(projected, actualToDate + (dailyPace + sd) * remainingDays);

  const cv = dailyPace > 0 ? sd / dailyPace : Number.POSITIVE_INFINITY;
  let confidence: ForecastConfidence = 'low';
  if (observed.length >= 21 && cv <= 0.2 && coverage >= 0.9) confidence = 'high';
  else if (observed.length >= 14 && cv <= 0.5 && coverage >= 0.7) confidence = 'medium';

  return {
    status: 'forecast',
    projected,
    low,
    high,
    actualToDate,
    observedDays: observed.length,
    remainingDays,
    dailyPace,
    confidence,
    formula: `当月実績累計 + 直近 ${recent.length} 観測日の平均 × 残 ${remainingDays} 日`,
    window,
  };
}

// ==========================================
// 前期比
// ==========================================

export type ComparisonResult =
  | {
      status: 'compared';
      previous: number;
      /** current - previous */
      delta: number;
      /** (current - previous) / previous。previous = 0 のときは null */
      ratio: number | null;
      direction: 'up' | 'down' | 'flat';
    }
  | { status: 'unavailable'; reason: string };

/** 前期比。前期が欠損のときは理由付きで算出不能 (0 比較で偽の増減を出さない) */
export function compareToPrevious(
  current: number | null | undefined,
  previous: number | null | undefined,
  options: { previousReason?: string } = {}
): ComparisonResult {
  if (typeof current !== 'number' || !Number.isFinite(current)) {
    return { status: 'unavailable', reason: '当期の値がありません' };
  }
  if (typeof previous !== 'number' || !Number.isFinite(previous)) {
    return { status: 'unavailable', reason: options.previousReason ?? '前期のデータがありません' };
  }
  const delta = current - previous;
  const ratio = previous === 0 ? null : delta / previous;
  const direction = Math.abs(delta) < 1e-9 ? 'flat' : delta > 0 ? 'up' : 'down';
  return { status: 'compared', previous, delta, ratio, direction };
}

/** 前期の比較対象キー。月次=前月 / 日次=前日 / 期間 (custom) は比較対象を定義しない */
export function previousScopeKey(scopeType: AnalysisScopeType, key: string): string | null {
  if (scopeType === 'monthly') {
    const match = /^(\d{4})-(\d{2})$/.exec(key);
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 2, 1));
    return date.toISOString().slice(0, 7);
  }
  if (scopeType === 'daily') {
    const p = parseDate(key);
    if (!p) return null;
    return new Date(Date.UTC(p.y, p.m - 1, p.d - 1)).toISOString().slice(0, 10);
  }
  return null;
}

/** 比較対象の呼称 (前月 / 前日) */
export function previousPeriodLabel(scopeType: AnalysisScopeType): string | null {
  if (scopeType === 'monthly') return '前月比';
  if (scopeType === 'daily') return '前日比';
  return null;
}
