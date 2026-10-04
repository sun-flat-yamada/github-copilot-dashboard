import type { BusinessCalendarConfig } from '../domain/entities/month-close.js';
import { DEFAULT_BUSINESS_CALENDAR, DEFAULT_CLOSE_BUSINESS_DAYS } from '../domain/entities/month-close.js';
import { monthCloseDate, shiftMonth } from './month-close.js';
import type {
  RollingTrendEntry,
  YearlyTrendCloseRule,
  YearlyTrendMetricKey,
  YearlyTrendPoint,
  YearlyTrendYoy,
} from '../types/copilot.js';

/**
 * 1 年推移 (P3-6 / B-01)。保存済みの月次集計から暦月 12 か月の系列を作り、
 * 確定 / 暫定 / 欠損を区別して前年同月比を付ける。欠損月は 0 で補完しない。
 *
 * 確定 (closed) は、月次締め (P4-2) の確定スナップショットがある月だけである。締め日 (翌月の第 N 営業日、
 * 営業日カレンダーは設定可能) を過ぎただけでは確定にしない。確定後の改訂は `revision_count` に表れる。
 */
export const MONTH_CLOSE_BUSINESS_DAYS = DEFAULT_CLOSE_BUSINESS_DAYS;

export { shiftMonth, monthCloseDate };

export function buildYearlyTrendCloseRule(calendar: BusinessCalendarConfig = DEFAULT_BUSINESS_CALENDAR): YearlyTrendCloseRule {
  const holidays = calendar.holidays.length > 0 ? `・祝日 ${calendar.holidays.length} 件を休業日に追加` : '';
  return {
    business_days_after_month_end: calendar.close_business_days,
    note: `翌月の第 ${calendar.close_business_days} 営業日 (土日除外${holidays}) に数値を確定 (凍結) し、チェックサムを付ける。確定後の変更は改訂として履歴に残る。確定スナップショットが無い月は暫定とする。`,
  };
}

export const YEARLY_TREND_CLOSE_RULE: YearlyTrendCloseRule = buildYearlyTrendCloseRule();

export const YEARLY_TREND_METRIC_KEYS: readonly YearlyTrendMetricKey[] = [
  'total_spend_usd',
  'total_seats',
  'active_seats',
  'acceptance_rate',
  'total_chats',
  'total_ai_credits_used',
];

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
  /** 月次締め (P4-2) の確定スナップショットがある月 -> 改訂回数。ここに無い月は暫定 */
  closedMonths: ReadonlyMap<string, { revision_count: number }>;
  /** 営業日カレンダー (締め日の表示用)。省略時は既定 (土日除外・第 5 営業日) */
  calendar?: BusinessCalendarConfig;
}

/** 終端月までの暦月 12 か月 (古い順)。保存が無い月は missing (値 null) とし、0 で補完しない */
export function buildYearlyTrend({ endMonth, entries, closedMonths, calendar }: BuildYearlyTrendInput): YearlyTrendPoint[] {
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
    const closed = closedMonths.get(month);
    points.push({
      month,
      status: entry === null ? 'missing' : closed ? 'closed' : 'provisional',
      closes_on: monthCloseDate(month, calendar),
      ...(closed ? { revision_count: closed.revision_count } : {}),
      entry,
      prior_month: priorMonth,
      yoy,
    });
  }
  return points;
}
