import React, { useState, useMemo, useEffect } from 'react';
import { UserUsageProfile } from '../../../src/types/copilot';
import { DeepAnalysisDataSourceInfo } from '../../../src/types/deep-analysis';
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
  Compass,
  BrainCircuit,
  Database,
  Layers,
} from 'lucide-react';

interface UserTrendViewerProps {
  profiles?: UserUsageProfile[];
  initialSelectedLogin?: string;
  sourceInfo?: DeepAnalysisDataSourceInfo;
  onOpenRadar?: (modelId?: string) => void;
  onOpenDeepAnalysis?: (login: string) => void;
}

// 既知モデルのカラーパレット定義 (未知のモデルはフォールバックパレットを使用)
const MODEL_COLOR_MAP: Record<string, { name: string; color: string }> = {
  'claude-3-7-sonnet': { name: 'Claude 3.7 Sonnet', color: '#d97706' }, // amber-600
  'claude-3-5-sonnet': { name: 'Claude 3.5 Sonnet', color: '#f59e0b' }, // amber-500
  'gpt-4o': { name: 'GPT-4o', color: '#10b981' }, // emerald-500
  'gpt-4o-mini': { name: 'GPT-4o mini', color: '#34d399' }, // emerald-400
  'o1': { name: 'o1 (推論)', color: '#6366f1' }, // indigo-500
  'o3-mini': { name: 'o3-mini', color: '#818cf8' }, // indigo-400
  'gemini-2-0-flash': { name: 'Gemini 2.0 Flash', color: '#3b82f6' }, // blue-500
  'gemini-1-5-pro': { name: 'Gemini 1.5 Pro', color: '#60a5fa' }, // blue-400
};

const FALLBACK_COLORS = ['#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#a855f7'];

export const UserTrendViewer: React.FC<UserTrendViewerProps> = ({
  profiles = [],
  initialSelectedLogin,
  sourceInfo,
  onOpenRadar,
  onOpenDeepAnalysis,
}) => {
  const [selectedLogin, setSelectedLogin] = useState<string>(
    initialSelectedLogin || (profiles[0]?.login || '')
  );

  // 外部からの初期選択・切替追従 (テーブルからの「トレンド」クリック等)
  useEffect(() => {
    if (initialSelectedLogin && profiles.some((p) => p.login === initialSelectedLogin)) {
      setSelectedLogin(initialSelectedLogin);
    } else if (profiles.length > 0 && !profiles.some((p) => p.login === selectedLogin)) {
      setSelectedLogin(profiles[0]?.login || '');
    }
  }, [initialSelectedLogin, profiles, selectedLogin]);

  // 現在選択されているユーザープロファイル
  const currentProfile = useMemo(() => {
    return profiles.find((p) => p.login === selectedLogin) || profiles[0] || null;
  }, [profiles, selectedLogin]);

  // 選択ユーザーの日次履歴に登場する全モデルキーを動的検出
  const activeModelConfigs = useMemo(() => {
    if (!currentProfile || !currentProfile.daily_history) return [];

    const foundModels = new Set<string>();
    currentProfile.daily_history.forEach((h) => {
      if (h.model_breakdown) {
        Object.keys(h.model_breakdown).forEach((m) => foundModels.add(m));
      }
    });

    // プロファイルサマリーの model_usage_totals も確認
    if (currentProfile.model_usage_totals) {
      Object.keys(currentProfile.model_usage_totals).forEach((m) => foundModels.add(m));
    }

    // モデルが1つも無い場合のフォールバック（代表モデル）
    if (foundModels.size === 0) {
      foundModels.add('claude-3-7-sonnet');
      foundModels.add('gpt-4o');
      foundModels.add('o1');
      foundModels.add('gemini-2-0-flash');
    }

    const modelList = Array.from(foundModels);
    let fallbackIdx = 0;

    return modelList.map((modelId) => {
      if (MODEL_COLOR_MAP[modelId]) {
        return {
          id: modelId,
          name: MODEL_COLOR_MAP[modelId].name,
          color: MODEL_COLOR_MAP[modelId].color,
        };
      }
      const color = FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length];
      fallbackIdx++;
      return {
        id: modelId,
        name: modelId,
        color,
      };
    });
  }, [currentProfile]);

  if (!currentProfile) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
        <User className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <p className="text-sm">ユーザープロファイルデータが存在しません。</p>
      </div>
    );
  }

  // チャート用データ加工 (動的モデル集計)
  const chartData = (currentProfile.daily_history || []).map((h) => {
    const row: Record<string, any> = {
      date: h.date.length >= 10 ? h.date.substring(5) : h.date, // MM-DD
      fullDate: h.date,
      suggestions: h.suggestions || 0,
      acceptances: h.acceptances || 0,
      acceptanceRate: Math.round((h.acceptance_rate || 0) * 100),
    };

    let totalModels = 0;
    activeModelConfigs.forEach((cfg) => {
      const val = h.model_breakdown?.[cfg.id] || 0;
      row[cfg.name] = val;
      totalModels += val;
    });

    // breakdown が無くとも総チャット数があればフォールバック
    row.totalModels = totalModels > 0 ? totalModels : (h.total_chats || 0);

    return row;
  });

  // 最も多く利用されているモデルの特定 (レーダー連携用)
  const primaryModelId = useMemo(() => {
    if (!currentProfile) return 'claude-3-7-sonnet';
    if (currentProfile.model_usage_totals) {
      const entries = Object.entries(currentProfile.model_usage_totals);
      if (entries.length > 0) {
        entries.sort((a, b) => b[1] - a[1]);
        return entries[0][0];
      }
    }
    return activeModelConfigs[0]?.id || 'claude-3-7-sonnet';
  }, [currentProfile, activeModelConfigs]);

  return (
    <div className="flex flex-col space-y-6">
      {/* 0. アクティブデータソース情報バッジ */}
      {sourceInfo && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border border-slate-800/80 rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-400">分析データソース:</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 flex items-center space-x-1.5 shadow-sm">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>{sourceInfo.label}</span>
            </span>
            {sourceInfo.isSynthesized && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/70 text-amber-300 border border-amber-800/60 flex items-center space-x-1 shadow-sm">
                <Layers className="w-3 h-3 text-amber-400" />
                <span>日別トレンド按分合成</span>
              </span>
            )}
            <span className="text-xs text-slate-400">
              対象ユーザー: <span className="font-mono text-slate-200">{profiles.length} 名</span>
            </span>
          </div>
          {sourceInfo.details && (
            <span className="text-[11px] text-slate-400">{sourceInfo.details}</span>
          )}
        </div>
      )}

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

        {/* ユーザー選択セレクト & ディープ分析起動 */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2">
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

          {onOpenDeepAnalysis && (
            <button
              onClick={() => onOpenDeepAnalysis(currentProfile.login)}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-600/30 to-indigo-600/30 hover:from-cyan-600/50 hover:to-indigo-600/50 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
              title="このユーザーの非効率AI利用パターンをディープ分析"
            >
              <BrainCircuit className="w-4 h-4 text-cyan-400" />
              <span>ディープ分析</span>
            </button>
          )}
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
              {activeModelConfigs.map((m) => m.name).join('、')} の日別対話回数と全体推移
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
            {activeModelConfigs.slice(0, 5).map((m) => (
              <span key={m.id} className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                <span>{m.name}</span>
              </span>
            ))}
            {activeModelConfigs.length > 5 && (
              <span className="text-[11px] text-slate-400">+{activeModelConfigs.length - 5} モデル</span>
            )}

            {onOpenRadar && (
              <button
                onClick={() => onOpenRadar(primaryModelId)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/70 transition-all shadow-sm ml-1 cursor-pointer"
                title={`${primaryModelId} の特性をレーダーチャートで比較`}
              >
                <Compass className="w-3 h-3 text-purple-400" />
                <span>モデル特性レーダーで比較</span>
              </button>
            )}
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
              {activeModelConfigs.map((cfg) => (
                <Bar key={cfg.id} dataKey={cfg.name} stackId="a" fill={cfg.color} />
              ))}
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
