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
      netCost: g.net_cost_usd,
      limit: g.spending_limit_usd,
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            {groupingLabel} 別 コスト配賦 (USD)
          </h3>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">
              利用費用: <strong className="font-mono text-slate-200">${data.overview.total_spend_usd.toLocaleString()}</strong>
            </span>
            {data.overview.total_net_billable_usd !== undefined && (
              <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300 font-mono text-[11px]">
                超過請求: ${data.overview.total_net_billable_usd.toLocaleString()}
              </span>
            )}
          </div>
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
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs shadow-xl text-slate-200 space-y-1">
                      <p className="font-semibold text-white mb-1.5">{d.name}</p>
                      <div className="flex justify-between space-x-4">
                        <span className="text-slate-400">利用費用:</span>
                        <span className="font-mono font-bold text-slate-100">${Number(d.cost || 0).toLocaleString()}</span>
                      </div>
                      {d.netCost !== undefined && (
                        <div className="flex justify-between space-x-4">
                          <span className="text-amber-400">超過請求費用:</span>
                          <span className="font-mono font-bold text-amber-300">${Number(d.netCost || 0).toLocaleString()}</span>
                        </div>
                      )}
                      {d.limit !== undefined && d.limit > 0 && (
                        <div className="flex justify-between space-x-4 text-slate-400">
                          <span>Limit設定値:</span>
                          <span className="font-mono">${Number(d.limit || 0).toLocaleString()}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                        稼働 {d.activeSeats} / 総シート {d.seats} 席
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 凡例リスト */}
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {chartData.slice(0, 6).map((item, idx) => (
            <div key={item.name} className="flex items-center justify-between space-x-2 truncate">
              <div className="flex items-center space-x-1.5 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-slate-300 truncate font-medium">{item.name}</span>
              </div>
              <div className="flex items-center space-x-1 font-mono text-slate-400 shrink-0">
                <span>${item.cost.toLocaleString()}</span>
                {item.netCost !== undefined && (
                  <span className="text-[10px] text-amber-400" title="超過請求費用">(${item.netCost.toLocaleString()})</span>
                )}
              </div>
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
