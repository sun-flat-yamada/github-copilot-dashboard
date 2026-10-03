import React from 'react';
import { GroupingDimension, ScopeAggregatedData } from '../../../src/types/copilot';
import { AccessibleChart } from './common/AccessibleChart';
import { RankedBarChart } from './common/RankedBarChart';
import { rankWithOther } from '../utils/chart-series';
import {
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
  grouping?: GroupingDimension;
  onGroupingChange?: (grouping: GroupingDimension) => void;
}

/** 多数グループは上位 N + その他へ集約する (ドーナツは大小比較が困難: D-03) */
const TOP_N_GROUPS = 8;


export const CostAllocationCharts: React.FC<CostAllocationChartsProps> = ({
  data,
  grouping: externalGrouping,
  onGroupingChange,
}) => {
  const [internalGrouping, setInternalGrouping] = React.useState<GroupingDimension>(
    externalGrouping || 'department'
  );

  React.useEffect(() => {
    if (externalGrouping) {
      setInternalGrouping(externalGrouping);
    }
  }, [externalGrouping]);

  const currentGrouping = onGroupingChange ? (externalGrouping || internalGrouping) : internalGrouping;

  const handleGroupingSelect = (dim: GroupingDimension) => {
    setInternalGrouping(dim);
    if (onGroupingChange) {
      onGroupingChange(dim);
    }
  };

  const summariesRecord =
    currentGrouping === 'department'
      ? data.by_department
      : currentGrouping === 'cost_center'
      ? data.by_cost_center
      : data.by_organization;

  const groupingLabel =
    currentGrouping === 'department'
      ? 'ユーザー定義Gr (部署・PJ)'
      : currentGrouping === 'cost_center'
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
      onboardingSeats: Math.max(0, g.total_seats - g.active_seats - g.idle_seats),
      potentialSavings: g.potential_savings_usd,
      // グループ別の利用指標は推定 (シート比按分) または欠損 (null)。欠損は 0 にしない
      acceptanceRate: g.acceptance_rate === null ? null : Math.round(g.acceptance_rate * 100),
    }))
    .sort((a, b) => b.cost - a.cost);

  const rankedCost = rankWithOther(chartData, (g) => ({ name: g.name, value: g.cost }), TOP_N_GROUPS);

  return (
    <div className="flex flex-col space-y-6 w-full">
      {/* 1. コスト内訳 ソート済み横棒 (上位 N + その他) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            {groupingLabel} 別 コスト内訳 (USD)
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            {/* 集計軸切替タブ (インライン) */}
            <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => handleGroupingSelect('department')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  currentGrouping === 'department'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                部署 (Department)
              </button>
              <button
                type="button"
                onClick={() => handleGroupingSelect('cost_center')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  currentGrouping === 'cost_center'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cost Center
              </button>
              <button
                type="button"
                onClick={() => handleGroupingSelect('organization')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  currentGrouping === 'organization'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Organization
              </button>
            </div>

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
        </div>

        <RankedBarChart
          testId="cost-ranked-bar"
          title={`${groupingLabel} 別 コスト内訳`}
          valueLabel="利用費用 (USD)"
          rows={rankedCost}
          formatValue={(v) => `$${v.toLocaleString()}`}
          describe={(r) => {
            const d = chartData.find((c) => c.name === r.name);
            return d ? `超過請求 $${Number(d.netCost || 0).toLocaleString()}、稼働 ${d.activeSeats} / 総シート ${d.seats} 席` : `${r.count} グループの合計`;
          }}
        />
      </div>

      {/* 2. グループ別 シート数 & 遊休シート比較 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            {groupingLabel} 別 ライセンス稼働状況
          </h3>
          <span className="text-xs text-slate-400">稼働 vs 遊休シート</span>
        </div>

        <AccessibleChart
          testId="seat-status-chart"
          title={`${groupingLabel} 別 ライセンス稼働状況`}
          summary={`${chartData.length} グループの稼働・遊休・導入期間シート数。稼働は無地、遊休は斜線、導入期間は水玉で区別。`}
          columns={[
            { key: 'name', label: 'グループ' },
            { key: 'active', label: '稼働シート' },
            { key: 'idle', label: '遊休シート' },
            { key: 'onboarding', label: '導入期間' },
            { key: 'total', label: '総シート' },
          ]}
          rows={chartData.map((d) => ({ name: d.name, active: d.activeSeats, idle: d.idleSeats, onboarding: d.onboardingSeats, total: d.seats }))}
        >
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <defs>
                  <pattern id="seat-pattern-idle" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="#d29922" />
                    <rect width="2.5" height="6" fill="#0d1117" fillOpacity="0.55" />
                  </pattern>
                  <pattern id="seat-pattern-onboarding" width="6" height="6" patternUnits="userSpaceOnUse">
                    <rect width="6" height="6" fill="#38bdf8" />
                    <circle cx="3" cy="3" r="1.3" fill="#0d1117" fillOpacity="0.6" />
                  </pattern>
                </defs>
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
                <Bar dataKey="idleSeats" name="遊休シート" stackId="a" fill="url(#seat-pattern-idle)" />
                <Bar dataKey="onboardingSeats" name="導入期間 (遊休に含まない)" stackId="a" fill="url(#seat-pattern-onboarding)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AccessibleChart>

        <div className="mt-2 text-xs text-slate-400 text-center">
          各グループの総ライセンス数に対するアクティブ利用率の比較
        </div>
      </div>
    </div>
  );
};
