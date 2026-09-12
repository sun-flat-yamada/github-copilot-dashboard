import React, { useState, useMemo } from 'react';
import { ScopeAggregatedData } from '../../../src/types/copilot';
import {
  AnalysisMethodId,
  AnalysisPeriodScopeType,
  CustomDateRange,
  InefficiencyPatternId,
} from '../../../src/types/deep-analysis';
import {
  ANALYSIS_METHODS_REGISTRY,
  InefficiencyDiagnosticEngine,
} from '../../../src/processor/inefficiency-diagnostic';
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
import {
  BrainCircuit,
  Microscope,
  Calendar,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  Zap,
  Activity,
  Layers,
  User,
  ShieldAlert,
} from 'lucide-react';

interface DeepAnalysisViewProps {
  aggregatedData: ScopeAggregatedData;
  initialSelectedLogin?: string;
}

const MODEL_COLORS: Record<string, string> = {
  'claude-3-7-sonnet': '#a855f7',
  'gpt-4o': '#3b82f6',
  'o1': '#f43f5e',
  'gemini-2-0-flash': '#10b981',
};

export const DeepAnalysisView: React.FC<DeepAnalysisViewProps> = ({
  aggregatedData,
  initialSelectedLogin,
}) => {
  const profiles = useMemo(() => {
    return aggregatedData.user_profiles || [];
  }, [aggregatedData]);

  // 1. 分析方式セレクターステート
  const [selectedMethodId, setSelectedMethodId] =
    useState<AnalysisMethodId>('inefficient_usage_diagnostic');

  // 2. ユーザー選択ステート
  const [selectedLogin, setSelectedLogin] = useState<string>(() => {
    if (initialSelectedLogin && profiles.some((p) => p.login === initialSelectedLogin)) {
      return initialSelectedLogin;
    }
    // デフォルト: 兆候があるユーザーまたは最初のユーザー
    const interestingUser =
      profiles.find((p) => p.login === 'kenji-sato') ||
      profiles.find((p) => p.login === 'yuki-takahashi') ||
      profiles[0];
    return interestingUser?.login || '';
  });

  // 3. 対象区間選択ステート
  const [periodScope, setPeriodScope] = useState<AnalysisPeriodScopeType>('30d');
  const [customRange, setCustomRange] = useState<CustomDateRange>(() => {
    const end = aggregatedData.date_range?.end || '2026-09-10';
    const d = new Date(end);
    d.setDate(d.getDate() - 14);
    const start = d.toISOString().split('T')[0];
    return { start, end };
  });
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);

  // 4. ドリルダウン展開中パターン
  const [expandedPatternId, setExpandedPatternId] = useState<InefficiencyPatternId | null>(
    'tab_spamming_roulette'
  );

  // 5. 処方箋コピー状態
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // 現在選択中のユーザープロファイル
  const currentProfile = useMemo(() => {
    return profiles.find((p) => p.login === selectedLogin) || profiles[0] || null;
  }, [profiles, selectedLogin]);

  // 非効率パターン診断の実行
  const diagnosticResult = useMemo(() => {
    if (!currentProfile) return null;
    return InefficiencyDiagnosticEngine.diagnoseUser(
      currentProfile,
      periodScope,
      periodScope === 'custom' ? customRange : undefined,
      profiles
    );
  }, [currentProfile, periodScope, customRange, profiles]);

  const handleCopyRecommendation = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleTogglePatternExpand = (patternId: InefficiencyPatternId) => {
    setExpandedPatternId((prev) => (prev === patternId ? null : patternId));
  };

  if (!currentProfile || !diagnosticResult) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 max-w-4xl mx-auto my-10">
        <User className="w-12 h-12 mx-auto text-slate-600 mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">ユーザーデータが見つかりません</h3>
        <p className="text-sm">プロファイル情報を読み込めませんでした。スコープを確認してください。</p>
      </div>
    );
  }

  const { healthScore, healthStatus, metricsSummary, period, patterns, drilldown } =
    diagnosticResult;

  // 選択中方式の定義
  const currentMethodDef =
    ANALYSIS_METHODS_REGISTRY.find((m) => m.id === selectedMethodId) ||
    ANALYSIS_METHODS_REGISTRY[0];

  return (
    <div className="flex flex-col space-y-6 animate-fadeIn pb-12">
      {/* ============================================================ */}
      {/* 1. 専用ビュー ヘッダー & 分析方式セレクター (拡張性スロット) */}
      {/* ============================================================ */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/90 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/25">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">ディープ分析ワークスペース</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-700/80">
                  Deep Analytics Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                個人の活用実績をミクロ診断し、アンチパターン検知・コスト最適化・現場への改善処方箋を導出
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center space-x-1.5">
              <Microscope className="w-3.5 h-3.5 text-indigo-400" />
              <span>分析方式数: <strong>{ANALYSIS_METHODS_REGISTRY.length}</strong> (稼働中: 1)</span>
            </span>
          </div>
        </div>

        {/* 分析方式セレクター (Analysis Method Selector - 拡張性アーキテクチャ) */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>分析方式の選択 (Analysis Engine)</span>
            </span>
            <span className="text-[11px] text-slate-400">今後随時新しい分析方式がプラグイン追加されます</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ANALYSIS_METHODS_REGISTRY.map((method) => {
              const isActive = selectedMethodId === method.id;
              const isComingSoon = method.status === 'coming_soon';

              return (
                <button
                  key={method.id}
                  onClick={() => !isComingSoon && setSelectedMethodId(method.id)}
                  disabled={isComingSoon}
                  className={`text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between ${
                    isActive
                      ? 'bg-gradient-to-b from-indigo-900/60 to-slate-900 border-indigo-500 shadow-md shadow-indigo-500/15'
                      : isComingSoon
                      ? 'bg-slate-950/40 border-slate-850 opacity-60 cursor-not-allowed hover:border-slate-800'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold ${
                        isActive ? 'text-white' : isComingSoon ? 'text-slate-400' : 'text-slate-200'
                      }`}
                    >
                      {method.shortTitle}
                    </span>
                    {method.badge && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          method.status === 'active'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {method.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {method.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          {/* 選択中分析方式の解説バナー */}
          <div className="mt-4 p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-start space-x-3 text-xs">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-200">
                【{currentMethodDef.title}】
              </span>
              <span className="text-slate-400 ml-1.5 leading-relaxed">
                {currentMethodDef.description}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. 共通操作バー: 診断対象ユーザー & 対象区間セレクター */}
      {/* ============================================================ */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* ユーザー選択 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5 shrink-0">
            <User className="w-4 h-4 text-indigo-400" />
            <span>診断対象ユーザー:</span>
          </label>

          <div className="relative min-w-[260px] sm:w-80">
            <select
              value={selectedLogin}
              onChange={(e) => setSelectedLogin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer pr-8 shadow-inner"
            >
              {profiles.map((p) => (
                <option key={p.login} value={p.login}>
                  {p.display_name} (@{p.login}) - {p.department}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700 font-mono text-[11px]">
              {currentProfile.cost_center}
            </span>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
              {currentProfile.plan_type}
            </span>
          </div>
        </div>

        {/* 対象区間の切り替えコントロール (前1カ月間 / 当日 / 1週間前 / 期間指定) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1 mr-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>対象区間:</span>
          </span>

          <div className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-1 gap-1">
            <button
              onClick={() => {
                setPeriodScope('30d');
                setIsCustomPickerOpen(false);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodScope === '30d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              前1カ月間 (デフォルト)
            </button>

            <button
              onClick={() => {
                setPeriodScope('today');
                setIsCustomPickerOpen(false);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodScope === 'today'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              当日
            </button>

            <button
              onClick={() => {
                setPeriodScope('7d');
                setIsCustomPickerOpen(false);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodScope === '7d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              1週間前まで
            </button>

            <button
              onClick={() => {
                setPeriodScope('custom');
                setIsCustomPickerOpen(!isCustomPickerOpen);
              }}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodScope === 'custom'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>期間指定</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${isCustomPickerOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 期間指定カレンダーピッカー展開パネル */}
      {periodScope === 'custom' && isCustomPickerOpen && (
        <div className="bg-slate-900 border border-indigo-500/50 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-semibold text-slate-300">開始日:</span>
            <input
              type="date"
              value={customRange.start}
              onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <span className="text-slate-500">〜</span>
            <span className="font-semibold text-slate-300">終了日:</span>
            <input
              type="date"
              value={customRange.end}
              onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={() => setIsCustomPickerOpen(false)}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow transition-all"
          >
            この期間で診断を更新
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. 診断サマリー & 総合健全度スコアメーター */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 総合健全度スコアメーター */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>AI利用 総合健全度スコア</span>
            </span>
            <span
              className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                healthStatus === 'healthy'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : healthStatus === 'warning'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
              }`}
            >
              {healthStatus === 'healthy'
                ? '良好・適正'
                : healthStatus === 'warning'
                ? '改善の余地あり'
                : '非効率兆候・要改善'}
            </span>
          </div>

          <div className="my-5 flex items-center justify-center space-x-6">
            <div className="relative flex items-center justify-center">
              <svg className="w-28 h-28 transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={289}
                  strokeDashoffset={289 - (289 * healthScore) / 100}
                  strokeLinecap="round"
                  className={`transition-all duration-1000 ${
                    healthScore >= 80
                      ? 'text-emerald-500'
                      : healthScore >= 60
                      ? 'text-amber-500'
                      : 'text-rose-500'
                  }`}
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-white">{healthScore}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">/ 100点</span>
              </div>
            </div>

            <div className="flex flex-col space-y-2 text-xs">
              <div>
                <span className="text-slate-400">対象区間:</span>
                <p className="font-semibold text-slate-200">{period.label}</p>
              </div>
              <div>
                <span className="text-slate-400">稼働実績:</span>
                <p className="font-semibold text-slate-200">
                  {period.activeDays}日 稼働 / 全{period.totalDays}日間
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 leading-relaxed">
            {healthScore >= 80
              ? 'コード補完の受諾率およびモデル選択のバランスが取れており、AIの恩恵を効率的に享受しています。'
              : healthScore >= 60
              ? '一部の非効率な使用アンチパターン（低受諾率または高コストモデル過剰偏重）が検出されています。'
              : '複数の非効率パターンが強く疑われます。提示されている改善処方箋の実践を推奨します。'}
          </p>
        </div>

        {/* 期間内アクティビティKPI */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>選択期間の利用実績サマリー ({period.startDate} 〜 {period.endDate})</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              ユーザー: <strong className="text-indigo-300">{currentProfile.display_name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block mb-1">コード受諾率</span>
              <div className="flex items-baseline space-x-1">
                <span
                  className={`text-2xl font-black ${
                    metricsSummary.acceptanceRatePercent >= 28
                      ? 'text-emerald-400'
                      : metricsSummary.acceptanceRatePercent >= 18
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {metricsSummary.acceptanceRatePercent}%
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {metricsSummary.totalAcceptances}受諾 / {metricsSummary.totalSuggestions}提案
              </span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block mb-1">総チャット回数</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-black text-slate-100">
                  {metricsSummary.totalChats}
                </span>
                <span className="text-xs text-slate-400">回</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                1日平均 {metricsSummary.dailyAvgChats} 回
              </span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block mb-1">1日平均 提案数</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-black text-slate-100">
                  {metricsSummary.dailyAvgSuggestions}
                </span>
                <span className="text-xs text-slate-400">件/日</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                累計 {metricsSummary.totalSuggestions} 提案
              </span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block mb-1">期間推計コスト</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-black text-indigo-300">
                  ${metricsSummary.totalCostUsd}
                </span>
                <span className="text-xs text-slate-400">USD</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">日割り概算費用</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/70 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span className="flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                各非効率パターンのカードをクリックすると、該当指標の時系列ドリルダウンが表示されます。
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. 非効率パターン兆候診断カード一覧 (確率%と視覚表示) */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">
              典型的な非効率AI利用パターンの兆候診断
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            確率%：統計的特徴量と閾値逸脱モデルに基づく兆候検知
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5">
          {patterns.map((pattern) => {
            const isSelected = expandedPatternId === pattern.id;
            const prob = pattern.probabilityPercent;

            return (
              <div
                key={pattern.id}
                onClick={() => handleTogglePatternExpand(pattern.id)}
                className={`rounded-xl border p-4 cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                {/* 最上部：リスクバッジとステータス */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                        pattern.name.includes('スマート・オフロード')
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500 shadow-sm'
                          : pattern.riskLevel === 'high'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                          : pattern.riskLevel === 'medium'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : pattern.riskLevel === 'low'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {pattern.name.includes('スマート・オフロード')
                        ? '🌟 スマート・オフロード'
                        : pattern.riskLevel === 'high'
                        ? '高リスク (兆候あり)'
                        : pattern.riskLevel === 'medium'
                        ? '中リスク (注意)'
                        : pattern.riskLevel === 'low'
                        ? '低リスク'
                        : '健全 (兆候なし)'}
                    </span>

                    <span className="text-slate-500 hover:text-slate-300">
                      {isSelected ? (
                        <ChevronUp className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white mb-1 line-clamp-1">
                    {pattern.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                    {pattern.tagline}
                  </p>
                </div>

                {/* 確率 % 表示 & プログレスバー */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[10px] text-slate-400">兆候確率</span>
                    <span
                      className={`text-xl font-black ${
                        prob >= 70
                          ? 'text-rose-400'
                          : prob >= 40
                          ? 'text-amber-400'
                          : prob >= 15
                          ? 'text-indigo-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {prob}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        prob >= 70
                          ? 'bg-gradient-to-r from-orange-500 to-rose-500'
                          : prob >= 40
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                          : prob >= 15
                          ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      }`}
                      style={{ width: `${Math.max(5, prob)}%` }}
                    />
                  </div>

                  <span className="text-[10px] text-indigo-400 font-semibold mt-2.5 block text-center">
                    {isSelected ? 'ドリルダウンを閉じる ▲' : 'ドリルダウン深掘り ▼'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 5. ドリルダウン深掘り分析パネル (クリックで展開) */}
      {/* ============================================================ */}
      {expandedPatternId && (
        <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-2xl p-6 shadow-2xl space-y-6 animate-fadeIn">
          {(() => {
            const pattern = patterns.find((p) => p.id === expandedPatternId);
            if (!pattern) return null;

            return (
              <>
                {/* ドリルダウン ヘッダー */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className="px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-700 text-xs font-bold font-mono">
                        DRILLDOWN
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {pattern.name} の深掘り分析
                      </h3>
                      <span className="text-xs font-mono text-slate-400">({pattern.nameEn})</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      {pattern.summary}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">判定兆候確率</span>
                      <span
                        className={`text-2xl font-black ${
                          pattern.probabilityPercent >= 70
                            ? 'text-rose-400'
                            : pattern.probabilityPercent >= 40
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {pattern.probabilityPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 判定要因 (Contributing Factors) カード一覧 */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                    判定根拠・要因指標 (Contributing Factors)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pattern.contributingFactors.map((factor, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-200">
                            {factor.metricName}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              factor.severity === 'danger'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : factor.severity === 'warning'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : factor.severity === 'good'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            実測: {factor.currentValueFormatted}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {factor.description}
                        </p>
                        <span className="text-[10px] text-slate-500 mt-2 font-mono">
                          推奨閾値: {factor.recommendedThresholdFormatted}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

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
                                  fill={MODEL_COLORS[entry.modelName] || '#64748b'}
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
                              style={{ backgroundColor: MODEL_COLORS[m.modelName] || '#64748b' }}
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

                {/* 改善アクション処方箋 (Recommendations) */}
                <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950 border border-indigo-500/40 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        改善アクション処方箋 (推奨アクション)
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      ワンクリックでテキストをコピーして1on1やSlack等で共有可能
                    </span>
                  </div>

                  <div className="space-y-2">
                    {pattern.recommendations.map((rec, rIdx) => (
                      <div
                        key={rIdx}
                        className="flex items-start justify-between bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 gap-3 hover:border-indigo-500/50 transition-all"
                      >
                        <p className="leading-relaxed">{rec}</p>
                        <button
                          onClick={() => handleCopyRecommendation(rec, rIdx)}
                          className="shrink-0 p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                          title="アドバイスをクリップボードにコピー"
                        >
                          {copiedIndex === rIdx ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
