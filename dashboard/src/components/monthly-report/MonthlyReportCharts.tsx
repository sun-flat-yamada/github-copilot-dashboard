import React, { useState, useMemo } from 'react';
import {
  GroupingDimension,
  MonthlyReportAggregatedData,
} from '../../../../src/types/copilot';
import {
  PieChart as PieIcon,
  Cpu,
  BarChart3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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

export const REPORT_CHART_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
];

interface MonthlyReportChartsProps {
  reportData: MonthlyReportAggregatedData;
  grouping?: GroupingDimension;
  onGroupingChange?: (grouping: GroupingDimension) => void;
  selectedGroup?: string;
}

export const MonthlyReportCharts: React.FC<MonthlyReportChartsProps> = ({
  reportData,
  grouping: externalGrouping,
  onGroupingChange,
  selectedGroup = 'all',
}) => {
  const [internalGrouping, setInternalGrouping] = useState<GroupingDimension>('department');
  const currentGrouping = externalGrouping || internalGrouping;

  const handleGroupingSelect = (dim: GroupingDimension) => {
    setInternalGrouping(dim);
    if (onGroupingChange) {
      onGroupingChange(dim);
    }
  };

  // グループ集計データの整形
  const groupSummaries = useMemo(() => {
    let rawGroup: Record<string, any> = {};
    if (currentGrouping === 'department') rawGroup = reportData.by_department;
    else if (currentGrouping === 'cost_center') rawGroup = reportData.by_cost_center;
    else rawGroup = reportData.by_organization;

    return Object.values(rawGroup).sort((a: any, b: any) => b.total_cost_usd - a.total_cost_usd);
  }, [reportData, currentGrouping]);

  type GroupSortKey = 'name' | 'seats' | 'requests' | 'cost' | 'excess' | 'share';
  const [groupSortKey, setGroupSortKey] = useState<GroupSortKey>('cost');
  const [groupSortOrder, setGroupSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleGroupSort = (key: GroupSortKey) => {
    if (groupSortKey === key) {
      setGroupSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setGroupSortKey(key);
      setGroupSortOrder(key === 'name' ? 'asc' : 'desc');
    }
  };

  const renderGroupSortIcon = (key: GroupSortKey) => {
    if (groupSortKey !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />;
    }
    return groupSortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-400 ml-1 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-400 ml-1 shrink-0" />
    );
  };

  const pieChartData = useMemo(() => {
    return groupSummaries.map((g: any) => ({
      name: g.group_name,
      value: g.total_cost_usd,
      netCost: g.net_cost_usd,
      requests: g.total_suggestions,
      users: g.total_seats,
    }));
  }, [groupSummaries]);

  // テーブル表示用のソート済みグループ集計
  const sortedTableSummaries = useMemo(() => {
    return [...groupSummaries].sort((a: any, b: any) => {
      let cmp = 0;
      switch (groupSortKey) {
        case 'name':
          cmp = (a.group_name || '').localeCompare(b.group_name || '');
          break;
        case 'seats':
          cmp = (a.total_seats || 0) - (b.total_seats || 0);
          break;
        case 'requests':
          cmp = (a.total_suggestions || 0) - (b.total_suggestions || 0);
          break;
        case 'cost':
          cmp = (a.total_cost_usd || 0) - (b.total_cost_usd || 0);
          break;
        case 'excess': {
          const excessA = Number(a.net_cost_usd ?? a.total_cost_usd ?? 0);
          const excessB = Number(b.net_cost_usd ?? b.total_cost_usd ?? 0);
          cmp = excessA - excessB;
          break;
        }
        case 'share':
          cmp = (a.total_cost_usd || 0) - (b.total_cost_usd || 0);
          break;
        default:
          cmp = 0;
          break;
      }
      return groupSortOrder === 'asc' ? cmp : -cmp;
    });
  }, [groupSummaries, groupSortKey, groupSortOrder]);

  // 日別消費トレンド (日付昇順に防御的に再ソート)
  const sortedDailyTrends = useMemo(() => {
    return [...reportData.daily_trends].sort((a, b) => {
      const ta = Date.parse(a.date);
      const tb = Date.parse(b.date);
      if (!isNaN(ta) && !isNaN(tb)) return ta - tb;
      return a.date.localeCompare(b.date);
    });
  }, [reportData]);

  return (
    <div className="space-y-6">
      {/* 1. 3軸集計 & 費用配賦セクション */}
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
              onClick={() => handleGroupingSelect('department')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                currentGrouping === 'department'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              部署 (Department)
            </button>
            <button
              onClick={() => handleGroupingSelect('cost_center')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                currentGrouping === 'cost_center'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cost Center
            </button>
            <button
              onClick={() => handleGroupingSelect('organization')}
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
                    <Cell key={`cell-${index}`} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, _name: any, item: any) => {
                    const g = item?.payload;
                    const excess = g?.netCost !== undefined ? `$${Number(g.netCost).toFixed(2)}` : `$${Number(val || 0).toFixed(2)}`;
                    return [`利用費用: $${Number(val || 0).toFixed(2)} (超過請求: ${excess})`, '金額'];
                  }}
                  contentStyle={{ backgroundColor: '#090d13', borderColor: '#334155', borderRadius: 8, fontSize: '11px' }}
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
                  <th
                    className="py-2 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                    onClick={() => handleGroupSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>グループ名</span>
                      {renderGroupSortIcon('name')}
                    </div>
                  </th>
                  <th
                    className="py-2 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                    onClick={() => handleGroupSort('seats')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>人数</span>
                      {renderGroupSortIcon('seats')}
                    </div>
                  </th>
                  <th
                    className="py-2 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                    onClick={() => handleGroupSort('requests')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>リクエスト数</span>
                      {renderGroupSortIcon('requests')}
                    </div>
                  </th>
                  <th
                    className="py-2 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                    onClick={() => handleGroupSort('cost')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>利用費用 (USD)</span>
                      {renderGroupSortIcon('cost')}
                    </div>
                  </th>
                  <th
                    className="py-2 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                    onClick={() => handleGroupSort('excess')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>超過請求 (USD)</span>
                      {renderGroupSortIcon('excess')}
                    </div>
                  </th>
                  <th
                    className="py-2 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                    onClick={() => handleGroupSort('share')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>シェア</span>
                      {renderGroupSortIcon('share')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedTableSummaries.map((g: any, idx: number) => {
                  const percent =
                    reportData.overview.total_net_spend_usd > 0
                      ? ((g.total_cost_usd / reportData.overview.total_net_spend_usd) * 100).toFixed(1)
                      : '0.0';
                  const isSelected = selectedGroup !== 'all' && selectedGroup === g.group_name;
                  return (
                    <tr
                      key={g.group_name}
                      className={`transition ${
                        isSelected
                          ? 'bg-emerald-950/60 border-l-4 border-emerald-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-medium text-white flex items-center space-x-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: REPORT_CHART_COLORS[idx % REPORT_CHART_COLORS.length] }}
                        />
                        <span className="truncate max-w-[200px]">{g.group_name}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            選択中
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{g.total_seats}名</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {g.total_suggestions.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-semibold text-slate-100 font-mono">${g.total_cost_usd.toFixed(2)}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span className="text-[11px] text-amber-400 font-medium">
                          ${Number(g.net_cost_usd ?? g.total_cost_usd).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">{percent}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. AI モデル別・SKU別分析 & 日別推移 */}
      <div className="flex flex-col space-y-6 w-full">
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
                      backgroundColor: REPORT_CHART_COLORS[idx % REPORT_CHART_COLORS.length],
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
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span>日別利用トレンド (Daily Trend)</span>
          </h3>
          <div className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sortedDailyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis yAxisId="left" stroke="#10b981" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#090d13', borderColor: '#334155', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="cost_usd"
                  name="利用額 (USD)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="requests"
                  name="リクエスト数"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
