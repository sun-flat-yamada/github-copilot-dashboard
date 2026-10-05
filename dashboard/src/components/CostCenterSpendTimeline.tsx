import React, { useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, ReferenceDot,
} from 'recharts';
import { LineChart as LineChartIcon, CalendarClock } from 'lucide-react';
import type { CostCenterBudget, ReportCostCenterDaily } from '../../../src/types/copilot';
import { BudgetForecastRule, type BudgetTimeline } from '../../../src/domain/rules/BudgetForecastRule';
import { useCurrency } from '../contexts/CurrencyContext';

interface Props {
  budgets: CostCenterBudget[];
  /** Cost Center 名 -> 日次費用 (月次レポート)。無い (ライブ集計など) ときは「日次データなし」を表示する */
  costCenterDaily?: Record<string, ReportCostCenterDaily[]>;
  /** YYYY-MM */
  month?: string;
}

const UNAVAILABLE_TEXT: Record<NonNullable<BudgetTimeline['forecast_unavailable_reason']>, string> = {
  no_limit: '上限Budgetが未設定のため、到達予想は表示しません',
  no_data: '日次データがないため、到達予想は表示しません',
  insufficient_days: '観測日数が3日未満のため、到達予想は表示しません',
  no_spend: '利用実績がないため、到達予想は表示しません',
  already_reached: '',
};

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

const TimelineCard: React.FC<{ budget: CostCenterBudget; daily: ReportCostCenterDaily[]; month: string }> = ({
  budget, daily, month,
}) => {
  const { formatMoney } = useCurrency();
  const usd = (v: number) => formatMoney(v, { precisionUSD: 0, precisionSub: 0 }).usd;

  const timeline = useMemo(
    () => BudgetForecastRule.buildTimeline({
      month,
      daily: daily.map((d) => ({ date: d.date, gross_usd: d.gross_usd })),
      free_tier_usd: budget.free_tier_budget_usd,
      spending_limit_usd: budget.spending_limit_usd,
    }),
    [daily, month, budget.free_tier_budget_usd, budget.spending_limit_usd]
  );
  const f = timeline.forecast;

  const rows = useMemo(() => {
    const byDay = new Map<number, { day: number; cumulative?: number; expected?: number; band?: [number, number] }>();
    timeline.points.forEach((p) => byDay.set(p.day, { day: p.day, ...(p.cumulative_usd !== null ? { cumulative: p.cumulative_usd } : {}) }));
    f?.projection.forEach((p) => {
      const row = byDay.get(p.day) ?? { day: p.day };
      row.expected = p.expected;
      row.band = [p.low, p.high];
      byDay.set(p.day, row);
    });
    return Array.from(byDay.values()).sort((a, b) => a.day - b.day);
  }, [timeline, f]);

  const lastCum = [...timeline.points].reverse().find((p) => p.cumulative_usd !== null)?.cumulative_usd ?? 0;
  const yMax = Math.max(timeline.limit_line_usd ?? 0, timeline.free_line_usd, lastCum) * 1.12 || 1;
  const dayOf = (date: string) => Number(date.slice(8, 10));
  const clampDay = (date: string) => (date.slice(0, 7) === month ? dayOf(date) : timeline.days_in_month);
  const crossesMonth = (date: string | null) => date !== null && date.slice(0, 7) !== month;
  const point = (date: string | null) => timeline.points.find((p) => p.date === date);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg" data-testid="cost-center-timeline">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="text-sm font-bold text-white">{budget.cost_center_name}</h4>
          <span className="text-[11px] text-slate-400">{month} の累計利用費用の推移 (USD / 利用費用ベース)</span>
        </div>
        <div className="text-[11px] flex flex-wrap gap-x-4 gap-y-1 text-slate-300">
          {timeline.free_tier_exceeded_on && <span className="text-emerald-300">無料枠超過: {md(timeline.free_tier_exceeded_on)}</span>}
          {timeline.limit_reached_on && <span className="text-rose-300 font-bold">上限到達: {md(timeline.limit_reached_on)}</span>}
        </div>
      </div>

      <div className="h-64" role="img" aria-label={`${budget.cost_center_name} の月内累計費用の推移と上限Budget到達予想`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" type="number" domain={[1, timeline.days_in_month]} tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(d: number) => `${Number(month.slice(5, 7))}/${d}`} />
            <YAxis domain={[0, yMax]} allowDataOverflow tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: number) => usd(v)} width={64} />
            <Tooltip
              contentStyle={{ backgroundColor: '#090d13', borderColor: '#334155', borderRadius: 8, fontSize: '11px' }}
              labelFormatter={(d) => `${month}-${String(d).padStart(2, '0')}`}
              formatter={(value, name) => {
                if (Array.isArray(value)) return [`${usd(Number(value[0]))} 〜 ${usd(Number(value[1]))}`, name];
                return [usd(Number(value)), name];
              }}
            />
            {f && (() => {
              const x1 = clampDay(f.earliest);
              const x2 = f.latest ? clampDay(f.latest) : timeline.days_in_month;
              return <ReferenceArea x1={x1} x2={Math.max(x1, x2)} fill="#f43f5e" fillOpacity={0.12} stroke="#f43f5e" strokeOpacity={0.4} strokeDasharray="3 3" ifOverflow="hidden" />;
            })()}
            {timeline.free_line_usd > 0 && (
              <ReferenceLine y={timeline.free_line_usd} stroke="#10b981" strokeDasharray="6 4"
                label={{ value: `無料枠 ${usd(timeline.free_line_usd)}`, fill: '#34d399', fontSize: 10, position: 'insideTopLeft' }} />
            )}
            {timeline.limit_line_usd !== null && (
              <ReferenceLine y={timeline.limit_line_usd} stroke="#f43f5e" strokeWidth={2}
                label={{ value: `上限Budgetライン ${usd(timeline.limit_line_usd)} (無料枠+Limit)`, fill: '#fb7185', fontSize: 10, position: 'insideBottomLeft' }} />
            )}
            <Area dataKey="band" name="予測レンジ" stroke="none" fill="#f59e0b" fillOpacity={0.2} isAnimationActive={false} connectNulls />
            <Line dataKey="expected" name="予測 (直近トレンド)" stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            <Line dataKey="cumulative" name="累計利用費用" stroke="#6366f1" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            {timeline.free_tier_exceeded_on && point(timeline.free_tier_exceeded_on)?.cumulative_usd != null && (
              <ReferenceDot x={dayOf(timeline.free_tier_exceeded_on)} y={point(timeline.free_tier_exceeded_on)!.cumulative_usd!} r={5} fill="#10b981" stroke="#022c22" />
            )}
            {timeline.limit_reached_on && point(timeline.limit_reached_on)?.cumulative_usd != null && (
              <ReferenceDot x={dayOf(timeline.limit_reached_on)} y={point(timeline.limit_reached_on)!.cumulative_usd!} r={6} fill="#f43f5e" stroke="#4c0519" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 text-xs flex items-start gap-2 text-slate-300">
        <CalendarClock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        {f ? (
          <p>
            上限Budget到達予想: <strong className="text-amber-300 font-mono">{md(f.expected)}</strong>
            <span className="text-slate-400"> (幅: {md(f.earliest)} 〜 {f.latest ? md(f.latest) : '到達しない見込み'})</span>
            {(crossesMonth(f.earliest) || crossesMonth(f.expected)) && (
              <span className="text-slate-400"> ※月をまたぐ日付を含みます (月内では上限未到達の見込み)</span>
            )}
            <span className="block text-[10px] text-slate-500 mt-0.5">
              直近7日と月初からの平均日額 ({usd(f.rate_per_day.low)}〜{usd(f.rate_per_day.high)}/日) と標準誤差から算出した推定であり、確定値ではありません。
            </span>
          </p>
        ) : timeline.forecast_unavailable_reason === 'already_reached' ? (
          <p className="text-rose-300">上限Budgetに到達済みです ({timeline.limit_reached_on ? md(timeline.limit_reached_on) : ''})。</p>
        ) : (
          <p className="text-slate-500">{UNAVAILABLE_TEXT[timeline.forecast_unavailable_reason ?? 'no_data']}</p>
        )}
      </div>
    </div>
  );
};

export const CostCenterSpendTimeline: React.FC<Props> = ({ budgets, costCenterDaily, month }) => {
  if (!month || !costCenterDaily || Object.keys(costCenterDaily).length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-500" data-testid="cost-center-timeline-empty">
        <LineChartIcon className="w-6 h-6 mx-auto text-slate-600 mb-2" />
        <p className="text-sm">Cost Center別の日次データがないため、月内推移グラフは表示できません (日付付きの月次レポートで表示されます)。</p>
      </div>
    );
  }
  const shown = budgets.filter((b) => (costCenterDaily[b.cost_center_name]?.length ?? 0) > 0);
  return (
    <section className="flex flex-col space-y-4" aria-label="Cost Center別 月内推移">
      <div className="flex items-center space-x-2">
        <LineChartIcon className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-bold text-white">Cost Center別 月内推移と上限Budget到達予想</h3>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {shown.map((b) => (
          <TimelineCard key={b.cost_center_id} budget={b} daily={costCenterDaily[b.cost_center_name]} month={month} />
        ))}
      </div>
    </section>
  );
};
