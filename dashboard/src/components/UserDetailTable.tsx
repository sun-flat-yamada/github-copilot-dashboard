import React, { useState, useMemo } from 'react';
import { ScopeAggregatedData, UserSeatStatus, UserUsageProfile } from '../../../src/types/copilot';
import {
  Search,
  Download,
  UserCheck,
  AlertCircle,
  AlertTriangle,
  Clock,
  XCircle,
  LineChart,
  BrainCircuit,
  ArrowUpDown,
  Users as UsersIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ActionColumnHeader } from './common/ActionColumnHeader';
import { UserDrilldownPanel } from './UserDrilldownPanel';
import { useCurrency } from '../contexts/CurrencyContext';

export type UserSortMetric =
  | 'default'
  | 'acceptances'
  | 'suggestions'
  | 'acceptance_rate'
  | 'chats'
  | 'cost'
  | 'days_inactive';

interface UserDetailTableProps {
  data: ScopeAggregatedData;
  userProfiles?: UserUsageProfile[];
  initialSelectedLogin?: string;
  filterStatus?: UserSeatStatus | 'all';
  onSelectUserForTrend?: (login: string) => void;
  onSelectUserForDeepAnalysis?: (login: string) => void;
}

export const UserDetailTable: React.FC<UserDetailTableProps> = ({
  data,
  userProfiles,
  initialSelectedLogin,
  filterStatus: initialStatus = 'all',
  onSelectUserForTrend,
  onSelectUserForDeepAnalysis,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserSeatStatus | 'all'>(initialStatus);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [sortBy, setSortBy] = useState<UserSortMetric>('default');
  const [selectedUserLogin, setSelectedUserLogin] = useState<string | null>(initialSelectedLogin || null);

  const { users, scope_type } = data;
  const { formatMoney } = useCurrency();

  // 部署一覧の抽出
  const departments = useMemo(() => {
    const set = new Set(users.map((u) => u.department));
    return Array.from(set).sort();
  }, [users]);

  // 利用可能なプロファイル一覧 (明示指定またはデータ内包)
  const effectiveProfiles = useMemo(() => {
    if (userProfiles && userProfiles.length > 0) return userProfiles;
    return data.user_profiles || [];
  }, [userProfiles, data.user_profiles]);

  // 利用実績プロファイルのマップ作成
  const profileMap = useMemo(() => {
    const map = new Map<string, UserUsageProfile>();
    for (const p of effectiveProfiles) {
      map.set(p.login.toLowerCase(), p);
    }
    return map;
  }, [effectiveProfiles]);

  const hasUsageMetrics = effectiveProfiles.length > 0;

  const handleToggleUserDrilldown = (login: string) => {
    setSelectedUserLogin((prev) => (prev === login ? null : login));
  };

  // フィルタリング & ソート
  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => {
      // 検索一致
      const matchesSearch =
        u.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.cost_center.toLowerCase().includes(searchTerm.toLowerCase());

      // ステータス一致
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

      // 部署一致
      const matchesDept = selectedDept === 'all' || u.department === selectedDept;

      return matchesSearch && matchesStatus && matchesDept;
    });

    if (sortBy === 'default') {
      return list;
    }

    return list.sort((a, b) => {
      const profA = profileMap.get(a.login.toLowerCase());
      const profB = profileMap.get(b.login.toLowerCase());

      switch (sortBy) {
        case 'acceptances':
          return (profB?.total_acceptances ?? 0) - (profA?.total_acceptances ?? 0);
        case 'suggestions':
          return (profB?.total_suggestions ?? 0) - (profA?.total_suggestions ?? 0);
        case 'acceptance_rate':
          return (profB?.acceptance_rate ?? 0) - (profA?.acceptance_rate ?? 0);
        case 'chats':
          return (profB?.total_chats ?? 0) - (profA?.total_chats ?? 0);
        case 'cost': {
          const costA = scope_type === 'daily' ? a.prorated_daily_cost_usd : a.monthly_cost_usd;
          const costB = scope_type === 'daily' ? b.prorated_daily_cost_usd : b.monthly_cost_usd;
          return costB - costA;
        }
        case 'days_inactive':
          return b.days_inactive - a.days_inactive;
        default:
          return 0;
      }
    });
  }, [users, searchTerm, statusFilter, selectedDept, sortBy, profileMap, scope_type]);

  // CSVエクスポート
  const handleExportCsv = () => {
    const headers = [
      '#',
      'GitHub User',
      '表示名',
      '仕訳グループ (部署)',
      'Cost Center',
      'Organization',
      'プラン',
      'ステータス',
      '最終アクティビティ日',
      'エディタ',
      '非アクティブ日数',
      '月額費用 (USD)',
      '日割り費用 (USD)',
      ...(hasUsageMetrics ? ['提案数', '受諾採用数', '受諾率(%)', 'AIチャット数'] : []),
      '備考',
    ];

    const rows = filteredUsers.map((u, idx) => {
      const prof = profileMap.get(u.login.toLowerCase());
      return [
        idx + 1,
        u.login,
        `"${u.display_name.replace(/"/g, '""')}"`,
        `"${u.department.replace(/"/g, '""')}"`,
        `"${u.cost_center.replace(/"/g, '""')}"`,
        u.organization,
        u.plan_type,
        u.status,
        u.last_activity_at || '未利用',
        u.last_activity_editor || '-',
        u.days_inactive === 999 ? 'N/A' : u.days_inactive,
        u.monthly_cost_usd.toFixed(2),
        u.prorated_daily_cost_usd.toFixed(4),
        ...(hasUsageMetrics
          ? [
              prof?.total_suggestions ?? 0,
              prof?.total_acceptances ?? 0,
              ((prof?.acceptance_rate ?? 0) * 100).toFixed(1),
              prof?.total_chats ?? 0,
            ]
          : []),
        `"${(u.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `copilot_users_${data.scope_key}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: UserSeatStatus, daysInactive: number) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
            <UserCheck className="w-3 h-3" />
            <span>Active ({daysInactive}日前)</span>
          </span>
        );
      case 'low_active':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-950 text-yellow-300 border border-yellow-800">
            <Clock className="w-3 h-3" />
            <span>Low Active ({daysInactive}日前)</span>
          </span>
        );
      case 'idle':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
            <AlertCircle className="w-3 h-3" />
            <span>Idle ({daysInactive}日前)</span>
          </span>
        );
      case 'never_used':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <XCircle className="w-3 h-3" />
            <span>未利用 (Never)</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <UsersIcon className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">ユーザー別 利用・活用明細</h3>
            {sortBy !== 'default' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                <span>並び替え適用中</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            該当ユーザー数: <strong className="text-slate-200">{filteredUsers.length}</strong> / {users.length} 名
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 検索入力 */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ユーザー / 表示名 / 部署 検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
            />
          </div>

          {/* ステータス絞り込み */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">全ステータス</option>
            <option value="active">Active (14日以内)</option>
            <option value="low_active">Low Active (15-30日)</option>
            <option value="idle">Idle (30日以上未利用)</option>
            <option value="never_used">Never Used (未利用)</option>
          </select>

          {/* 部署絞り込み */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs"
          >
            <option value="all">すべての仕訳グループ</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* 並び替え基準 */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400">並び順:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as UserSortMetric)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none"
            >
              <option value="default" className="bg-slate-900">標準 (シート順)</option>
              <option value="acceptances" className="bg-slate-900">受諾数 降順</option>
              <option value="suggestions" className="bg-slate-900">提案数 降順</option>
              <option value="acceptance_rate" className="bg-slate-900">受諾率 降順</option>
              <option value="chats" className="bg-slate-900">AIチャット数 降順</option>
              <option value="cost" className="bg-slate-900">費用 降順</option>
              <option value="days_inactive" className="bg-slate-900">非アクティブ日数 降順</option>
            </select>
          </div>

          {/* CSVエクスポートボタン */}
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>CSV出力</span>
          </button>
        </div>
      </div>

      {/* テーブル本体: ヘッダー固定・データ行垂直スクロール */}
      <div className="overflow-auto max-h-[600px] rounded-lg border border-slate-800 relative scrollbar-thin scrollbar-thumb-slate-700">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold shadow-md">
            <tr className="border-b border-slate-800">
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-center w-14">#</th>
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3">ユーザー / 表示名</th>
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3">任意仕訳グループ</th>
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3">Cost Center</th>
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3">Organization</th>
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3">プラン</th>
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3">稼働状況</th>
              {hasUsageMetrics && (
                <>
                  <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-right">提案数</th>
                  <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-right">受諾採用数</th>
                  <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-right">受諾率</th>
                  <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-right">AIチャット</th>
                </>
              )}
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-right">費用 / 超過請求 ({scope_type === 'daily' ? '日割り' : '月額'})</th>
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-center w-24">
                <ActionColumnHeader />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={hasUsageMetrics ? 13 : 9} className="px-4 py-8 text-center text-slate-500">
                  一致するユーザーが見つかりませんでした。
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, index) => {
                const prof = profileMap.get(u.login.toLowerCase());
                const isSelected = selectedUserLogin === u.login;

                return (
                  <React.Fragment key={u.login}>
                    <tr
                      onClick={() => handleToggleUserDrilldown(u.login)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-950/60 border-l-4 border-indigo-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
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
                            <div className="flex items-center space-x-1.5">
                              <span className="font-semibold text-slate-200">{u.display_name}</span>
                              {isSelected && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500 text-white">
                                  分析中
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">@{u.login}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-950/80 text-purple-300 border border-purple-800/60">
                          {u.department}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {u.cost_center_error ? (
                          <span
                            className="inline-flex items-center space-x-1 text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2 py-0.5 rounded text-[11px] font-semibold"
                            title="Cost Center APIの取得失敗または未紐付けのためデータ不明"
                          >
                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>不明 (API制限/エラー)</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium">{u.cost_center}</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {u.is_data_unavailable ? (
                          <span
                            className="inline-flex items-center space-x-1 text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
                            title="Org権限不足(HTTP 403)のため詳細メトリクス取得不能"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>{u.organization} (権限不足)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">{u.organization}</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] font-bold uppercase ${
                            u.plan_type === 'enterprise' ? 'text-indigo-400' : 'text-slate-400'
                          }`}
                        >
                          {u.plan_type}
                        </span>
                      </td>

                      <td className="px-4 py-3">{getStatusBadge(u.status, u.days_inactive)}</td>

                      {hasUsageMetrics && (
                        <>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {prof ? prof.total_suggestions.toLocaleString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                            {prof ? prof.total_acceptances.toLocaleString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-purple-300">
                            {prof ? `${(prof.acceptance_rate * 100).toFixed(1)}%` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-indigo-300">
                            {prof ? prof.total_chats.toLocaleString() : '-'}
                          </td>
                        </>
                      )}

                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const cost = scope_type === 'daily' ? u.prorated_daily_cost_usd : u.monthly_cost_usd;
                          const costDual = formatMoney(cost);
                          return (
                            <>
                              <div className="font-mono font-semibold text-slate-200">
                                {costDual.usd} {costDual.sub && <span className="text-[11px] text-slate-400">({costDual.sub})</span>}
                              </div>
                              <div className="text-[10px] text-amber-400 font-mono">
                                超過: {costDual.usd} {costDual.sub && `(${costDual.sub})`}
                              </div>
                            </>
                          );
                        })()}
                      </td>

                      <td className="px-4 py-3 text-center">
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
                              className="p-1.5 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer inline-flex items-center justify-center"
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
                              title="診断 (非効率パターン診断・高度分析を実行)"
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
                        <td colSpan={hasUsageMetrics ? 13 : 9} className="p-0 border-b-2 border-indigo-500/60">
                          <UserDrilldownPanel
                            login={u.login}
                            displayName={u.display_name}
                            avatarUrl={u.avatar_url}
                            department={u.department}
                            costCenter={u.cost_center}
                            organization={u.organization}
                            planType={u.plan_type}
                            statusBadge={getStatusBadge(u.status, u.days_inactive)}
                            lastActivity={u.last_activity_at}
                            editor={u.last_activity_editor}
                            daysInactive={u.days_inactive}
                            monthlyCostUsd={u.monthly_cost_usd}
                            proratedCostUsd={u.prorated_daily_cost_usd}
                            excessBillingUsd={scope_type === 'daily' ? u.prorated_daily_cost_usd : u.monthly_cost_usd}
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
