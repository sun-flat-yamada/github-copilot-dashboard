import { AnalysisScopeType, EnrichedUserSeat } from '../entities/copilot.js';
import { isIdleSeatStatus } from './SeatClassificationRule.js';

/**
 * スコープ種別に応じたシート費用 (USD) を返す唯一の実装。
 * - daily: 日割り費用 (prorated_daily_cost_usd)
 * - monthly: 月額 (monthly_cost_usd)
 * - custom: 日割り費用 × 期間の日数
 *
 * パイプライン (MetricsAggregator) とブラウザ側のフィルター再集計 (filterEngine) が
 * 別々に計算していたため、フィルター適用時に日次・期間スコープの費用が月額に変わっていた。
 * 両者がこの関数を使うことで、フィルターの有無で費用の単位が変わらないことを保証する。
 */
export function seatCostForScope(
  seat: Pick<EnrichedUserSeat, 'monthly_cost_usd' | 'prorated_daily_cost_usd'>,
  scopeType: AnalysisScopeType,
  daysCount: number
): number {
  switch (scopeType) {
    case 'daily':
      return seat.prorated_daily_cost_usd;
    case 'monthly':
      return seat.monthly_cost_usd;
    default:
      return seat.prorated_daily_cost_usd * daysCount;
  }
}

/**
 * 遊休シートの月額換算の削減可能額 (USD)。スコープ種別 (日次 / 期間) に関わらず、
 * シート単価は月額なので、遊休シートの月額費用の合計を返す。
 * (overview.idle_waste_usd はスコープ内の費用で、日次スコープでは日割りの値になるため、
 *  「削減可能: $X/月」「年間推計」の表示には使えない)
 */
export function monthlyIdleSavingsUsd(
  users: Array<Pick<EnrichedUserSeat, 'status' | 'monthly_cost_usd'>>
): number {
  return users.filter((u) => isIdleSeatStatus(u.status)).reduce((sum, u) => sum + u.monthly_cost_usd, 0);
}
