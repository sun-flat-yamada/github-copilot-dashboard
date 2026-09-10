import React, { useState, useMemo } from 'react';
import { UserUsageProfile } from '../../../src/types/copilot';
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ComposedChart,
} from 'recharts';
import {
  User,
  Bot,
  Code2,
  Briefcase,
  Building2,
} from 'lucide-react';

interface UserTrendViewerProps {
  profiles?: UserUsageProfile[];
  initialSelectedLogin?: string;
}

export const UserTrendViewer: React.FC<UserTrendViewerProps> = ({
  profiles = [],
  initialSelectedLogin,
}) => {
  const [selectedLogin, setSelectedLogin] = useState<string>(
    initialSelectedLogin || (profiles[0]?.login || '')
  );

  // 現在選択されているユーザープロファイル
  const currentProfile = useMemo(() => {
    return profiles.find((p) => p.login === selectedLogin) || profiles[0] || null;
  }, [profiles, selectedLogin]);

  if (!currentProfile) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
        <User className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <p className="text-sm">ユーザープロファイルデータが存在しません。</p>
      </div>
    );
  }

  // チャート用データ加工
  const chartData = currentProfile.daily_history.map((h) => {
    const claude = h.model_breakdown['claude-3-7-sonnet'] || 0;
    const gpt4o = h.model_breakdown['gpt-4o'] || 0;
    const o1 = h.model_breakdown['o1'] || 0;
    const gemini = h.model_breakdown['gemini-2-0-flash'] || 0;
    const totalModels = claude + gpt4o + o1 + gemini;

    return {
      date: h.date.substring(5), // MM-DD
      fullDate: h.date,
      'Claude 3.7 Sonnet': claude,
      'GPT-4o': gpt4o,
      'o1 (推論)': o1,
      'Gemini 2.0 Flash': gemini,
      totalModels,
      suggestions: h.suggestions,
      acceptances: h.acceptances,
      acceptanceRate: Math.round(h.acceptance_rate * 100),
    };
  });

  return (
    <div className="flex flex-col space-y-6">
      {/* 1. ユーザー選択ヘッダーバー */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <img
            src={currentProfile.avatar_url || 'https://github.com/ghost.png'}
            alt={currentProfile.login}
            className="w-12 h-12 rounded-full border-2 border-indigo-500/80 bg-slate-800"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-white tracking-tight">{currentProfile.display_name}</h3>
              <span className="text-xs font-mono text-indigo-400">@{currentProfile.login}</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800">
                {currentProfile.plan_type}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
              <span className="flex items-center space-x-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentProfile.department}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentProfile.cost_center}</span>
              </span>
              <span>•</span>
              <span className="font-mono text-slate-400">{currentProfile.organization}</span>
            </div>
          </div>
        </div>

        {/* ユーザー選択セレクト */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-xs text-slate-400">ユーザー切替:</span>
          <select
            value={currentProfile.login}
            onChange={(e) => setSelectedLogin(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs"
          >
            {profiles.map((p) => (
              <option key={p.login} value={p.login}>
                {p.display_name} (@{p.login}) - {p.department}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. 期間サマリーカード (モデル利用内訳 & コード生成) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
          <span className="text-xs text-slate-400 block mb-1">期間 総AIチャット</span>
          <span className="text-2xl font-bold text-slate-100 font-mono">
            {currentProfile.total_chats.toLocaleString()}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">モデル対話・問い合わせ合計</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
          <span className="text-xs text-slate-400 block mb-1">AIコード提案数</span>
          <span className="text-2xl font-bold text-slate-100 font-mono">
            {currentProfile.total_suggestions.toLocaleString()}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">IDEコード補完提示</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
          <span className="text-xs text-purple-400 block mb-1">受諾採用数 & 受諾率</span>
          <span className="text-2xl font-bold text-purple-300 font-mono">
            {currentProfile.total_acceptances.toLocaleString()}{' '}
            <span className="text-sm font-sans font-medium text-slate-400">
              ({(currentProfile.acceptance_rate * 100).toFixed(1)}%)
            </span>
          </span>
          <p className="text-[11px] text-slate-500 mt-1">実コードに反映された回数</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
          <span className="text-xs text-emerald-400 block mb-1">期間 推計ライセンス費用</span>
          <span className="text-2xl font-bold text-emerald-300 font-mono">
            ${currentProfile.total_cost_usd.toFixed(2)}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">プラン: {currentProfile.plan_type}</p>
        </div>
      </div>

      {/* 3. 使用モデル種類の内訳と合計値別トレンドチャート */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span>日次モデル別利用量トレンド (モデル内訳積み上げ ＋ 合計値推移)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Claude 3.7 Sonnet、GPT-4o、o1、Gemini 2.0 Flash の日別対話回数と全体推移
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Claude 3.7</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>GPT-4o</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>o1</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Gemini 2.0</span>
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="date" stroke="#8b949e" fontSize={11} />
              <YAxis stroke="#8b949e" fontSize={11} label={{ value: '対話数', angle: -90, position: 'insideLeft', fill: '#8b949e', fontSize: 10 }} />
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
              <Bar dataKey="Claude 3.7 Sonnet" stackId="a" fill="#d97706" />
              <Bar dataKey="GPT-4o" stackId="a" fill="#10b981" />
              <Bar dataKey="o1 (推論)" stackId="a" fill="#6366f1" />
              <Bar dataKey="Gemini 2.0 Flash" stackId="a" fill="#3b82f6" />
              <Line
                type="monotone"
                dataKey="totalModels"
                name="モデル利用合計値"
                stroke="#f43f5e"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. コード補完の提案・受諾・受諾率推移 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span>日次コード補完提案数・採用数・受諾率の推移</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              提示されたコードに対する受諾の傾向と開発効率
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
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
              <Bar yAxisId="left" dataKey="suggestions" name="提案行・コード数" fill="#3b82f6" opacity={0.7} />
              <Bar yAxisId="left" dataKey="acceptances" name="受諾採用数" fill="#10b981" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="acceptanceRate"
                name="受諾率 (%)"
                stroke="#a371f7"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
