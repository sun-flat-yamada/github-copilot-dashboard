import React, { useState, useMemo } from 'react';
import { Users, Search, Download, Trophy, BrainCircuit } from 'lucide-react';
import { MonthlyReportAggregatedData } from '../../../../src/types/copilot';

interface MonthlyReportUserTableProps {
  reportData: MonthlyReportAggregatedData;
  onSelectUserForDeepAnalysis?: (login: string) => void;
}

export const MonthlyReportUserTable: React.FC<MonthlyReportUserTableProps> = ({
  reportData,
  onSelectUserForDeepAnalysis,
}) => {
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [userSortBy, setUserSortBy] = useState<'spend' | 'requests'>('spend');

  // 部署一覧 (フィルター用)
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    reportData.user_details.forEach((u) => set.add(u.department));
    return Array.from(set);
  }, [reportData]);

  // フィルタ・ソートされたユーザー明細
  const filteredUsers = useMemo(() => {
    return reportData.user_details
      .filter((u) => {
        const matchesSearch =
          u.login.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          u.display_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          u.cost_center.toLowerCase().includes(userSearchQuery.toLowerCase());
        const matchesDept = selectedDeptFilter === 'all' || u.department === selectedDeptFilter;
        return matchesSearch && matchesDept;
      })
      .sort((a, b) => {
        if (userSortBy === 'spend') return b.total_spend_usd - a.total_spend_usd;
        return b.total_requests - a.total_requests;
      });
  }, [reportData, userSearchQuery, selectedDeptFilter, userSortBy]);

  // CSV エクスポート
  const handleExportCsv = () => {
    const headers = [
      '順位',
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
            <span>ユーザー別 利用・費用明細 & ランキング ({filteredUsers.length}名)</span>
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>{userSortBy === 'spend' ? '利用費用順' : 'リクエスト順'}</span>
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
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">全グループ</option>
            {departmentsList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={userSortBy}
            onChange={(e) => setUserSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value="spend">費用 降順</option>
            <option value="requests">リクエスト数 降順</option>
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

      {/* ユーザー一覧テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
              <th className="py-2.5 px-3 text-center w-14">順位</th>
              <th className="py-2.5 px-3">GitHub ユーザー</th>
              <th className="py-2.5 px-3">部署 / 仕訳グループ</th>
              <th className="py-2.5 px-3">Cost Center</th>
              <th className="py-2.5 px-3">主利用モデル</th>
              <th className="py-2.5 px-3 text-right">総リクエスト</th>
              <th className="py-2.5 px-3 text-right">利用費用 / 超過請求 (USD)</th>
              <th className="py-2.5 px-3 text-right">最終利用日</th>
              <th className="py-2.5 px-3 text-center w-24">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-500">
                  該当するユーザーレコードがありません。
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, index) => {
                const isTop1 = index === 0;
                const isTop2 = index === 1;
                const isTop3 = index === 2;

                return (
                  <tr key={u.login} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-center font-bold">
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
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-100">{u.display_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">@{u.login}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                        {u.department}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{u.cost_center}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-950/60 text-purple-300 border border-purple-800/50">
                        {u.primary_model}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-200">
                      {u.total_requests.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-bold text-slate-100">
                        ${(u.gross_spend_usd ?? u.total_spend_usd).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-amber-400 font-mono">
                        超過: ${(u.net_spend_usd ?? u.total_spend_usd).toFixed(2)}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">
                      {u.last_activity_date || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {onSelectUserForDeepAnalysis && (
                        <button
                          type="button"
                          onClick={() => onSelectUserForDeepAnalysis(u.login)}
                          className="px-2 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 text-[10px] font-semibold inline-flex items-center space-x-1 transition-all shadow-sm"
                          title="このユーザーの非効率パターン・高度診断を実行"
                        >
                          <BrainCircuit className="w-3 h-3" />
                          <span>診断</span>
                        </button>
                      )}
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
