import React, { useState, useMemo } from 'react';
import { GroupingDimension, ScopeAggregatedData } from '../../../src/types/copilot';
import {
  Users,
  Briefcase,
  Landmark,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LineChart,
} from 'lucide-react';

interface GroupUsageRankingProps {
  data: ScopeAggregatedData;
  grouping: GroupingDimension;
  selectedGroup: string;
  onGroupChange?: (group: string) => void;
  onSelectUserForTrend: (login: string) => void;
}

type SortMetric =
  | 'index'
  | 'user'
  | 'group'
  | 'suggestions'
  | 'acceptances'
  | 'chats'
  | 'cost'
  | 'excess'
  | 'acceptance_rate';

export const GroupUsageRanking: React.FC<GroupUsageRankingProps> = ({
  data,
  grouping,
  selectedGroup,
  onGroupChange,
  onSelectUserForTrend,
}) => {
  const [sortBy, setSortBy] = useState<SortMetric>('acceptances');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { user_profiles = [], scope_type, scope_key, date_range } = data;

  const handleSort = (metric: SortMetric) => {
    if (sortBy === metric) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(metric);
      const isDescDefault =
        metric === 'acceptances' ||
        metric === 'suggestions' ||
        metric === 'chats' ||
        metric === 'cost' ||
        metric === 'excess' ||
        metric === 'acceptance_rate';
      setSortOrder(isDescDefault ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (metric: SortMetric) => {
    if (sortBy !== metric) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-400 ml-1 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-400 ml-1 shrink-0" />
    );
  };

  // 選択された軸におけるグループ一覧
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    for (const p of user_profiles) {
      if (grouping === 'department') set.add(p.department);
      else if (grouping === 'cost_center') set.add(p.cost_center);
      else set.add(p.organization);
    }
    return Array.from(set).sort();
  }, [user_profiles, grouping]);

  // グループおよびソートによるランキング一覧
  const rankedUsers = useMemo(() => {
    // 1. グループ絞り込み
    const filtered = user_profiles.filter((p) => {
      if (selectedGroup === 'all') return true;
      if (grouping === 'department') return p.department === selectedGroup;
      if (grouping === 'cost_center') return p.cost_center === selectedGroup;
      return p.organization === selectedGroup;
    });

    // 2. ソート
    return filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'user':
          cmp = (a.display_name || a.login).localeCompare(b.display_name || b.login);
          break;
        case 'group': {
          const gA = grouping === 'department' ? a.department : grouping === 'cost_center' ? a.cost_center : a.organization;
          const gB = grouping === 'department' ? b.department : grouping === 'cost_center' ? b.cost_center : b.organization;
          cmp = (gA || '').localeCompare(gB || '');
          break;
        }
        case 'acceptances':
          cmp = a.total_acceptances - b.total_acceptances;
          break;
        case 'suggestions':
          cmp = a.total_suggestions - b.total_suggestions;
          break;
        case 'chats':
          cmp = a.total_chats - b.total_chats;
          break;
        case 'cost':
        case 'excess':
          cmp = a.total_cost_usd - b.total_cost_usd;
          break;
        case 'acceptance_rate':
          cmp = a.acceptance_rate - b.acceptance_rate;
          break;
        case 'index':
        default:
          cmp = a.total_acceptances - b.total_acceptances;
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [user_profiles, selectedGroup, grouping, sortBy, sortOrder]);

  const dimensionLabel =
    grouping === 'department'
      ? '任意仕訳グループ (部署・PJ)'
      : grouping === 'cost_center'
      ? 'GitHub Cost Center'
      : 'GitHub Organization';

  const DimensionIcon =
    grouping === 'department'
      ? Briefcase
      : grouping === 'cost_center'
      ? Landmark
      : Building2;

  const scopeLabel =
    scope_type === 'daily'
      ? `日次集計 (${scope_key})`
      : scope_type === 'monthly'
      ? `月次集計 (${scope_key})`
      : `期間指定 (${date_range.start} 〜 ${date_range.end})`;

  // 選択中の Cost Center の予算情報 (該当する場合)
  const currentCostCenterBudget = useMemo(() => {
    if (grouping !== 'cost_center' || !data.cost_center_budgets) return null;
    if (selectedGroup === 'all') return null;
    return data.cost_center_budgets.find(
      (b) => b.cost_center_name.toLowerCase() === selectedGroup.toLowerCase() || b.cost_center_id === selectedGroup
    );
  }, [grouping, selectedGroup, data.cost_center_budgets]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col space-y-6">
      {/* 1. コントロールヘッダー */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white tracking-tight">グループ内 使用量・活用状況</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
              {scopeLabel}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            ページ共通の集計軸（{dimensionLabel}）および選択グループの範囲内で、AI活用度・受諾数を比較・一覧表示します。
          </p>
        </div>

        {/* ページ全体と連動した集計単位の表示インジケーター & Cost Center Limit */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {currentCostCenterBudget && (
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
              <span className="text-slate-400">Limit設定:</span>
              <span className="font-mono font-bold text-slate-200">${currentCostCenterBudget.spending_limit_usd.toLocaleString()}</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400">超過請求:</span>
              <span className="font-mono font-bold text-amber-300">${currentCostCenterBudget.net_billable_spend_usd.toLocaleString()}</span>
            </div>
          )}

          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-800/80 text-purple-200 text-xs font-semibold shadow-sm">
            <DimensionIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>{dimensionLabel}</span>
            <span className="text-[10px] text-purple-300 bg-purple-900/80 px-1.5 py-0.5 rounded font-normal">
              ページ全体連動
            </span>
          </div>
        </div>
      </div>

      {/* 2. フィルタ & ソートバー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">範囲グループ選択:</span>
          <select
            value={selectedGroup}
            onChange={(e) => onGroupChange?.(e.target.value)}
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
          <span className="text-xs text-slate-400">並び替え基準:</span>
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

      {/* 3. ユーザー利用明細テーブル */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-center w-14 cursor-pointer select-none hover:text-slate-200" onClick={() => handleSort('index')} title="連番順">#</th>
              <th
                className="px-4 py-3 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('user')}
              >
                <div className="flex items-center space-x-1">
                  <span>ユーザー / 表示名</span>
                  {renderSortIcon('user')}
                </div>
              </th>
              <th
                className="px-4 py-3 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('group')}
              >
                <div className="flex items-center space-x-1">
                  <span>{dimensionLabel}</span>
                  {renderSortIcon('group')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('suggestions')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>AIコード提案数</span>
                  {renderSortIcon('suggestions')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('acceptances')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>受諾採用数</span>
                  {renderSortIcon('acceptances')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('acceptance_rate')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>受諾率</span>
                  {renderSortIcon('acceptance_rate')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('chats')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>AIチャット数</span>
                  {renderSortIcon('chats')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('cost')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>利用料金 (USD)</span>
                  {renderSortIcon('cost')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('excess')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>超過請求 (USD)</span>
                  {renderSortIcon('excess')}
                </div>
              </th>
              <th className="px-4 py-3 text-center w-24">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {rankedUsers.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  該当するユーザーが存在しません。
                </td>
              </tr>
            ) : (
              rankedUsers.map((u, index) => {
                return (
                  <tr key={u.login} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">
                      {index + 1}
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
                      {grouping === 'department'
                        ? u.department
                        : grouping === 'cost_center'
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

                    <td className="px-4 py-3 text-right">
                      <span className="font-mono font-semibold text-slate-200">
                        ${u.total_cost_usd.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className="text-[11px] font-semibold text-amber-400">
                        ${u.total_cost_usd.toFixed(2)}
                      </span>
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
