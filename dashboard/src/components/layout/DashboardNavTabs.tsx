import React from 'react';
import {
  PieChart as PieIcon,
  Trophy,
  Bot,
  Landmark,
  BarChart3,
  Users2,
  Compass,
  BrainCircuit,
} from 'lucide-react';

export type TabType = 'overview' | 'ranking' | 'trend' | 'budget' | 'usage' | 'users';

interface DashboardNavTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenRadar: () => void;
  onOpenDeepAnalysis: () => void;
}

export const DashboardNavTabs: React.FC<DashboardNavTabsProps> = ({
  activeTab,
  onTabChange,
  onOpenRadar,
  onOpenDeepAnalysis,
}) => {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-slate-900 border border-slate-800 p-1 self-start lg:self-auto gap-1">
      <button
        onClick={() => onTabChange('overview')}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          activeTab === 'overview'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <PieIcon className="w-3.5 h-3.5" />
        <span>コスト配賦</span>
      </button>

      <button
        onClick={() => onTabChange('ranking')}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          activeTab === 'ranking'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Trophy className="w-3.5 h-3.5" />
        <span>グループ内ランキング</span>
      </button>

      <button
        onClick={() => onTabChange('trend')}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          activeTab === 'trend'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Bot className="w-3.5 h-3.5" />
        <span>ユーザー別モデル推移</span>
      </button>

      <button
        onClick={() => onTabChange('budget')}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          activeTab === 'budget'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Landmark className="w-3.5 h-3.5" />
        <span>CostCenter予算</span>
      </button>

      <button
        onClick={() => onTabChange('usage')}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          activeTab === 'usage'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <BarChart3 className="w-3.5 h-3.5" />
        <span>利用量・AI分析</span>
      </button>

      <button
        onClick={() => onTabChange('users')}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          activeTab === 'users'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Users2 className="w-3.5 h-3.5" />
        <span>ユーザー明細</span>
      </button>

      <button
        onClick={onOpenRadar}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/60 transition-all shadow-sm"
        title="著名ベンチマーク最新データに基づくAIモデル特性レーダーを開く"
      >
        <Compass className="w-3.5 h-3.5 text-purple-400" />
        <span>モデル特性レーダー</span>
      </button>

      <button
        onClick={onOpenDeepAnalysis}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 transition-all shadow-sm"
        title="個人の利用実績から非効率AI利用パターンの兆候を深掘り診断"
      >
        <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
        <span>ディープ分析 (高度診断)</span>
      </button>
    </div>
  );
};
