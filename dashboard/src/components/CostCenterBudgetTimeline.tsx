import React, { useMemo, useState } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import type { CostCenterBudget, MonthlyReportAggregatedData } from '../../../src/types/copilot';
import { buildBudgetTimeline } from '../utils/budgetForecast';
import { useCurrency } from '../contexts/CurrencyContext';

interface Props {
  reportData: MonthlyReportAggregatedData;
  budgets: CostCenterBudget[];
}

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** Cost Center ごとの累積利用額・無料枠超過点・上限ライン・上限到達予測 (信頼区間つき) */
export const CostCenterBudgetTimeline: React.FC<Props> = ({ reportData, budgets }) => {
  const { formatMoney } = useCurrency();
  const dailyMap = reportData.cost_center_daily;
  const names = useMemo(
    () => budgets.map((b) => b.cost_center_name).filter((n) => (dailyMap?.[n]?.length ?? 0) > 0),
    [budgets, dailyMap]
  );
  const [selected, setSelected] = useState<string>('');
  const name = names.includes(selected) ? selected : names[0];
  const budget = budgets.find((b) => b.cost_center_name === name);

  const timeline = useMemo(
    () =>
      name && budget
        ? buildBudgetTimeline({
            month: reportData.report_month,
            daily: dailyMap?.[name] ?? [],
            freeTierUsd: budget.free_tier_budget_usd,
            spendingLimitUsd: budget.spending_limit_usd,
          })
        : null,
    [name, budget, reportData.report_month, dailyMap]
  );

  // 日別データを持たない旧形式のレポートでは、値を作らず何も表示しない
  if (!timeline || !name) return null;

  const fmt = (v: number) => formatMoney(v, { precisionUSD: 0, precisionSub: 0 }).usd;
  const { forecast } = timeline;
  const forecastText =
    forecast.status === 'reached'
      ? `${forecast.reachDate} に上限へ到達済み`
      : forecast.status === 'ok'
      ? forecast.reachDate
        ? `予測: ${forecast.reachDate} 頃に上限へ到達` +
          (forecast.earliestDate || forecast.latestDate
            ? ` (信頼区間 80%: ${forecast.earliestDate ? md(forecast.earliestDate) : '〜'} 〜 ${forecast.latestDate ? md(forecast.latestDate) : '範囲外'})`
            : '')
        : '予測: 上限には到達しない見込み'
      : forecast.reason;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg" data-testid="cost-center-budget-timeline">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <LineChartIcon className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Cost Center 予算の推移と上限到達予測 ({reportData.report_month})</h3>
        </div>
        <select
          aria-label="Cost Center"
          value={name}
          onChange={(e) => setSelected(e.target.value)}
          className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1"
        >
          {names.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-amber-300 mb-2" role="status">{forecastText}</p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={timeline.points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(d) => `${d}日`} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => fmt(Number(v))} width={64} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }}
              labelFormatter={(d) => timeline.points[Number(d) - 1]?.date ?? ''}
              formatter={(v, key) =>
                [Array.isArray(v) ? `${fmt(Number(v[0]))} 〜 ${fmt(Number(v[1]))}` : fmt(Number(v)),
                  key === 'actual' ? '累積利用額' : key === 'projected' ? '予測' : '信頼区間'] as [string, string]
              }
            />
            <Area dataKey="band" stroke="none" fill="#6366f1" fillOpacity={0.2} isAnimationActive={false} />
            <Line dataKey="projected" stroke="#818cf8" strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="actual" stroke="#e2e8f0" strokeWidth={2} dot={false} isAnimationActive={false} />
            {timeline.freeTierUsd > 0 && (
              <ReferenceLine y={timeline.freeTierUsd} stroke="#34d399" strokeDasharray="4 4"
                label={{ value: `無料枠 ${fmt(timeline.freeTierUsd)}`, fill: '#34d399', fontSize: 11, position: 'insideTopLeft' }} />
            )}
            {timeline.limitLineUsd !== null && (
              <ReferenceLine y={timeline.limitLineUsd} stroke="#f43f5e"
                label={{ value: `上限 (無料枠+Limit) ${fmt(timeline.limitLineUsd)}`, fill: '#f43f5e', fontSize: 11, position: 'insideTopLeft' }} />
            )}
            {timeline.freeTierExceededDate && (
              <ReferenceDot
                x={Number(timeline.freeTierExceededDate.slice(8, 10))}
                y={timeline.points[Number(timeline.freeTierExceededDate.slice(8, 10)) - 1]?.actual}
                r={5} fill="#f59e0b" stroke="#0f172a"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-slate-500 mt-2">
        実線: 累積利用額 (無料枠控除前) / 点線・帯: 直近の傾向からの予測と信頼区間 /
        {timeline.freeTierExceededDate ? ` ● 無料枠超過: ${timeline.freeTierExceededDate}` : ' 無料枠は未超過'}
      </p>
    </div>
  );
};
