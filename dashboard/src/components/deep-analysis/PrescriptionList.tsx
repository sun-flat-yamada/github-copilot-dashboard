import React, { useState } from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';

interface PrescriptionListProps {
  recommendations: string[];
}

export const PrescriptionList: React.FC<PrescriptionListProps> = ({ recommendations }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyRecommendation = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950 border border-indigo-500/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            改善アクション処方箋 (推奨アクション)
          </h4>
        </div>
        <span className="text-[10px] text-slate-400">
          ワンクリックでテキストをコピーして1on1やSlack等で共有可能
        </span>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec, rIdx) => (
          <div
            key={rIdx}
            className="flex items-start justify-between bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 gap-3 hover:border-indigo-500/50 transition-all"
          >
            <p className="leading-relaxed">{rec}</p>
            <button
              onClick={() => handleCopyRecommendation(rec, rIdx)}
              className="shrink-0 p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
              title="アドバイスをクリップボードにコピー"
            >
              {copiedIndex === rIdx ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
