import React from 'react';
import { ScopeAggregatedData } from '../../../src/types/copilot';
import { ShieldAlert, ArrowRight, TrendingDown } from 'lucide-react';

interface IdleSeatAdvisorProps {
  data: ScopeAggregatedData;
  onFilterIdleUsers: () => void;
}

export const IdleSeatAdvisor: React.FC<IdleSeatAdvisorProps> = ({ data, onFilterIdleUsers }) => {
  const { overview } = data;

  if (overview.idle_seats === 0) {
    return null;
  }

  const annualSavings = overview.idle_waste_usd * 12;

  return (
    <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-800/60 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-start space-x-3">
        <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-amber-200 flex items-center space-x-2">
            <span>ライセンス最適化推奨 (Cost Optimization Opportunity)</span>
            <span className="bg-amber-900/80 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-700">
              {overview.idle_seats} 席の遊休
            </span>
          </h4>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            30日以上アクティビティが記録されていないシートが検出されました。これらのシートを回収・再割り当てすることで、
            月間 <strong className="text-amber-300 font-semibold">${overview.idle_waste_usd.toLocaleString()}</strong>（年間推計: <strong className="text-amber-300 font-semibold">${annualSavings.toLocaleString()}</strong>）のライセンス費用の削減が可能です。
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3 shrink-0">
        <button
          onClick={onFilterIdleUsers}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg transition-all flex items-center space-x-1.5 shadow-md hover:shadow-amber-500/20"
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>遊休シート一覧を表示</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
