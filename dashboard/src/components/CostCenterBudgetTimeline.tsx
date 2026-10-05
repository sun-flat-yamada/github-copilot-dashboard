import React, { useMemo, useState } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import type { CostCenterBudget } from '../../../src/types/copilot';
import { buildBudgetTimeline, dayIndex, forecastReachSpan, type DailySpend } from '../utils/budgetForecast';
import { useCurrency } from '../contexts/CurrencyContext';

interface Props {
  budgets: CostCenterBudget[];
  /** Cost Center 名 -> 日次費用 (gross)。無いときは何も表示しない (値を作らない) */
  costCenterDaily?: Record<string, DailySpend[]>;
  /** 表示期間 (YYYY-MM-DD, 両端を含む)。選択中の区間に合わせる */
  start: string;
  end: string;
  /** 上限到達予測を出すか。上限・無料枠は月次の枠なので月次の区間だけ true */
  forecastEnabled: boolean;
  /** 費用の出所の注記 */
  note?: string;
}

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** Cost Center ごとの累積利用額・無料枠超過点・上限ライン・上限到達予測 (信頼区間つき) */
export const CostCenterBudgetTimeline: React.FC<Props> = ({ budgets, costCenterDaily, start, end, forecastEnabled, note }) => {
  const { formatMoney } = useCurrency();
  const dailyMap = costCenterDaily;
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
            start,
            end,
            forecastEnabled,
            daily: dailyMap?.[name] ?? [],
            freeTierUsd: budget.free_tier_budget_usd,
            spendingLimitUsd: budget.spending_limit_usd,
          })
        : null,
    [name, budget, start, end, forecastEnabled, dailyMap]
  );

  // 日別データを持たない旧形式のレポートでは、値を作らず何も表示しない
  if (!timeline || !name) return null;

  const fmt = (v: number) => formatMoney(v, { precisionUSD: 0, precisionSub: 0 }).usd;
  const { forecast } = timeline;
  const span = forecastReachSpan(timeline);
  const reachedDay = forecast.status === 'reached' && forecast.reachDate ? dayIndex(timeline.startDate, timeline.daysInMonth, forecast.reachDate) : null;
  const freeDay = timeline.freeTierExceededDate ? dayIndex(timeline.startDate, timeline.daysInMonth, timeline.freeTierExceededDate) : null;
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
          <h3 className="text-sm font-bold text-white">Cost Center 予算の推移と上限到達予測 ({start === end ? start : `${start} 〜 ${end}`})</h3>
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
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(d) => md(timeline.points[Number(d) - 1]?.date ?? '')} interval="preserveStartEnd" />
            <YAxis domain={[0, (dataMax: number) => dataMax * 1.1]} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => fmt(Number(v))} width={64} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }}
              labelFormatter={(d) => timeline.points[Number(d) - 1]?.date ?? ''}
              formatter={(v, key) =>
                [Array.isArray(v) ? `${fmt(Number(v[0]))} 〜 ${fmt(Number(v[1]))}` : fmt(Number(v)),
                  key === 'actual' ? '累積利用額' : key === 'projected' ? '予測' : '信頼区間'] as [string, string]
              }
            />
            {span && (
              <ReferenceArea x1={span.fromDay} x2={span.toDay} fill="#f43f5e" fillOpacity={0.12}
                stroke="#f43f5e" strokeOpacity={0.5} strokeDasharray="3 3" />
            )}
            <Area dataKey="band" stroke="none" fill="#6366f1" fillOpacity={0.2} isAnimationActive={false} />
            <Line dataKey="projected" stroke="#818cf8" strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="actual" stroke="#e2e8f0" strokeWidth={2} dot={false} isAnimationActive={false} />
            {timeline.freeTierUsd > 0 && (
              <ReferenceLine y={timeline.freeTierUsd} stroke="#34d399" strokeDasharray="4 4"
                label={{ value: `無料枠 ${fmt(timeline.freeTierUsd)}`, fill: '#34d399', fontSize: 11, position: 'insideTopLeft' }} />
            )}
            {timeline.limitLineUsd !== null && (
              <ReferenceLine y={timeline.limitLineUsd} stroke="#f43f5e" strokeWidth={2} ifOverflow="extendDomain"
                label={{ value: `上限 (無料枠+Limit) ${fmt(timeline.limitLineUsd)}`, fill: '#f43f5e', fontSize: 11, position: 'insideBottomRight' }} />
            )}
            {span?.expectedDay != null && timeline.limitLineUsd !== null && (
              <ReferenceDot x={span.expectedDay} y={timeline.limitLineUsd} r={5} fill="#f43f5e" stroke="#0f172a" />
            )}
            {reachedDay !== null && (
              <ReferenceDot x={reachedDay} y={timeline.points[reachedDay - 1]?.actual} r={6} fill="#f43f5e" stroke="#0f172a" />
            )}
            {freeDay !== null && (
              <ReferenceDot
                x={freeDay}
                y={timeline.points[freeDay - 1]?.actual}
                r={5} fill="#f59e0b" stroke="#0f172a"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {span?.beyondMonthEnd && (
        <p className="text-[11px] text-slate-400 mt-2">※ 到達予想の幅が月末を超えています (赤い帯は月末まで表示。月内に到達しない見込みの側を含みます)</p>
      )}
      {note && <p className="text-[11px] text-slate-400 mt-2">{note}</p>}
      <p className="text-[11px] text-slate-500 mt-2">
        実線: 累積利用額 (無料枠控除前) / 点線・青い帯: 直近の傾向からの予測と信頼区間 / 赤い帯: 上限到達予想日の幅 /
        {timeline.freeTierExceededDate ? ` ● 無料枠超過: ${timeline.freeTierExceededDate}` : ' 無料枠は未超過'}
      </p>
    </div>
  );
};
