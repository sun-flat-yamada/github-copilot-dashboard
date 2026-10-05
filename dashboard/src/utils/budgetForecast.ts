/**
 * Cost Center 予算の時系列と上限到達予測 (純関数)。
 * 累積利用費用 (gross) を日別に積み上げ、無料枠の超過日と、
 * 直近の傾向から見た上限到達日 (信頼区間つき) を求める。描画から分離してテスト可能にする。
 *
 * 上限は「課金対象実使用額 (= max(0, gross - 無料枠))」に掛かるので、
 * gross の軸では `無料枠 + 上限` が上限ラインになる (BudgetUtilizationRule と同じ)。
 */
export interface DailySpend {
  date: string; // YYYY-MM-DD
  spend_usd: number;
}

export interface TimelinePoint {
  /** 月内の日 (1 始まり) */
  day: number;
  date: string;
  /** 観測済みの累積利用費用。観測期間より後は undefined */
  actual?: number;
  /** 予測の中心線 (最終観測日から) */
  projected?: number;
  /** 信頼区間 [下限, 上限] (最終観測日から) */
  band?: [number, number];
}

export type ForecastStatus = 'ok' | 'reached' | 'unavailable';

export interface LimitForecast {
  status: ForecastStatus;
  /** unavailable の理由 (表示用) */
  reason?: string;
  /** 'reached': 実績で上限に達した日。'ok': 予測の中心線が上限に達する日 */
  reachDate?: string;
  /** 信頼区間の悲観側 (早い方) / 楽観側 (遅い方) の到達日。期間内に到達しない側は undefined */
  earliestDate?: string;
  latestDate?: string;
  /** 1 日あたりの増加額 (USD/日) */
  slopePerDay?: number;
}

export interface BudgetTimeline {
  /** 表示期間の開始月 (YYYY-MM) */
  month: string;
  /** 表示期間の開始日 / 終了日 (YYYY-MM-DD) */
  startDate: string;
  endDate: string;
  /** 表示期間の日数 (月次なら月の日数) */
  daysInMonth: number;
  points: TimelinePoint[];
  freeTierUsd: number;
  /** gross 軸での上限ライン (無料枠 + 上限)。上限未設定は null */
  limitLineUsd: number | null;
  lastObservedDate: string | null;
  freeTierExceededDate: string | null;
  forecast: LimitForecast;
}

export interface BuildTimelineInput {
  /** 月 (YYYY-MM)。start / end を指定しないときの表示期間 (月初〜月末) */
  month?: string;
  /** 表示期間 (YYYY-MM-DD, 両端を含む)。選択中の区間 (日次 / 期間指定など) に合わせる。month より優先 */
  start?: string;
  end?: string;
  /** 上限到達予測を出すか (既定 true)。上限・無料枠は月次の枠なので、月次以外の区間では false にする */
  forecastEnabled?: boolean;
  daily: readonly DailySpend[];
  freeTierUsd: number;
  spendingLimitUsd: number;
  /** 信頼水準 (既定 0.8)。0.8 / 0.9 / 0.95 のいずれか */
  confidence?: 0.8 | 0.9 | 0.95;
}

/** 予測に必要な最小の観測日数 */
export const MIN_OBSERVED_DAYS = 5;
/** 月末より先を探す最大日数 */
const MAX_HORIZON_DAYS = 366;

// 両側信頼水準ごとの t 分布の片側分位点 (自由度 3..10, 15, 20, 30, 無限大)
const T_TABLE: Record<number, [number, number, number]> = {
  3: [1.638, 2.353, 3.182],
  4: [1.533, 2.132, 2.776],
  5: [1.476, 2.015, 2.571],
  6: [1.44, 1.943, 2.447],
  7: [1.415, 1.895, 2.365],
  8: [1.397, 1.86, 2.306],
  9: [1.383, 1.833, 2.262],
  10: [1.372, 1.812, 2.228],
  15: [1.341, 1.753, 2.131],
  20: [1.325, 1.725, 2.086],
  30: [1.31, 1.697, 2.042],
};
const Z: Record<number, number> = { 0.8: 1.282, 0.9: 1.645, 0.95: 1.96 };
const CONF_INDEX: Record<number, number> = { 0.8: 0, 0.9: 1, 0.95: 2 };

function quantile(confidence: 0.8 | 0.9 | 0.95, df: number): number {
  const idx = CONF_INDEX[confidence];
  if (df >= 30) return Z[confidence];
  const keys = Object.keys(T_TABLE).map(Number).sort((a, b) => a - b);
  // 表に無い自由度は小さい側の値を使う (区間が広くなる安全側)
  let key = keys[0];
  for (const k of keys) if (k <= df) key = k;
  return T_TABLE[key][idx];
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const DAY_MS = 86_400_000;

/** 期間の day 日目 (1 始まり) の日付。期間の終わりより先の日も計算できる */
function dateAt(startDate: string, day: number): string {
  return new Date(Date.parse(`${startDate}T00:00:00Z`) + (day - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** 期間 (startDate から total 日) 内の日付 (YYYY-MM-DD) → 日 (1 始まり)。期間外・不正な日付は null */
export function dayIndex(startDate: string, total: number, date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const day = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_MS) + 1;
  return Number.isInteger(day) && day >= 1 && day <= total ? day : null;
}

/** 期間 (start 〜 end, 両端を含む) の日数 */
function periodDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
}

export function buildBudgetTimeline(input: BuildTimelineInput): BudgetTimeline {
  const { daily, freeTierUsd, spendingLimitUsd } = input;
  const confidence = input.confidence ?? 0.8;
  const forecastEnabled = input.forecastEnabled ?? true;
  const month = (input.start ?? input.month ?? '').slice(0, 7);
  const startDate = input.start ?? `${month}-01`;
  const total = input.start && input.end ? Math.max(1, periodDays(input.start, input.end)) : daysInMonth(month);
  const endDate = dateAt(startDate, total);
  const limitLineUsd = spendingLimitUsd > 0 ? freeTierUsd + spendingLimitUsd : null;

  const perDay = new Array<number>(total + 1).fill(0);
  let lastDay = 0;
  for (const d of daily) {
    const day = dayIndex(startDate, total, d.date);
    if (day === null || !Number.isFinite(d.spend_usd)) continue;
    perDay[day] += d.spend_usd;
    if (day > lastDay) lastDay = day;
  }

  // 観測期間 (1 日目 〜 最終観測日) の累積。記録の無い日は費用 0 の日として扱う
  const cumulative = new Array<number>(total + 1).fill(0);
  for (let day = 1; day <= lastDay; day++) cumulative[day] = cumulative[day - 1] + perDay[day];

  const points: TimelinePoint[] = [];
  for (let day = 1; day <= total; day++) {
    const p: TimelinePoint = { day, date: dateAt(startDate, day) };
    if (day <= lastDay) p.actual = round(cumulative[day]);
    points.push(p);
  }

  let freeTierExceededDate: string | null = null;
  if (freeTierUsd > 0) {
    for (let day = 1; day <= lastDay; day++) {
      if (cumulative[day] > freeTierUsd) {
        freeTierExceededDate = dateAt(startDate, day);
        break;
      }
    }
  }

  const forecast = projectLimit({ startDate, total, lastDay, cumulative, limitLineUsd, confidence, points, forecastEnabled });

  return {
    month,
    startDate,
    endDate,
    daysInMonth: total,
    points,
    freeTierUsd,
    limitLineUsd,
    lastObservedDate: lastDay > 0 ? dateAt(startDate, lastDay) : null,
    freeTierExceededDate,
    forecast,
  };
}

interface ProjectArgs {
  startDate: string;
  forecastEnabled: boolean;
  total: number;
  lastDay: number;
  cumulative: number[];
  limitLineUsd: number | null;
  confidence: 0.8 | 0.9 | 0.95;
  points: TimelinePoint[];
}

function projectLimit(a: ProjectArgs): LimitForecast {
  const { startDate, total, lastDay, cumulative, limitLineUsd, confidence, points, forecastEnabled } = a;
  if (limitLineUsd === null) return { status: 'unavailable', reason: '上限Budgetが未設定のため予測できません' };

  // 実績で既に上限に達している
  for (let day = 1; day <= lastDay; day++) {
    if (cumulative[day] >= limitLineUsd) return { status: 'reached', reachDate: dateAt(startDate, day) };
  }
  if (!forecastEnabled) {
    return { status: 'unavailable', reason: '上限は月次の枠のため、月次以外の区間では上限到達予測を表示しません' };
  }
  if (lastDay < MIN_OBSERVED_DAYS) {
    return { status: 'unavailable', reason: `観測日数が${MIN_OBSERVED_DAYS}日未満のため予測できません` };
  }

  // 累積に対する最小二乗直線 y = a + b x。傾きを 1 日あたりの増加額とする
  const n = lastDay;
  let sx = 0;
  let sy = 0;
  for (let x = 1; x <= n; x++) {
    sx += x;
    sy += cumulative[x];
  }
  const xbar = sx / n;
  const ybar = sy / n;
  let sxx = 0;
  let sxy = 0;
  for (let x = 1; x <= n; x++) {
    sxx += (x - xbar) ** 2;
    sxy += (x - xbar) * (cumulative[x] - ybar);
  }
  const slope = sxy / sxx;
  if (!(slope > 0)) return { status: 'unavailable', reason: '利用額が増えていないため上限到達日を予測できません' };
  const intercept = ybar - slope * xbar;
  let sse = 0;
  for (let x = 1; x <= n; x++) sse += (cumulative[x] - (intercept + slope * x)) ** 2;
  const se = Math.sqrt(sse / (n - 2));
  const t = quantile(confidence, n - 2);

  const last = cumulative[n];
  const central = (x: number) => last + slope * (x - n);
  const halfWidth = (x: number) => t * se * Math.sqrt(1 + 1 / n + (x - xbar) ** 2 / sxx);
  const lower = (x: number) => Math.max(last, central(x) - halfWidth(x));
  const upper = (x: number) => central(x) + halfWidth(x);

  // グラフ用: 最終観測日 (幅 0) から月末まで
  for (const p of points) {
    if (p.day < n) continue;
    const c = p.day === n ? last : central(p.day);
    p.projected = round(c);
    p.band = p.day === n ? [round(last), round(last)] : [round(lower(p.day)), round(upper(p.day))];
  }

  const firstReach = (f: (x: number) => number): string | undefined => {
    for (let x = n + 1; x <= total + MAX_HORIZON_DAYS; x++) {
      if (f(x) >= limitLineUsd) return dateAt(startDate, x);
    }
    return undefined;
  };

  return {
    status: 'ok',
    reachDate: firstReach(central),
    earliestDate: firstReach(upper),
    latestDate: firstReach(lower),
    slopePerDay: round(slope),
  };
}

/** 日次集計 (ライブ) のうち、Cost Center 別の日次費用の算出に使う部分 */
interface LiveScopeLike {
  users: readonly { cost_center: string; prorated_daily_cost_usd: number }[];
  daily_trends: readonly { date: string }[];
}

/**
 * 自動収集データ (ライブ) の Cost Center 別の日次費用。
 * ライブには Cost Center 別の利用明細が無く、費用はシート課金なので、観測日 (daily_trends の各日) ごとに
 * Cost Center のシートの日割り費用 (prorated_daily_cost_usd) を合計する (シート費用の日次の積み上がり)。
 * 観測日に無い日は含めない (推定しない)。
 */
export function liveCostCenterDaily(scope: LiveScopeLike): Record<string, DailySpend[]> {
  const dayCost = new Map<string, number>();
  for (const u of scope.users) {
    const name = (u.cost_center || '').trim();
    if (!name || !Number.isFinite(u.prorated_daily_cost_usd)) continue;
    dayCost.set(name, (dayCost.get(name) ?? 0) + u.prorated_daily_cost_usd);
  }
  const dates = Array.from(new Set(scope.daily_trends.map((t) => t.date))).sort();
  const result: Record<string, DailySpend[]> = {};
  dayCost.forEach((cost, name) => {
    result[name] = dates.map((date) => ({ date, spend_usd: Number(cost.toFixed(4)) }));
  });
  return result;
}

/** 月 (YYYY-MM) 全体の表示期間 */
export function monthPeriod(month: string): { start: string; end: string } {
  const start = `${month}-01`;
  return { start, end: dateAt(start, daysInMonth(month)) };
}

/** ライブの表示期間: 月次スコープは月全体 (月末まで予測を描くため)、それ以外は選択中の期間 */
export function livePeriod(scope: {
  scope_type: string;
  scope_key: string;
  date_range: { start: string; end: string };
}): { start: string; end: string; monthly: boolean } {
  if (scope.scope_type === 'monthly' && /^\d{4}-\d{2}$/.test(scope.scope_key)) {
    return { ...monthPeriod(scope.scope_key), monthly: true };
  }
  return { start: scope.date_range.start, end: scope.date_range.end, monthly: false };
}

export interface ReachSpan {
  /** 到達予想の幅を月内の日 (1 始まり) で表したもの。月末を超える側は月末に丸める */
  fromDay: number;
  toDay: number;
  /** 中心線の到達日 (月内の日)。月末を超えるとき null */
  expectedDay: number | null;
  /** 幅または中心の日付が翌月以降だった (丸めた) か */
  beyondMonthEnd: boolean;
}

/**
 * 到達予想日 (最早 / 期待 / 最遅) を、時間軸に描ける月内の日の幅へ変換する。
 * 予測が ok で、最早の到達日が分かるときだけ返す (値を作らない)。月外の日付は月末に丸める。
 */
export function forecastReachSpan(timeline: BudgetTimeline): ReachSpan | null {
  const f = timeline.forecast;
  if (f.status !== 'ok') return null;
  const first = f.earliestDate ?? f.reachDate;
  if (!first) return null;
  const toDay = (date: string | undefined): number | null => {
    if (!date) return null;
    return dayIndex(timeline.startDate, timeline.daysInMonth, date) ?? (date > timeline.endDate ? timeline.daysInMonth + 1 : null);
  };
  const fromRaw = toDay(first);
  if (fromRaw === null) return null;
  const toRaw = toDay(f.latestDate) ?? timeline.daysInMonth + 1; // 最遅が範囲外 = 月末以降
  const expectedRaw = toDay(f.reachDate);
  const clamp = (d: number) => Math.min(d, timeline.daysInMonth);
  const beyond = fromRaw > timeline.daysInMonth || toRaw > timeline.daysInMonth || (expectedRaw ?? 0) > timeline.daysInMonth;
  return {
    fromDay: clamp(fromRaw),
    toDay: clamp(Math.max(fromRaw, toRaw)),
    expectedDay: expectedRaw !== null && expectedRaw <= timeline.daysInMonth ? expectedRaw : null,
    beyondMonthEnd: beyond,
  };
}

function round(v: number): number {
  return Number(v.toFixed(2));
}
