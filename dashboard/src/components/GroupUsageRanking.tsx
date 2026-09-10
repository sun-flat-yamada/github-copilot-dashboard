import React, { useState, useMemo } from 'react';
import { GroupingDimension, ScopeAggregatedData } from '../../../src/types/copilot';
import {
  Trophy,
  Briefcase,
  Landmark,
  Building2,
  ArrowUpDown,
  LineChart,
} from 'lucide-react';

interface GroupUsageRankingProps {
  data: ScopeAggregatedData;
  onSelectUserForTrend: (login: string) => void;
}

type SortMetric = 'suggestions' | 'acceptances' | 'chats' | 'cost' | 'acceptance_rate';

export const GroupUsageRanking: React.FC<GroupUsageRankingProps> = ({
  data,
  onSelectUserForTrend,
}) => {
  const [currentDimension, setCurrentDimension] = useState<GroupingDimension>('department');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortMetric>('acceptances');

  const { user_profiles = [], scope_type, scope_key, date_range } = data;

  // 選択された軸におけるグループ一覧
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    for (const p of user_profiles) {
      if (currentDimension === 'department') set.add(p.department);
      else if (currentDimension === 'cost_center') set.add(p.cost_center);
      else set.add(p.organization);
    }
    return Array.from(set).sort();
  }, [user_profiles, currentDimension]);

  // グループおよびソートによるランキング一覧
  const rankedUsers = useMemo(() => {
    // 1. グループ絞り込み
    const filtered = user_profiles.filter((p) => {
      if (selectedGroup === 'all') return true;
      if (currentDimension === 'department') return p.department === selectedGroup;
      if (currentDimension === 'cost_center') return p.cost_center === selectedGroup;
      return p.organization === selectedGroup;
    });

    // 2. ソート
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'acceptances':
          return b.total_acceptances - a.total_acceptances;
        case 'suggestions':
          return b.total_suggestions - a.total_suggestions;
        case 'chats':
          return b.total_chats - a.total_chats;
        case 'cost':
          return b.total_cost_usd - a.total_cost_usd;
        case 'acceptance_rate':
          return b.acceptance_rate - a.acceptance_rate;
        default:
          return b.total_acceptances - a.total_acceptances;
      }
    });
  }, [user_profiles, selectedGroup, currentDimension, sortBy]);

  const dimensionLabel =
    currentDimension === 'department'
      ? '任意仕訳グループ (部署・PJ)'
      : currentDimension === 'cost_center'
      ? 'GitHub Cost Center'
      : 'GitHub Organization';

  const scopeLabel =
    scope_type === 'daily'
      ? `日次集計 (${scope_key})`
      : scope_type === 'monthly'
      ? `月次集計 (${scope_key})`
      : `期間指定 (${date_range.start} 〜 ${date_range.end})`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col space-y-6">
      {/* 1. コントロールヘッダー */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-tight">グループ内 使用量・貢献ランキング</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
              {scopeLabel}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            CostCenter、Organization、および任意仕訳グループの範囲内で、AI活用度・受諾数を比較・順位付けします。
          </p>
        </div>

        {/* 軸の切り替えボタン */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 font-semibold">分析軸:</span>
          <div className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-1">
            <button
              onClick={() => {
                setCurrentDimension('department');
                setSelectedGroup('all');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                currentDimension === 'department'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>仕訳グループ</span>
            </button>
            <button
              onClick={() => {
                setCurrentDimension('cost_center');
                setSelectedGroup('all');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                currentDimension === 'cost_center'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Cost Center</span>
            </button>
            <button
              onClick={() => {
                setCurrentDimension('organization');
                setSelectedGroup('all');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                currentDimension === 'organization'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Organization</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. フィルタ & ソートバー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">範囲グループ選択:</span>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">すべての {dimensionLabel}</option>
            {availableGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            ({rankedUsers.length} 名)
          </span>
        </div>

        {/* ソート指標切り替え */}
        <div className="flex items-center space-x-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">ランキング基準:</span>
          <div className="inline-flex rounded-lg bg-slate-900 border border-slate-700 p-0.5 text-xs">
            <button
              onClick={() => setSortBy('acceptances')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sortBy === 'acceptances' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              受諾数 (Acceptances)
            </button>
            <button
              onClick={() => setSortBy('suggestions')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sortBy === 'suggestions' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              提案数
            </button>
            <button
              onClick={() => setSortBy('chats')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sortBy === 'chats' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AIチャット数
            </button>
            <button
              onClick={() => setSortBy('acceptance_rate')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sortBy === 'acceptance_rate' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              受諾率
            </button>
            <button
              onClick={() => setSortBy('cost')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sortBy === 'cost' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              利用料金
            </button>
          </div>
        </div>
      </div>

      {/* 3. ランキングテーブル */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-center w-14">順位</th>
              <th className="px-4 py-3">ユーザー / 表示名</th>
              <th className="px-4 py-3">{dimensionLabel}</th>
              <th className="px-4 py-3 text-right">AIコード提案数</th>
              <th className="px-4 py-3 text-right">受諾採用数</th>
              <th className="px-4 py-3 text-right">受諾率</th>
              <th className="px-4 py-3 text-right">AIチャット数</th>
              <th className="px-4 py-3 text-right">利用料金</th>
              <th className="px-4 py-3 text-center w-24">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {rankedUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  該当するユーザーが存在しません。
                </td>
              </tr>
            ) : (
              rankedUsers.map((u, index) => {
                const isTop1 = index === 0;
                const isTop2 = index === 1;
                const isTop3 = index === 2;

                return (
                  <tr key={u.login} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-center font-bold">
                      {isTop1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs">
                          🥇
                        </span>
                      ) : isTop2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/20 text-slate-200 border border-slate-400/40 text-xs">
                          🥈
                        </span>
                      ) : isTop3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/40 text-xs">
                          🥉
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono">{index + 1}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={u.avatar_url || 'https://github.com/ghost.png'}
                          alt={u.login}
                          className="w-6 h-6 rounded-full border border-slate-700 bg-slate-800"
                        />
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-100">{u.display_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">@{u.login}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-300">
                      {currentDimension === 'department'
                        ? u.department
                        : currentDimension === 'cost_center'
                        ? u.cost_center
                        : u.organization}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      {u.total_suggestions.toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                      {u.total_acceptances.toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-semibold text-purple-300">
                      {(u.acceptance_rate * 100).toFixed(1)}%
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-indigo-300">
                      {u.total_chats.toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200">
                      ${u.total_cost_usd.toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onSelectUserForTrend(u.login)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-all flex items-center space-x-1 mx-auto"
                        title="日次利用トレンド・モデル内訳を確認"
                      >
                        <LineChart className="w-3 h-3" />
                        <span>トレンド</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
