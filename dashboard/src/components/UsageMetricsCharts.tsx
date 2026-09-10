import React from 'react';
import { ScopeAggregatedData } from '../../../src/types/copilot';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface UsageMetricsChartsProps {
  data: ScopeAggregatedData;
}

export const UsageMetricsCharts: React.FC<UsageMetricsChartsProps> = ({ data }) => {
  const { daily_trends, top_languages } = data;

  const trendData = daily_trends.map((t) => ({
    date: t.date.substring(5), // MM-DD
    activeUsers: t.active_users,
    acceptanceRate: Math.round(t.acceptance_rate * 100),
    suggestions: t.suggestions,
    chats: t.chats,
  }));

  const langData = top_languages.slice(0, 6).map((l) => ({
    name: l.name,
    suggestions: l.suggestions,
    acceptances: l.acceptances,
    rate: Math.round(l.acceptance_rate * 100),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. トレンド推移 (アクティブ数 & 受諾率) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            日次アクティブユーザー & 受諾率推移
          </h3>
          <span className="text-xs text-slate-400">期間トレンド</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="date" stroke="#8b949e" fontSize={11} />
              <YAxis yAxisId="left" stroke="#8b949e" fontSize={11} />
              <YAxis
                yAxisId="right"
                orientation="right"
                unit="%"
                stroke="#a371f7"
                fontSize={11}
                domain={[0, 100]}
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
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="activeUsers"
                name="アクティブユーザー"
                stroke="#2f81f7"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="acceptanceRate"
                name="受諾率 (%)"
                stroke="#a371f7"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. プログラミング言語別 提案 & 受諾数 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            開発言語別 コード提案 & 受諾数
          </h3>
          <span className="text-xs text-slate-400">Top Languages</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={langData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="name" stroke="#8b949e" fontSize={11} />
              <YAxis stroke="#8b949e" fontSize={11} />
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
              <Bar dataKey="suggestions" name="AI提案数" fill="#58a6ff" />
              <Bar dataKey="acceptances" name="受諾採用数" fill="#3fb950" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
