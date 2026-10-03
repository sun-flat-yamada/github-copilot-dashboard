import React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { compareToPrevious } from '../../../../src/domain/metrics/kpi-analysis';

/** 増減の良し悪し。higher-better=増えると良い / lower-better=減ると良い / neutral=良し悪しを付けない */
export type DeltaTone = 'higher-better' | 'lower-better' | 'neutral';

interface PeriodDeltaProps {
  /** 比較の呼称 (前月比 / 前日比)。null は比較対象が無いスコープ (期間) */
  label: string | null;
  current: number | null | undefined;
  previous: number | null | undefined;
  /** 差分の整形 (符号なしの絶対値を受け取る) */
  formatDelta: (absDelta: number) => React.ReactNode;
  tone?: DeltaTone;
  /** 算出できない理由 (label が null のときの理由を含む) */
  unavailableReason: string;
  testId: string;
}

const TONE_CLASS = {
  good: 'text-emerald-400',
  bad: 'text-rose-400',
  neutral: 'text-slate-400',
} as const;

/**
 * 前期比の表示。矢印・符号・文言で増減を示し、色だけに頼らない。
 * 前期が無い・比較対象が無いときは「前期比 —（理由）」とし、0 との比較を出さない。
 */
export const PeriodDelta: React.FC<PeriodDeltaProps> = ({ label, current, previous, formatDelta, tone = 'neutral', unavailableReason, testId }) => {
  const heading = label ?? '前期比';
  const result = label === null
    ? ({ status: 'unavailable', reason: unavailableReason } as const)
    : compareToPrevious(current, previous, { previousReason: unavailableReason });

  if (result.status === 'unavailable') {
    return (
      <p className="text-[11px] text-slate-500 mt-1" data-testid={testId} data-state="unavailable">
        {heading} <span className="text-slate-400">—</span>（{result.reason}）
      </p>
    );
  }

  const { direction, delta, ratio } = result;
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : ArrowRight;
  const sign = direction === 'up' ? '+' : direction === 'down' ? '-' : '±';
  const good = tone === 'higher-better' ? direction === 'up' : tone === 'lower-better' ? direction === 'down' : null;
  const bad = tone === 'higher-better' ? direction === 'down' : tone === 'lower-better' ? direction === 'up' : null;
  const toneClass = direction === 'flat' ? TONE_CLASS.neutral : good ? TONE_CLASS.good : bad ? TONE_CLASS.bad : TONE_CLASS.neutral;

  return (
    <p className={`text-[11px] mt-1 flex items-center gap-1 flex-wrap ${toneClass}`} data-testid={testId} data-state="compared" data-direction={direction}>
      <span className="text-slate-500">{heading}</span>
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span className="font-semibold">
        {sign}
        {formatDelta(Math.abs(delta))}
        {ratio !== null && ` (${sign}${Math.abs(ratio * 100).toFixed(1)}%)`}
      </span>
    </p>
  );
};
