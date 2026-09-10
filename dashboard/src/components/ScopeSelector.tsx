import React from 'react';
import { AnalysisScopeType, IndexMetadata } from '../../../src/types/copilot';
import { Calendar, Clock, Layers } from 'lucide-react';

interface ScopeSelectorProps {
  indexMeta: IndexMetadata | null;
  scopeType: AnalysisScopeType;
  selectedKey: string;
  onScopeChange: (type: AnalysisScopeType, key: string) => void;
}

export const ScopeSelector: React.FC<ScopeSelectorProps> = ({
  indexMeta,
  scopeType,
  selectedKey,
  onScopeChange,
}) => {
  const availableDays = indexMeta?.available_days || [];
  const availableMonths = indexMeta?.available_months || [];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-2">
        <Layers className="w-5 h-5 text-indigo-400" />
        <span className="text-sm font-semibold text-slate-300">分析スコープ:</span>
        <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => onScopeChange('daily', availableDays[0] || selectedKey)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center space-x-1.5 ${
              scopeType === 'daily'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>日次 (Daily)</span>
          </button>
          <button
            onClick={() => onScopeChange('monthly', availableMonths[0] || selectedKey)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center space-x-1.5 ${
              scopeType === 'monthly'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>月次 (Monthly)</span>
          </button>
          <button
            onClick={() => onScopeChange('custom', 'latest-30d')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center space-x-1.5 ${
              scopeType === 'custom'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>直近30日間 (30 Days)</span>
          </button>
        </div>
      </div>

      {/* スコープに応じたキーセレクタ */}
      <div className="flex items-center space-x-3 text-sm">
        {scopeType === 'daily' && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">対象日付:</span>
            <select
              value={selectedKey}
              onChange={(e) => onScopeChange('daily', e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableDays.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        {scopeType === 'monthly' && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">対象月:</span>
            <select
              value={selectedKey}
              onChange={(e) => onScopeChange('monthly', e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}

        {scopeType === 'custom' && (
          <div className="flex items-center space-x-2 text-xs text-indigo-300 bg-indigo-950/50 border border-indigo-800/60 px-3 py-1.5 rounded-lg">
            <span>期間: {indexMeta?.default_scopes.latest_range.start} 〜 {indexMeta?.default_scopes.latest_range.end}</span>
          </div>
        )}
      </div>
    </div>
  );
};
