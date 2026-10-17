import React from 'react';
import { DollarSign, Sparkles, Users, Cpu } from 'lucide-react';
import { MonthlyReportAggregatedData } from '../../../../src/types/copilot';
import { useCurrency } from '../../contexts/CurrencyContext';
import { MetricLabel } from '../common/MetricLabel';
import { extractTotalAiCredits } from '../../utils/monthlyCreditsTrend';
import { computeActiveAccountStats, formatStatValue } from '../../utils/accountStats';

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

export interface CopilotPlanCounts {
  enterprise: number;
  business: number;
}

/**
 * 月次レポートデータから Copilot プラン (Enterprise / Business) の内訳人数を算出する。
 * 1. user_details に plan_type を持つユーザーが存在する場合はそれを優先集計 (フィルター時にも連動)
 * 2. 存在しない場合は sku_breakdown (seats 単位の SKU) から集計
 */
export function extractCopilotPlanCounts(reportData: MonthlyReportAggregatedData): CopilotPlanCounts {
  const usersWithPlan = (reportData.user_details ?? []).filter(
    (u) => typeof (u as any).plan_type === 'string' && (u as any).plan_type.length > 0
  );

  if (usersWithPlan.length > 0) {
    let enterprise = 0;
    let business = 0;
    for (const u of usersWithPlan) {
      const plan = ((u as any).plan_type || '').toLowerCase();
      if (plan.includes('enterprise')) {
        enterprise += 1;
      } else if (plan.includes('business')) {
        business += 1;
      }
    }
    return { enterprise, business };
  }

  let enterprise = 0;
  let business = 0;
  if (Array.isArray(reportData.sku_breakdown) && reportData.sku_breakdown.length > 0) {
    for (const item of reportData.sku_breakdown) {
      const name = (item.sku_name || '').toLowerCase();
      if (name.includes('enterprise')) {
        enterprise += item.total_quantity;
      } else if (name.includes('business')) {
        business += item.total_quantity;
      }
    }
  }

  return { enterprise, business };
}

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

          <div className="mt-2">
            {hasRequests && hasCredits ? (
              // 両方存在する場合: リクエストと AIC を行分離して併記
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400 font-medium">リクエスト:</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-lg font-black text-white tracking-tight" data-testid="report-requests-total">
                      {totalRequests.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">req</span>
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-amber-400 font-medium">AI クレジット:</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-base font-black text-amber-300 tracking-tight" data-testid="report-credits-total">
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
            <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] uppercase font-semibold text-slate-400">
                  利用アカウント (実績 &gt; 0):
                </span>
                <span
                  className={`font-mono font-semibold ${hasCredits ? 'text-amber-300' : 'text-slate-200'}`}
                  data-testid="report-requests-active-count"
                >
                  {(hasCredits ? credStats : reqStats).activeCount} 名
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center bg-slate-950/60 rounded-lg p-1.5 border border-slate-800/60">
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
          )}

          <p className="mt-1.5 text-[10px] text-slate-400 truncate">
            {hasRequests && hasCredits
              ? 'リクエスト呼出 & AIC 消費実績'
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
            {/* Copilot プラン内訳 (Enterprise / Business) */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs flex-wrap gap-1" data-testid="report-plan-breakdown">
              <span className="text-[10px] text-slate-400 font-medium">プラン内訳:</span>
              <div className="flex items-center space-x-2 text-[11px]">
                <span className="text-indigo-300 font-medium" data-testid="report-plan-enterprise">
                  Enterprise: <b className="font-bold font-mono text-white" data-testid="report-plan-enterprise-count">{enterprise}</b>名
                </span>
                <span className="text-slate-600 font-mono">/</span>
                <span className="text-slate-300 font-medium" data-testid="report-plan-business">
                  Business: <b className="font-bold font-mono text-white" data-testid="report-plan-business-count">{business}</b>名
                </span>
              </div>
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
