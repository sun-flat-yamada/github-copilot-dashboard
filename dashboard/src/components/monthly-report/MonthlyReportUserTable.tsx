import React, { useState, useMemo } from 'react';
import { Users, Search, Download } from 'lucide-react';
import { MonthlyReportAggregatedData } from '../../../../src/types/copilot';

interface MonthlyReportUserTableProps {
  reportData: MonthlyReportAggregatedData;
}

export const MonthlyReportUserTable: React.FC<MonthlyReportUserTableProps> = ({ reportData }) => {
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
      'GitHub User',
      'Display Name',
      'Department',
      'Cost Center',
      'Organization',
      'Primary Model',
      'Total Requests',
      'Total Spend (USD)',
      'Last Activity',
      'Surface',
    ];
    const rows = filteredUsers.map((u) => [
      u.login,
      `"${u.display_name.replace(/"/g, '""')}"`,
      `"${u.department.replace(/"/g, '""')}"`,
      `"${u.cost_center.replace(/"/g, '""')}"`,
      u.organization,
      `"${u.primary_model}"`,
      u.total_requests,
      u.total_spend_usd.toFixed(2),
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

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
              <th className="py-2.5 px-3">GitHub ユーザー</th>
              <th className="py-2.5 px-3">部署 / 仕訳グループ</th>
              <th className="py-2.5 px-3">Cost Center</th>
              <th className="py-2.5 px-3">主利用モデル</th>
              <th className="py-2.5 px-3 text-right">総リクエスト</th>
              <th className="py-2.5 px-3 text-right">利用費用 (USD)</th>
              <th className="py-2.5 px-3 text-right">最終利用日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500">
                  該当するユーザーレコードがありません。
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.login} className="hover:bg-slate-800/40 transition">
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
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                    ${u.total_spend_usd.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">
                    {u.last_activity_date || '-'}
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
