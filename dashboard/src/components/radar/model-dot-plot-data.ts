import type { ModelBenchmarkProfile, RadarAxisMeta, RadarAxisKey } from '../../../../src/types/model-benchmark';

/** Raw value that backs each radar axis, as text (shown next to every score; P3-7 / B-15). */
export function formatAxisRaw(axis: RadarAxisKey, m: ModelBenchmarkProfile): string {
  const r = m.raw_metrics;
  switch (axis) {
    case 'coding_swe':
      return `SWE-bench ${r.swe_bench_verified}% / HumanEval+ ${r.humaneval_plus}%`;
    case 'reasoning_logic':
      return `AIME ${r.aime_2024}% / GPQA ${r.gpqa_diamond}%`;
    case 'arena_elo':
      return `Elo ${r.arena_coding_elo}`;
    case 'speed_latency':
      return `${r.output_speed_tps} tok/s`;
    case 'cost_efficiency':
      return `$${r.input_cost_per_m} in / $${r.output_cost_per_m} out per 1M`;
    case 'architecture_design':
      return `${r.context_window_display || `${r.context_window_k}K`} context`;
    default:
      return '';
  }
}

export interface DotPlotRow {
  axis: RadarAxisMeta;
  dots: Array<{ modelId: string; name: string; score: number; raw: string }>;
}

/** One row per axis (small multiples); dots are the selected models. */
export function buildDotPlotRows(axes: RadarAxisMeta[], models: ModelBenchmarkProfile[]): DotPlotRow[] {
  return axes.map((axis) => ({
    axis,
    dots: models.map((m) => ({
      modelId: m.id,
      name: m.name,
      score: m.radar_scores[axis.key],
      raw: formatAxisRaw(axis.key, m),
    })),
  }));
}

/** Plain-text summary for assistive technology: the leader on each axis. */
export function summarizeDotPlot(rows: DotPlotRow[]): string {
  if (rows.length === 0 || rows[0].dots.length === 0) return 'モデルが選択されていません。';
  return rows
    .map((row) => {
      const best = [...row.dots].sort((a, b) => b.score - a.score)[0];
      return `${row.axis.shortLabel}は${best.name}が最高 (${best.score})`;
    })
    .join('、');
}
