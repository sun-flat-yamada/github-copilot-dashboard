import React, { useMemo } from 'react';
import { ScopeAggregatedData } from '../../../src/types/copilot';
import { DollarSign, Users, AlertTriangle, AlertCircle, CheckCircle2, MessageSquare, FileCode, Wallet } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { SEAT_IDLE_CRITERIA_TEXT } from '../../../src/domain/rules/SeatClassificationRule';
import { UNFILTERED_SECTION_NOTICE } from '../../../src/domain/constants/filter-scope';
import { qualify } from '../../../src/domain/metrics/metric-registry';
import { MetricValue } from './common/MetricValue';
import { MetricLabel } from './common/MetricLabel';
import { PeriodDelta } from './common/PeriodDelta';
import { ForecastNote } from './common/ForecastNote';
import { forecastMonthEnd, previousPeriodLabel, type ForecastResult } from '../../../src/domain/metrics/kpi-analysis';

interface KpiSummaryCardsProps {
  data: ScopeAggregatedData;
  /** デモデータ由来か。true のとき各 KPI に「デモ」バッジを付ける */
  isDemo?: boolean;
  /** 前期 (月次=前月 / 日次=前日) のスコープ。無ければ前期比は「—（理由）」 */
  previousData?: ScopeAggregatedData | null;
  /** 現在時刻 (月末予測の「締め済み月」判定用。テストで固定する) */
  now?: Date;
}

/** 予算消化率 = 超過請求費用 / 支出上限。上限未設定・費用未取得は null (0 にしない) */
function budgetUtilization(overview: ScopeAggregatedData['overview'] | undefined): number | null {
  if (!overview) return null;
  const limit = overview.total_spending_limit_usd;
  const net = overview.total_net_billable_usd;
  if (limit === undefined || limit <= 0 || net === undefined) return null;
  return net / limit;
}

export const KpiSummaryCards: React.FC<KpiSummaryCardsProps> = ({ data, isDemo = false, previousData = null, now }) => {
  const { overview, scope_type } = data;
  const { formatMoney } = useCurrency();

  // スコープ種別ごとの費用の定義 (値は seatCostForScope と一致: 日次=日割り / 月次=月額満額 / 期間=日割り×日数)
  const costLabel =
    scope_type === 'daily'
      ? '当日 日割り費用'
      : scope_type === 'monthly'
      ? '当月 月額費用 (シート費)'
      : '期間 費用 (日割り×日数)';
  const metricScope = scope_type;

  // 前期比 (月次=前月比 / 日次=前日比 / 期間=比較対象なし)
  const deltaLabel = previousPeriodLabel(scope_type);
  const prevOverview = previousData?.overview;
  const prevReason = deltaLabel === null
    ? '期間スコープは比較対象を定義しません'
    : `${scope_type === 'monthly' ? '前月' : '前日'}のデータがありません`;
  const usdDelta = (v: number) => formatMoney(v).usd;

  // 月末着地予測 (月次スコープのみ。観測値だけから算出し、不足時は理由付きで出さない)
  const { spendForecast, creditsForecast } = useMemo(() => {
    const notMonthly: ForecastResult = { status: 'unavailable', reason: '月次スコープでのみ月末予測を算出します' };
    if (scope_type !== 'monthly') return { spendForecast: notMonthly, creditsForecast: notMonthly };
    const month = data.scope_key;
    const asOf = now ?? new Date();
    const trends = data.daily_trends ?? [];
    const spend = forecastMonthEnd(trends.map((t) => ({ date: t.date, value: t.daily_cost_usd })), { month, now: asOf });
    const hasCredits = trends.some((t) => typeof t.ai_credits_used === 'number');
    const credits: ForecastResult = hasCredits
      ? forecastMonthEnd(trends.map((t) => ({ date: t.date, value: t.ai_credits_used })), { month, now: asOf })
      : { status: 'unavailable', reason: 'AI Credits の日次値を取得できていません' };
    return { spendForecast: spend, creditsForecast: credits };
  }, [scope_type, data.scope_key, data.daily_trends, now]);
  const forecastUnfiltered = data.filter_notice?.unfiltered_sections.includes('daily_trends') ?? false;

  // 予算消化率 (支出上限が無いときは欠損)
  const budgetRate = budgetUtilization(overview);
  const prevBudgetRate = budgetUtilization(prevOverview);

  const isChatMissing = overview.missing_metrics?.includes('copilot_ide_chat');
  const isLanguageMissing = overview.missing_metrics?.includes('copilot_ide_code_completions');

  // 利用状況メトリクス (受諾率・チャット・PR) の出所。取得できていないものを 0 として描画しない
  const usageAvailability = data.usage_metrics?.availability ?? 'live';
  const isUsageUnavailable = usageAvailability === 'unavailable' || overview.overall_acceptance_rate === null;
  const isUsageCarriedOver = usageAvailability === 'carried_over';
  const isUsageUnfiltered = data.filter_notice?.unfiltered_sections.includes('usage_metrics') ?? false;

  const spendDual = formatMoney(overview.total_spend_usd);
  const netBillableDual = overview.total_net_billable_usd !== undefined ? formatMoney(overview.total_net_billable_usd) : null;
  const spendingLimitDual = overview.total_spending_limit_usd !== undefined && overview.total_spending_limit_usd > 0
    ? formatMoney(overview.total_spending_limit_usd, { precisionUSD: 0, precisionSub: 0 })
    : null;
  const idleWasteDual = formatMoney(overview.idle_waste_usd);

  // 品質属性 (Metric Registry): 実測 / 推定 / 欠損 / デモ
  const spendQ = qualify('total_spend', overview.total_spend_usd, { isDemo });
  const activeQ = qualify('active_rate', overview.active_ratio, { isDemo });
  const idleQ = qualify('idle_waste', overview.idle_waste_usd, {
    isDemo,
    estimatedReason: `遊休の判定基準 (${SEAT_IDLE_CRITERIA_TEXT}) に基づく見込み額です。確定した削減額ではありません`,
  });
  const budgetQ = qualify('budget_utilization', budgetRate, {
    isDemo,
    missingReason: overview.total_spending_limit_usd === undefined || overview.total_spending_limit_usd <= 0
      ? '支出上限が未設定です'
      : '超過請求費用を取得できていません',
  });
  const acceptanceQ = qualify('acceptance_rate', isUsageUnavailable ? null : overview.overall_acceptance_rate, {
    isDemo,
    missingReason: '利用状況メトリクスを取得できていません',
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4" data-testid="kpi-summary-cards">
      {/* 1. 総費用 (利用費用 & 超過請求費用) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all" title="GitHubのカタログ価格(USD)基準">
        <div className="flex items-center justify-between">
          <MetricLabel metricId="total_spend" scopeType={metricScope} label={costLabel} />
          <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline space-x-2 flex-wrap">
            <MetricValue
              qualified={spendQ}
              format={() => <>{spendDual.usd}{spendDual.sub && <span className="text-sm font-semibold text-slate-400"> ({spendDual.sub})</span>}</>}
            />
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">利用費用</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            契約シート数: <span className="text-slate-300 font-medium">{overview.total_seats} 席</span>
          </p>
          <PeriodDelta
            testId="delta-total_spend"
            label={deltaLabel}
            current={overview.total_spend_usd}
            previous={prevOverview?.total_spend_usd}
            formatDelta={usdDelta}
            unavailableReason={prevReason}
          />
          {(overview.cost_unconfirmed_seats ?? 0) > 0 && (
            <p
              className="text-[11px] text-amber-400 mt-1 flex items-center space-x-1"
              data-testid="cost-unconfirmed-note"
              title="API が plan_type を返さない / 未知の値のシートは、料金を推測せず費用に含めていません"
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>料金プラン未確定 {overview.cost_unconfirmed_seats} 席は費用に含まれません</span>
            </p>
          )}

          {/* 超過請求費用 & 上限Limit設定値の併記 */}
          {netBillableDual && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] flex-wrap gap-1">
              <span className="text-slate-400">超過請求費用:</span>
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="font-mono font-semibold text-emerald-400">
                  {netBillableDual.usd}
                </span>
                {netBillableDual.sub && (
                  <span className="font-mono text-[10px] text-emerald-500/80">
                    ({netBillableDual.sub})
                  </span>
                )}
                {spendingLimitDual && (
                  <span className="text-slate-500 font-mono text-[10px]">
                    (上限: {spendingLimitDual.usd}{spendingLimitDual.sub ? ` [${spendingLimitDual.sub}]` : ''})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 月末着地予測 (推定): 費用 / AI Credits */}
          <ForecastNote
            metricId="spend_forecast"
            result={spendForecast}
            scopeType={metricScope}
            isDemo={isDemo}
            format={(v) => formatMoney(v).usd}
          />
          <ForecastNote
            metricId="credits_forecast"
            result={creditsForecast}
            scopeType={metricScope}
            isDemo={isDemo}
            format={(v) => `${Math.round(v).toLocaleString()} credits`}
          />
          {forecastUnfiltered && (
            <p className="text-[10px] text-slate-500 mt-1" data-testid="forecast-unfiltered-note">
              月末予測は日次推移 (全社値) から算出しています: {UNFILTERED_SECTION_NOTICE}
            </p>
          )}
        </div>
      </div>

      {/* 2. アクティブ率 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <MetricLabel metricId="active_rate" scopeType={metricScope} />
          <div className="p-2 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <MetricValue qualified={activeQ} format={(v) => `${(v * 100).toFixed(1)}%`} />
          <p className="text-xs text-slate-500 mt-1">
            稼働ユーザー: <span className="text-blue-400 font-medium">{overview.active_users}</span> / {overview.total_seats} 名
          </p>
          <PeriodDelta
            testId="delta-active_rate"
            label={deltaLabel}
            current={overview.active_ratio}
            previous={prevOverview?.active_ratio}
            formatDelta={(v) => `${(v * 100).toFixed(1)}pt`}
            tone="higher-better"
            unavailableReason={prevReason}
          />
          {(overview.onboarding_seats ?? 0) > 0 && (
            <p
              className="text-[11px] text-sky-400 mt-1"
              data-testid="onboarding-note"
              title="付与から間もなく、まだ利用がないシートです。遊休 (削減可能) には含めていません"
            >
              導入期間 {overview.onboarding_seats} 席 (遊休に含まない)
            </p>
          )}
        </div>
      </div>

      {/* 3. 遊休コスト / 削減可能額 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-800/80 transition-all">
        <div className="flex items-center justify-between">
          <MetricLabel metricId="idle_waste" scopeType={metricScope} className="text-xs font-medium text-amber-400" />
          <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <MetricValue
            qualified={idleQ}
            valueClassName="text-2xl font-bold text-amber-300"
            format={() => <>{idleWasteDual.usd}{idleWasteDual.sub && <span className="text-sm font-semibold text-amber-400/80"> ({idleWasteDual.sub})</span>}</>}
          />
          <p className="text-xs text-slate-500 mt-1" title={`遊休の判定基準: ${SEAT_IDLE_CRITERIA_TEXT}`}>
            遊休 ({SEAT_IDLE_CRITERIA_TEXT}): <span className="text-amber-400 font-semibold">{overview.idle_seats} 席</span>
          </p>
          <PeriodDelta
            testId="delta-idle_waste"
            label={deltaLabel}
            current={overview.idle_waste_usd}
            previous={prevOverview?.idle_waste_usd}
            formatDelta={usdDelta}
            tone="lower-better"
            unavailableReason={prevReason}
          />
        </div>
      </div>

      {/* 4. 予算消化率 (支出上限に対する超過請求費用。上限未設定は欠損) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <MetricLabel metricId="budget_utilization" scopeType={metricScope} />
          <div className="p-2 rounded-lg bg-teal-950/80 border border-teal-800/60 text-teal-400">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <MetricValue qualified={budgetQ} format={(v) => `${(v * 100).toFixed(1)}%`} />
          {budgetRate !== null && netBillableDual && spendingLimitDual && (
            <p className="text-xs text-slate-500 mt-1">
              超過請求 <span className="text-slate-300 font-medium">{netBillableDual.usd}</span> / 上限 {spendingLimitDual.usd}
            </p>
          )}
          <PeriodDelta
            testId="delta-budget_utilization"
            label={deltaLabel}
            current={budgetRate}
            previous={prevBudgetRate}
            formatDelta={(v) => `${(v * 100).toFixed(1)}pt`}
            unavailableReason={prevBudgetRate === null && previousData ? '前期の支出上限が未設定です' : prevReason}
          />
        </div>
      </div>

      {/* 5. 参考: Inline補完受諾率 & コード貢献 (欠損時は「—」と理由を表示) */}
      <div 
        className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all"
        title="IDEコード補完（Ghost Text）の受諾率です。Copilot CLIやAutopilot自律モードの作業は含まれません。"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <MetricLabel metricId="acceptance_rate" scopeType={metricScope} className="text-xs font-medium text-purple-400" />
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-700 text-slate-400"
              data-testid="acceptance-reference-chip"
              title="補完の適合度であり、生産性指標ではありません (SDD-06 §4.2)"
            >
              参考
            </span>
          </div>
          <div className="flex items-center space-x-1">
            {isUsageCarriedOver && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800"
                data-testid="usage-carried-over-badge"
                title={`利用状況メトリクスの取得に失敗したため、前回成功時の値を表示しています${data.usage_metrics?.as_of ? ` (取得: ${data.usage_metrics.as_of})` : ''}`}
              >
                前回値
              </span>
            )}
            {isUsageUnfiltered && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700"
                data-testid="usage-unfiltered-badge"
                title="利用状況メトリクスはユーザー別の実測を持たないため、フィルターで絞り込まれません (全社の値)"
              >
                {UNFILTERED_SECTION_NOTICE}
              </span>
            )}
            {(isChatMissing || isLanguageMissing) && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center space-x-1"
                title="一部のメトリクスがAPIエラーにより取得不能でした"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>データ一部不明</span>
              </span>
            )}
            <div className="p-2 rounded-lg bg-purple-950/80 border border-purple-800/60 text-purple-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="mt-3">
          {isUsageUnavailable ? (
            <>
              <div data-testid="usage-unavailable">
                <MetricValue qualified={acceptanceQ} format={() => null} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                取得不可: 利用状況メトリクス (補完・チャット等) を取得できていません
              </p>
            </>
          ) : (
            <>
              <MetricValue
                qualified={acceptanceQ}
                valueClassName="text-2xl font-bold text-purple-300"
                format={(v) => `${(v * 100).toFixed(1)}%`}
              />
              <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center space-x-1">
                  {isChatMissing ? (
                    <span className="text-rose-400 flex items-center space-x-1 font-semibold" title="チャットAPI取得異常">
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                      <span>不明 (API制限)</span>
                    </span>
                  ) : (
                    <>
                      <MessageSquare className="w-3 h-3 text-slate-400" />
                      <span>{overview.total_chats === null ? '—' : overview.total_chats.toLocaleString()} chats</span>
                    </>
                  )}
                </span>
                <span className="flex items-center space-x-1">
                  <FileCode className="w-3 h-3 text-slate-400" />
                  <span>{overview.total_pr_summaries === null ? '—' : overview.total_pr_summaries.toLocaleString()} PRs</span>
                </span>
              </div>
              <PeriodDelta
                testId="delta-acceptance_rate"
                label={deltaLabel}
                current={isUsageUnavailable ? null : overview.overall_acceptance_rate}
                previous={prevOverview?.overall_acceptance_rate}
                formatDelta={(v) => `${(v * 100).toFixed(1)}pt`}
                unavailableReason={prevReason}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
