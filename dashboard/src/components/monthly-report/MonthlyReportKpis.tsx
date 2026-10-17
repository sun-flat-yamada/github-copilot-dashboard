import React from 'react';
import { DollarSign, Sparkles, Users, Cpu } from 'lucide-react';
import { MonthlyReportAggregatedData, ReportUserDetail } from '../../../../src/types/copilot';
import { useCurrency } from '../../contexts/CurrencyContext';
import { MetricLabel } from '../common/MetricLabel';
import { extractTotalAiCredits } from '../../utils/monthlyCreditsTrend';
import {
  computeActiveAccountStats,
  formatStatValue,
  computeDistributionBuckets,
  type DistributionBucket,
} from '../../utils/accountStats';

export type ReportKpiCardWidgetId =
  | 'report_kpi_cost'
  | 'report_kpi_requests'
  | 'report_kpi_active_users'
  | 'report_kpi_top_model';

export const ALL_REPORT_KPI_CARD_WIDGET_IDS: readonly ReportKpiCardWidgetId[] = [
  'report_kpi_cost',
  'report_kpi_requests',
  'report_kpi_active_users',
  'report_kpi_top_model',
] as const;

export interface PlanUserCounts {
  active: number;
  nonActive: number;
  total: number;
}

export interface CopilotPlanCounts {
  enterprise: PlanUserCounts;
  business: PlanUserCounts;
}

/**
 * ユーザーが当月アクティブ (稼働) かどうかを判定する。
 * 1. status が明示されている場合 ('active' | 'low_active' -> true, 'idle' | 'never_used' | 'inactive' -> false)
 * 2. is_active boolean がある場合はそれを優先
 * 3. 利用実績 (リクエスト数 > 0, AI クレジット消費 > 0, 費用 > 0, 最終活動日あり) があれば active、それ以外は nonActive
 */
export function isReportUserActive(u: ReportUserDetail): boolean {
  if (typeof (u as any).status === 'string') {
    const s = ((u as any).status || '').toLowerCase();
    if (s === 'active' || s === 'low_active') return true;
    if (s === 'idle' || s === 'never_used' || s === 'inactive' || s === 'non-active' || s === 'non_active') return false;
  }
  if (typeof (u as any).is_active === 'boolean') {
    return (u as any).is_active;
  }
  const requests = u.usage_insight?.usage?.requests ?? (typeof u.total_requests === 'number' ? u.total_requests : 0);
  const credits = u.usage_insight?.usage?.credits ?? (typeof (u as any).credits === 'number' ? (u as any).credits : 0);
  const spend = u.gross_spend_usd ?? u.total_spend_usd ?? 0;
  return requests > 0 || credits > 0 || spend > 0 || Boolean(u.last_activity_date);
}

/**
 * 月次レポートデータから Copilot プラン (Enterprise / Business) のアクティブ・ノンアクティブ内訳人数を算出する。
 * 1. user_details に plan_type を持つユーザーが存在する場合はそれを優先集計 (フィルター時にも連動)
 * 2. 存在しない場合は sku_breakdown (seats 単位の SKU) および overview.total_active_users から按分集計
 */
export function extractCopilotPlanCounts(reportData: MonthlyReportAggregatedData): CopilotPlanCounts {
  const usersWithPlan = (reportData.user_details ?? []).filter(
    (u) => typeof u.plan_type === 'string' && u.plan_type.length > 0
  );

  if (usersWithPlan.length > 0) {
    const enterprise: PlanUserCounts = { active: 0, nonActive: 0, total: 0 };
    const business: PlanUserCounts = { active: 0, nonActive: 0, total: 0 };

    for (const u of usersWithPlan) {
      const plan = (u.plan_type || '').toLowerCase();
      const isActive = isReportUserActive(u);
      if (plan.includes('enterprise')) {
        enterprise.total += 1;
        if (isActive) enterprise.active += 1;
        else enterprise.nonActive += 1;
      } else if (plan.includes('business')) {
        business.total += 1;
        if (isActive) business.active += 1;
        else business.nonActive += 1;
      }
    }
    return { enterprise, business };
  }

  let entTotal = 0;
  let bizTotal = 0;
  if (Array.isArray(reportData.sku_breakdown) && reportData.sku_breakdown.length > 0) {
    for (const item of reportData.sku_breakdown) {
      const name = (item.sku_name || '').toLowerCase();
      if (name.includes('enterprise')) {
        entTotal += item.total_quantity;
      } else if (name.includes('business')) {
        bizTotal += item.total_quantity;
      }
    }
  }

  const totalSeats = entTotal + bizTotal;
  const totalActive = reportData.overview?.total_active_users ?? 0;

  let entActive = 0;
  let entNonActive = entTotal;
  let bizActive = 0;
  let bizNonActive = bizTotal;

  if (totalSeats > 0) {
    if (totalActive >= totalSeats) {
      entActive = entTotal;
      entNonActive = 0;
      bizActive = bizTotal;
      bizNonActive = 0;
    } else {
      entActive = Math.min(entTotal, Math.round(totalActive * (entTotal / totalSeats)));
      bizActive = Math.min(bizTotal, Math.max(0, totalActive - entActive));
      entNonActive = Math.max(0, entTotal - entActive);
      bizNonActive = Math.max(0, bizTotal - bizActive);
    }
  }

  return {
    enterprise: { active: entActive, nonActive: entNonActive, total: entTotal },
    business: { active: bizActive, nonActive: bizNonActive, total: bizTotal },
  };
}

interface DistributionMiniHistogramProps {
  buckets: DistributionBucket[];
  unit: string;
  variant?: 'indigo' | 'amber';
}

/**
 * KPI カード内にコンパクトに配置する度数分布ミニヒストグラム
 */
const DistributionMiniHistogram: React.FC<DistributionMiniHistogramProps> = ({
  buckets,
  unit,
  variant = 'indigo',
}) => {
  if (buckets.length === 0) return null;
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="flex flex-col items-end shrink-0" data-testid="report-requests-distribution">
      <span className="text-[9px] text-slate-500 font-medium tracking-tight block text-right mb-0.5">
        分布 ({buckets.length}階級)
      </span>
      <div className="flex items-end gap-1 h-6 px-1.5 py-0.5 bg-slate-950/70 rounded border border-slate-800/70">
        {buckets.map((b, i) => {
          const heightPercent =
            b.count === 0 ? '8%' : `${Math.max(16, (b.count / maxCount) * 100)}%`;
          const barColor =
            b.count === 0
              ? 'bg-slate-800/80'
              : variant === 'amber'
              ? 'bg-amber-500 hover:bg-amber-400'
              : 'bg-indigo-500 hover:bg-indigo-400';

          return (
            <div
              key={i}
              className={`w-2 sm:w-2.5 rounded-t transition-colors cursor-help ${barColor}`}
              style={{ height: heightPercent }}
              title={`${b.label} ${unit}: ${b.count}名 (${b.percentage}%)`}
              data-testid={`distribution-bar-${i}`}
            />
          );
        })}
      </div>
    </div>
  );
};

interface MonthlyReportKpisProps {
  reportData: MonthlyReportAggregatedData;
}

interface SingleMonthlyReportKpiCardProps extends MonthlyReportKpisProps {
  cardId: ReportKpiCardWidgetId;
}

export const SingleMonthlyReportKpiCard: React.FC<SingleMonthlyReportKpiCardProps> = ({
  cardId,
  reportData,
}) => {
  const { formatMoney } = useCurrency();
  const grossDual = formatMoney(reportData.overview.total_gross_spend_usd);
  const netDual = formatMoney(reportData.overview.total_net_spend_usd);
  const discountDual = formatMoney(reportData.overview.total_discount_usd);

  switch (cardId) {
    case 'report_kpi_cost':
      return (
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm relative overflow-hidden" data-testid="report-kpi-cost">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">費用サマリー (Cost Overview)</span>
            <div className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-800/60 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium"><MetricLabel metricId="report_gross_spend" className="text-[10px] text-slate-400 font-medium" label="利用費用 (総額):" /></span>
              <div className="flex items-baseline space-x-1.5 flex-wrap">
                <span className="text-xl font-black text-white tracking-tight">
                  {grossDual.usd}
                </span>
                {grossDual.sub && (
                  <span className="text-xs font-semibold text-slate-400">
                    ({grossDual.sub})
                  </span>
                )}
              </div>
            </div>
            <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-1">
              <MetricLabel metricId="report_net_spend" className="text-[11px] text-amber-400 font-medium" label="超過請求費用:" hideWindow />
              <span className="font-mono font-bold text-amber-300 text-sm">
                {netDual.usd} {netDual.sub && <span className="text-[11px] text-amber-400/80 font-normal">({netDual.sub})</span>}
              </span>
            </div>
          </div>
          {reportData.overview.total_discount_usd > 0 && (
            <div className="mt-1 text-[10px] text-emerald-400/90 text-right">
              無料枠控除: -{discountDual.usd} {discountDual.sub && `(-${discountDual.sub})`}
            </div>
          )}
        </div>
      );

    case 'report_kpi_requests': {
      // ユーザー別利用実績の抽出 (正の利用実績 > 0 を集計)
      const userDetails = reportData.user_details ?? [];
      const reqValues = userDetails
        .map((u) => {
          const insightReq = u.usage_insight?.usage?.requests;
          if (typeof insightReq === 'number') return insightReq;
          return typeof u.total_requests === 'number' ? u.total_requests : 0;
        })
        .filter((v) => v > 0);

      const credValues = userDetails
        .map((u) => {
          const insightCred = u.usage_insight?.usage?.credits;
          if (typeof insightCred === 'number') return insightCred;
          const directCred = (u as unknown as { credits?: number }).credits;
          if (typeof directCred === 'number') return directCred;
          return 0;
        })
        .filter((v) => v > 0);

      const totalRequests = reportData.overview.total_requests ?? 0;
      const creditsExtraction = extractTotalAiCredits(reportData);
      const userCreditsSum = credValues.reduce((s, c) => s + c, 0);
      const totalCredits =
        credValues.length > 0
          ? userCreditsSum
          : !creditsExtraction.isEstimatedFromSpend
          ? creditsExtraction.totalCredits
          : 0;

      const hasRequests = totalRequests > 0 || reqValues.length > 0;
      const hasCredits = totalCredits > 0 || credValues.length > 0;

      const reqStats = computeActiveAccountStats(reqValues);
      const credStats = computeActiveAccountStats(credValues);
      const reqBuckets = computeDistributionBuckets(reqValues, 5);
      const credBuckets = computeDistributionBuckets(credValues, 5);
      const activeBuckets = hasRequests ? reqBuckets : credBuckets;
      const activeUnit = hasRequests ? 'req' : 'AIC';
      const activeVariant = hasRequests ? 'indigo' : 'amber';

      // 種別ごとのタイトル・バッジ・表示モード
      let cardLabel = '総リクエスト / クレジット';
      let badgeLabel = '実績なし';
      let badgeStyle = 'bg-slate-800 text-slate-400 border-slate-700';

      if (hasRequests && hasCredits) {
        cardLabel = '総リクエスト & AI クレジット';
        badgeLabel = 'リクエスト & AIC';
        badgeStyle = 'bg-purple-950 text-purple-300 border-purple-800/60';
      } else if (hasCredits) {
        cardLabel = '総 AI クレジット (AIC)';
        badgeLabel = 'AIC (クレジット)';
        badgeStyle = 'bg-amber-950 text-amber-300 border-amber-800/60';
      } else if (hasRequests) {
        cardLabel = '総リクエスト数';
        badgeLabel = 'リクエスト';
        badgeStyle = 'bg-indigo-950 text-indigo-300 border-indigo-800/60';
      }

      return (
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm relative overflow-hidden" data-testid="report-requests-card">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <MetricLabel metricId="report_requests" label={cardLabel} hideWindow />
            <div className="flex items-center space-x-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeStyle}`} data-testid="report-requests-badge">
                {badgeLabel}
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-950 border border-indigo-800/60 text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            {hasRequests && hasCredits ? (
              // 両方存在する場合: リクエストと AIC を行分離して併記
              <div className="space-y-1 min-w-0">
                <div className="flex items-baseline space-x-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 font-medium">リクエスト:</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-base font-black text-white tracking-tight" data-testid="report-requests-total">
                      {totalRequests.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">req</span>
                  </div>
                </div>
                <div className="flex items-baseline space-x-1.5 flex-wrap">
                  <span className="text-xs text-amber-400 font-medium">AI クレジット:</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-sm font-black text-amber-300 tracking-tight" data-testid="report-credits-total">
                      {totalCredits.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-amber-400/90">AIC</span>
                  </div>
                </div>
              </div>
            ) : hasCredits ? (
              // AI クレジットのみの場合
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-amber-300 tracking-tight" data-testid="report-requests-total">
                  {totalCredits.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-amber-400/90">AIC</span>
              </div>
            ) : (
              // リクエストのみ (または実績なし) の場合
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-white tracking-tight" data-testid="report-requests-total">
                  {totalRequests.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-400">req</span>
              </div>
            )}

            {/* 分布ミニグラフ (Mini Distribution Histogram) */}
            <DistributionMiniHistogram
              buckets={activeBuckets}
              unit={activeUnit}
              variant={activeVariant}
            />
          </div>

          {/* 利用アカウントにおける最大値・中央値・最小値の統計 */}
          {hasRequests && hasCredits ? (
            <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] space-y-1.5">
              <div className="bg-slate-950/60 rounded p-1.5 border border-slate-800/60 space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-indigo-300">Req ({reqStats.activeCount}名):</span>
                  <span className="text-slate-300 font-mono">
                    最小 <b data-testid="report-requests-min">{formatStatValue(reqStats.min)}</b> / 中央 <b className="text-indigo-300" data-testid="report-requests-median">{formatStatValue(reqStats.median)}</b> / 最大 <b data-testid="report-requests-max">{formatStatValue(reqStats.max)}</b>
                  </span>
                </div>
                <div className="flex items-center justify-between font-medium pt-1 border-t border-slate-900">
                  <span className="text-amber-400">AIC ({credStats.activeCount}名):</span>
                  <span className="text-slate-300 font-mono">
                    最小 <b data-testid="report-credits-min">{formatStatValue(credStats.min)}</b> / 中央 <b className="text-amber-300" data-testid="report-credits-median">{formatStatValue(credStats.median)}</b> / 最大 <b data-testid="report-credits-max">{formatStatValue(credStats.max)}</b>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1">
              <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800/60 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                  <span className="font-medium">利用アカウント (実績 &gt; 0):</span>
                  <span
                    className={`font-mono font-bold ${hasCredits ? 'text-amber-300' : 'text-slate-200'}`}
                    data-testid="report-requests-active-count"
                  >
                    {(hasCredits ? credStats : reqStats).activeCount} 名
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center pt-1 border-t border-slate-900">
                  <div>
                    <span className="text-[9px] text-slate-500 block">最小値</span>
                    <span className="font-mono text-slate-300 text-xs font-bold" data-testid="report-requests-min">
                      {formatStatValue((hasCredits ? credStats : reqStats).min)}
                    </span>
                  </div>
                  <div className="border-x border-slate-800/80">
                    <span className={`text-[9px] block font-medium ${hasCredits ? 'text-amber-400' : 'text-indigo-400'}`}>
                      中央値
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ${hasCredits ? 'text-amber-300' : 'text-indigo-300'}`}
                      data-testid="report-requests-median"
                    >
                      {formatStatValue((hasCredits ? credStats : reqStats).median)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">最大値</span>
                    <span className="font-mono text-slate-300 text-xs font-bold" data-testid="report-requests-max">
                      {formatStatValue((hasCredits ? credStats : reqStats).max)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="mt-1.5 text-[10px] text-slate-400 truncate">
            {hasRequests && hasCredits
              ? 'リクエスト呼出 & AIC 消費実績 (異なる尺度)'
              : hasCredits
              ? 'AI クレジット消費総量 (リクエスト数行なし)'
              : hasRequests
              ? 'リクエスト呼出総量 (AIC行なし)'
              : '利用実績データなし'}
          </p>
        </div>
      );
    }

    case 'report_kpi_active_users': {
      const { enterprise, business } = extractCopilotPlanCounts(reportData);
      return (
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col justify-between" data-testid="report-kpi-active-users">
          <div>
            <div className="flex items-center justify-between">
              <MetricLabel metricId="report_active_users" />
              <div className="p-1.5 rounded-lg bg-blue-950 border border-blue-800/60 text-blue-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-white tracking-tight" data-testid="report-active-users-total">
                {reportData.overview.total_active_users}
              </span>
              <span className="text-xs font-semibold text-slate-400">名</span>
            </div>
            {/* Copilot プラン内訳 (Enterprise / Business: アクティブ / ノンアクティブ) */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5" data-testid="report-plan-breakdown">
              <span className="text-[10px] text-slate-400 font-medium block">
                プラン内訳 (アクティブ / ノンアクティブ):
              </span>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between" data-testid="report-plan-enterprise">
                  <span className="text-indigo-300 font-medium">Enterprise ({enterprise.total}名):</span>
                  <span className="font-mono text-slate-300 text-[10px]">
                    アクティブ <b className="text-white font-bold" data-testid="report-plan-enterprise-active">{enterprise.active}</b>名
                    <span className="text-slate-600 mx-1">/</span>
                    ノンアクティブ <b className="text-slate-400 font-bold" data-testid="report-plan-enterprise-inactive">{enterprise.nonActive}</b>名
                  </span>
                </div>
                <div className="flex items-center justify-between" data-testid="report-plan-business">
                  <span className="text-slate-300 font-medium">Business ({business.total}名):</span>
                  <span className="font-mono text-slate-300 text-[10px]">
                    アクティブ <b className="text-white font-bold" data-testid="report-plan-business-active">{business.active}</b>名
                    <span className="text-slate-600 mx-1">/</span>
                    ノンアクティブ <b className="text-slate-400 font-bold" data-testid="report-plan-business-inactive">{business.nonActive}</b>名
                  </span>
                </div>
              </div>
              <span className="hidden" data-testid="report-plan-enterprise-count">{enterprise.total}</span>
              <span className="hidden" data-testid="report-plan-business-count">{business.total}</span>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">利用履歴のあるユニークアカウント</p>
        </div>
      );
    }

    case 'report_kpi_top_model': {
      const top3Models = (reportData.model_breakdown || []).slice(0, 3);
      return (
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col justify-between" data-testid="report-kpi-top-model">
          <div>
            <div className="flex items-center justify-between">
              <MetricLabel metricId="report_top_model" />
              <div className="p-1.5 rounded-lg bg-purple-950 border border-purple-800/60 text-purple-400">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {top3Models.length === 0 ? (
                <div className="text-xs text-slate-400 font-medium py-1">データなし</div>
              ) : (
                top3Models.map((item, idx) => (
                  <div
                    key={item.model_name || idx}
                    className="flex items-center justify-between text-xs"
                    data-testid={`report-top-model-rank-${idx + 1}`}
                  >
                    <div className="flex items-center space-x-1.5 min-w-0 mr-1.5">
                      <span
                        className={`text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded shrink-0 ${
                          idx === 0
                            ? 'bg-purple-900/80 text-purple-200 border border-purple-700/60 font-black'
                            : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className={`truncate font-medium ${
                          idx === 0 ? 'text-white' : 'text-slate-300'
                        }`}
                        title={item.model_name}
                      >
                        {item.model_name}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold text-xs shrink-0 ${
                        idx === 0 ? 'text-purple-300' : 'text-slate-400'
                      }`}
                    >
                      {item.percentage}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">上位3モデルのリクエスト占有率</p>
        </div>
      );
    }
  }
};

export const MonthlyReportKpis: React.FC<MonthlyReportKpisProps> = ({ reportData }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {ALL_REPORT_KPI_CARD_WIDGET_IDS.map((cardId) => (
        <SingleMonthlyReportKpiCard key={cardId} cardId={cardId} reportData={reportData} />
      ))}
    </div>
  );
};
