import React from 'react';
import { Tag, Check, X } from 'lucide-react';

interface TagFilterBarProps {
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  filteredCount?: number;
  totalCount?: number;
}

export const TagFilterBar: React.FC<TagFilterBarProps> = ({
  availableTags,
  selectedTags,
  onToggleTag,
  onClearTags,
  filteredCount,
  totalCount,
}) => {
  if (availableTags.length === 0) return null;

  const hasFilter = selectedTags.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <div className="flex items-center space-x-1.5 text-xs text-slate-400 shrink-0 mr-1">
        <Tag className="w-3.5 h-3.5 text-indigo-400" />
        <span className="font-semibold uppercase tracking-wider text-[11px]">タグ絞り込み:</span>
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 font-mono">
          AND一致
        </span>
      </div>

      {/* タグピル一覧 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm ring-1 ring-indigo-400/50'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white hover:border-slate-700'
              }`}
              title={`タグ「${tag}」で絞り込み (${isSelected ? 'クリックして解除' : 'クリックして追加 (AND)'})`}
            >
              {isSelected && <Check className="w-3 h-3 text-indigo-200" />}
              <span>{tag}</span>
            </button>
          );
        })}
      </div>

      {/* フィルター適用中バッジ & クリアボタン */}
      {hasFilter && (
        <div className="flex items-center space-x-2 ml-1">
          {filteredCount !== undefined && totalCount !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-medium">
              該当: <strong className="text-white">{filteredCount}</strong> / {totalCount} 名
            </span>
          )}

          <button
            type="button"
            onClick={onClearTags}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 text-xs transition cursor-pointer"
            title="タグフィルターを全解除"
          >
            <X className="w-3 h-3" />
            <span>解除</span>
          </button>
        </div>
      )}
    </div>
  );
};
