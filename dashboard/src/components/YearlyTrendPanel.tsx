import React from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RollingTrendDataset, YearlyTrendPoint, YearlyTrendStatus, YearlyTrendYoy } from '../../../src/types/copilot';
import { loadYearlyTrendDataset, type DatasetResult } from '../dataset/datasetLoader';
import { AccessibleChart } from './common/AccessibleChart';
import { MetricLabel } from './common/MetricLabel';

export const STATUS_LABEL: Record<YearlyTrendStatus, string> = {
  closed: '確定',
  provisional: '暫定',
  missing: '欠損',
};

const STATUS_NOTE: Record<YearlyTrendStatus, string> = {
  closed: '月次締めで確定した月 (改訂は履歴に残る)',
  provisional: '確定前の月 (値は変わり得る)',
  missing: '保存済みの集計がない月 (0 ではない)',
};

const usd = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** 前年同月比の表示。算出できないときは「—（理由）」 (0 や空欄にしない) */
export function formatYoy(yoy: YearlyTrendYoy, formatDelta: (absDelta: number) => string): string {
  if (yoy.delta === null) return `—（${yoy.reason ?? '算出できない'}）`;
  const sign = yoy.delta > 0 ? '+' : yoy.delta < 0 ? '-' : '±';
  const abs = formatDelta(Math.abs(yoy.delta));
  if (yoy.change_rate === null) return `${sign}${abs}（変化率: —（${yoy.reason ?? '算出できない'}））`;
  return `${sign}${abs} (${sign}${Math.abs(yoy.change_rate * 100).toFixed(1)}%)`;
}

export interface YearlyTrendRow {
  month: string;
  status: YearlyTrendStatus;
  spend: number | null;
  acceptance_rate_pct: number | null;
}

/** グラフ用の行。欠損月は値を null のままにし、0 で補完しない */
export function toChartRows(points: readonly YearlyTrendPoint[]): YearlyTrendRow[] {
  return points.map((p) => ({
    month: p.month,
    status: p.status,
    spend: p.entry ? p.entry.total_spend_usd : null,
    acceptance_rate_pct: p.entry && p.entry.acceptance_rate !== null ? Math.round(p.entry.acceptance_rate * 1000) / 10 : null,
  }));
}

const COLOR = { closed: '#6366f1', provisional: '#a5b4fc', line: '#34d399' } as const;

interface YearlyTrendPanelProps {
  dataset: RollingTrendDataset | null;
  /** 取得に失敗したときの理由 */
  error?: string | null;
  isDemo?: boolean;
}

export const YearlyTrendPanel: React.FC<YearlyTrendPanelProps> = ({ dataset, error, isDemo = false }) => {
  const points = dataset?.points ?? [];
  if (!dataset || points.length === 0) {
    const reason = error
      ? `1 年推移ファイルを取得できません (${error})`
      : dataset
      ? '1 年推移が新形式で出力されていません (次回の収集後に表示されます)'
      : '1 年推移を読み込み中です';
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400" data-testid="yearly-trend-unavailable">
        <p className="text-sm font-semibold text-slate-300">— 1 年推移を表示できません</p>
        <p className="text-xs mt-1 text-slate-500">{reason}</p>
      </div>
    );
  }

  const rows = toChartRows(points);
  const counts = { closed: 0, provisional: 0, missing: 0 };
  for (const p of points) counts[p.status] += 1;
  const revised = points.filter((p) => (p.revision_count ?? 0) > 0).length;
  const latest = [...points].reverse().find((p) => p.entry);
  const summary =
    `${points[0].month} から ${points[points.length - 1].month} までの 12 か月。確定 ${counts.closed} か月、暫定 ${counts.provisional} か月、欠損 ${counts.missing} か月。` +
    (revised > 0 ? `確定後に改訂された月が ${revised} か月ある (監査ビューで履歴と差分を確認できる)。` : '') +
    (latest ? `最新の月 (${latest.month}) の利用費用は ${usd(latest.entry!.total_spend_usd)}。` : '');

  return (
    <div className="space-y-4" data-testid="yearly-trend-panel">
      {isDemo && (
        <p className="text-xs text-amber-300" data-testid="yearly-trend-demo">デモデータ (架空の値) です。</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300" data-testid="yearly-trend-legend">
        {(['closed', 'provisional', 'missing'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block w-3 h-3 rounded-sm border"
              style={{ background: s === 'closed' ? COLOR.closed : s === 'provisional' ? COLOR.provisional : 'transparent', borderColor: s === 'missing' ? '#64748b' : 'transparent', borderStyle: s === 'missing' ? 'dashed' : 'solid' }}
            />
            <span className="font-semibold">{STATUS_LABEL[s]}</span>
            <span className="text-slate-400">{STATUS_NOTE[s]}</span>
          </span>
        ))}
      </div>
      {dataset.close_rule && (
        <p className="text-[11px] text-slate-400" data-testid="yearly-trend-close-rule">締めのルール: {dataset.close_rule.note}</p>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <MetricLabel metricId="yoy_spend_change" />
        <MetricLabel metricId="yoy_active_seats_change" />
      </div>

      <AccessibleChart
        title="1 年推移 (月次)"
        summary={summary}
        testId="yearly-trend-chart"
        columns={[
          { key: 'month', label: '月' },
          { key: 'status', label: '状態' },
          { key: 'spend', label: '利用費用' },
          { key: 'spend_yoy', label: '費用 前年同月比' },
          { key: 'seats', label: '利用中シート' },
          { key: 'seats_yoy', label: 'シート 前年同月比' },
          { key: 'rate', label: '受諾率' },
        ]}
        rows={points.map((p) => ({
          month: p.month,
          status: `${STATUS_LABEL[p.status]}${p.status === 'closed' ? (p.revision_count ? ` (改訂 ${p.revision_count} 回)` : '') : p.status === 'provisional' ? ` (締め日 ${p.closes_on})` : ''}`,
          spend: p.entry ? usd(p.entry.total_spend_usd) : '—（保存済み集計なし）',
          spend_yoy: formatYoy(p.yoy.total_spend_usd, usd),
          seats: p.entry ? `${p.entry.active_seats}` : '—（保存済み集計なし）',
          seats_yoy: formatYoy(p.yoy.active_seats, (n) => `${n}`),
          rate: p.entry && p.entry.acceptance_rate !== null ? `${(p.entry.acceptance_rate * 100).toFixed(1)}%` : '—（利用状況メトリクス未取得）',
        }))}
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="spend" stroke="#94a3b8" fontSize={11} tickFormatter={(v: number) => `$${v}`} />
              <YAxis yAxisId="rate" orientation="right" stroke="#94a3b8" fontSize={11} unit="%" domain={[0, 100]} />
              <Tooltip
                formatter={(value, name) => (value === null || value === undefined ? '—（欠損）' : name === '受諾率' ? `${value}%` : usd(Number(value)))}
                contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
              />
              <Legend />
              <Bar yAxisId="spend" dataKey="spend" name="利用費用" isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell key={r.month} fill={r.status === 'provisional' ? COLOR.provisional : COLOR.closed} stroke={r.status === 'provisional' ? COLOR.closed : undefined} strokeDasharray={r.status === 'provisional' ? '4 2' : undefined} />
                ))}
              </Bar>
              {/* 欠損月は線を切る (connectNulls=false)。0 で描かない */}
              <Line yAxisId="rate" type="monotone" dataKey="acceptance_rate_pct" name="受諾率" stroke={COLOR.line} connectNulls={false} dot isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </AccessibleChart>
    </div>
  );
};

interface YearlyTrendSectionProps {
  baseDir: string;
  isDemo?: boolean;
}

/** データセットを取得して表示する。取得失敗は理由つきで表示し、空の推移や DEMO には置き換えない */
export const YearlyTrendSection: React.FC<YearlyTrendSectionProps> = ({ baseDir, isDemo }) => {
  const [result, setResult] = React.useState<DatasetResult<RollingTrendDataset> | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    setResult(null);
    loadYearlyTrendDataset(baseDir).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [baseDir]);
  return <YearlyTrendPanel dataset={result?.data ?? null} error={result?.error ?? null} isDemo={isDemo || result?.demoSourced} />;
};
