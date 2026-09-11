import React from 'react';
import { DashboardAppMode } from '../../../src/types/copilot';
import { Activity, FileSpreadsheet, Compass, BrainCircuit } from 'lucide-react';

interface ModeSwitcherProps {
  currentMode: DashboardAppMode;
  onModeChange: (mode: DashboardAppMode) => void;
  reportCount: number;
}

export const ModeSwitcher: React.FC<ModeSwitcherProps> = ({
  currentMode,
  onModeChange,
  reportCount,
}) => {
  return (
    <div className="inline-flex items-center p-1 bg-slate-900/90 border border-slate-800 rounded-xl shadow-inner">
      <button
        onClick={() => onModeChange('live_metrics')}
        className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          currentMode === 'live_metrics'
            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <Activity className="w-3.5 h-3.5" />
        <span>API 連携 (Live Metrics)</span>
      </button>

      <button
        onClick={() => onModeChange('monthly_report')}
        className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
          currentMode === 'monthly_report'
            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        <span>Monthly Usage Report</span>
        {reportCount > 0 && (
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              currentMode === 'monthly_report' ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {reportCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onModeChange('model_radar')}
        className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          currentMode === 'model_radar'
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <Compass className="w-3.5 h-3.5" />
        <span>AIモデル特性レーダー</span>
      </button>

      <button
        onClick={() => onModeChange('deep_analysis')}
        className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
          currentMode === 'deep_analysis'
            ? 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 text-white shadow-md'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
        <span>ディープ分析 (高度診断)</span>
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            currentMode === 'deep_analysis' ? 'bg-indigo-950 text-indigo-200' : 'bg-slate-800 text-cyan-300'
          }`}
        >
          Pro
        </span>
      </button>
    </div>
  );
};
