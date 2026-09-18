import React from 'react';
import {
  InefficiencyPatternId,
  InefficiencyPatternResult,
} from '../../../../src/types/deep-analysis';
import { ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

interface PatternAccordionItemProps {
  patterns: InefficiencyPatternResult[];
  expandedPatternId: InefficiencyPatternId | null;
  onTogglePatternExpand: (id: InefficiencyPatternId) => void;
}

export const PatternAccordionItem: React.FC<PatternAccordionItemProps> = ({
  patterns,
  expandedPatternId,
  onTogglePatternExpand,
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            <span>AI利用 非効率パターン判定 & 兆候確率 (Pattern Diagnostic)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            5つの典型的なアンチパターンの兆候有無を判定。カードをクリックして要因と処方箋をドリルダウン表示
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 pt-1">
        {patterns.map((pattern) => {
          const isSelected = expandedPatternId === pattern.id;
          const prob = pattern.probabilityPercent;

          return (
            <div
              key={pattern.id}
              onClick={() => onTogglePatternExpand(pattern.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                isSelected
                  ? 'bg-gradient-to-b from-indigo-950/80 to-slate-900 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      pattern.name.includes('スマート・オフロード')
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : pattern.riskLevel === 'high'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : pattern.riskLevel === 'medium'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : pattern.riskLevel === 'low'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {pattern.name.includes('スマート・オフロード')
                      ? '🌟 スマート・オフロード'
                      : pattern.riskLevel === 'high'
                      ? '高リスク (兆候あり)'
                      : pattern.riskLevel === 'medium'
                      ? '中リスク (注意)'
                      : pattern.riskLevel === 'low'
                      ? '低リスク'
                      : '健全 (兆候なし)'}
                  </span>

                  <span className="text-slate-500 hover:text-slate-300">
                    {isSelected ? (
                      <ChevronUp className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-white mb-1 line-clamp-1">
                  {pattern.name}
                </h4>
                <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                  {pattern.tagline}
                </p>
              </div>

              {/* 確率 % 表示 & プログレスバー */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[10px] text-slate-400">兆候確率</span>
                  <span
                    className={`text-xl font-black ${
                      prob >= 70
                        ? 'text-rose-400'
                        : prob >= 40
                        ? 'text-amber-400'
                        : prob >= 15
                        ? 'text-indigo-300'
                        : 'text-emerald-400'
                    }`}
                  >
                    {prob}%
                  </span>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      prob >= 70
                        ? 'bg-gradient-to-r from-orange-500 to-rose-500'
                        : prob >= 40
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                        : prob >= 15
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    }`}
                    style={{ width: `${Math.max(5, prob)}%` }}
                  />
                </div>

                <span className="text-[10px] text-indigo-400 font-semibold mt-2.5 block text-center">
                  {isSelected ? 'ドリルダウンを閉じる ▲' : 'ドリルダウン深掘り ▼'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
