import React from 'react';
import { CostCenterBudget } from '../../../src/types/copilot';
import { Landmark, ShieldCheck, AlertTriangle, AlertOctagon, TrendingUp, Gift, DollarSign } from 'lucide-react';

interface CostCenterBudgetCardsProps {
  budgets?: CostCenterBudget[];
}

export const CostCenterBudgetCards: React.FC<CostCenterBudgetCardsProps> = ({ budgets = [] }) => {
  if (budgets.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
        <Landmark className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <p className="text-sm">Cost Center Budget情報が設定されていないか、取得できませんでした。</p>
      </div>
    );
  }

  // 全体合計の算出
  const totalLimit = budgets.reduce((sum, b) => sum + b.spending_limit_usd, 0);
  const totalFree = budgets.reduce((sum, b) => sum + b.free_tier_budget_usd, 0);
  const totalCurrent = budgets.reduce((sum, b) => sum + b.current_spend_usd, 0);
  const totalNetBillable = budgets.reduce((sum, b) => sum + b.net_billable_spend_usd, 0);
  const totalRemaining = budgets.reduce((sum, b) => sum + b.remaining_budget_usd, 0);
  const totalUtilization = totalLimit > 0 ? Number(((totalNetBillable / totalLimit) * 100).toFixed(1)) : 0;

  return (
    <div className="flex flex-col space-y-6">
      {/* 1. 全体Budgetサマリーバー */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shrink-0">
            <Landmark className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-white tracking-tight">Enterprise Cost Center 予算管理 (Budget Overview)</h3>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800">
                GitHub Enterprise Billing
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              各Cost Centerに割り当てられた上限Budget額、無料枠、および現在の消化状況を一元管理します。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs shrink-0">
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
            <span className="text-slate-400 block mb-0.5">総 Limit設定値</span>
            <span className="text-base font-bold text-slate-100 font-mono">${totalLimit.toLocaleString()}</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
            <span className="text-emerald-400 block mb-0.5 flex items-center space-x-1">
              <Gift className="w-3 h-3" />
              <span>総 無料枠</span>
            </span>
            <span className="text-base font-bold text-emerald-300 font-mono">${totalFree.toLocaleString()}</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
            <span className="text-slate-400 block mb-0.5">総 利用費用</span>
            <span className="text-base font-bold text-slate-200 font-mono">${totalCurrent.toLocaleString()}</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
            <span className="text-amber-400 block mb-0.5 font-medium">超過請求費用</span>
            <span className="text-base font-bold text-amber-300 font-mono">${totalNetBillable.toLocaleString()}</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
            <span className="text-indigo-400 block mb-0.5">総 残余枠</span>
            <span className="text-base font-bold text-indigo-300 font-mono">${totalRemaining.toLocaleString()}</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
            <span className="text-purple-400 block mb-0.5">全体 消化率</span>
            <span className="text-base font-bold text-purple-300 font-mono">{totalUtilization}%</span>
          </div>
        </div>
      </div>

      {/* 2. 各Cost CenterのBudgetカードグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {budgets.map((b) => {
          const isExceeded = b.status === 'exceeded';
          const isWarning = b.status === 'warning';

          return (
            <div
              key={b.cost_center_id}
              className={`bg-slate-900 border rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all ${
                isExceeded
                  ? 'border-rose-700/80 bg-rose-950/10'
                  : isWarning
                  ? 'border-amber-700/80 bg-amber-950/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* ヘッダー: 名前とステータス */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-tight">{b.cost_center_name}</h4>
                    <span className="text-[11px] font-mono text-slate-400">{b.cost_center_code}</span>
                  </div>

                  {isExceeded ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-950 text-rose-300 border border-rose-800 flex items-center space-x-1 animate-pulse">
                      <AlertOctagon className="w-3 h-3" />
                      <span>予算超過</span>
                    </span>
                  ) : isWarning ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-950 text-amber-300 border border-amber-800 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>注意 (80%超)</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>正常</span>
                    </span>
                  )}
                </div>

                {/* 予算内訳リスト */}
                <div className="mt-4 space-y-2 text-xs border-t border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                      <span>Limit設定値:</span>
                    </span>
                    <strong className="font-mono text-slate-100">${b.spending_limit_usd.toLocaleString()}</strong>
                  </div>

                  <div className="flex items-center justify-between text-emerald-300">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <Gift className="w-3.5 h-3.5 text-emerald-500" />
                      <span>無料枠 (Credit):</span>
                    </span>
                    <span className="font-mono font-medium text-emerald-400">-${b.free_tier_budget_usd.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-200">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                      <span>利用費用 (使用済):</span>
                    </span>
                    <span className="font-mono font-bold text-slate-200">${b.current_spend_usd.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-amber-300 text-xs pt-1 border-t border-slate-800/60 font-medium">
                    <span>超過請求費用:</span>
                    <span className="font-mono font-bold text-amber-400">${b.net_billable_spend_usd.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-indigo-300 font-semibold text-xs pt-0.5">
                    <span>残余Budget枠:</span>
                    <span className="font-mono text-indigo-400">${b.remaining_budget_usd.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* プログレスバー & 使用率 */}
              <div className="mt-5 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-slate-400">予算消化率</span>
                  <span
                    className={`font-mono font-bold ${
                      isExceeded ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {b.budget_utilization_percent}%
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isExceeded
                        ? 'bg-rose-500'
                        : isWarning
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, b.budget_utilization_percent)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
