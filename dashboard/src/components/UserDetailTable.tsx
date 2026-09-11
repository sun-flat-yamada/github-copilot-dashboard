import React, { useState, useMemo } from 'react';
import { ScopeAggregatedData, UserSeatStatus } from '../../../src/types/copilot';
import { Search, Download, UserCheck, AlertCircle, AlertTriangle, Clock, XCircle, LineChart, BrainCircuit } from 'lucide-react';

interface UserDetailTableProps {
  data: ScopeAggregatedData;
  filterStatus?: UserSeatStatus | 'all';
  onSelectUserForTrend?: (login: string) => void;
  onSelectUserForDeepAnalysis?: (login: string) => void;
}

export const UserDetailTable: React.FC<UserDetailTableProps> = ({
  data,
  filterStatus: initialStatus = 'all',
  onSelectUserForTrend,
  onSelectUserForDeepAnalysis,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserSeatStatus | 'all'>(initialStatus);
  const [selectedDept, setSelectedDept] = useState<string>('all');

  const { users, scope_type } = data;

  // 部署一覧の抽出
  const departments = useMemo(() => {
    const set = new Set(users.map((u) => u.department));
    return Array.from(set).sort();
  }, [users]);

  // フィルタリング
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
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
  }, [users, searchTerm, statusFilter, selectedDept]);

  // CSVエクスポート
  const handleExportCsv = () => {
    const headers = [
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
      '備考',
    ];

    const rows = filteredUsers.map((u) => [
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
      `"${(u.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `copilot_seats_${data.scope_key}.csv`);
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
          <h3 className="text-sm font-semibold text-slate-200">ユーザー別 利用 & 費用配賦明細</h3>
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
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
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

      {/* テーブル本体 */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">ユーザー / 表示名</th>
              <th className="px-4 py-3">任意仕訳グループ</th>
              <th className="px-4 py-3">Cost Center</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">プラン</th>
              <th className="px-4 py-3">稼働状況</th>
              <th className="px-4 py-3 text-right">費用 ({scope_type === 'daily' ? '日割り' : '月額'})</th>
              <th className="px-4 py-3 text-center w-24">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  一致するユーザーが見つかりませんでした。
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.login} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={u.avatar_url || 'https://github.com/ghost.png'}
                        alt={u.login}
                        className="w-6 h-6 rounded-full border border-slate-700 bg-slate-800"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-200">{u.display_name}</span>
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
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200">
                    ${(scope_type === 'daily' ? u.prorated_daily_cost_usd : u.monthly_cost_usd).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center space-x-1.5">
                      {onSelectUserForTrend && (
                        <button
                          onClick={() => onSelectUserForTrend(u.login)}
                          className="px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold flex items-center space-x-1 transition-all"
                          title="日次利用トレンド・モデル内訳を確認"
                        >
                          <LineChart className="w-3 h-3" />
                          <span>トレンド</span>
                        </button>
                      )}
                      {onSelectUserForDeepAnalysis && (
                        <button
                          onClick={() => onSelectUserForDeepAnalysis(u.login)}
                          className="px-2 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 text-[10px] font-semibold flex items-center space-x-1 transition-all shadow-sm"
                          title="非効率パターン診断・高度分析を実行"
                        >
                          <BrainCircuit className="w-3 h-3" />
                          <span>診断</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
