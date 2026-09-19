import React, { useMemo, useState } from 'react';
import { UserUsageProfile } from '../../../src/types/copilot';
import { InefficiencyDiagnosticEngine } from '../../../src/processor/inefficiency-diagnostic';
import {
  X,
  LineChart,
  BrainCircuit,
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Sparkles,
  Bot,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
} from 'lucide-react';
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

export interface UserDrilldownPanelProps {
  login: string;
  displayName: string;
  avatarUrl?: string;
  department: string;
  costCenter: string;
  organization: string;
  planType?: string;
  statusBadge?: React.ReactNode;
  lastActivity?: string | null;
  editor?: string | null;
  daysInactive?: number;
  monthlyCostUsd?: number;
  proratedCostUsd?: number;
  excessBillingUsd?: number;
  // プロファイル情報（確定テレメトリまたは月次按分データ）
  profile?: UserUsageProfile | null;
  allProfiles?: UserUsageProfile[];
  primaryModel?: string;
  totalRequests?: number;
  surface?: string;
  // 画面遷移・操作コールバック
  onSelectUserForTrend?: (login: string) => void;
  onSelectUserForDeepAnalysis?: (login: string) => void;
  onClose?: () => void;
}

const MODEL_COLORS: Record<string, string> = {
  'claude-3-7-sonnet': '#a855f7',
  'gpt-4o': '#3b82f6',
  'o1': '#f43f5e',
  'gemini-2-0-flash': '#10b981',
  'default': '#6366f1',
};

export const UserDrilldownPanel: React.FC<UserDrilldownPanelProps> = ({
  login,
  displayName,
  avatarUrl,
  department,
  costCenter,
  organization,
  planType = 'enterprise',
  statusBadge,
  lastActivity,
  editor,
  daysInactive,
  monthlyCostUsd = 0,
  proratedCostUsd = 0,
  excessBillingUsd = 0,
  profile,
  allProfiles = [],
  primaryModel,
  totalRequests,
  surface,
  onSelectUserForTrend,
  onSelectUserForDeepAnalysis,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trend' | 'diagnostic'>('overview');
  const [showAllPatterns, setShowAllPatterns] = useState(false);

  // 非効率パターン診断の計算（プロファイルが存在する場合）
  const diagnostic = useMemo(() => {
    if (!profile) return null;
    try {
      return InefficiencyDiagnosticEngine.diagnoseUser(profile, '30d', undefined, allProfiles);
    } catch {
      return null;
    }
  }, [profile, allProfiles]);

  // 日次推移データの整形
  const dailyChartData = useMemo(() => {
    if (!profile?.daily_history || profile.daily_history.length === 0) return [];
    return profile.daily_history.map((d) => {
      const claude = d.model_breakdown['claude-3-7-sonnet'] || 0;
      const gpt4o = d.model_breakdown['gpt-4o'] || 0;
      const o1 = d.model_breakdown['o1'] || 0;
      const gemini = d.model_breakdown['gemini-2-0-flash'] || 0;

      return {
        date: d.date.substring(5), // MM-DD
        fullDate: d.date,
        suggestions: d.suggestions,
        acceptances: d.acceptances,
        chats: d.total_chats,
        acceptanceRate: Math.round(d.acceptance_rate * 100),
        claude,
        gpt4o,
        o1,
        gemini,
      };
    });
  }, [profile]);

  // モデル別合計チャット比率
  const modelBreakdownData = useMemo(() => {
    if (!profile?.daily_history || profile.daily_history.length === 0) {
      if (primaryModel) {
        return [{ name: primaryModel, value: totalRequests || 1, color: '#6366f1' }];
      }
      return [];
    }

    const counts: Record<string, number> = {};
    for (const h of profile.daily_history) {
      for (const [model, cnt] of Object.entries(h.model_breakdown || {})) {
        counts[model] = (counts[model] || 0) + cnt;
      }
    }

    const entries = Object.entries(counts).filter(([, val]) => val > 0);
    if (entries.length === 0) {
      return [{ name: primaryModel || 'Claude 3.7 Sonnet', value: 1, color: '#a855f7' }];
    }

    return entries.map(([model, val]) => ({
      name: model,
      value: val,
      color: MODEL_COLORS[model] || '#6366f1',
    }));
  }, [profile, primaryModel, totalRequests]);

  // 主要KPI指標
  const suggestionsCount = profile?.total_suggestions ?? (totalRequests ? Math.round(totalRequests * 0.55) : 0);
  const acceptancesCount = profile?.total_acceptances ?? (totalRequests ? Math.round(totalRequests * 0.20) : 0);
  const acceptanceRateVal = profile?.acceptance_rate
    ? Math.round(profile.acceptance_rate * 100)
    : suggestionsCount > 0
    ? Math.round((acceptancesCount / suggestionsCount) * 100)
    : 0;
  const chatsCount = profile?.total_chats ?? (totalRequests ? Math.max(1, totalRequests - suggestionsCount) : 0);

  return (
    <div className="w-full bg-slate-950/90 border-y-2 border-indigo-500/80 p-5 sm:p-6 shadow-2xl animate-fadeIn space-y-5 rounded-b-xl">
      {/* 1. ヘッダー: ユーザー情報 & クイックアクション & 閉じるボタン */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-3.5">
          <img
            src={avatarUrl || 'https://github.com/ghost.png'}
            alt={login}
            className="w-12 h-12 rounded-full border-2 border-indigo-500/80 bg-slate-800 shrink-0 shadow-md"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-bold text-white tracking-tight">{displayName}</h4>
              <span className="text-xs font-mono text-indigo-400">@{login}</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/60">
                {planType}
              </span>
              {statusBadge}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                {department}
              </span>
              <span>•</span>
              <span className="font-mono text-slate-300">{costCenter}</span>
              <span>•</span>
              <span className="font-mono text-slate-400">{organization}</span>
              {editor && (
                <>
                  <span>•</span>
                  <span className="text-slate-400">エディタ: {editor}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* アクションボタン & 閉じる */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-auto">
          {onSelectUserForTrend && (
            <button
              type="button"
              onClick={() => onSelectUserForTrend(login)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
              title="ユーザー別モデル推移ビューへ移動"
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>推移ビュー</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
            </button>
          )}

          {onSelectUserForDeepAnalysis && (
            <button
              type="button"
              onClick={() => onSelectUserForDeepAnalysis(login)}
              className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
              title="ディープ分析ビューで高度行動診断を全画面表示"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>ディープ分析</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-700 ml-1"
              title="ドリルダウンパネルを閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. ドリルダウン サブナビゲーションタブ */}
      <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>概要 & コストKPI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trend')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'trend'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>日次推移 & モデル構成</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('diagnostic')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'diagnostic'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          <span>AI健全度 & 非効率診断</span>
          {diagnostic && (
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                diagnostic.healthScore >= 80
                  ? 'bg-emerald-950 text-emerald-300'
                  : diagnostic.healthScore >= 60
                  ? 'bg-amber-950 text-amber-300'
                  : 'bg-rose-950 text-rose-300'
              }`}
            >
              {diagnostic.healthScore}点
            </span>
          )}
        </button>
      </div>

      {/* 3. タブコンテンツ */}

      {/* Tab 1: 概要 & コストKPI */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-fadeIn">
          {/* KPIカードグリッド */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* コード提案数 */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 block">コード提案数</span>
              <span className="text-lg font-bold font-mono text-slate-100 mt-1 block">
                {suggestionsCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500">インライン補完</span>
            </div>

            {/* 受諾採用数 */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 block">受諾採用数</span>
              <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                {acceptancesCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-500/80 font-medium">採用コード</span>
            </div>

            {/* 受諾率 */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 block">コード受諾率</span>
              <span className="text-lg font-bold font-mono text-purple-300 mt-1 block">
                {acceptanceRateVal}%
              </span>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    acceptanceRateVal >= 30 ? 'bg-purple-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, acceptanceRateVal)}%` }}
                />
              </div>
            </div>

            {/* AIチャット数 */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 block">AI対話・チャット</span>
              <span className="text-lg font-bold font-mono text-indigo-300 mt-1 block">
                {chatsCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500">
                {primaryModel ? `主: ${primaryModel}` : 'マルチモデル対話'}
              </span>
            </div>

            {/* 月額費用 / 超過額 */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 block">推計費用 (月額/日割り)</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-lg font-bold font-mono text-slate-100">
                  ${monthlyCostUsd.toFixed(2)}
                </span>
                {proratedCostUsd > 0 && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    (日割: ${proratedCostUsd.toFixed(2)})
                  </span>
                )}
              </div>
              <span className="text-[10px] text-amber-400 font-mono">
                超過請求: ${excessBillingUsd.toFixed(2)}
              </span>
            </div>

            {/* 稼働状況 */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 block">最終利用・状態</span>
              <span className="text-sm font-semibold text-slate-200 mt-1 block truncate">
                {lastActivity || '未アクティビティ'}
              </span>
              <span className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>
                  {daysInactive !== undefined && daysInactive !== 999
                    ? `${daysInactive} 日非稼働`
                    : 'アクティビティなし'}
                </span>
              </span>
            </div>
          </div>

          {/* 健全度ハイライト & 主利用モデル */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {diagnostic && (
              <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white">AI活用健全度スコア</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {diagnostic.healthScore >= 80
                      ? '高効率でバランスの取れた模範的なAI活用ができています'
                      : diagnostic.healthScore >= 60
                      ? '軽微な非効率兆候が見られます（生成ガチャや対話過多等）'
                      : '改善推奨: 非効率アンチパターンが検出されています'}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span
                    className={`text-2xl font-black ${
                      diagnostic.healthScore >= 80
                        ? 'text-emerald-400'
                        : diagnostic.healthScore >= 60
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {diagnostic.healthScore}
                  </span>
                  <span className="text-xs text-slate-500"> / 100</span>
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white">AIモデル構成 & ツール環境</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  主利用モデル: <strong className="text-slate-200">{primaryModel || 'Claude 3.7 Sonnet'}</strong>
                  {surface && <span className="ml-2">({surface})</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('trend')}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200 bg-indigo-950/60 hover:bg-indigo-900/60 rounded border border-indigo-800/60 transition cursor-pointer"
              >
                詳細チャート →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 日次推移 & モデル構成 */}
      {activeTab === 'trend' && (
        <div className="space-y-4 animate-fadeIn">
          {dailyChartData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 日次推移グラフ */}
              <div className="lg:col-span-8 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    <span>日次コード提案・受諾・受諾率推移</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {dailyChartData.length} 日間の履歴
                  </span>
                </div>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={dailyChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
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
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="acceptances"
                        name="受諾件数"
                        fill="#10b981"
                        radius={[2, 2, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="acceptanceRate"
                        name="受諾率 (%)"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* モデル利用構成比 */}
              <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5 mb-2">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                    <span>AIモデル利用構成</span>
                  </span>

                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={modelBreakdownData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={55}
                          paddingAngle={3}
                        >
                          {modelBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
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
                  {modelBreakdownData.map((m) => (
                    <div key={m.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-slate-300 font-mono text-[11px] truncate max-w-[130px]">
                          {m.name}
                        </span>
                      </div>
                      <span className="text-slate-400 font-mono">{m.value.toLocaleString()} 回</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
              日次推移データがありません。
            </div>
          )}
        </div>
      )}

      {/* Tab 3: AI健全度 & 非効率診断 */}
      {activeTab === 'diagnostic' && (
        <div className="space-y-4 animate-fadeIn">
          {diagnostic ? (
            <>
              {/* スコアサマリー */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">総合AI健全度スコア</span>
                    <div className="flex items-baseline space-x-1 mt-1">
                      <span
                        className={`text-2xl font-black ${
                          diagnostic.healthScore >= 80
                            ? 'text-emerald-400'
                            : diagnostic.healthScore >= 60
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {diagnostic.healthScore}
                      </span>
                      <span className="text-xs text-slate-500">/ 100</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      diagnostic.healthStatus === 'healthy'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : diagnostic.healthStatus === 'warning'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {diagnostic.healthStatus === 'healthy'
                      ? '健全'
                      : diagnostic.healthStatus === 'warning'
                      ? '注意'
                      : '要改善'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">日平均提案・受諾</span>
                    <div className="flex items-baseline space-x-1 mt-1">
                      <span className="text-xl font-bold font-mono text-cyan-400">
                        {diagnostic.metricsSummary.dailyAvgSuggestions}
                      </span>
                      <span className="text-xs text-slate-500">件/日</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-purple-300 font-mono">
                    受諾率: {diagnostic.metricsSummary.acceptanceRatePercent}%
                  </span>
                </div>

                <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">検出アンチパターン</span>
                    <div className="text-lg font-bold text-slate-100 mt-1">
                      {diagnostic.patterns.filter((p) => p.probabilityPercent >= 40).length} 件
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">要警戒/注意</span>
                </div>
              </div>

              {/* 5つの非効率パターン判定一覧 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    5つの典型非効率パターン兆候判定
                  </h5>
                  <button
                    type="button"
                    onClick={() => setShowAllPatterns(!showAllPatterns)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center space-x-1 cursor-pointer"
                  >
                    <span>{showAllPatterns ? '要注意のみ表示' : '全パターン表示'}</span>
                    {showAllPatterns ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {(showAllPatterns
                    ? diagnostic.patterns
                    : diagnostic.patterns.filter((p) => p.probabilityPercent >= 30)
                  ).map((pat) => (
                    <div
                      key={pat.id}
                      className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                          {pat.probabilityPercent >= 70 ? (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : pat.probabilityPercent >= 40 ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          <span>{pat.name}</span>
                        </span>
                        <span
                          className={`text-xs font-mono font-bold ${
                            pat.probabilityPercent >= 70
                              ? 'text-rose-400'
                              : pat.probabilityPercent >= 40
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          兆候: {pat.probabilityPercent}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{pat.summary}</p>
                      {pat.recommendations.length > 0 && (
                        <div className="pt-1 text-[11px] text-indigo-300 font-medium flex items-center space-x-1">
                          <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>推奨: {pat.recommendations[0]}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
              診断用プロファイルが存在しないため、診断を実行できません。
            </div>
          )}
        </div>
      )}
    </div>
  );
};
