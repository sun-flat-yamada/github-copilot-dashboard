/**
 * Cost Center 予算の月内推移と、上限 Budget への到達予想 (SDD-06 §Budget Timeline)。
 *
 * 入力は月次レポート明細の日次 gross 費用だけ。無い値は作らない (推計に足りないときは null)。
 * 上限 Budget は課金対象実使用額 (= max(0, 利用費用 - 無料枠)) に対する枠なので、
 * 利用費用の軸では「無料枠 + 上限」が上限線になる (BudgetUtilizationRule と同じ定義)。
 */

export interface DailySpendInput {
  date: string; // YYYY-MM-DD
  gross_usd: number;
}

export interface BudgetTimelinePoint {
  date: string;
  day: number; // 月初 = 1
  /** 当日までの累計 (観測済みの最終日より後は null) */
  cumulative_usd: number | null;
  daily_usd: number | null;
}

export interface LimitReachForecast {
  /** 直近の 1 日あたり費用: expected = 直近 7 日平均、low / high = 推定値のばらつきの下限 / 上限 */
  rate_per_day: { low: number; expected: number; high: number };
  /** 到達予想日。low レートが 0 (到達しない) のとき latest は null。月末を超える日付もそのまま返す */
  earliest: string;
  expected: string;
  latest: string | null;
  /** 予測の起点 (観測済みの最終日) */
  from_date: string;
  from_cumulative_usd: number;
  /** 起点から終点 (到達予想日) までの累計の予測線: 月末までの日付だけ */
  projection: { date: string; day: number; expected: number; low: number; high: number }[];
}

export interface BudgetTimeline {
  month: string;
  days_in_month: number;
  points: BudgetTimelinePoint[];
  /** 利用費用の軸での基準線。limit が 0 以下 (未設定) のとき limit_line_usd は null */
  free_line_usd: number;
  limit_line_usd: number | null;
  /** 累計が無料枠を超えた最初の日 (無料枠が 0 のときは null) */
  free_tier_exceeded_on: string | null;
  /** 累計が上限線に達した最初の日 */
  limit_reached_on: string | null;
  /** 既に超過 / 観測不足 / 上限未設定のときは null */
  forecast: LimitReachForecast | null;
  /** forecast が null の理由 (画面表示用) */
  forecast_unavailable_reason: 'no_limit' | 'no_data' | 'insufficient_days' | 'already_reached' | 'no_spend' | null;
}

const MIN_OBSERVED_DAYS = 3;
const TREND_WINDOW_DAYS = 7;

const pad = (n: number) => String(n).padStart(2, '0');
const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export class BudgetForecastRule {
  static buildTimeline(input: {
    month: string; // YYYY-MM
    daily: DailySpendInput[];
    free_tier_usd: number;
    spending_limit_usd: number;
  }): BudgetTimeline {
    const [y, m] = input.month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const spendByDate = new Map<string, number>();
    for (const d of input.daily) {
      if (d.date.startsWith(input.month)) spendByDate.set(d.date, (spendByDate.get(d.date) ?? 0) + d.gross_usd);
    }
    const observedDates = Array.from(spendByDate.keys()).sort();
    const lastObserved = observedDates[observedDates.length - 1];
    const lastDay = lastObserved ? Number(lastObserved.slice(8, 10)) : 0;

    const freeLine = Math.max(0, input.free_tier_usd);
    const limitLine = input.spending_limit_usd > 0 ? freeLine + input.spending_limit_usd : null;

    const points: BudgetTimelinePoint[] = [];
    const dailyValues: number[] = [];
    let cumulative = 0;
    let freeExceededOn: string | null = null;
    let limitReachedOn: string | null = null;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${input.month}-${pad(day)}`;
      if (day > lastDay) {
        points.push({ date, day, cumulative_usd: null, daily_usd: null });
        continue;
      }
      const daily = spendByDate.get(date) ?? 0;
      cumulative += daily;
      dailyValues.push(daily);
      if (freeExceededOn === null && freeLine > 0 && cumulative > freeLine) freeExceededOn = date;
      if (limitReachedOn === null && limitLine !== null && cumulative >= limitLine) limitReachedOn = date;
      points.push({ date, day, cumulative_usd: Number(cumulative.toFixed(4)), daily_usd: Number(daily.toFixed(4)) });
    }

    const base = {
      month: input.month,
      days_in_month: daysInMonth,
      points,
      free_line_usd: freeLine,
      limit_line_usd: limitLine,
      free_tier_exceeded_on: freeExceededOn,
      limit_reached_on: limitReachedOn,
    };
    const unavailable = (reason: BudgetTimeline['forecast_unavailable_reason']): BudgetTimeline => ({
      ...base,
      forecast: null,
      forecast_unavailable_reason: reason,
    });

    if (limitLine === null) return unavailable('no_limit');
    if (dailyValues.length === 0) return unavailable('no_data');
    if (limitReachedOn !== null) return unavailable('already_reached');
    if (cumulative <= 0) return unavailable('no_spend');
    if (dailyValues.length < MIN_OBSERVED_DAYS) return unavailable('insufficient_days');

    // 推定値: 直近 7 日平均 (期待) と月初からの平均。幅は推定値の差 ± 標準誤差で付ける
    const trailing = mean(dailyValues.slice(-TREND_WINDOW_DAYS));
    const monthToDate = mean(dailyValues);
    const variance =
      dailyValues.length > 1
        ? dailyValues.reduce((acc, v) => acc + (v - monthToDate) ** 2, 0) / (dailyValues.length - 1)
        : 0;
    const stdError = Math.sqrt(variance / dailyValues.length);
    const low = Math.max(0, Math.min(trailing, monthToDate) - stdError);
    const high = Math.max(trailing, monthToDate) + stdError;
    if (high <= 0) return unavailable('no_spend');

    const remaining = limitLine - cumulative;
    const reachDate = (rate: number): string | null =>
      rate > 0 ? addDays(lastObserved, Math.max(1, Math.ceil(remaining / rate))) : null;
    const expectedDate = reachDate(trailing > 0 ? trailing : high) as string;

    const projection: LimitReachForecast['projection'] = [];
    for (let day = lastDay; day <= daysInMonth; day++) {
      const k = day - lastDay;
      projection.push({
        date: `${input.month}-${pad(day)}`,
        day,
        expected: Number((cumulative + (trailing > 0 ? trailing : high) * k).toFixed(4)),
        low: Number((cumulative + low * k).toFixed(4)),
        high: Number((cumulative + high * k).toFixed(4)),
      });
    }

    return {
      ...base,
      forecast: {
        rate_per_day: { low, expected: trailing > 0 ? trailing : high, high },
        earliest: reachDate(high) as string,
        expected: expectedDate,
        latest: reachDate(low),
        from_date: lastObserved,
        from_cumulative_usd: Number(cumulative.toFixed(4)),
        projection,
      },
      forecast_unavailable_reason: null,
    };
  }
}
