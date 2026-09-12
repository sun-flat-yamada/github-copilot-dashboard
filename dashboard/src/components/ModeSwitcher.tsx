import React, { useState, useEffect } from 'react';
import { DashboardAppMode } from '../../../src/types/copilot';
import {
  Activity,
  FileSpreadsheet,
  Compass,
  BrainCircuit,
  ChevronDown,
  Check,
} from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);

  // ESCキーでドロップダウンを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const modes = [
    {
      id: 'live_metrics' as DashboardAppMode,
      label: 'API 連携 (Live Metrics)',
      icon: <Activity className="w-3.5 h-3.5" />,
      activeClass: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md',
      badge: null,
    },
    {
      id: 'monthly_report' as DashboardAppMode,
      label: 'Monthly Usage Report',
      icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
      activeClass: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md',
      badge: reportCount > 0 ? (
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            currentMode === 'monthly_report'
              ? 'bg-emerald-950 text-emerald-200'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          {reportCount}
        </span>
      ) : null,
    },
    {
      id: 'model_radar' as DashboardAppMode,
      label: 'AIモデル特性レーダー',
      icon: <Compass className="w-3.5 h-3.5" />,
      activeClass: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md',
      badge: null,
    },
    {
      id: 'deep_analysis' as DashboardAppMode,
      label: 'ディープ分析 (高度診断)',
      icon: <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />,
      activeClass: 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 text-white shadow-md',
      badge: (
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            currentMode === 'deep_analysis'
              ? 'bg-indigo-950 text-indigo-200'
              : 'bg-slate-800 text-cyan-300'
          }`}
        >
          Pro
        </span>
      ),
    },
  ];

  const activeModeItem = modes.find((m) => m.id === currentMode) || modes[0];

  return (
    <>
      {/* 1. 幅が十分広い場合 (2xl 以上 / 1536px〜): 4つのモードを横並びでフル表示 */}
      <div className="hidden 2xl:inline-flex items-center p-1 bg-slate-900/90 border border-slate-800 rounded-xl shadow-inner flex-shrink-0">
        {modes.map((mode) => {
          const isActive = currentMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative whitespace-nowrap ${
                isActive
                  ? mode.activeClass
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {mode.icon}
              <span>{mode.label}</span>
              {mode.badge}
            </button>
          );
        })}
      </div>

      {/* 2. 幅が不足する場合 (2xl 未満): 現在アクティブなモードのみを表示し、クリック展開で切り替え */}
      <div className="relative 2xl:hidden flex-shrink-0">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-md ${
            isOpen
              ? 'bg-slate-800 border-slate-600 text-white ring-2 ring-indigo-500/40'
              : 'bg-slate-900/95 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-800/80'
          }`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          title="クリックしてモードを切り替え"
        >
          <span className="flex items-center space-x-1.5 truncate max-w-[130px] sm:max-w-[190px] md:max-w-[240px]">
            {activeModeItem.icon}
            <span className="truncate whitespace-nowrap">{activeModeItem.label}</span>
          </span>
          {activeModeItem.badge}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
              isOpen ? 'rotate-180 text-white' : ''
            }`}
          />
        </button>

        {/* ドロップダウンメニュー */}
        {isOpen && (
          <>
            {/* 外側クリック検知用オーバーレイ */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 p-1.5 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl z-50 backdrop-blur-md flex flex-col space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
                表示モードを選択
              </div>

              {modes.map((mode) => {
                const isActive = currentMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      onModeChange(mode.id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left ${
                      isActive
                        ? 'bg-indigo-950/80 text-white border border-indigo-700/80 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    role="option"
                    aria-selected={isActive}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div
                        className={`p-1.5 rounded-lg ${
                          isActive ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {mode.icon}
                      </div>
                      <span className="truncate">{mode.label}</span>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                      {mode.badge}
                      {isActive && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
};
