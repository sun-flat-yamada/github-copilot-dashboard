import React from 'react';
import { AnalysisViewId, ANALYSIS_VIEW_REGISTRY } from '../../../../src/types/views';
import { DataSourceType } from '../../../../src/types/copilot';
import {
  PieChart as PieIcon,
  Trophy,
  Users2,
  Bot,
  Landmark,
  BrainCircuit,
  Compass,
} from 'lucide-react';

interface ViewNavigationProps {
  activeView: AnalysisViewId;
  onSelectView: (view: AnalysisViewId) => void;
  activeSource: DataSourceType;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  PieChart: <PieIcon className="w-3.5 h-3.5" />,
  Trophy: <Trophy className="w-3.5 h-3.5" />,
  Users2: <Users2 className="w-3.5 h-3.5" />,
  Bot: <Bot className="w-3.5 h-3.5" />,
  Landmark: <Landmark className="w-3.5 h-3.5" />,
  BrainCircuit: <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />,
  Compass: <Compass className="w-3.5 h-3.5 text-purple-400" />,
};

export const ViewNavigation: React.FC<ViewNavigationProps> = ({
  activeView,
  onSelectView,
  activeSource,
}) => {
  return (
    <nav className="w-full border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-sm sticky top-16 z-40">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto no-scrollbar">
        <div className="inline-flex items-center space-x-1 p-1 bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-inner min-w-max">
          {ANALYSIS_VIEW_REGISTRY.map((view) => {
            const isActive = activeView === view.id;
            const isSupported = view.supportedDataSources.includes(activeSource);
            const icon = ICON_MAP[view.iconName] || <PieIcon className="w-3.5 h-3.5" />;

            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onSelectView(view.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : isSupported
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    : 'text-slate-600 hover:text-slate-400 hover:bg-slate-850/40'
                }`}
                title={isSupported ? view.description : `${view.description} (現在のデータソースでは一部制限あり)`}
              >
                <span className="shrink-0">{icon}</span>
                <span>{view.shortTitle}</span>
                {view.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : view.badgeColor === 'cyan'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {view.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
