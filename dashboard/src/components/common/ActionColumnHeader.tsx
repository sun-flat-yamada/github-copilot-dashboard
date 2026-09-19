import React, { useState, useRef, useEffect } from 'react';
import { Info, X, ChevronDown, LineChart, BrainCircuit } from 'lucide-react';

interface ActionColumnHeaderProps {
  className?: string;
  align?: 'center' | 'right' | 'left';
}

export const ActionColumnHeader: React.FC<ActionColumnHeaderProps> = ({
  className = '',
  align = 'center',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 外側クリックおよびEscapeキーで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const justifyClass =
    align === 'left'
      ? 'justify-start'
      : align === 'right'
      ? 'justify-end'
      : 'justify-center';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center space-x-1 ${justifyClass} ${className}`}
    >
      <span>アクション</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`p-1 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center ${
          isOpen
            ? 'text-indigo-300 bg-indigo-950/80 border border-indigo-700/60'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent'
        }`}
        title="各アクションアイコンの機能説明を表示"
        aria-label="アクションアイコンの機能説明"
        aria-expanded={isOpen}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {/* ポップオーバー説明カード */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="アクションアイコンの機能説明"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-2 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3.5 z-50 text-left normal-case font-normal text-xs divide-y divide-slate-800"
        >
          <div className="flex items-center justify-between pb-2">
            <span className="font-bold text-slate-100 flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>アクションアイコンの説明</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded hover:bg-slate-800 transition"
              aria-label="閉じる"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="pt-2.5 space-y-2.5">
            {/* 1. 詳細分析 */}
            <div className="flex items-start space-x-2.5">
              <span className="p-1 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 shrink-0 mt-0.5">
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
              <div>
                <div className="font-semibold text-slate-100 text-[11px]">
                  詳細分析 (インライン展開)
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  行直下に利用内訳・主要モデル配分・AI健全度診断パネルを展開/格納します。
                </div>
              </div>
            </div>

            {/* 2. トレンド */}
            <div className="flex items-start space-x-2.5">
              <span className="p-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 shrink-0 mt-0.5">
                <LineChart className="w-3.5 h-3.5" />
              </span>
              <div>
                <div className="font-semibold text-slate-100 text-[11px]">
                  トレンド (モデル推移)
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  対象ユーザーの日次利用推移およびAIモデル別利用割合ビューへ遷移します。
                </div>
              </div>
            </div>

            {/* 3. 診断 */}
            <div className="flex items-start space-x-2.5">
              <span className="p-1 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 shrink-0 mt-0.5">
                <BrainCircuit className="w-3.5 h-3.5" />
              </span>
              <div>
                <div className="font-semibold text-slate-100 text-[11px]">
                  診断 (高度ディープ分析)
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  非効率アンチパターンの判定およびCopilot高度活用診断ビューへ遷移します。
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
