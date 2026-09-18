import React from 'react';
import { UserUsageProfile } from '../../../../src/types/copilot';
import {
  AnalysisPeriodScopeType,
  CustomDateRange,
} from '../../../../src/types/deep-analysis';
import { User, Calendar, ChevronDown } from 'lucide-react';

interface UserPeriodControlsProps {
  profiles: UserUsageProfile[];
  currentProfile: UserUsageProfile;
  selectedLogin: string;
  onSelectLogin: (login: string) => void;
  periodScope: AnalysisPeriodScopeType;
  onSelectPeriodScope: (scope: AnalysisPeriodScopeType) => void;
  customRange: CustomDateRange;
  onCustomRangeChange: (range: CustomDateRange) => void;
  isCustomPickerOpen: boolean;
  onToggleCustomPicker: () => void;
}

export const UserPeriodControls: React.FC<UserPeriodControlsProps> = ({
  profiles,
  currentProfile,
  selectedLogin,
  onSelectLogin,
  periodScope,
  onSelectPeriodScope,
  customRange,
  onCustomRangeChange,
  isCustomPickerOpen,
  onToggleCustomPicker,
}) => {
  return (
    <>
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* ユーザー選択 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5 shrink-0">
            <User className="w-4 h-4 text-indigo-400" />
            <span>診断対象ユーザー:</span>
          </label>

          <div className="relative min-w-[260px] sm:w-80">
            <select
              value={selectedLogin}
              onChange={(e) => onSelectLogin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer pr-8 shadow-inner"
            >
              {profiles.map((p) => (
                <option key={p.login} value={p.login}>
                  {p.display_name} (@{p.login}) - {p.department}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700 font-mono text-[11px]">
              {currentProfile.cost_center}
            </span>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
              {currentProfile.plan_type}
            </span>
          </div>
        </div>

        {/* 対象区間の切り替えコントロール */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1 mr-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>対象区間:</span>
          </span>

          <div className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-1 gap-1">
            <button
              onClick={() => onSelectPeriodScope('30d')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodScope === '30d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              前1カ月間 (デフォルト)
            </button>

            <button
              onClick={() => onSelectPeriodScope('today')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodScope === 'today'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              当日
            </button>

            <button
              onClick={() => onSelectPeriodScope('7d')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodScope === '7d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              1週間前まで
            </button>

            <button
              onClick={onToggleCustomPicker}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodScope === 'custom'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>期間指定</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${isCustomPickerOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 期間指定カレンダーピッカー展開パネル */}
      {periodScope === 'custom' && isCustomPickerOpen && (
        <div className="bg-slate-900 border border-indigo-500/50 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-semibold text-slate-300">開始日:</span>
            <input
              type="date"
              value={customRange.start}
              onChange={(e) => onCustomRangeChange({ ...customRange, start: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <span className="text-slate-500">〜</span>
            <span className="font-semibold text-slate-300">終了日:</span>
            <input
              type="date"
              value={customRange.end}
              onChange={(e) => onCustomRangeChange({ ...customRange, end: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={onToggleCustomPicker}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow transition-all"
          >
            この期間で診断を更新
          </button>
        </div>
      )}
    </>
  );
};
