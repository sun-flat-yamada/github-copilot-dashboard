import React from 'react';
import { TrendingUp } from 'lucide-react';
import { MetricLabel } from './MetricLabel';
import { MetricValue } from './MetricValue';
import {
  qualify,
  type MetricId,
  type MetricScopeType,
} from '../../../../src/domain/metrics/metric-registry';
import { CONFIDENCE_LABEL_JA, type ForecastResult } from '../../../../src/domain/metrics/kpi-analysis';

interface ForecastNoteProps {
  metricId: Extract<MetricId, 'spend_forecast' | 'credits_forecast'>;
  result: ForecastResult;
  scopeType?: MetricScopeType;
  isDemo?: boolean;
  /** 値の整形 */
  format: (value: number) => React.ReactNode;
}

/**
 * 月末着地予測 (推定)。算出式・窓・信頼度・予測レンジを併記する。
 * 観測不足 (月初・欠損多) や月次以外のスコープでは「—（理由）」とし、値を作らない。
 * 締め済みの月は予測ではなく実績を示す。
 */
export const ForecastNote: React.FC<ForecastNoteProps> = ({ metricId, result, scopeType, isDemo = false, format }) => {
  const wrapper = 'mt-2.5 pt-2 border-t border-slate-800/80';

  if (result.status === 'closed') {
    return (
      <div className={wrapper} data-testid={`forecast-${metricId}`} data-state="closed">
        <MetricLabel metricId={metricId} scopeType={scopeType} className="text-[11px] font-medium text-slate-400" hideWindow />
        <p className="text-[11px] text-slate-400 mt-1">
          締め済みの月のため予測せず、実績 <span className="font-semibold text-slate-200">{format(result.actual)}</span> ({result.observedDays} 日分) を表示しています
        </p>
      </div>
    );
  }

  const qualified = result.status === 'forecast'
    ? qualify(metricId, result.projected, { isDemo, estimatedReason: `${result.formula} による見込み値です。確定値ではありません` })
    : qualify(metricId, null, { isDemo, missingReason: result.reason });

  return (
    <div className={wrapper} data-testid={`forecast-${metricId}`} data-state={result.status}>
      <MetricLabel metricId={metricId} scopeType={scopeType} className="text-[11px] font-medium text-slate-400" />
      <div className="mt-1 flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
        <MetricValue qualified={qualified} valueClassName="text-base font-bold text-slate-200" compact format={format} />
      </div>
      {result.status === 'forecast' && (
        <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500" data-testid={`forecast-basis-${metricId}`}>
          <li>
            予測レンジ: {format(result.low)} 〜 {format(result.high)}
            <span className="ml-2" data-testid={`forecast-confidence-${metricId}`}>信頼度: <span className="text-slate-300 font-semibold">{CONFIDENCE_LABEL_JA[result.confidence]}</span></span>
          </li>
          <li>算出式: {result.formula}</li>
          <li>実績累計 {format(result.actualToDate)} ({result.observedDays} 日観測) / 直近ペース {format(result.dailyPace)}/日</li>
        </ul>
      )}
    </div>
  );
};
