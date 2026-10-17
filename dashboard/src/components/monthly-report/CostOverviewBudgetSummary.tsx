import React, { useMemo } from 'react';
import type { CostCenterBudget, MonthlyReportAggregatedData } from '../../../../src/types/copilot';
import { useCurrency } from '../../contexts/CurrencyContext';
import { monthPeriod, summarizeBudgetForecast } from '../../utils/budgetForecast';

interface Props {
  reportData: MonthlyReportAggregatedData;
  budgets?: CostCenterBudget[];
}

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/**
 * 費用サマリー (Cost Overview) カード内の「Cost Center 予算の推移と上限到達予測」サマリー版。
 * 上限到達に最も近い Cost Center の現在利用料・無料枠・上限を数値で表示する。
 * 予算または日別データが無いときは何も表示しない (値を作らない)。
 */
export const CostOverviewBudgetSummary: React.FC<Props> = ({ reportData, budgets }) => {
  const { formatMoney } = useCurrency();
  const summary = useMemo(
    () => summarizeBudgetForecast(budgets ?? [], reportData.cost_center_daily, monthPeriod(reportData.report_month)),
    [budgets, reportData.cost_center_daily, reportData.report_month]
  );
  if (!summary) return null;

  const fmtUsd = (v: number) => formatMoney(v, { precisionUSD: 0, precisionSub: 0 }).usd;
  const f = summary.forecast;
  let forecastText = f.reason ?? '';
  if (f.status === 'reached') {
    forecastText = `${f.reachDate} に上限へ到達済み`;
  } else if (f.status === 'ok') {
    if (!f.reachDate) {
      forecastText = '予測: 上限には到達しない見込み';
    } else {
      const range =
        f.earliestDate || f.latestDate
          ? ` (80%: ${f.earliestDate ? md(f.earliestDate) : '〜'} 〜 ${f.latestDate ? md(f.latestDate) : '範囲外'})`
          : '';
      forecastText = `予測: ${f.reachDate} 頃に上限へ到達${range}`;
    }
  }

  return (
    <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1" data-testid="cost-overview-budget-summary">
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-medium">
        <span className="truncate" title={summary.costCenterName}>
          予算推移・上限到達予測: {summary.costCenterName}
        </span>
        {summary.totalCostCenters > 1 && <span className="shrink-0">他 {summary.totalCostCenters - 1} 件</span>}
      </div>
      <div className="grid grid-cols-3 gap-1 text-[10px]">
        <div>
          <span className="block text-slate-400">現在利用料</span>
          <span className="font-mono font-bold text-white text-xs" data-testid="budget-summary-current">{fmtUsd(summary.currentUsd)}</span>
        </div>
        <div>
          <span className="block text-emerald-400/90">無料枠</span>
          <span className="font-mono font-bold text-emerald-300 text-xs" data-testid="budget-summary-free-tier">{fmtUsd(summary.freeTierUsd)}</span>
        </div>
        <div>
          <span className="block text-rose-400/90">上限</span>
          <span className="font-mono font-bold text-rose-300 text-xs" data-testid="budget-summary-limit">
            {summary.spendingLimitUsd !== null ? fmtUsd(summary.spendingLimitUsd) : '未設定'}
          </span>
        </div>
      </div>
      {summary.progressPercent !== null && summary.limitLineUsd !== null && (
        <div>
          <div
            className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(summary.progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full ${summary.progressPercent >= 100 ? 'bg-rose-500' : summary.progressPercent >= 80 ? 'bg-amber-400' : 'bg-indigo-400'}`}
              style={{ width: `${Math.min(100, summary.progressPercent)}%` }}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            上限ライン (無料枠+上限) {fmtUsd(summary.limitLineUsd)} の {summary.progressPercent.toFixed(0)}%
          </div>
        </div>
      )}
      <p className="text-[10px] text-amber-300" role="status" data-testid="budget-summary-forecast">{forecastText}</p>
    </div>
  );
};
