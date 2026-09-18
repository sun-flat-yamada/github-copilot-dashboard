import React from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  summaryChips?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  subtitle,
  icon,
  summaryChips,
  isExpanded,
  onToggle,
  children,
  className = '',
}) => {
  return (
    <div
      id={`section-${id}`}
      className={`border border-slate-800 rounded-2xl bg-slate-900/70 shadow-sm overflow-hidden transition-all duration-200 ${className}`}
    >
      {/* クリック可能なヘッダーバー */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors cursor-pointer group"
        aria-expanded={isExpanded}
        aria-controls={`content-${id}`}
      >
        <div className="flex items-center space-x-3 min-w-0 pr-4">
          {icon && (
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/80 text-indigo-400 group-hover:text-white group-hover:border-indigo-500/50 transition-colors shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate group-hover:text-indigo-200 transition-colors">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {/* 折りたたみ時に外から確認できるサマリーチップ群 */}
          {summaryChips && (
            <div className="hidden sm:flex items-center space-x-2">
              {summaryChips}
            </div>
          )}

          {/* 展開/収納トグルアイコン */}
          <div className={`p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-400 group-hover:text-white transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-indigo-950/60 border-indigo-700/60 text-indigo-300' : ''}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* 展開されるコンテンツボディ */}
      {isExpanded && (
        <div
          id={`content-${id}`}
          className="px-5 pb-5 pt-2 border-t border-slate-800/70 animate-in fade-in duration-200"
        >
          {children}
        </div>
      )}
    </div>
  );
};
