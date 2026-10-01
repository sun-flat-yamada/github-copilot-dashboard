import { ScopeAggregatedData } from '../types/copilot.js';
import { MISSING_USAGE_METRICS } from './metrics-aggregator.js';

/**
 * 保存済みのスコープ集計が、実測の利用状況メトリクス (補完・チャット等) を持っているか。
 * usage_metrics が無い旧形式のファイルは daily_trends の有無で判定する。
 */
export function hasUsageMetrics(scope: ScopeAggregatedData | null | undefined): boolean {
  if (!scope) return false;
  if (scope.usage_metrics) return scope.usage_metrics.availability !== 'unavailable';
  return (scope.daily_trends?.length ?? 0) > 0;
}

/**
 * 利用状況メトリクスの取得に失敗した回の集計 (fresh: シート・費用のみ最新) に、
 * 前回成功時の集計 (previous) の利用状況セクションを引き継ぐ (Last-known-good)。
 *
 * - シート・費用・Cost Center 予算などは今回取得した最新の値を使う
 * - 利用状況 (受諾率・チャット・日次推移・言語・エージェント等) だけ前回値を引き継ぎ、
 *   usage_metrics.availability = 'carried_over' と取得時刻 (as_of) で前回値であることを明示する
 * - グループ別の按分推定値は、最新のシート比で再計算できないため引き継がない (null のまま)
 *
 * 前回値が無い (または前回も未取得の) 場合は fresh をそのまま返す。
 */
export function carryOverUsageSections(
  fresh: ScopeAggregatedData,
  previous: ScopeAggregatedData | null,
  asOf: string | null | undefined
): ScopeAggregatedData {
  if (!previous || !hasUsageMetrics(previous)) {
    return fresh;
  }

  const previousAsOf = previous.usage_metrics?.availability === 'carried_over' ? previous.usage_metrics.as_of : undefined;
  const missing = (previous.overview.missing_metrics ?? []).filter((m) => m !== MISSING_USAGE_METRICS);

  return {
    ...fresh,
    overview: {
      ...fresh.overview,
      overall_acceptance_rate: previous.overview.overall_acceptance_rate,
      total_suggestions: previous.overview.total_suggestions,
      total_acceptances: previous.overview.total_acceptances,
      total_chats: previous.overview.total_chats,
      total_pr_summaries: previous.overview.total_pr_summaries,
      total_cli_commands: previous.overview.total_cli_commands,
      missing_metrics: missing.length > 0 ? missing : undefined,
    },
    daily_trends: previous.daily_trends,
    top_languages: previous.top_languages,
    agent_summary: previous.agent_summary,
    code_generation_summary: previous.code_generation_summary,
    outcome_indicators: previous.outcome_indicators,
    adoption_distribution: previous.adoption_distribution ?? fresh.adoption_distribution,
    usage_metrics: {
      availability: 'carried_over',
      ...((previousAsOf ?? asOf) ? { as_of: (previousAsOf ?? asOf) as string } : {}),
    },
  };
}
