import { AnalysisMethodId } from '../../../../src/types/deep-analysis';
import { ANALYSIS_METHODS_REGISTRY } from '../../../../src/processor/inefficiency-diagnostic';
import { BrainCircuit, Microscope, Layers, Sparkles } from 'lucide-react';

interface MethodSelectorProps {
  selectedMethodId: AnalysisMethodId;
  onSelectMethod: (id: AnalysisMethodId) => void;
}

export const MethodSelector: React.FC<MethodSelectorProps> = ({
  selectedMethodId,
  onSelectMethod,
}) => {
  const currentMethodDef =
    ANALYSIS_METHODS_REGISTRY.find((m) => m.id === selectedMethodId) ||
    ANALYSIS_METHODS_REGISTRY[0];

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/90 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/25">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white tracking-tight">ディープ分析ワークスペース</h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-700/80">
                Deep Analytics Hub
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              個人の活用実績をミクロ診断し、アンチパターン検知・コスト最適化・現場への改善処方箋を導出
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center space-x-1.5">
            <Microscope className="w-3.5 h-3.5 text-indigo-400" />
            <span>分析方式数: <strong>{ANALYSIS_METHODS_REGISTRY.length}</strong> (稼働中: 1)</span>
          </span>
        </div>
      </div>

      {/* 分析方式セレクター */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>分析方式の選択 (Analysis Engine)</span>
          </span>
          <span className="text-[11px] text-slate-400">今後随時新しい分析方式がプラグイン追加されます</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ANALYSIS_METHODS_REGISTRY.map((method) => {
            const isActive = selectedMethodId === method.id;
            const isComingSoon = method.status === 'coming_soon';

            return (
              <button
                key={method.id}
                onClick={() => !isComingSoon && onSelectMethod(method.id)}
                disabled={isComingSoon}
                className={`text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between ${
                  isActive
                    ? 'bg-gradient-to-b from-indigo-900/60 to-slate-900 border-indigo-500 shadow-md shadow-indigo-500/15'
                    : isComingSoon
                    ? 'bg-slate-950/40 border-slate-850 opacity-60 cursor-not-allowed hover:border-slate-800'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-bold ${
                      isActive ? 'text-white' : isComingSoon ? 'text-slate-400' : 'text-slate-200'
                    }`}
                  >
                    {method.shortTitle}
                  </span>
                  {method.badge && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        method.status === 'active'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {method.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {method.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        {/* 選択中分析方式の解説バナー */}
        <div className="mt-4 p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-start space-x-3 text-xs">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-200">
              【{currentMethodDef.title}】
            </span>
            <span className="text-slate-400 ml-1.5 leading-relaxed">
              {currentMethodDef.description}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
