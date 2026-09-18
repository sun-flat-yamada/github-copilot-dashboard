import React from 'react';
import { UserDiagnosticDrilldown } from '../../../../src/types/deep-analysis';
import { Activity, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const DRILLDOWN_MODEL_COLORS: Record<string, string> = {
  'claude-3-7-sonnet': '#a855f7',
  'gpt-4o': '#3b82f6',
  'o1': '#f43f5e',
  'gemini-2-0-flash': '#10b981',
};

interface PatternDrilldownChartProps {
  drilldown: UserDiagnosticDrilldown;
}

export const PatternDrilldownChart: React.FC<PatternDrilldownChartProps> = ({ drilldown }) => {
  return (
    <div className="space-y-5">
      {/* チャートエリア: 日次推移 & モデル構成比率 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
        {/* 日次アクティビティ推移 (提案 vs 受諾 & 受諾率) */}
        <div className="lg:col-span-8 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>期間内の日次推移 (コード提案・受諾・受諾率)</span>
            </span>
            <span className="text-[10px] text-slate-500">
              {drilldown.dailyActivity.length} 日分のログ
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={drilldown.dailyActivity.map((d) => ({
                  date: d.date.substring(5),
                  suggestions: d.suggestions,
                  acceptances: d.acceptances,
                  rate: d.acceptanceRatePercent,
                  chats: d.chats,
                }))}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={10} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#10b981"
                  fontSize={10}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    fontSize: '11px',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="suggestions"
                  name="コード提案数"
                  fill="#6366f1"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="acceptances"
                  name="受諾件数"
                  fill="#8b5cf6"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rate"
                  name="受諾率 (%)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* モデル別チャット利用比率 & 推計コスト */}
        <div className="lg:col-span-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300">
                AIモデル別 チャット内訳
              </span>
              <span className="text-[10px] text-slate-400">利用割合</span>
            </div>

            <div className="h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={drilldown.modelDistribution.filter((m) => m.chatsCount > 0)}
                    dataKey="chatsCount"
                    nameKey="modelName"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {drilldown.modelDistribution.map((entry) => (
                      <Cell
                        key={entry.modelName}
                        fill={DRILLDOWN_MODEL_COLORS[entry.modelName] || '#64748b'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      fontSize: '11px',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            {drilldown.modelDistribution.map((m) => (
              <div
                key={m.modelName}
                className="flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center space-x-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: DRILLDOWN_MODEL_COLORS[m.modelName] || '#64748b' }}
                  />
                  <span className="text-slate-300 font-mono">{m.modelName}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">{m.chatsCount}回 ({m.percentage}%)</span>
                  <span className="font-bold text-indigo-300">${m.estimatedCostUsd}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 組織平均ベンチマークとの対比 */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>全社・組織平均との比較ベンチマーク (Peer Gap Analysis)</span>
          </span>
          <span className="text-[10px] text-slate-400">同社エンジニア群との差異</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {drilldown.peerBenchmarks.map((bench, idx) => (
            <div
              key={idx}
              className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between"
            >
              <span className="text-[11px] text-slate-400 mb-1">{bench.metricName}</span>
              <div className="flex items-baseline justify-between my-1">
                <span className="text-sm font-bold text-white">
                  当該: {bench.userFormatted}
                </span>
                <span className="text-xs text-slate-400">
                  平均: {bench.peerAverageFormatted}
                </span>
              </div>
              <div className="flex items-center space-x-1 mt-1 pt-1.5 border-t border-slate-800 text-[11px]">
                <span className="text-slate-400">乖離:</span>
                <span
                  className={`font-bold ${
                    bench.isPositiveForEfficiency
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {bench.differenceFormatted}
                </span>
                <span className="text-[10px] text-slate-500">
                  ({bench.isPositiveForEfficiency ? '良好' : '改善推奨'})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
