import { RollingTrendEntry, ScopeAggregatedData } from '../types/copilot.js';
import { hasUsageMetrics } from './scope-merge.js';

/**
 * 保存済みの月次集計 (processed/monthly) から 1 か月分の推移エントリを実値で構成する。
 *
 * 利用状況メトリクスが取得できていない月は、受諾率・チャット数を 0 や固定値で埋めず null とする。
 * (旧実装は「当月のスナップショット値」と受諾率 0.35 を全月に複写しており、推移として成立していなかった)
 */
export function buildRollingTrendEntry(month: string, scope: ScopeAggregatedData): RollingTrendEntry {
  const usage = hasUsageMetrics(scope);
  const creditsUsed = (scope.users ?? []).reduce((sum, u) => sum + (u.ai_credits_used_28d ?? 0), 0);

  return {
    month,
    total_spend_usd: scope.overview.total_spend_usd,
    total_seats: scope.overview.total_seats,
    active_seats: scope.overview.active_users,
    idle_seats: scope.overview.idle_seats,
    acceptance_rate: usage ? scope.overview.overall_acceptance_rate : null,
    total_chats: usage ? scope.overview.total_chats : null,
    total_ai_credits_used: creditsUsed,
    total_agent_sessions: scope.agent_summary?.total_sessions ?? null,
    agent_adoption_rate: scope.agent_summary?.adoption_rate ?? null,
  };
}
