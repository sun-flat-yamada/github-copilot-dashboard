import React from 'react';
import { ScopeAggregatedData } from '../../../src/types/copilot';
import { ShieldAlert, ArrowRight, TrendingDown } from 'lucide-react';
import { SEAT_IDLE_CRITERIA_TEXT, isIdleSeatStatus } from '../../../src/domain/rules/SeatClassificationRule';
import { monthlyIdleSavingsUsd } from '../../../src/domain/rules/ScopeCostRule';

interface IdleSeatAdvisorProps {
  data: ScopeAggregatedData;
  onFilterIdleUsers: () => void;
}

export const IdleSeatAdvisor: React.FC<IdleSeatAdvisorProps> = ({ data, onFilterIdleUsers }) => {
  const { overview } = data;

  if (overview.idle_seats === 0) {
    return null;
  }

  // 削減可能額は「遊休シートの月額費用の合計」。overview.idle_waste_usd はスコープ内の費用
  // (日次スコープでは日割り) のため、「月間」「年間推計」の表示には使わない。
  const monthlySavings = monthlyIdleSavingsUsd(data.users);
  const annualSavings = monthlySavings * 12;
  const hasUnconfirmedIdleSeat = data.users.some(
    (u) => isIdleSeatStatus(u.status) && u.plan_type === 'unknown'
  );

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
            遊休 ({SEAT_IDLE_CRITERIA_TEXT}) と判定されたシートが検出されました。これらのシートを回収・再割り当てすることで、
            月間 <strong className="text-amber-300 font-semibold">${monthlySavings.toLocaleString()}</strong>（年間推計: <strong className="text-amber-300 font-semibold">${annualSavings.toLocaleString()}</strong>）のライセンス費用の削減が可能です。
          </p>
          {hasUnconfirmedIdleSeat && (
            <p className="text-[11px] text-amber-400 mt-1" data-testid="idle-unconfirmed-note">
              料金プランが未確定のシートは、削減可能額に含めていません。
            </p>
          )}
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
