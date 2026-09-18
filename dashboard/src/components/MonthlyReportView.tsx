import React, { useState, useMemo } from 'react';
import {
  GroupingDimension,
  MonthlyReportAggregatedData,
} from '../../../src/types/copilot';
import {
  DollarSign,
  Users,
  Cpu,
  Boxes,
  PieChart as PieIcon,
  BarChart3,
  Upload,
  Search,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from 'recharts';

interface MonthlyReportViewProps {
  reportData: MonthlyReportAggregatedData;
  availableReportMonths: string[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onOpenDropzone: () => void;
}

const COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
];

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  reportData,
  availableReportMonths,
  selectedMonth,
  onSelectMonth,
  onOpenDropzone,
}) => {
  const [currentGrouping, setCurrentGrouping] = useState<GroupingDimension>('department');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [userSortBy, setUserSortBy] = useState<'spend' | 'requests'>('spend');

  // グループ集計データの整形
  const groupSummaries = useMemo(() => {
    let rawGroup: Record<string, any> = {};
    if (currentGrouping === 'department') rawGroup = reportData.by_department;
    else if (currentGrouping === 'cost_center') rawGroup = reportData.by_cost_center;
    else rawGroup = reportData.by_organization;

    return Object.values(rawGroup).sort((a: any, b: any) => b.total_cost_usd - a.total_cost_usd);
  }, [reportData, currentGrouping]);

  const pieChartData = useMemo(() => {
    return groupSummaries.map((g: any) => ({
      name: g.group_name,
      value: g.total_cost_usd,
      requests: g.total_suggestions,
      users: g.total_seats,
    }));
  }, [groupSummaries]);

  // 部署一覧 (フィルター用)
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    reportData.user_details.forEach((u) => set.add(u.department));
    return Array.from(set);
  }, [reportData]);

  // 日別消費トレンド (日付昇順に防御的に再ソート)
  // バックエンド (JSON) 側のデータ品質に依存せず、表示側でも常に暦日順を保証する。
  const sortedDailyTrends = useMemo(() => {
    return [...reportData.daily_trends].sort((a, b) => {
      const ta = Date.parse(a.date);
      const tb = Date.parse(b.date);
      if (!isNaN(ta) && !isNaN(tb)) return ta - tb;
      return a.date.localeCompare(b.date);
    });
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
    <div className="flex flex-col space-y-6">
      {/* 1. レポートツールバー (月切り替え & CSVドロップゾーン) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-800/80 text-emerald-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white">対象月次レポート:</span>
              <select
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {availableReportMonths.map((m) => (
                  <option key={m} value={m}>
                    {m} レポート
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-400">
              <span>ソース: <strong className="text-slate-200">{reportData.file_name}</strong></span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                {reportData.source_type === 'local_drop' ? (
                  <span className="text-amber-400 font-medium">ローカル直接読込 (一時表示)</span>
                ) : (
                  <span className="text-emerald-400 font-medium flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>copilot-data 格納済み</span>
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenDropzone}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition shadow"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>手元の CSV を解析 / ドロップ</span>
          </button>
        </div>
      </div>

      {/* 2. KPI サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* カード 1: 請求実額 */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">月間実費用 (Net Spend)</span>
            <div className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-800/60 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-white tracking-tight">
              ${reportData.overview.total_net_spend_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center space-x-1.5">
            <span>定価: ${reportData.overview.total_gross_spend_usd.toFixed(2)}</span>
            {reportData.overview.total_discount_usd > 0 && (
              <span className="text-emerald-400">(-${reportData.overview.total_discount_usd.toFixed(2)})</span>
            )}
          </div>
        </div>

        {/* カード 2: 総リクエスト数 */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">総リクエスト / クレジット</span>
            <div className="p-1.5 rounded-lg bg-indigo-950 border border-indigo-800/60 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white tracking-tight">
              {reportData.overview.total_requests.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">リクエスト / AIC 呼出総量</p>
        </div>

        {/* カード 3: アクティブ人数 */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">レポート内アクティブ人数</span>
            <div className="p-1.5 rounded-lg bg-blue-950 border border-blue-800/60 text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white tracking-tight">
              {reportData.overview.total_active_users}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">利用履歴のあるユニークアカウント</p>
        </div>

        {/* カード 4: 最多使用モデル */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">最多利用 AI モデル</span>
            <div className="p-1.5 rounded-lg bg-purple-950 border border-purple-800/60 text-purple-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 truncate">
            <span className="text-lg font-bold text-white tracking-tight">
              {reportData.overview.top_model}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {reportData.model_breakdown[0]?.percentage || 0}% のリクエストを占有
          </p>
        </div>

        {/* カード 5: 主要課金 SKU */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">主契約 / SKU</span>
            <div className="p-1.5 rounded-lg bg-amber-950 border border-amber-800/60 text-amber-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 truncate">
            <span className="text-sm font-bold text-white font-mono">
              {reportData.overview.top_sku}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">主要請求カテゴリ</p>
        </div>
      </div>

      {/* 3. 3軸集計 & 費用配賦セクション */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              <span>3軸グループ別 費用・利用配賦 (Cost Allocation)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              COPILOT_USER_MAPPING により社内部署・プロジェクトへ自動仕訳
            </p>
          </div>

          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setCurrentGrouping('department')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                currentGrouping === 'department'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              部署 (Department)
            </button>
            <button
              onClick={() => setCurrentGrouping('cost_center')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                currentGrouping === 'cost_center'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cost Center
            </button>
            <button
              onClick={() => setCurrentGrouping('organization')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                currentGrouping === 'organization'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Organization
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* ドーナツチャート */}
          <div className="h-64 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`$${Number(val || 0).toFixed(2)}`, '費用']}
                  contentStyle={{ backgroundColor: '#090d13', borderColor: '#334155', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <span className="text-[11px] text-slate-400 mt-1">金額シェア (USD)</span>
          </div>

          {/* 配賦一覧リスト */}
          <div className="lg:col-span-2 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2 px-3">グループ名</th>
                  <th className="py-2 px-3 text-right">人数</th>
                  <th className="py-2 px-3 text-right">リクエスト数</th>
                  <th className="py-2 px-3 text-right">合計金額 (USD)</th>
                  <th className="py-2 px-3 text-right">シェア</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {groupSummaries.map((g: any, idx: number) => {
                  const percent =
                    reportData.overview.total_net_spend_usd > 0
                      ? ((g.total_cost_usd / reportData.overview.total_net_spend_usd) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <tr key={g.group_name} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-medium text-white flex items-center space-x-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span className="truncate max-w-[200px]">{g.group_name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{g.total_seats}名</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {g.total_suggestions.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                        ${g.total_cost_usd.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{percent}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. AI モデル別・SKU別分析 & 日別推移 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* モデル別消費比率 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>AI モデル別 リクエスト & 費用内訳</span>
          </h3>
          <div className="space-y-3 pt-1">
            {reportData.model_breakdown.map((m, idx) => (
              <div key={m.model_name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">{m.model_name}</span>
                  <div className="flex items-center space-x-2 text-slate-400">
                    <span>{m.total_requests.toLocaleString()} req</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">${m.total_spend_usd.toFixed(2)}</span>
                    <span>({m.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${m.percentage}%`,
                      backgroundColor: COLORS[idx % COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 日別リクエスト・コスト推移 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>月内 日別消費トレンド</span>
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sortedDailyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" tickFormatter={(v) => v.substring(8)} textAnchor="middle" />
                <YAxis yAxisId="left" stroke="#64748b" />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                <Tooltip contentStyle={{ backgroundColor: '#090d13', borderColor: '#334155' }} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="requests"
                  name="リクエスト数"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="spend_usd"
                  name="費用 ($)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. ユーザー別利用明細テーブル */}
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
    </div>
  );
};
