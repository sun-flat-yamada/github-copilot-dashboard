import React from 'react';
import { QUALITY_PRESENTATION, type QualifiedValue } from '../../../../src/domain/metrics/metric-registry';

const BADGE_STYLE = {
  estimated: 'bg-amber-950/70 text-amber-300 border-amber-700/70',
  missing: 'bg-rose-950 text-rose-300 border-rose-800',
  demo: 'bg-violet-950/70 text-violet-300 border-violet-800/70',
} as const;

interface MetricValueProps {
  qualified: QualifiedValue;
  /** 値の整形 (値があるときのみ呼ばれる) */
  format: (value: number) => React.ReactNode;
  /** 値の文字クラス */
  valueClassName?: string;
  /** 補助表示用の小さい欠損表示 (「—（理由）」の文字を小さくする) */
  compact?: boolean;
}

/**
 * 品質属性に応じた共通表示。
 * 実測=値のみ / 推定・デモ=値 + バッジ / 欠損=「—（理由）」(0 を描画しない)。
 * 色だけに頼らず、バッジにはラベルを併記する。
 */
export const MetricValue: React.FC<MetricValueProps> = ({ qualified, format, valueClassName = 'text-2xl font-bold text-slate-100', compact = false }) => {
  const { quality, value, reason, metricId } = qualified;
  const badge = QUALITY_PRESENTATION[quality].badge;

  if (quality === 'missing' || value === null) {
    return (
      <div data-testid={`metric-${metricId}`} data-quality="missing">
        <span className={compact ? 'text-base font-bold text-slate-500' : 'text-2xl font-bold text-slate-500'}>—</span>
        <span className="ml-1 text-xs text-slate-500" data-testid="metric-missing-reason">（{reason ?? QUALITY_PRESENTATION.missing.description}）</span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline space-x-2 flex-wrap" data-testid={`metric-${metricId}`} data-quality={quality}>
      <span className={valueClassName}>{format(value)}</span>
      {badge && (quality === 'estimated' || quality === 'demo') && (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${BADGE_STYLE[quality]}`}
          data-testid={`metric-badge-${quality}`}
          title={reason ?? QUALITY_PRESENTATION[quality].description}
        >
          {badge}
        </span>
      )}
    </div>
  );
};
