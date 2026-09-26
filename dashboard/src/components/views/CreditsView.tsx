import React, { useState, useMemo } from 'react';
import { CreditsViewModel } from '../../../../src/adapters/presenters/CreditsPresenter';
import { Coins, DollarSign, Layers, PieChart, AlertTriangle, ShieldCheck, Users, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface CreditsViewProps {
  viewModel: CreditsViewModel;
}

type CreditsConsumerSortKey = 'login' | 'department' | 'costCenter' | 'credits' | 'costUsd';

export const CreditsView: React.FC<CreditsViewProps> = ({ viewModel }) => {
  const [sortKey, setSortKey] = useState<CreditsConsumerSortKey>('credits');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  if (!viewModel.hasData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
        <Coins className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <p className="text-sm">AI Credits データが利用できません。</p>
      </div>
    );
  }

  const {
    effectiveRateFormatted,
    totalCreditsUsedFormatted,
    totalCreditsCostFormatted,
    totalCombinedCostFormatted,
    poolUtilizationPercent,
    poolStatus,
    byModel,
    byCostCenter,
    topConsumers,
  } = viewModel;

  const handleSort = (key: CreditsConsumerSortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'login' || key === 'department' || key === 'costCenter' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (key: CreditsConsumerSortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400" />
    );
  };

  const sortedConsumers = useMemo(() => {
    return [...topConsumers].sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'login':
          diff = a.login.localeCompare(b.login, 'ja');
          break;
        case 'department':
          diff = (a.department || '').localeCompare(b.department || '', 'ja');
          break;
        case 'costCenter':
          diff = (a.costCenter || '').localeCompare(b.costCenter || '', 'ja');
          break;
        case 'credits':
          diff = a.credits - b.credits;
          break;
        case 'costUsd':
          diff = a.costUsd - b.costUsd;
          break;
      }
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [topConsumers, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & KPIs */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/30 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
              <Coins className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">GitHub AI Credits & 従量課金分析</h3>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-800">
                  2026.06+ Specification
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                組織全体の共有プールクレジット消化状況、モデル別トークン換算費用、および個人上限を可視化します。
              </p>
            </div>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>組織プール総消費</span>
            </span>
            <span className="text-2xl font-black text-amber-300 font-mono">{totalCreditsUsedFormatted}</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>AI Credits 換算費用 ({effectiveRateFormatted})</span>
            </span>
            <span className="text-2xl font-black text-emerald-300 font-mono">{totalCreditsCostFormatted}</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>総合費用 (シート＋Credits)</span>
            </span>
            <span className="text-2xl font-black text-slate-100 font-mono">{totalCombinedCostFormatted}</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center justify-between">
              <span>プール消化率</span>
              {poolStatus === 'exceeded' ? (
                <span className="text-[10px] text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> 超過
                </span>
              ) : poolStatus === 'warning' ? (
                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> 警戒
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> 健全
                </span>
              )}
            </span>
            <span className="text-2xl font-black text-slate-100 font-mono">{poolUtilizationPercent}%</span>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  poolStatus === 'exceeded'
                    ? 'bg-rose-500'
                    : poolStatus === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, poolUtilizationPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Model Breakdown & Cost Centers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Breakdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-400" />
            <span>モデル別 AI Credits 消費割合</span>
          </h4>
          {byModel.length === 0 ? (
            <p className="text-xs text-slate-500">モデル別クレジット内訳データがありません。</p>
          ) : (
            <div className="space-y-3">
              {byModel.map((m) => (
                <div key={m.modelName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{m.modelName}</span>
                    <span className="text-slate-400 font-mono">
                      {m.credits.toLocaleString()} c ({m.costUsdFormatted}) - {m.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full"
                      style={{ width: `${m.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Center Breakdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Cost Center 別 Credits 配賦状況</span>
          </h4>
          {byCostCenter.length === 0 ? (
            <p className="text-xs text-slate-500">Cost Center別クレジットデータがありません。</p>
          ) : (
            <div className="space-y-3">
              {byCostCenter.map((c) => (
                <div
                  key={c.costCenter}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <span className="font-semibold text-slate-200">{c.costCenter}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-300 font-mono">{c.credits.toLocaleString()} Credits</span>
                    <span className="text-emerald-400 font-mono font-bold">{c.costUsdFormatted}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Top Consumers Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <span>トップ AI Credits 消費ユーザー (Top Consumers)</span>
        </h4>
        {topConsumers.length === 0 ? (
          <p className="text-xs text-slate-500">ユーザー別クレジット消費データがありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th
                    className="py-2.5 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('login')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>GitHub ユーザー</span>
                      {renderSortIcon('login')}
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('department')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>部署 / チーム</span>
                      {renderSortIcon('department')}
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('costCenter')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Cost Center</span>
                      {renderSortIcon('costCenter')}
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('credits')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>消費 Credits</span>
                      {renderSortIcon('credits')}
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('costUsd')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>換算費用</span>
                      {renderSortIcon('costUsd')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedConsumers.map((u) => (
                  <tr key={u.login} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-200 font-mono">{u.login}</td>
                    <td className="py-2.5 px-3 text-slate-400">{u.department || '未設定'}</td>
                    <td className="py-2.5 px-3 text-slate-400">{u.costCenter || 'Default'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-300">
                      {u.credits.toLocaleString()} c
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      {u.costUsdFormatted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
