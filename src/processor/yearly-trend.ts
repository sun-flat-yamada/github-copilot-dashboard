import type {
  RollingTrendEntry,
  YearlyTrendCloseRule,
  YearlyTrendMetricKey,
  YearlyTrendPoint,
  YearlyTrendStatus,
  YearlyTrendYoy,
} from '../types/copilot.js';

/**
 * 1 年推移 (P3-6 / B-01)。保存済みの月次集計から暦月 12 か月の系列を作り、
 * 確定 / 暫定 / 欠損を区別して前年同月比を付ける。欠損月は 0 で補完しない。
 *
 * 月次締め (P4-2: 凍結・チェックサム・改訂版) は未実装のため、締めは暦から導出する:
 * 翌月の第 5 営業日 (平日のみ。祝日は考慮しない) を過ぎた月を「確定」とする。
 * 確定は「締め日を過ぎた」ことだけを示し、数値の不変性は P4-2 で保証する。
 */
export const MONTH_CLOSE_BUSINESS_DAYS = 5;

export const YEARLY_TREND_CLOSE_RULE: YearlyTrendCloseRule = {
  business_days_after_month_end: MONTH_CLOSE_BUSINESS_DAYS,
  note: '翌月の第 5 営業日 (平日のみ・祝日は考慮しない) を過ぎた月を確定とする。数値の凍結・改訂履歴は月次締め (P4-2) で扱う。',
};

export const YEARLY_TREND_METRIC_KEYS: readonly YearlyTrendMetricKey[] = [
  'total_spend_usd',
  'total_seats',
  'active_seats',
  'acceptance_rate',
  'total_chats',
  'total_ai_credits_used',
];

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseMonth(month: string): { y: number; m: number } {
  if (!MONTH_RE.test(month)) throw new Error(`Invalid month: ${month}`);
  return { y: Number(month.slice(0, 4)), m: Number(month.slice(5, 7)) };
}

function formatMonth(y: number, m: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

/** month から n か月ずらした月 (n は負も可) */
export function shiftMonth(month: string, n: number): string {
  const { y, m } = parseMonth(month);
  const idx = y * 12 + (m - 1) + n;
  return formatMonth(Math.floor(idx / 12), (idx % 12) + 1);
}

/** 翌月の第 N 営業日 (UTC, 平日のみ) の日付 (YYYY-MM-DD) */
export function monthCloseDate(month: string, businessDays: number = MONTH_CLOSE_BUSINESS_DAYS): string {
  const next = shiftMonth(month, 1);
  const { y, m } = parseMonth(next);
  let counted = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(y, m - 1, day));
    if (d.getUTCMonth() !== m - 1) break;
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) counted++;
    if (counted === businessDays) return d.toISOString().slice(0, 10);
  }
  throw new Error(`Cannot compute close date for ${month}`);
}

/** 締め日 (UTC) を過ぎていれば closed。締め日当日から確定とする */
export function monthCloseStatus(month: string, now: Date): Exclude<YearlyTrendStatus, 'missing'> {
  return now.toISOString().slice(0, 10) >= monthCloseDate(month) ? 'closed' : 'provisional';
}

/** 窓 (終端月を含む 12 か月) と、その前年同月 12 か月。保存済み月次の読み込み対象 */
export function yearlyTrendMonthsNeeded(endMonth: string): string[] {
  const months: string[] = [];
  for (let i = 23; i >= 0; i--) months.push(shiftMonth(endMonth, -i));
  return months;
}

function yoyOf(current: number | null | undefined, prior: number | null | undefined, missingReason: string): YearlyTrendYoy {
  const cur = current ?? null;
  const pri = prior ?? null;
  if (cur === null) return { current: null, prior: pri, delta: null, change_rate: null, reason: missingReason };
  if (pri === null) return { current: cur, prior: null, delta: null, change_rate: null, reason: '前年同月のデータなし' };
  const delta = cur - pri;
  if (pri === 0) return { current: cur, prior: pri, delta, change_rate: null, reason: '前年同月が 0 のため変化率は算出しない' };
  return { current: cur, prior: pri, delta, change_rate: delta / pri };
}

const METRIC_MISSING_REASON = '当月の指標を取得できていない';

export interface BuildYearlyTrendInput {
  /** 窓の終端月 (通常は保存済み月次の最新月) */
  endMonth: string;
  /** 月 (YYYY-MM) -> 保存済み月次集計から作ったエントリ。保存が無い月は含めない */
  entries: ReadonlyMap<string, RollingTrendEntry>;
  now: Date;
}

/** 終端月までの暦月 12 か月 (古い順)。保存が無い月は missing (値 null) とし、0 で補完しない */
export function buildYearlyTrend({ endMonth, entries, now }: BuildYearlyTrendInput): YearlyTrendPoint[] {
  const points: YearlyTrendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const month = shiftMonth(endMonth, -i);
    const priorMonth = shiftMonth(month, -12);
    const entry = entries.get(month) ?? null;
    const prior = entries.get(priorMonth) ?? null;
    const monthMissing = entry === null ? 'この月の保存済み集計がない' : METRIC_MISSING_REASON;
    const yoy = {} as Record<YearlyTrendMetricKey, YearlyTrendYoy>;
    for (const key of YEARLY_TREND_METRIC_KEYS) {
      yoy[key] = yoyOf(entry ? entry[key] : null, prior ? prior[key] : null, monthMissing);
    }
    points.push({
      month,
      status: entry === null ? 'missing' : monthCloseStatus(month, now),
      closes_on: monthCloseDate(month),
      entry,
      prior_month: priorMonth,
      yoy,
    });
  }
  return points;
}
