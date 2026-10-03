import React from 'react';
import { Info } from 'lucide-react';
import {
  METRIC_REGISTRY,
  describeMetric,
  windowLabel,
  type MetricId,
  type MetricScopeType,
} from '../../../../src/domain/metrics/metric-registry';

interface MetricLabelProps {
  metricId: MetricId;
  /** scope 窓の指標で、窓の表示をスコープ種別に追従させる */
  scopeType?: MetricScopeType;
  /** 表示名の上書き (省略時はカタログの日本語名) */
  label?: React.ReactNode;
  className?: string;
  /** 窓チップを出さない (カード内に別途窓を表示している場合) */
  hideWindow?: boolean;
}

/**
 * 指標カタログ (Metric Registry) に基づく KPI ラベル。
 * 指標名 + 定義ツールチップ (定義・計算式・窓・単位・出典・注意点) + 窓チップを表示する。
 * 窓は色だけでなくテキストで示す。
 */
export const MetricLabel: React.FC<MetricLabelProps> = ({ metricId, scopeType, label, className = 'text-xs font-medium text-slate-400', hideWindow = false }) => {
  const def = METRIC_REGISTRY[metricId];
  const tooltip = describeMetric(metricId, scopeType);
  const window = windowLabel(def.window, scopeType);
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap" data-testid={`metric-label-${metricId}`}>
      <span className={className} title={tooltip}>{label ?? def.label.ja}</span>
      <span
        role="img"
        aria-label={`${def.label.ja} の定義: ${tooltip.replace(/\n/g, ' / ')}`}
        title={tooltip}
        className="text-slate-500 hover:text-slate-300 cursor-help"
        data-testid={`metric-definition-${metricId}`}
      >
        <Info className="w-3 h-3" aria-hidden="true" />
      </span>
      {!hideWindow && (
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-700 text-slate-400 bg-slate-950/60"
          data-testid={`metric-window-${metricId}`}
        >
          {window}
        </span>
      )}
    </span>
  );
};
