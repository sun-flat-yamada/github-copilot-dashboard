import React, { useState, useEffect, useMemo } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  BenchmarkDataset,
  RadarAxisKey,
} from '../../../src/types/model-benchmark';
import {
  ScopeAggregatedData,
  MonthlyReportAggregatedData,
} from '../../../src/types/copilot';
import {
  Radar as RadarIcon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  BrainCircuit,
  Gauge,
  Compass,
  ArrowUpDown,
  FileCode2,
  Flame,
  ShieldCheck,
  RefreshCw,
  Sliders,
  MessageSquareQuote,
  Target,
  Eye,
  Building2,
} from 'lucide-react';

import { normalizeModelId } from '../../../src/processor/benchmark-evaluator';

export interface ModelUsageStat {
  modelId: string;
  requests: number;
  percentage: number;
  hasUsage: boolean;
}

interface ModelRadarViewProps {
  initialSelectedModelId?: string;
  onNavigateToTrend?: (modelId: string) => void;
  aggregatedData?: ScopeAggregatedData | null;
  monthlyReportData?: MonthlyReportAggregatedData | null;
}

// プリセット定義 (現時点でGitHub Copilotに提供されている全AIモデルを掲載)
const PRESETS = [
  {
    id: 'copilot-all',
    name: '🌟 Copilot 公式全8モデル一括',
    description: '現時点でGitHub Copilotに提供されている全AIモデル（Claude 3.7/3.5, GPT-4o/4o-mini, o1/o3-mini, Gemini 2.0/2.5）をまとめて比較',
    modelIds: [
      'claude-3-7-sonnet',
      'claude-3-5-sonnet',
      'gpt-4o',
      'gpt-4o-mini',
      'o1',
      'o3-mini',
      'gemini-2-0-flash',
      'gemini-2-5-pro',
    ],
  },
  {
    id: 'copilot-core',
    name: 'Copilot 4大フラッグシップ',
    description: 'Claude 3.7 Sonnet / GPT-4o / o1 / Gemini 2.0 Flash',
    modelIds: ['claude-3-7-sonnet', 'gpt-4o', 'o1', 'gemini-2-0-flash'],
  },
  {
    id: 'reasoning-focus',
    name: 'Copilot 推論 (Reasoning) 特化',
    description: 'o1 / o3-mini / Claude 3.7 Sonnet (思考チェーン・推論モデル群)',
    modelIds: ['o1', 'o3-mini', 'claude-3-7-sonnet'],
  },
  {
    id: 'speed-cost',
    name: 'Copilot 高速・低コスト日常補完',
    description: 'Gemini 2.0 Flash / GPT-4o mini / GPT-4o / Claude 3.5 Sonnet',
    modelIds: ['gemini-2-0-flash', 'gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet'],
  },
  {
    id: 'architecture-context',
    name: 'Copilot 大規模設計・長文コンテキスト',
    description: 'Claude 3.7 Sonnet / Gemini 2.5 Pro / Claude 3.5 Sonnet (設計・リファクタリング群)',
    modelIds: ['claude-3-7-sonnet', 'gemini-2-5-pro', 'claude-3-5-sonnet'],
  },
  {
    id: 'all-with-benchmark',
    name: '全モデル + 外部対照 (DeepSeek R1)',
    description: 'Copilot公式全モデル + 比較用オープンウェイト推論最高峰モデル',
    modelIds: [
      'claude-3-7-sonnet',
      'claude-3-5-sonnet',
      'gpt-4o',
      'gpt-4o-mini',
      'o1',
      'o3-mini',
      'gemini-2-0-flash',
      'gemini-2-5-pro',
      'deepseek-r1',
    ],
  },
];

export const ModelRadarView: React.FC<ModelRadarViewProps> = ({
  initialSelectedModelId,
  onNavigateToTrend,
  aggregatedData,
  monthlyReportData,
}) => {
  const [dataset, setDataset] = useState<BenchmarkDataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 選択中モデルIDのリスト (最大4モデル)
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  // フォーカス中の特定モデルID (詳細カード用)
  const [focusedModelId, setFocusedModelId] = useState<string>('');
  // 生データテーブルのソート列 (社内利用シェア 'usage' も追加)
  const [sortKey, setSortKey] = useState<'overall' | 'swe' | 'speed' | 'cost' | 'aime' | 'usage'>('overall');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // 1. ベンチマークデータの取得
  useEffect(() => {
    async function loadDataset() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('./data/model-benchmarks.json');
        if (!res.ok) {
          throw new Error(`Failed to load model-benchmarks.json: status ${res.status}`);
        }
        const data = (await res.json()) as BenchmarkDataset;
        setDataset(data);

        // 初期選択モデルの設定: デフォルトは Copilot 提供全モデル
        if (initialSelectedModelId && data.models.some((m) => m.id === initialSelectedModelId)) {
          setSelectedModelIds([initialSelectedModelId]);
          setFocusedModelId(initialSelectedModelId);
        } else {
          // Copilot 公式提供モデルをすべて初期選択
          const copilotModelIds = data.models.filter((m) => m.is_copilot_native).map((m) => m.id);
          const defaultIds = copilotModelIds.length > 0 ? copilotModelIds : data.models.map((m) => m.id);
          setSelectedModelIds(defaultIds);
          setFocusedModelId(defaultIds[0]);
        }
      } catch (e: any) {
        console.error('Failed to load benchmark dataset:', e);
        setError(e.message || 'データロードエラー');
      } finally {
        setLoading(false);
      }
    }

    loadDataset();
  }, [initialSelectedModelId]);

  // 組織内・分析対象データの実績集計 (未利用モデルも必ず 0% として保持ナレッジ全モデルを網羅)
  const usageStats = useMemo<Record<string, ModelUsageStat>>(() => {
    const rawCounts: Record<string, number> = {};
    let totalRequests = 0;

    // A. Live Metrics (aggregatedData) から集計
    if (aggregatedData?.user_profiles && aggregatedData.user_profiles.length > 0) {
      for (const p of aggregatedData.user_profiles) {
        if (p.model_usage_totals) {
          for (const [rawModel, count] of Object.entries(p.model_usage_totals)) {
            const normId = normalizeModelId(rawModel);
            rawCounts[normId] = (rawCounts[normId] || 0) + count;
            totalRequests += count;
          }
        }
      }
    }

    // B. Monthly Report (monthlyReportData) から集計 (Live Metricsが空または未連携の場合の補完)
    if (totalRequests === 0 && monthlyReportData?.model_breakdown) {
      for (const m of monthlyReportData.model_breakdown) {
        const normId = normalizeModelId(m.model_name);
        rawCounts[normId] = (rawCounts[normId] || 0) + m.total_requests;
        totalRequests += m.total_requests;
      }
    }

    const result: Record<string, ModelUsageStat> = {};
    if (!dataset) return result;

    // 保持しているナレッジとしての全モデル (dataset.models) を必ず網羅
    // 利用がないモデルは requests: 0, percentage: 0, hasUsage: false となる
    for (const model of dataset.models) {
      const count = rawCounts[model.id] || 0;
      const pct = totalRequests > 0 ? Number(((count / totalRequests) * 100).toFixed(1)) : 0;
      result[model.id] = {
        modelId: model.id,
        requests: count,
        percentage: pct,
        hasUsage: count > 0,
      };
    }

    return result;
  }, [aggregatedData, monthlyReportData, dataset]);

  // 選択中モデルのプロファイル配列
  const selectedModels = useMemo(() => {
    if (!dataset) return [];
    return dataset.models.filter((m) => selectedModelIds.includes(m.id));
  }, [dataset, selectedModelIds]);

  // フォーカス中モデルのプロファイル
  const focusedModel = useMemo(() => {
    if (!dataset) return null;
    return (
      dataset.models.find((m) => m.id === focusedModelId) ||
      selectedModels[0] ||
      dataset.models[0] ||
      null
    );
  }, [dataset, focusedModelId, selectedModels]);

  // フォーカス中モデルの組織内利用実績
  const focusedUsage = useMemo<ModelUsageStat | null>(() => {
    if (!focusedModel) return null;
    return (
      usageStats[focusedModel.id] || {
        modelId: focusedModel.id,
        requests: 0,
        percentage: 0,
        hasUsage: false,
      }
    );
  }, [focusedModel, usageStats]);

  // レーダーチャート用データ整形
  const radarChartData = useMemo(() => {
    if (!dataset) return [];

    return dataset.axis_definitions.map((axis) => {
      const entry: Record<string, any> = {
        subject: axis.shortLabel,
        fullSubject: axis.label,
        key: axis.key,
        primaryMetric: axis.primaryMetric,
      };

      for (const model of selectedModels) {
        entry[model.name] = model.radar_scores[axis.key as RadarAxisKey];
      }

      return entry;
    });
  }, [dataset, selectedModels]);

  // テーブルソート済みモデルリスト
  const sortedModels = useMemo(() => {
    if (!dataset) return [];
    const list = [...dataset.models];

    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortKey === 'overall') {
        valA = a.evaluation.overall_score;
        valB = b.evaluation.overall_score;
      } else if (sortKey === 'swe') {
        valA = a.raw_metrics.swe_bench_verified;
        valB = b.raw_metrics.swe_bench_verified;
      } else if (sortKey === 'speed') {
        valA = a.raw_metrics.output_speed_tps;
        valB = b.raw_metrics.output_speed_tps;
      } else if (sortKey === 'cost') {
        // コストは安い方が上位
        valA = a.radar_scores.cost_efficiency;
        valB = b.radar_scores.cost_efficiency;
      } else if (sortKey === 'aime') {
        valA = a.raw_metrics.aime_2024;
        valB = b.raw_metrics.aime_2024;
      } else if (sortKey === 'usage') {
        valA = usageStats[a.id]?.percentage || 0;
        valB = usageStats[b.id]?.percentage || 0;
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [dataset, sortKey, sortAsc, usageStats]);

  // モデル選択トグル (全モデル選択可能)
  const handleToggleModel = (id: string) => {
    if (selectedModelIds.includes(id)) {
      if (selectedModelIds.length > 1) {
        setSelectedModelIds(selectedModelIds.filter((m) => m !== id));
        if (focusedModelId === id) {
          setFocusedModelId(selectedModelIds.find((m) => m !== id) || '');
        }
      }
    } else {
      setSelectedModelIds([...selectedModelIds, id]);
      setFocusedModelId(id);
    }
  };

  // 全Copilotモデル一括選択
  const handleSelectAllCopilot = () => {
    if (!dataset) return;
    const copilotIds = dataset.models.filter((m) => m.is_copilot_native).map((m) => m.id);
    setSelectedModelIds(copilotIds);
    setFocusedModelId(copilotIds[0] || '');
  };

  const handleApplyPreset = (modelIds: string[]) => {
    setSelectedModelIds(modelIds);
    setFocusedModelId(modelIds[0] || '');
  };

  const handleSort = (key: 'overall' | 'swe' | 'speed' | 'cost' | 'aime' | 'usage') => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-400">著名ベンチマーク最新データをロード・解析中...</p>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="p-6 bg-red-950/40 border border-red-800 rounded-xl text-red-200 text-sm">
        <div className="flex items-center space-x-2 font-bold mb-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span>ベンチマークデータの読み込みに失敗しました</span>
        </div>
        <p className="text-xs font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* 1. タイトル & ステータスヘッダー */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="p-3 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-500/25">
              <RadarIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  AIモデル特性レーダー & ベンチマーク評価
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/80 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>v{dataset.version}</span>
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/80 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>最新ベンチマーク検証済</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                SWE-bench Verified、AIME 2024、LMSYS Chatbot Arena、Artificial Analysis 等の著名ベンチマーク最新実測値を多軸正規化。
                GitHub Copilot で活用可能な各AIモデルの得意分野・推奨ユースケースを自動判定します。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-400 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>更新日: {new Date(dataset.last_updated).toLocaleDateString('ja-JP')}</span>
            </div>
          </div>
        </div>

        {/* 比較プリセットセレクタ */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-slate-300">比較プリセット:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => {
              const isActive =
                p.modelIds.length === selectedModelIds.length &&
                p.modelIds.every((id) => selectedModelIds.includes(id));
              return (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p.modelIds)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                  title={p.description}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* モデル選択チップス (未利用モデルも必ず 0% として全ナレッジモデルを選択可能) */}
        <div className="mt-4 flex flex-col space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-300">モデル選択:</span>
              <span className="text-[11px] text-slate-400">
                （保持ナレッジ全 <strong className="text-indigo-300">{dataset.models.length}</strong> モデル表示 • 社内未利用は <span className="font-mono text-slate-400 bg-slate-950 px-1 py-0.2 rounded border border-slate-800">0%</span> として選択可能）
              </span>
            </div>
            <button
              onClick={handleSelectAllCopilot}
              className="px-2.5 py-1 text-[11px] font-semibold rounded bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 transition-all shadow-sm flex items-center space-x-1"
              title="GitHub Copilot公式提供の全モデルを一括選択"
            >
              <span>Copilot公式全選択</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {dataset.models.map((model) => {
              const isSelected = selectedModelIds.includes(model.id);
              const isFocused = focusedModelId === model.id;
              const usage = usageStats[model.id] || { requests: 0, percentage: 0, hasUsage: false };
              return (
                <button
                  key={model.id}
                  onClick={() => handleToggleModel(model.id)}
                  className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs transition-all border ${
                    isSelected
                      ? 'border-indigo-500/80 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  } ${isFocused && isSelected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900' : ''}`}
                  style={{
                    backgroundColor: isSelected ? `${model.color}25` : undefined,
                  }}
                  title={`社内利用シェア: ${usage.percentage}% (${usage.requests.toLocaleString()} 回)${usage.hasUsage ? '' : ' - 実績なし (ナレッジとして選択可能)'}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: model.color }}
                  />
                  <span className="font-medium">{model.name}</span>
                  {model.is_copilot_native && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono">
                      Copilot
                    </span>
                  )}
                  {/* 社内利用シェア (0%も明示表示) */}
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      usage.hasUsage
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                        : 'bg-slate-900/80 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {usage.percentage}%
                  </span>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-slate-300 ml-0.5">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. レーダーチャート & フォーカスモデル判定カード */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左: レーダーチャート (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Compass className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">6軸多次元特性マップ (0 - 100)</h3>
              </div>
              <span className="text-[11px] text-slate-400">
                選択中: <strong className="text-indigo-300">{selectedModels.length}</strong> / {dataset.models.length} モデル
              </span>
            </div>

            {/* チャート描画領域 */}
            <div className="w-full h-[400px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarChartData} outerRadius="75%">
                  <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const targetAxis = dataset.axis_definitions.find(
                          (a) => a.shortLabel === label
                        );
                        return (
                          <div className="bg-slate-950/95 border border-slate-800 p-3 rounded-xl shadow-2xl text-xs space-y-2 backdrop-blur max-w-xs">
                            <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">
                              {targetAxis?.label || label}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {targetAxis?.description}
                            </p>
                            <div className="space-y-1 pt-1">
                              {payload.map((entry: any, index: number) => (
                                <div
                                  key={`item-${index}`}
                                  className="flex items-center justify-between space-x-4"
                                >
                                  <div className="flex items-center space-x-1.5">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-slate-300 font-medium truncate max-w-[130px]">
                                      {entry.name}
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold text-white">
                                    {entry.value} / 100
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(val) => (
                      <span className="text-xs text-slate-300 hover:text-white cursor-pointer">
                        {val}
                      </span>
                    )}
                  />
                  {selectedModels.map((model) => (
                    <Radar
                      key={model.id}
                      name={model.name}
                      dataKey={model.name}
                      stroke={model.color}
                      fill={model.color}
                      fillOpacity={selectedModels.length === 1 ? 0.35 : selectedModels.length > 4 ? 0.08 : 0.18}
                      strokeWidth={focusedModelId === model.id ? 3 : 1.75}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 軸の凡例クイックリファレンス */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            {dataset.axis_definitions.map((axis) => (
              <div
                key={axis.key}
                className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60"
              >
                <span className="font-semibold text-slate-300 block">{axis.shortLabel}</span>
                <span className="text-slate-500 text-[10px]">{axis.primaryMetric}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右: フォーカスモデルの特性判定カード (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {focusedModel ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex-1 flex flex-col justify-between">
              <div>
                {/* ヘッダー: モデル名・グレード */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: focusedModel.color }}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {focusedModel.vendor} • {focusedModel.model_family}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">{focusedModel.name}</h3>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-slate-400">総合グレード</span>
                      <span
                        className="px-2.5 py-0.5 rounded-md font-black text-sm text-white shadow-lg"
                        style={{ backgroundColor: focusedModel.color }}
                      >
                        {focusedModel.evaluation.grade}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400 mt-1">
                      Score: <strong className="text-white">{focusedModel.evaluation.overall_score}</strong> / 100
                    </span>
                  </div>
                </div>

                {/* 特性タグバッジ */}
                <div className="mt-4">
                  <span className="text-xs font-semibold text-slate-400 block mb-2">判定特性タグ:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {focusedModel.evaluation.suitability_tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 flex items-center space-x-1"
                      >
                        <Flame className="w-3 h-3 text-indigo-400" />
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* 組織内・分析対象データの実績 (未利用モデルは 0% と明示しつつナレッジとして参照可能) */}
                <div className="mt-4 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      <span>組織内・分析対象スコープでの実利用状況</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        focusedUsage?.hasUsage
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700/80'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      {focusedUsage?.hasUsage ? '社内利用あり' : '社内利用なし (0%)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
                    <div>
                      <span className="text-[11px] text-slate-400 block">社内利用シェア:</span>
                      <span
                        className={`text-base font-mono font-black ${
                          focusedUsage?.hasUsage ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {focusedUsage?.percentage || 0}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">総リクエスト・対話数:</span>
                      <span className="text-base font-mono font-bold text-slate-200">
                        {(focusedUsage?.requests || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">回</span>
                      </span>
                    </div>
                  </div>

                  {onNavigateToTrend && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        {focusedUsage?.hasUsage ? '日次利用推移を確認:' : 'モデル別推移タブへ移動:'}
                      </span>
                      <button
                        onClick={() => onNavigateToTrend(focusedModel.id)}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 transition-colors"
                      >
                        ユーザー別モデル推移を表示 ➔
                      </button>
                    </div>
                  )}

                  {!focusedUsage?.hasUsage && (
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed border-t border-slate-800/80 pt-1.5">
                      ※ 現行の分析対象データに利用実績はありませんが、モデル特性レーダーのナレッジとしてベンチマーク性能・推奨ユースケース・エンジニアの評判を完全参照可能です。
                    </p>
                  )}
                </div>

                {/* 総合判定サマリー */}
                <div className="mt-4 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {focusedModel.evaluation.summary_verdict}
                  </p>
                </div>

                {/* Copilot 推奨利用指針 */}
                <div className="mt-4 p-3.5 bg-indigo-950/40 border border-indigo-800/60 rounded-xl">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-300 mb-1">
                    <BrainCircuit className="w-4 h-4 text-indigo-400" />
                    <span>Copilot 実務活用ガイド</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {focusedModel.evaluation.copilot_usage_guidance}
                  </p>
                </div>

                {/* 推奨ユースケース & 強み */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/70">
                    <div className="flex items-center space-x-1 text-emerald-400 font-bold mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>推奨ユースケース</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-300 text-[11px]">
                      {focusedModel.evaluation.recommended_for.map((rec, i) => (
                        <li key={i} className="flex items-start space-x-1.5">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/70">
                    <div className="flex items-center space-x-1 text-sky-400 font-bold mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>顕著な強み (Strengths)</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-300 text-[11px]">
                      {focusedModel.evaluation.strengths.map((str, i) => (
                        <li key={i} className="flex items-start space-x-1.5">
                          <span className="text-sky-500 font-bold">•</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 留意点 (Weaknesses) がある場合 */}
                {focusedModel.evaluation.weaknesses.length > 0 && (
                  <div className="mt-3 p-2.5 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-200/90 flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-300">利用時の留意点: </span>
                      <span>{focusedModel.evaluation.weaknesses.join(' / ')}</span>
                    </div>
                  </div>
                )}

                {/* リアルなエンジニアの声・現場の評判 (※ SNSの噂) */}
                {focusedModel.evaluation.buzz && (
                  <div className="mt-4 p-3.5 bg-gradient-to-br from-purple-950/30 via-slate-950/70 to-indigo-950/30 border border-purple-800/40 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between border-b border-purple-800/30 pb-2">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-purple-300">
                        <MessageSquareQuote className="w-4 h-4 text-purple-400" />
                        <span>リアルなエンジニアの声・現場の評判</span>
                      </div>
                      <span className="text-[10px] font-semibold text-amber-300/95 bg-amber-950/70 border border-amber-600/50 px-2 py-0.5 rounded-full shadow-sm">
                        {focusedModel.evaluation.buzz.source_note}
                      </span>
                    </div>

                    {/* キャッチコピー / 通り名 */}
                    <div className="text-xs font-bold text-slate-100 flex items-start space-x-1.5 pt-0.5">
                      <span className="text-purple-400 font-mono text-base leading-none">“</span>
                      <p className="italic leading-relaxed text-purple-200">
                        {focusedModel.evaluation.buzz.headline}
                      </p>
                      <span className="text-purple-400 font-mono text-base leading-none">”</span>
                    </div>

                    {/* 現場エンジニアの実感ポイント */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400/90 block">
                        現場で多く聞かれる実感・評価:
                      </span>
                      <ul className="space-y-1 text-slate-300 text-[11px]">
                        {focusedModel.evaluation.buzz.community_sentiments.map((sentiment, i) => (
                          <li key={i} className="flex items-start space-x-1.5">
                            <span className="text-purple-400 font-bold flex-shrink-0">💬</span>
                            <span className="leading-snug">{sentiment}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 囁かれる注意点・噂 */}
                    {focusedModel.evaluation.buzz.caution_rumor && (
                      <div className="pt-2 border-t border-purple-800/30 text-[11px] text-amber-200/90 flex items-start space-x-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-semibold text-amber-300">囁かれる噂・ボヤキ: </span>
                          <span>{focusedModel.evaluation.buzz.caution_rumor}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* モデル切り替えクイックセレクタ */}
              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">詳細カード切り替え:</span>
                <div className="flex items-center space-x-1.5">
                  {selectedModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setFocusedModelId(m.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                        focusedModelId === m.id
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.name.split(' ')[0]} {m.name.split(' ')[1] || ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              モデルを選択してください
            </div>
          )}
        </div>
      </div>

      {/* 3. 著名ベンチマーク生データ詳細比較テーブル */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <FileCode2 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">著名ベンチマーク最新実測データ詳細テーブル</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              SWE-bench Verified、AIME 2024、LMSYS Arena Elo、TPS、入出力コスト、コンテキスト長の実測値一覧
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">ソート基準:</span>
            <button
              onClick={() => handleSort('overall')}
              className={`px-2.5 py-1 rounded-md font-medium border ${
                sortKey === 'overall'
                  ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              総合スコア
            </button>
            <button
              onClick={() => handleSort('swe')}
              className={`px-2.5 py-1 rounded-md font-medium border ${
                sortKey === 'swe'
                  ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              SWE-bench
            </button>
            <button
              onClick={() => handleSort('speed')}
              className={`px-2.5 py-1 rounded-md font-medium border ${
                sortKey === 'speed'
                  ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              出力速度
            </button>
            <button
              onClick={() => handleSort('cost')}
              className={`px-2.5 py-1 rounded-md font-medium border ${
                sortKey === 'cost'
                  ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              コスト効率
            </button>
            <button
              onClick={() => handleSort('usage')}
              className={`px-2.5 py-1 rounded-md font-medium border flex items-center space-x-1 ${
                sortKey === 'usage'
                  ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              <Building2 className="w-3 h-3 text-indigo-400" />
              <span>社内利用シェア</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-3">モデル / ファミリー</th>
                <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('overall')}>
                  <div className="flex items-center space-x-1">
                    <span>総合 Grade / 判定</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('usage')}>
                  <div className="flex items-center space-x-1 text-slate-200 font-bold">
                    <span>社内利用シェア</span>
                    <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('swe')}>
                  <div className="flex items-center space-x-1">
                    <span>SWE-bench Verified</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('aime')}>
                  <div className="flex items-center space-x-1">
                    <span>AIME 2024 / GPQA</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Arena Coding Elo</th>
                <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('speed')}>
                  <div className="flex items-center space-x-1">
                    <span>速度 (Tokens/s)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('cost')}>
                  <div className="flex items-center space-x-1">
                    <span>単価 ($/1M Tok)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Context 窓</th>
                <th className="py-3 px-3 text-right">レーダー表示</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedModels.map((m) => {
                const isSelected = selectedModelIds.includes(m.id);
                const isFocused = focusedModelId === m.id;
                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isFocused ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: m.color }}
                        />
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-white">{m.name}</span>
                            {m.is_copilot_native && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono">
                                Copilot
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {m.vendor} • {m.release_date}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2">
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-black text-white"
                          style={{ backgroundColor: m.color }}
                        >
                          {m.evaluation.grade}
                        </span>
                        <span className="font-mono text-slate-300 font-bold">
                          {m.evaluation.overall_score} pt
                        </span>
                      </div>
                    </td>

                    {/* 社内利用シェア (実績なしモデルは 0% と明示) */}
                    <td className="py-3 px-3 font-mono">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`font-bold ${
                            usageStats[m.id]?.hasUsage ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {usageStats[m.id]?.percentage || 0}%
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({(usageStats[m.id]?.requests || 0).toLocaleString()} req)
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">
                          {m.raw_metrics.swe_bench_verified}%
                        </span>
                        <span className="text-[10px] text-slate-500">
                          HumanEval+: {m.raw_metrics.humaneval_plus}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">
                          AIME: {m.raw_metrics.aime_2024}%
                        </span>
                        <span className="text-[10px] text-slate-500">
                          GPQA: {m.raw_metrics.gpqa_diamond}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-indigo-300">
                      {m.raw_metrics.arena_coding_elo}
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="flex items-center space-x-1.5">
                        <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="font-bold text-white">
                          {m.raw_metrics.output_speed_tps} tps
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-300">
                      <div className="flex flex-col">
                        <span>In: ${m.raw_metrics.input_cost_per_m}</span>
                        <span className="text-[10px] text-slate-500">
                          Out: ${m.raw_metrics.output_cost_per_m}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-300">
                      {m.raw_metrics.context_window_k >= 1000
                        ? `${m.raw_metrics.context_window_k / 1000}M Tok`
                        : `${m.raw_metrics.context_window_k}K Tok`}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleToggleModel(m.id)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isSelected ? '選択解除' : 'レーダー追加'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. ベンチマークデータソース & 判定基準情報 (お題設計・性能の見え方・SNSの噂) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>著名ベンチマーク出典の設計背景・現場での見え方・エンジニアの声</span>
          </div>
          <span className="text-[11px] text-slate-400">
            各ベンチマークの出題意図と実務開発での評価ポイント
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          {dataset.sources.map((src) => (
            <div
              key={src.id}
              className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3.5 hover:border-slate-700 transition-colors"
            >
              {/* カードヘッダー */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <h4 className="font-bold text-slate-100 text-sm">{src.name}</h4>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(src.last_fetched_at).toLocaleDateString('ja-JP')}
                    </span>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 rounded bg-slate-800 text-indigo-400 hover:text-white transition-colors"
                      title="公式サイトを開く"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {src.description}
                </p>
              </div>

              {/* 3層の詳細解説ブロック */}
              <div className="space-y-2.5">
                {/* 1. どのようなお題に対して設計されているか */}
                {src.target_problem && (
                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800/80">
                    <div className="flex items-center space-x-1.5 text-indigo-300 font-bold text-[11px] mb-1">
                      <Target className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span>出題内容・お題の設計:</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {src.target_problem}
                    </p>
                  </div>
                )}

                {/* 2. 現場でどのような性能の見え方をするものなのか */}
                {src.performance_view && (
                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800/80">
                    <div className="flex items-center space-x-1.5 text-sky-300 font-bold text-[11px] mb-1">
                      <Eye className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      <span>現場での性能の見え方・評価の見所:</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {src.performance_view}
                    </p>
                  </div>
                )}

                {/* 3. リアルなエンジニアの声・SNSの噂 */}
                {src.community_rumor && (
                  <div className="p-3 bg-amber-950/20 rounded-lg border border-amber-800/40">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1.5 text-amber-300 font-bold text-[11px]">
                        <MessageSquareQuote className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span>エンジニア界隈のリアルな声・議論</span>
                      </div>
                      <span className="text-[9px] font-semibold text-amber-300 bg-amber-950/80 border border-amber-700/60 px-1.5 py-0.2 rounded">
                        ※ SNSの噂
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      {src.community_rumor}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModelRadarView;
