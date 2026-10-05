import React from 'react';
import { SignalLevel } from '../../../../src/types/copilot';
import { SIGNAL_LEVEL_LABELS } from '../../../../src/processor/usage-insight-definitions';

const STYLE: Record<SignalLevel, string> = {
  none: 'bg-slate-800 text-slate-300 border-slate-700',
  watch: 'bg-sky-950/70 text-sky-300 border-sky-800/70',
  review: 'bg-amber-950/70 text-amber-300 border-amber-700/70',
  insufficient: 'bg-slate-900 text-slate-500 border-slate-800',
};

interface UsageSignalBadgeProps {
  level: SignalLevel;
  /** ホバーで見せる根拠 */
  title?: string;
}

/** 兆候の段階バッジ。色だけに頼らずラベルを併記する。横幅を確保し改行を防止。 */
export const UsageSignalBadge: React.FC<UsageSignalBadgeProps> = ({ level, title }) => (
  <span
    title={title}
    className={`inline-flex items-center justify-center shrink-0 px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap min-w-[52px] text-center ${STYLE[level]}`}
  >
    {SIGNAL_LEVEL_LABELS[level]}
  </span>
);
