import React from 'react';
import { GroupingDimension, ScopeAggregatedData } from '../../../src/types/copilot';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

interface CostAllocationChartsProps {
  data: ScopeAggregatedData;
  grouping: GroupingDimension;
}

const COLORS = [
  '#8957e5', // purple
  '#2f81f7', // blue
  '#3fb950', // green
  '#d29922', // yellow/amber
  '#f85149', // red
  '#db61a2', // pink
  '#7ee787', // light green
  '#a371f7', // light purple
];

export const CostAllocationCharts: React.FC<CostAllocationChartsProps> = ({
  data,
  grouping,
}) => {
  const summariesRecord =
    grouping === 'department'
      ? data.by_department
      : grouping === 'cost_center'
      ? data.by_cost_center
      : data.by_organization;

  const groupingLabel =
    grouping === 'department'
      ? '仕訳グループ (部署・PJ)'
      : grouping === 'cost_center'
      ? 'GitHub Cost Center'
      : 'GitHub Organization';

  const chartData = Object.values(summariesRecord)
    .map((g) => ({
      name: g.group_name,
      cost: g.total_cost_usd,
      seats: g.total_seats,
      activeSeats: g.active_seats,
      idleSeats: g.idle_seats,
      potentialSavings: g.potential_savings_usd,
      acceptanceRate: Math.round(g.acceptance_rate * 100),
    }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="flex flex-col space-y-6 w-full">
      {/* 1. コスト配賦 ドーナツチャート */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            {groupingLabel} 別 コスト配賦 (USD)
          </h3>
          <span className="text-xs text-slate-400">Total: ${data.overview.total_spend_usd.toLocaleString()}</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="cost"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, '費用']}
                contentStyle={{
                  backgroundColor: '#161b22',
                  borderColor: '#30363d',
                  borderRadius: '8px',
                  color: '#f0f6fc',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 凡例リスト */}
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {chartData.slice(0, 6).map((item, idx) => (
            <div key={item.name} className="flex items-center space-x-2 truncate">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="text-slate-300 truncate font-medium">{item.name}:</span>
              <span className="text-slate-400 font-mono">${item.cost.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. グループ別 シート数 & 遊休シート比較 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            {groupingLabel} 別 ライセンス稼働状況
          </h3>
          <span className="text-xs text-slate-400">稼働 vs 遊休シート</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis type="number" stroke="#8b949e" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#8b949e"
                fontSize={11}
                width={100}
                tickFormatter={(val) => (val.length > 10 ? val.substring(0, 10) + '...' : val)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  borderColor: '#30363d',
                  borderRadius: '8px',
                  color: '#f0f6fc',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#8b949e' }} />
              <Bar dataKey="activeSeats" name="稼働シート" stackId="a" fill="#3fb950" />
              <Bar dataKey="idleSeats" name="遊休シート" stackId="a" fill="#d29922" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 text-xs text-slate-400 text-center">
          各グループの総ライセンス数に対するアクティブ利用率の比較
        </div>
      </div>
    </div>
  );
};
