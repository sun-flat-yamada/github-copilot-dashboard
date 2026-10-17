import React from 'react';
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';

export interface WidgetCardControlProps {
  id: string;
  title: string;
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
  children: React.ReactNode;
}

export const WidgetCardFrame: React.FC<WidgetCardControlProps> = ({
  id,
  title,
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
  children,
}) => {
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
      className={`flex flex-col rounded-xl bg-slate-900 border shadow-lg overflow-hidden transition-all duration-200 ${
        isDragOver
          ? 'border-indigo-500 ring-2 ring-indigo-500/30'
          : 'border-slate-800 hover:border-slate-700'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Compact Widget Toolbar for KPI Cards */}
      <div className="px-3 py-1.5 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          {draggable && (
            <div
              className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0 p-0.5 rounded"
              title="ドラッグしてウィジェットの表示順番を変更"
              aria-hidden="true"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          )}
          <span className="text-[10px] font-semibold text-slate-400 truncate">
            KPI Widget
          </span>
        </div>

        <div
          className="flex items-center space-x-0.5 shrink-0"
          role="group"
          aria-label={`${title}のウィジェット操作`}
        >
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              data-testid={`widget-move-up-${id}`}
              title="表示順番を前（上）へ移動"
              aria-label={`${title}を上へ移動`}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              data-testid={`widget-move-down-${id}`}
              title="表示順番を次（下）へ移動"
              aria-label={`${title}を下へ移動`}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              data-testid={`widget-remove-${id}`}
              title="ウィジェットを削除"
              aria-label={`${title}を削除`}
              className="p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-rose-950/60 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Card Content */}
      <div className="flex-1 flex flex-col [&>div]:flex-1 [&>div]:border-0 [&>div]:rounded-none [&>div]:shadow-none">
        {children}
      </div>
    </div>
  );
};
