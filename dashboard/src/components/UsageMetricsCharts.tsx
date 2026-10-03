import React from 'react';
import { ScopeAggregatedData } from '../../../src/types/copilot';
import { UNFILTERED_SECTION_NOTICE } from '../../../src/domain/constants/filter-scope';
import { AccessibleChart } from './common/AccessibleChart';
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

  // 利用状況メトリクス (日次推移・言語別) の出所。取得できていない場合は 0 のグラフを描かず、理由を表示する
  const availability = data.usage_metrics?.availability ?? 'live';
  const isUnfiltered = data.filter_notice?.unfiltered_sections.includes('daily_trends') ?? false;

  if (availability === 'unavailable' || daily_trends.length === 0) {
    return (
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400"
        data-testid="usage-metrics-unavailable"
      >
        <p className="text-sm font-semibold text-slate-300">— 利用状況メトリクスを取得できていません</p>
        <p className="text-xs mt-1 text-slate-500">
          日次アクティブユーザー・Inline補完受諾率・言語別の提案/受諾は、利用状況メトリクス (Usage Metrics) の取得後に表示されます。
          データ状態バナー / エラー詳細で収集の状態を確認できます。
        </p>
      </div>
    );
  }

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
    <div className="flex flex-col space-y-6 w-full">
      {(availability === 'carried_over' || isUnfiltered) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {availability === 'carried_over' && (
            <span
              className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold"
              data-testid="usage-carried-over-note"
            >
              前回値{data.usage_metrics?.as_of ? ` (取得: ${data.usage_metrics.as_of})` : ''}: 今回は利用状況メトリクスを取得できませんでした
            </span>
          )}
          {isUnfiltered && (
            <span
              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold"
              data-testid="usage-unfiltered-note"
            >
              {UNFILTERED_SECTION_NOTICE}
            </span>
          )}
        </div>
      )}
      {/* 1. トレンド推移 (アクティブ数 & Inline補完受諾率) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            日次アクティブユーザー & Inline補完受諾率推移
          </h3>
          <span className="text-xs text-slate-400">期間トレンド</span>
        </div>

        <AccessibleChart
          testId="usage-trend-chart"
          title="日次アクティブユーザーと Inline補完受諾率の推移"
          summary={`${trendData.length} 日分。アクティブユーザーと受諾率 (%) の日次推移。`}
          columns={[{ key: 'date', label: '日付' }, { key: 'activeUsers', label: 'アクティブユーザー' }, { key: 'rate', label: 'Inline補完受諾率' }]}
          rows={trendData.map((t) => ({ date: t.date, activeUsers: t.activeUsers, rate: `${t.acceptanceRate}%` }))}
        >
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
                  name="Inline補完受諾率 (%)"
                  stroke="#a371f7"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AccessibleChart>
      </div>

      {/* 2. プログラミング言語別 提案 & 受諾数 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            開発言語別 コード提案 & 受諾数
          </h3>
          <span className="text-xs text-slate-400">Top Languages</span>
        </div>

        <AccessibleChart
          testId="usage-language-chart"
          title="開発言語別 コード提案と受諾数"
          summary={`上位 ${langData.length} 言語の AI 提案数と受諾採用数。`}
          columns={[{ key: 'name', label: '言語' }, { key: 'suggestions', label: 'AI提案数' }, { key: 'acceptances', label: '受諾採用数' }, { key: 'rate', label: '受諾率' }]}
          rows={langData.map((l) => ({ name: l.name, suggestions: l.suggestions, acceptances: l.acceptances, rate: `${l.rate}%` }))}
        >
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
        </AccessibleChart>
      </div>
    </div>
  );
};
