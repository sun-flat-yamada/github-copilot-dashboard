import React from 'react';
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, X } from 'lucide-react';

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
  /** Widget controls (optional) */
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
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
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onRemove,
  draggable = false,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragEnd,
}) => {
  const hasWidgetControls = Boolean(onMoveUp || onMoveDown || onRemove);

  return (
    <div
      id={`section-${id}`}
      data-testid={`overview-widget-${id}`}
      data-widget-id={id}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`border rounded-2xl bg-slate-900/70 shadow-sm overflow-hidden transition-all duration-200 ${
        isDragOver
          ? 'border-indigo-500 ring-2 ring-indigo-500/30'
          : 'border-slate-800'
      } ${isDragging ? 'opacity-50' : ''} ${className}`}
    >
      {/* ヘッダーバー: アコーディオン開閉ボタンとWidget操作ボタン群を兄弟配置 (nested-interactive 防止) */}
      <div className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-2 hover:bg-slate-800/50 transition-colors">
        {draggable && (
          <div
            className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0 p-1 rounded"
            title="ドラッグしてウィジェットの表示順番を変更"
            aria-hidden="true"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* クリック可能なアコーディオン開閉ボタン */}
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center justify-between text-left cursor-pointer group"
          aria-expanded={isExpanded}
          aria-controls={`content-${id}`}
        >
          <div className="flex items-center space-x-3 min-w-0 pr-3">
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

          <div className="flex items-center space-x-2.5 shrink-0">
            {/* 折りたたみ時に外から確認できるサマリーチップ群 */}
            {summaryChips && (
              <div className="hidden sm:flex items-center space-x-2">
                {summaryChips}
              </div>
            )}

            {/* 展開/収納トグルアイコン */}
            <div
              className={`p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-400 group-hover:text-white transition-transform duration-200 ${
                isExpanded
                  ? 'rotate-180 bg-indigo-950/60 border-indigo-700/60 text-indigo-300'
                  : ''
              }`}
            >
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {/* Widget 順序変更・削除コントロール */}
        {hasWidgetControls && (
          <div
            className="flex items-center space-x-1 shrink-0 pl-2 border-l border-slate-800/80"
            role="group"
            aria-label={`${title}のウィジェット操作`}
          >
            {onMoveUp && (
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                data-testid={`widget-move-up-${id}`}
                title="表示順番を上へ移動"
                aria-label={`${title}を上へ移動`}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
            {onMoveDown && (
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                data-testid={`widget-move-down-${id}`}
                title="表示順番を下へ移動"
                aria-label={`${title}を下へ移動`}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                data-testid={`widget-remove-${id}`}
                title="ウィジェットを削除"
                aria-label={`${title}を削除`}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/60 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

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

