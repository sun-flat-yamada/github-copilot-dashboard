import React from 'react';
import type { ModelBenchmarkProfile, RadarAxisMeta } from '../../../../src/types/model-benchmark';
import { AccessibleChart, type ChartTableColumn } from '../common/AccessibleChart';
import { buildDotPlotRows, formatAxisRaw, summarizeDotPlot } from './model-dot-plot-data';

interface ModelDotPlotProps {
  axes: RadarAxisMeta[];
  models: ModelBenchmarkProfile[];
  focusedModelId?: string;
  onFocusModel?: (modelId: string) => void;
}

const WIDTH = 760;
const LABEL_W = 150;
const PAD_R = 24;
const ROW_H = 52;
const TOP = 8;
const AXIS_H = 22;
const PLOT_W = WIDTH - LABEL_W - PAD_R;

type Shape = 'circle' | 'square' | 'diamond' | 'triangle' | 'cross';
const SHAPES: Shape[] = ['circle', 'square', 'diamond', 'triangle', 'cross'];

const Marker: React.FC<{ shape: Shape; cx: number; cy: number; r: number; color: string; focused: boolean }> = ({ shape, cx, cy, r, color, focused }) => {
  const common = { fill: color, stroke: focused ? '#f8fafc' : '#0f172a', strokeWidth: focused ? 2 : 1, fillOpacity: focused ? 1 : 0.85 };
  switch (shape) {
    case 'square':
      return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} {...common} />;
    case 'diamond':
      return <polygon points={`${cx},${cy - r - 1} ${cx + r + 1},${cy} ${cx},${cy + r + 1} ${cx - r - 1},${cy}`} {...common} />;
    case 'triangle':
      return <polygon points={`${cx},${cy - r - 1} ${cx + r + 1},${cy + r} ${cx - r - 1},${cy + r}`} {...common} />;
    case 'cross':
      return (
        <path
          d={`M${cx - r},${cy - r} L${cx + r},${cy + r} M${cx - r},${cy + r} L${cx + r},${cy - r}`}
          stroke={color}
          strokeWidth={focused ? 3.5 : 2.5}
          fill="none"
        />
      );
    default:
      return <circle cx={cx} cy={cy} r={r} {...common} />;
  }
};

/**
 * Model comparison as small multiples of dot plots + a raw-value table (P3-7 / B-15, D-03).
 * Replaces the radar: no axis-order-dependent area, values read off a common 0-100 scale,
 * and models are told apart by marker shape and a text legend, not by colour alone.
 */
export const ModelDotPlot: React.FC<ModelDotPlotProps> = ({ axes, models, focusedModelId, onFocusModel }) => {
  const rows = React.useMemo(() => buildDotPlotRows(axes, models), [axes, models]);
  const height = TOP + rows.length * ROW_H + AXIS_H;
  const x = (score: number) => LABEL_W + (Math.max(0, Math.min(100, score)) / 100) * PLOT_W;
  const ticks = [0, 25, 50, 75, 100];

  const columns: ChartTableColumn[] = [
    { key: 'model', label: 'モデル' },
    ...axes.map((a) => ({ key: a.key, label: `${a.shortLabel} (点 / 生値)` })),
  ];
  const tableRows = models.map((m) => {
    const row: Record<string, React.ReactNode> = { model: m.name };
    for (const a of axes) {
      row[a.key] = (
        <span>
          <strong>{m.radar_scores[a.key]}</strong>
          <span className="block text-[10px] text-slate-400">{formatAxisRaw(a.key, m)}</span>
        </span>
      );
    }
    return row;
  });

  return (
    <AccessibleChart
      title="モデル別 6 軸スコア (ドットプロット)"
      summary={summarizeDotPlot(rows)}
      columns={columns}
      rows={tableRows}
      testId="model-dot-plot"
    >
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full h-auto" aria-hidden="true" focusable="false">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP} y2={TOP + rows.length * ROW_H} stroke="#334155" strokeDasharray="3 3" />
            <text x={x(t)} y={TOP + rows.length * ROW_H + 15} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {t}
            </text>
          </g>
        ))}
        {rows.map((row, ri) => {
          const cy = TOP + ri * ROW_H + ROW_H / 2;
          return (
            <g key={row.axis.key} data-testid={`dot-row-${row.axis.key}`}>
              {ri % 2 === 0 && <rect x={0} y={TOP + ri * ROW_H} width={WIDTH} height={ROW_H} fill="#94a3b8" fillOpacity={0.06} />}
              <text x={8} y={cy + 4} fontSize="12" fontWeight="600" fill="#cbd5e1">
                {row.axis.shortLabel}
              </text>
              <line x1={LABEL_W} x2={LABEL_W + PLOT_W} y1={cy} y2={cy} stroke="#475569" />
              {row.dots.map((d, di) => {
                const model = models[di];
                const focused = d.modelId === focusedModelId;
                const jitter = ((di % 5) - 2) * 7;
                return (
                  <g
                    key={d.modelId}
                    onClick={() => onFocusModel?.(d.modelId)}
                    className="cursor-pointer"
                    data-testid={`dot-${row.axis.key}-${d.modelId}`}
                  >
                    <title>{`${d.name} / ${row.axis.label}: ${d.score} (${d.raw})`}</title>
                    <Marker shape={SHAPES[di % SHAPES.length]} cx={x(d.score)} cy={cy + jitter} r={focused ? 6 : 4.5} color={model.color} focused={focused} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </AccessibleChart>
  );
};

/** Marker shape used for the model at `index` (legend uses the same mapping). */
export function dotShapeFor(index: number): Shape {
  return SHAPES[index % SHAPES.length];
}
