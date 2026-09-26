import React, { useState, useMemo } from 'react';
import { Users, Search, Download, ArrowUpDown, ArrowUp, ArrowDown, BrainCircuit, ChevronDown, ChevronUp, LineChart } from 'lucide-react';
import { GroupingDimension, MonthlyReportAggregatedData, UserUsageProfile } from '../../../../src/types/copilot';
import { adaptReportToProfiles } from '../../utils/deepAnalysisAdapter';
import { formatElapsedActivity } from '../../utils/dateFormatters';
import { ActionColumnHeader } from '../common/ActionColumnHeader';
import { UserDrilldownPanel } from '../UserDrilldownPanel';
import { useCurrency } from '../../contexts/CurrencyContext';

export type MonthlyUserSortKey =
  | 'index'
  | 'user'
  | 'department'
  | 'cost_center'
  | 'organization'
  | 'primary_model'
  | 'requests'
  | 'spend'
  | 'excess'
  | 'last_activity';

export type MonthlyUserSortOrder = 'asc' | 'desc';

interface MonthlyReportUserTableProps {
  reportData: MonthlyReportAggregatedData;
  userProfiles?: UserUsageProfile[];
  initialSelectedLogin?: string;
  grouping?: GroupingDimension;
  selectedGroup?: string;
  onGroupChange?: (group: string) => void;
  onSelectUserForDeepAnalysis?: (login: string) => void;
  onSelectUserForTrend?: (login: string) => void;
}

export const MonthlyReportUserTable: React.FC<MonthlyReportUserTableProps> = ({
  reportData,
  userProfiles,
  initialSelectedLogin,
  grouping = 'department',
  selectedGroup,
  onGroupChange,
  onSelectUserForDeepAnalysis,
  onSelectUserForTrend,
}) => {
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [localGroupFilter, setLocalGroupFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<MonthlyUserSortKey>('spend');
  const [sortOrder, setSortOrder] = useState<MonthlyUserSortOrder>('desc');
  const [selectedUserLogin, setSelectedUserLogin] = useState<string | null>(initialSelectedLogin || null);
  const { formatMoney } = useCurrency();

  const activeGroup = selectedGroup !== undefined ? selectedGroup : localGroupFilter;

  // 集計軸に応じたグループ一覧 (フィルター用)
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    reportData.user_details.forEach((u) => {
      if (grouping === 'cost_center') {
        if (u.cost_center) set.add(u.cost_center);
      } else if (grouping === 'organization') {
        if (u.organization) set.add(u.organization);
      } else {
        if (u.department) set.add(u.department);
      }
    });
    return Array.from(set).sort();
  }, [reportData, grouping]);

  const handleGroupFilterChange = (val: string) => {
    setLocalGroupFilter(val);
    if (onGroupChange) {
      onGroupChange(val);
    }
  };

  // 利用可能なプロファイル一覧 (渡されたプロファイルまたはレポートからの動的アダプト)
  const effectiveProfiles = useMemo(() => {
    if (userProfiles && userProfiles.length > 0) return userProfiles;
    return adaptReportToProfiles(reportData);
  }, [userProfiles, reportData]);

  // プロファイルマップ
  const profileMap = useMemo(() => {
    const map = new Map<string, UserUsageProfile>();
    for (const p of effectiveProfiles) {
      map.set(p.login.toLowerCase(), p);
    }
    return map;
  }, [effectiveProfiles]);

  const handleToggleUserDrilldown = (login: string) => {
    setSelectedUserLogin((prev) => (prev === login ? null : login));
  };

  const handleSort = (key: MonthlyUserSortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      const isDescDefault = key === 'requests' || key === 'spend' || key === 'excess' || key === 'last_activity';
      setSortOrder(isDescDefault ? 'desc' : 'asc');
    }
  };

  const handleDropdownSortChange = (val: 'spend' | 'requests') => {
    setSortKey(val);
    setSortOrder('desc');
  };

  const renderSortIcon = (key: MonthlyUserSortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-400 ml-1 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-400 ml-1 shrink-0" />
    );
  };

  const handleIndexSort = () => handleSort('index');

  // フィルタ・ソートされたユーザー明細
  const filteredUsers = useMemo(() => {
    return reportData.user_details
      .filter((u) => {
        const matchesSearch =
          u.login.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          u.display_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          u.cost_center.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          (u.organization && u.organization.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
          u.department.toLowerCase().includes(userSearchQuery.toLowerCase());

        let matchesGroup = true;
        if (activeGroup && activeGroup !== 'all') {
          if (grouping === 'cost_center') {
            matchesGroup = u.cost_center === activeGroup;
          } else if (grouping === 'organization') {
            matchesGroup = u.organization === activeGroup;
          } else {
            matchesGroup = u.department === activeGroup;
          }
        }
        return matchesSearch && matchesGroup;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'user':
            cmp = (a.display_name || a.login).localeCompare(b.display_name || b.login);
            break;
          case 'department':
            cmp = (a.department || '').localeCompare(b.department || '');
            break;
          case 'cost_center':
            cmp = (a.cost_center || '').localeCompare(b.cost_center || '');
            break;
          case 'organization':
            cmp = (a.organization || '').localeCompare(b.organization || '');
            break;
          case 'primary_model':
            cmp = (a.primary_model || '').localeCompare(b.primary_model || '');
            break;
          case 'requests':
            cmp = a.total_requests - b.total_requests;
            break;
          case 'spend': {
            const costA = a.gross_spend_usd ?? a.total_spend_usd;
            const costB = b.gross_spend_usd ?? b.total_spend_usd;
            cmp = costA - costB;
            break;
          }
          case 'excess': {
            const excessA = a.net_spend_usd ?? a.total_spend_usd;
            const excessB = b.net_spend_usd ?? b.total_spend_usd;
            cmp = excessA - excessB;
            break;
          }
          case 'last_activity':
            cmp = (a.last_activity_date || '').localeCompare(b.last_activity_date || '');
            break;
          case 'index':
          default:
            cmp = 0;
            break;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [reportData, userSearchQuery, activeGroup, grouping, sortKey, sortOrder]);

  // CSV エクスポート
  const handleExportCsv = () => {
    const headers = [
      '#',
      'GitHub User',
      'Display Name',
      'Department',
      'Cost Center',
      'Organization',
      'Primary Model',
      'Total Requests',
      'Usage Cost Gross (USD)',
      'Excess Billable Cost Net (USD)',
      'Last Activity',
      'Surface',
    ];
    const rows = filteredUsers.map((u, idx) => [
      idx + 1,
      u.login,
      `"${u.display_name.replace(/"/g, '""')}"`,
      `"${u.department.replace(/"/g, '""')}"`,
      `"${u.cost_center.replace(/"/g, '""')}"`,
      u.organization,
      `"${u.primary_model}"`,
      u.total_requests,
      (u.gross_spend_usd ?? u.total_spend_usd).toFixed(2),
      (u.net_spend_usd ?? u.total_spend_usd).toFixed(2),
      u.last_activity_date || '',
      `"${u.surface || ''}"`,
    ]);

    const csvText = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `copilot-usage-users-${reportData.report_month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>ユーザー別 利用・費用明細 ({filteredUsers.length}名)</span>
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <span>{sortKey === 'spend' ? '利用費用順' : sortKey === 'requests' ? 'リクエスト順' : '並び替え適用中'}</span>
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            レポート期間中の個人別消費量と主要モデル利用実績
          </p>
        </div>

        {/* 検索 & フィルター & エクスポート */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="ユーザー / 表示名 検索..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48"
            />
          </div>

          <select
            value={activeGroup}
            onChange={(e) => handleGroupFilterChange(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">
              {grouping === 'cost_center'
                ? '全 Cost Center'
                : grouping === 'organization'
                ? '全 Organization'
                : '全 部署'}
            </option>
            {availableGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            value={sortKey === 'spend' && sortOrder === 'desc' ? 'spend' : sortKey === 'requests' && sortOrder === 'desc' ? 'requests' : ''}
            onChange={(e) => handleDropdownSortChange(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value="spend">費用 降順</option>
            <option value="requests">リクエスト数 降順</option>
            {sortKey !== 'spend' && sortKey !== 'requests' && (
              <option value="" disabled>カスタム並び替え中</option>
            )}
          </select>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
            title="CSV形式でエクスポート"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* ユーザー一覧テーブル: ヘッダー固定・データ行垂直スクロール */}
      <div className="overflow-auto max-h-[600px] rounded-lg border border-slate-800 relative scrollbar-thin scrollbar-thumb-slate-700">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-950 text-slate-400 font-semibold shadow-md">
            <tr className="border-b border-slate-800">
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 text-center w-14 cursor-pointer select-none hover:text-slate-200" onClick={handleIndexSort} title="連番順">#</th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('user')}
              >
                <div className="flex items-center space-x-1">
                  <span>GitHub ユーザー</span>
                  {renderSortIcon('user')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('department')}
              >
                <div className="flex items-center space-x-1">
                  <span>部署 / 仕訳グループ</span>
                  {renderSortIcon('department')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('cost_center')}
              >
                <div className="flex items-center space-x-1">
                  <span>Cost Center</span>
                  {renderSortIcon('cost_center')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('organization')}
              >
                <div className="flex items-center space-x-1">
                  <span>Organization</span>
                  {renderSortIcon('organization')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('primary_model')}
              >
                <div className="flex items-center space-x-1">
                  <span>主利用モデル</span>
                  {renderSortIcon('primary_model')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('requests')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>総リクエスト</span>
                  {renderSortIcon('requests')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('spend')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>利用費用 (USD)</span>
                  {renderSortIcon('spend')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('excess')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>超過請求 (USD)</span>
                  {renderSortIcon('excess')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('last_activity')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>最終利用日</span>
                  {renderSortIcon('last_activity')}
                </div>
              </th>
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 py-2.5 px-3 text-center w-24">
                <ActionColumnHeader />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-8 text-slate-500">
                  該当するユーザーレコードがありません。
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, index) => {
                const isSelected = selectedUserLogin === u.login;
                const prof = profileMap.get(u.login.toLowerCase());

                return (
                  <React.Fragment key={u.login}>
                    <tr
                      onClick={() => handleToggleUserDrilldown(u.login)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-indigo-950/60 border-l-4 border-indigo-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-xs">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-100">{u.display_name}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500 text-white">
                              分析中
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">@{u.login}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {u.department}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{u.cost_center}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
                          {u.organization}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-950/60 text-purple-300 border border-purple-800/50">
                          {u.primary_model}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-200">
                        {u.total_requests.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {(() => {
                          const gross = u.gross_spend_usd ?? u.total_spend_usd;
                          const grossDual = formatMoney(gross);
                          return (
                            <div className="font-bold text-slate-100 font-mono">
                              {grossDual.usd} {grossDual.sub && <span className="text-[11px] text-slate-400 font-normal">({grossDual.sub})</span>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {(() => {
                          const net = u.net_spend_usd ?? u.total_spend_usd;
                          const netDual = formatMoney(net);
                          return (
                            <div className="text-[11px] font-semibold text-amber-400">
                              {netDual.usd} {netDual.sub && <span className="text-[10px] text-amber-300/80 font-normal">({netDual.sub})</span>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                        {u.last_activity_date ? (
                          <div className="flex items-center justify-end space-x-1.5 whitespace-nowrap">
                            <span className="text-slate-200">{u.last_activity_date}</span>
                            {formatElapsedActivity(u.last_activity_date) && (
                              <span className="text-[10px] text-slate-400 font-sans">
                                ({formatElapsedActivity(u.last_activity_date)})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleUserDrilldown(u.login);
                            }}
                            className={`p-1.5 rounded transition-all shadow-sm cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white border border-indigo-400'
                                : 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60'
                            }`}
                            title={isSelected ? 'ドリルダウンを閉じる' : '詳細分析 (利用実態・AI健全度をドリルダウン分析)'}
                            aria-label={isSelected ? '閉じる' : '詳細分析'}
                          >
                            {isSelected ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {onSelectUserForTrend && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectUserForTrend(u.login);
                              }}
                              className="p-1.5 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 transition-all shadow-sm cursor-pointer inline-flex items-center justify-center"
                              title="トレンド (日次利用トレンド・モデル内訳を確認)"
                              aria-label="トレンド"
                            >
                              <LineChart className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onSelectUserForDeepAnalysis && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectUserForDeepAnalysis(u.login);
                              }}
                              className="p-1.5 rounded bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 transition-all shadow-sm cursor-pointer inline-flex items-center justify-center"
                              title="診断 (非効率パターン・高度診断を実行)"
                              aria-label="診断"
                            >
                              <BrainCircuit className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isSelected && (
                      <tr key={`${u.login}-drilldown`} className="bg-slate-950">
                        <td colSpan={11} className="p-0 border-b-2 border-indigo-500/60">
                          <UserDrilldownPanel
                            login={u.login}
                            displayName={u.display_name}
                            department={u.department}
                            costCenter={u.cost_center}
                            organization={u.organization}
                            primaryModel={u.primary_model}
                            totalRequests={u.total_requests}
                            monthlyCostUsd={u.gross_spend_usd ?? u.total_spend_usd}
                            excessBillingUsd={u.net_spend_usd ?? u.total_spend_usd}
                            lastActivity={u.last_activity_date}
                            surface={u.surface}
                            profile={prof}
                            allProfiles={effectiveProfiles}
                            onSelectUserForTrend={onSelectUserForTrend}
                            onSelectUserForDeepAnalysis={onSelectUserForDeepAnalysis}
                            onClose={() => setSelectedUserLogin(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
