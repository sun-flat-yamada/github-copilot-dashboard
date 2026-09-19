import React, { useState, useMemo } from 'react';
import { Users, Search, Download, Trophy, BrainCircuit, ChevronDown, ChevronUp, LineChart } from 'lucide-react';
import { MonthlyReportAggregatedData, UserUsageProfile } from '../../../../src/types/copilot';
import { adaptReportToProfiles } from '../../utils/deepAnalysisAdapter';
import { UserDrilldownPanel } from '../UserDrilldownPanel';

interface MonthlyReportUserTableProps {
  reportData: MonthlyReportAggregatedData;
  userProfiles?: UserUsageProfile[];
  initialSelectedLogin?: string;
  onSelectUserForDeepAnalysis?: (login: string) => void;
  onSelectUserForTrend?: (login: string) => void;
}

export const MonthlyReportUserTable: React.FC<MonthlyReportUserTableProps> = ({
  reportData,
  userProfiles,
  initialSelectedLogin,
  onSelectUserForDeepAnalysis,
  onSelectUserForTrend,
}) => {
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [userSortBy, setUserSortBy] = useState<'spend' | 'requests'>('spend');
  const [selectedUserLogin, setSelectedUserLogin] = useState<string | null>(initialSelectedLogin || null);

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
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleUserDrilldown(u.login);
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center space-x-1 transition-all shadow-sm cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white border border-indigo-400'
                                : 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60'
                            }`}
                            title={isSelected ? 'ドリルダウンを閉じる' : 'このユーザーの利用実態・AI健全度をドリルダウン分析'}
                          >
                            {isSelected ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            <span>{isSelected ? '閉じる' : '詳細分析'}</span>
                          </button>
                          {onSelectUserForTrend && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectUserForTrend(u.login);
                              }}
                              className="px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                              title="日次利用トレンド・モデル内訳を確認"
                            >
                              <LineChart className="w-3 h-3" />
                              <span>トレンド</span>
                            </button>
                          )}
                          {onSelectUserForDeepAnalysis && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectUserForDeepAnalysis(u.login);
                              }}
                              className="px-2 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 text-[10px] font-semibold inline-flex items-center space-x-1 transition-all shadow-sm cursor-pointer"
                              title="このユーザーの非効率パターン・高度診断を実行"
                            >
                              <BrainCircuit className="w-3 h-3" />
                              <span>診断</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isSelected && (
                      <tr key={`${u.login}-drilldown`} className="bg-slate-950">
                        <td colSpan={9} className="p-0 border-b-2 border-indigo-500/60">
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
