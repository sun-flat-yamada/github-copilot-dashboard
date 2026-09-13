import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  CANONICAL_VENDOR_ORDER,
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
  Clock,
  RefreshCw,
  Sliders,
  MessageSquareQuote,
  Target,
  Eye,
  Building2,
  CreditCard,
  BookOpen,
  Tag,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Trash2,
  Plus,
  Code2,
  Brain,
  Trophy,
  Zap,
  Coins,
  Maximize2,
  Table,
  HelpCircle,
} from 'lucide-react';

import { normalizeModelId } from '../../../src/processor/benchmark-evaluator';
import { RadarTableOfContents } from './RadarTableOfContents';
import { ModelSelectorSidebar, SidebarDisplayMode } from './ModelSelectorSidebar';

export interface ModelUsageStat {
  modelId: string;
  requests: number;
  percentage: number;
  hasUsage: boolean;
}

/**
 * 組織内・分析対象データの実績集計 (未利用モデルも必ず 0% として保持)
 */
export function computeModelUsage(
  dataset: BenchmarkDataset | null,
  aggregatedData?: ScopeAggregatedData | null,
  monthlyReportData?: MonthlyReportAggregatedData | null
): Record<string, ModelUsageStat> {
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
}

/**
 * 実績利用数上位のモデルIDリストを取得 (デフォルトTop3、データなし/0件時は空配列)
 */
export function getTopUsageModelIds(
  dataset: BenchmarkDataset,
  usageStats: Record<string, ModelUsageStat>,
  limit = 3
): string[] {
  const activeModels = dataset.models
    .filter((m) => (usageStats[m.id]?.requests || 0) > 0)
    .sort((a, b) => (usageStats[b.id]?.requests || 0) - (usageStats[a.id]?.requests || 0));

  if (activeModels.length === 0) {
    return [];
  }

  return activeModels.slice(0, limit).map((m) => m.id);
}

interface ModelRadarViewProps {
  initialSelectedModelId?: string;
  onNavigateToTrend?: (modelId: string) => void;
  aggregatedData?: ScopeAggregatedData | null;
  monthlyReportData?: MonthlyReportAggregatedData | null;
}

// プリセット定義 (2026年 GitHub Copilot公式モデル・カテゴリ別・メーカー別)
export const PRESETS = [
  {
    id: 'flagship-2026',
    name: '🌟 2026上 旗艦4選',
    description: 'Claude Opus 5 / GPT-6 Astra / Gemini 3.8 Flash / Kimi K3 (2026年上期 各社最前線フラッグシップ — Powerful Tier 代表スナップショット)',
    modelIds: ['claude-opus-5', 'gpt-6-astra', 'gemini-3-8-flash', 'kimi-k3'],
  },
  {
    id: 'practical-high-value',
    name: '💡 実用性能で高コスパ',
    description: 'Claude Sonnet 5 / Gemini 3.8 Flash / GPT-5.6 Luna / Kimi K2.7 Code (実用コーディング性能と抜群の費用対効果を両立)',
    modelIds: ['claude-sonnet-5', 'gemini-3-8-flash', 'gpt-5-6-luna', 'kimi-k2-7-code'],
  },
  {
    id: 'recommended-code-review',
    name: '🔍 コードレビュー利用に推奨',
    description: 'Claude Opus 5 / Claude Sonnet 5 / Gemini 3.8 Flash (最高水準の推論・SWE性能を維持したコスト別上位3選)',
    modelIds: ['claude-opus-5', 'claude-sonnet-5', 'gemini-3-8-flash'],
  },
  {
    id: 'recommended-codebase-analysis',
    name: '📂 コードベース分析に推奨',
    description: 'Claude Opus 5 / Claude Sonnet 5 / Gemini 3.8 Flash (1Mコンテキスト・大域的設計把握のコスト別上位3選)',
    modelIds: ['claude-opus-5', 'claude-sonnet-5', 'gemini-3-8-flash'],
  },
  {
    id: 'recommended-architecture',
    name: '🏛️ 設計に推奨',
    description: 'GPT-6 Astra / Claude Sonnet 5 / Gemini 3.8 Flash (極限論理推論・アーキテクチャ把握のコスト別上位3選)',
    modelIds: ['gpt-6-astra', 'claude-sonnet-5', 'gemini-3-8-flash'],
  },
  {
    id: 'tier-powerful',
    name: '⚡ Powerful (最上位推論)',
    description: 'GPT-6 Astra / Claude Opus 5 / GPT-5.6 Sol / Kimi K3 (最高峰コーディング・推論群)',
    modelIds: ['gpt-6-astra', 'claude-opus-5', 'gpt-5-6-sol', 'kimi-k3'],
  },
  {
    id: 'tier-versatile',
    name: '🛠️ Versatile (実務バランス)',
    description: 'Claude Sonnet 5 / GPT-5.6 Terra / Gemini 3.8 Flash / Grok 4.6 (標準実務・俊敏性重視)',
    modelIds: ['claude-sonnet-5', 'gpt-5-6-terra', 'gemini-3-8-flash', 'grok-4-6'],
  },
  {
    id: 'tier-lightweight',
    name: '🚀 Lightweight (超高速・低コスト)',
    description: 'GPT-5.6 Luna / Gemini 3.5 Flash / MAI-Code-1.1-Flash / GPT-5.4 mini (日常インライン・超高速補完)',
    modelIds: ['gpt-5-6-luna', 'gemini-3-5-flash', 'mai-code-1-1-flash', 'gpt-5-4-mini'],
  },
  {
    id: 'vendor-anthropic',
    name: '🟠 Anthropic 主力',
    description: 'Claude Sonnet 5 / Claude Opus 5 / Claude Fable 5.1 / Claude Haiku 4.5 (Anthropic 2026最新)',
    modelIds: ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-haiku-4-5'],
  },
  {
    id: 'vendor-openai',
    name: '🟢 OpenAI 主力',
    description: 'GPT-6 Astra / GPT-5.6 Sol / GPT-5.6 Terra / GPT-5.6 Luna (OpenAI 2026最新ファミリ)',
    modelIds: ['gpt-6-astra', 'gpt-5-6-sol', 'gpt-5-6-terra', 'gpt-5-6-luna'],
  },
  {
    id: 'vendor-google',
    name: '🔵 Google Gemini 3.x',
    description: 'Gemini 3.8 Flash / Gemini 3.7 Flash / Gemini 3.6 Flash / Gemini 3.5 Flash (Google 最新1Mコンテキスト)',
    modelIds: ['gemini-3-8-flash', 'gemini-3-7-flash', 'gemini-3-6-flash', 'gemini-3-5-flash'],
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
  // 詳細カード上部プルダウンの開閉状態
  const [isDetailCardDropdownOpen, setIsDetailCardDropdownOpen] = useState<boolean>(false);
  // 生データテーブルのソート列 (社内利用シェア 'usage'、コンテキスト長 'context'、モデル名 'model'、レーダー表示 'radar'、Arena Elo 'arena' も対応)
  const [sortKey, setSortKey] = useState<
    'overall' | 'swe' | 'speed' | 'cost' | 'aime' | 'arena' | 'usage' | 'context' | 'model' | 'radar'
  >('overall');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  // モデル列用3種ループ状態 ('default' > 'asc' > 'desc')
  const [modelSortMode, setModelSortMode] = useState<'default' | 'asc' | 'desc'>('default');

  // 出典解説カードへのジャンプ時の一時ハイライト対象ID
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);

  // モデル選択チップス用: 表示モード (メーカー別 'vendor' / カテゴリ別 'category') & 絞り込み
  const [groupingMode, setGroupingMode] = useState<'vendor' | 'category'>('vendor');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('all');

  // 生データテーブル用: メーカー & カテゴリ絞り込み
  const [tableVendorFilter, setTableVendorFilter] = useState<string>('all');
  const [tableTierFilter, setTableTierFilter] = useState<string>('all');

  // AIモデル選択サイドバーの表示モード ('expanded' (表示/デフォルト) / 'compact' (省幅) / 'collapsed' (非表示))
  const [sidebarMode, setSidebarMode] = useState<SidebarDisplayMode>(() => {
    try {
      const stored = localStorage.getItem('copilot_radar_sidebar_mode');
      if (stored === 'expanded' || stored === 'compact' || stored === 'collapsed') {
        return stored;
      }
    } catch {
      // localStorage 非対応環境
    }
    return 'expanded';
  });

  const handleSidebarModeChange = (mode: SidebarDisplayMode) => {
    setSidebarMode(mode);
    try {
      localStorage.setItem('copilot_radar_sidebar_mode', mode);
    } catch {
      // ignore
    }
  };

  // 初期選択完了フラグ
  const hasInitializedRef = useRef<boolean>(false);

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

        // 初期選択モデルの設定:
        // 1. initialSelectedModelId が指定されていればそれを選択
        // 2. 利用データに基づく Top 3 モデルを選択 (利用実績データがない/0件の場合は未選択: [])
        if (initialSelectedModelId && data.models.some((m) => m.id === initialSelectedModelId)) {
          setSelectedModelIds([initialSelectedModelId]);
          setFocusedModelId(initialSelectedModelId);
          hasInitializedRef.current = true;
        } else {
          const stats = computeModelUsage(data, aggregatedData, monthlyReportData);
          const top3Ids = getTopUsageModelIds(data, stats, 3);
          setSelectedModelIds(top3Ids);
          setFocusedModelId(top3Ids[0] || '');
          hasInitializedRef.current = true;
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

  // 利用データが非同期で後から到着した場合の初期選択反映 (未初期化または未選択時)
  useEffect(() => {
    if (!dataset || hasInitializedRef.current) return;
    if (initialSelectedModelId && dataset.models.some((m) => m.id === initialSelectedModelId)) {
      setSelectedModelIds([initialSelectedModelId]);
      setFocusedModelId(initialSelectedModelId);
      hasInitializedRef.current = true;
      return;
    }
    const stats = computeModelUsage(dataset, aggregatedData, monthlyReportData);
    const top3Ids = getTopUsageModelIds(dataset, stats, 3);
    if (top3Ids.length > 0) {
      setSelectedModelIds(top3Ids);
      setFocusedModelId(top3Ids[0] || '');
      hasInitializedRef.current = true;
    }
  }, [dataset, aggregatedData, monthlyReportData, initialSelectedModelId]);

  // 組織内・分析対象データの実績集計 (未利用モデルも必ず 0% として保持ナレッジ全モデルを網羅)
  const usageStats = useMemo<Record<string, ModelUsageStat>>(() => {
    return computeModelUsage(dataset, aggregatedData, monthlyReportData);
  }, [aggregatedData, monthlyReportData, dataset]);

  // 最終ベンチマーク確認日のフォーマット (yyyy-mm-dd)
  const lastBenchmarkConfirmDate = useMemo(() => {
    if (!dataset?.last_updated) return '';
    const d = new Date(dataset.last_updated);
    if (isNaN(d.getTime())) {
      return dataset.last_updated.slice(0, 10);
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [dataset?.last_updated]);

  // 選択中モデルのプロファイル配列
  const selectedModels = useMemo(() => {
    if (!dataset) return [];
    return dataset.models.filter((m) => selectedModelIds.includes(m.id));
  }, [dataset, selectedModelIds]);

  // フォーカス中モデルのプロファイル
  const focusedModel = useMemo(() => {
    if (!dataset || selectedModels.length === 0) return null;
    // 選択中モデルに focusedModelId が含まれていればそれを最優先
    if (selectedModelIds.includes(focusedModelId)) {
      const found = dataset.models.find((m) => m.id === focusedModelId);
      if (found) return found;
    }
    // 含まれていなければ選択中モデルの先頭
    return selectedModels[0] || null;
  }, [dataset, focusedModelId, selectedModelIds, selectedModels]);

  // 詳細カード切り替え用: 選択中モデルリスト内での現在位置
  const currentFocusedIndex = useMemo(() => {
    if (!focusedModel || selectedModels.length === 0) return -1;
    return selectedModels.findIndex((m) => m.id === focusedModel.id);
  }, [focusedModel, selectedModels]);

  // 左移動 (前のモデルへ)
  const handlePrevModel = () => {
    if (selectedModels.length <= 1) return;
    const idx = currentFocusedIndex >= 0 ? currentFocusedIndex : 0;
    const prevIdx = (idx - 1 + selectedModels.length) % selectedModels.length;
    setFocusedModelId(selectedModels[prevIdx].id);
  };

  // 右移動 (次のモデルへ)
  const handleNextModel = () => {
    if (selectedModels.length <= 1) return;
    const idx = currentFocusedIndex >= 0 ? currentFocusedIndex : 0;
    const nextIdx = (idx + 1) % selectedModels.length;
    setFocusedModelId(selectedModels[nextIdx].id);
  };

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

  // テーブルソート・フィルタ済みモデルリスト
  const sortedModels = useMemo(() => {
    if (!dataset) return [];
    let list = [...dataset.models];

    // テーブル メーカー絞り込み
    if (tableVendorFilter !== 'all') {
      if (tableVendorFilter === 'Other') {
        const standardVendors = (CANONICAL_VENDOR_ORDER as readonly string[]).filter((x) => x !== 'Other');
        list = list.filter((m) => !standardVendors.includes(m.vendor));
      } else {
        list = list.filter((m) => m.vendor === tableVendorFilter);
      }
    }

    // テーブル カテゴリ (Tier) 絞り込み
    if (tableTierFilter !== 'all') {
      list = list.filter((m) => {
        const tier = (m.extended_capabilities?.tier || m.capabilities?.tier || '').toLowerCase();
        return tier === tableTierFilter;
      });
    }

    if (sortKey === 'model') {
      if (modelSortMode === 'asc') {
        list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      } else if (modelSortMode === 'desc') {
        list.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
      }
      // 'default' は dataset.models の原順序をそのまま保持
      return list;
    }

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
      } else if (sortKey === 'arena') {
        valA = a.raw_metrics.arena_coding_elo;
        valB = b.raw_metrics.arena_coding_elo;
      } else if (sortKey === 'usage') {
        valA = usageStats[a.id]?.percentage || 0;
        valB = usageStats[b.id]?.percentage || 0;
      } else if (sortKey === 'context') {
        valA = a.raw_metrics.context_window_k;
        valB = b.raw_metrics.context_window_k;
      } else if (sortKey === 'radar') {
        valA = selectedModelIds.includes(a.id) ? 1 : 0;
        valB = selectedModelIds.includes(b.id) ? 1 : 0;
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [dataset, sortKey, sortAsc, modelSortMode, selectedModelIds, usageStats, tableVendorFilter, tableTierFilter]);

  // 全モデル中の各指標の最大値 (スコアバー描画用)
  const maxMetrics = useMemo(() => {
    if (!dataset || dataset.models.length === 0) return null;
    const ms = dataset.models;
    return {
      overall:    Math.max(...ms.map((m) => m.evaluation.overall_score)),
      swe:        Math.max(...ms.map((m) => m.raw_metrics.swe_bench_verified)),
      humaneval:  Math.max(...ms.map((m) => m.raw_metrics.humaneval_plus)),
      aime:       Math.max(...ms.map((m) => m.raw_metrics.aime_2024)),
      gpqa:       Math.max(...ms.map((m) => m.raw_metrics.gpqa_diamond)),
      arena_elo:  Math.max(...ms.map((m) => m.raw_metrics.arena_coding_elo)),
      speed_tps:  Math.max(...ms.map((m) => m.raw_metrics.output_speed_tps)),
      // コスト効率: cost_efficiency レーダースコアが高いほど良い
      cost_eff:   Math.max(...ms.map((m) => m.radar_scores.cost_efficiency)),
    };
  }, [dataset]);

  // モデル選択トグル (全モデル選択可能・0モデル選択解除も可能)
  const handleToggleModel = (id: string) => {
    if (selectedModelIds.includes(id)) {
      const next = selectedModelIds.filter((m) => m !== id);
      setSelectedModelIds(next);
      if (focusedModelId === id) {
        setFocusedModelId(next[0] || '');
      }
    } else {
      setSelectedModelIds([...selectedModelIds, id]);
      setFocusedModelId(id);
    }
  };

  // 複数モデルの一括選択/一括解除 (ベンダー・Tier別ボタン用)
  const handleBatchSelectModels = (targetIds: string[], select: boolean) => {
    if (select) {
      setSelectedModelIds((prev) => Array.from(new Set([...prev, ...targetIds])));
      if (!targetIds.includes(focusedModelId) && targetIds.length > 0) {
        setFocusedModelId(targetIds[0]);
      }
    } else {
      setSelectedModelIds((prev) => {
        const next = prev.filter((id) => !targetIds.includes(id));
        if (targetIds.includes(focusedModelId)) {
          setFocusedModelId(next[0] || '');
        }
        return next;
      });
    }
  };

  // 全Copilotモデル一括選択
  const handleSelectAllCopilot = () => {
    if (!dataset) return;
    const copilotIds = dataset.models.filter((m) => m.is_copilot_native).map((m) => m.id);
    setSelectedModelIds(copilotIds);
    setFocusedModelId(copilotIds[0] || '');
  };

  // 全モデルの選択解除 (完全クリア)
  const handleClearSelection = () => {
    setSelectedModelIds([]);
    setFocusedModelId('');
  };

  const handleApplyPreset = (modelIds: string[]) => {
    setSelectedModelIds(modelIds);
    setFocusedModelId(modelIds[0] || '');
  };

  const handleSort = (
    key: 'overall' | 'swe' | 'speed' | 'cost' | 'aime' | 'arena' | 'usage' | 'context' | 'model' | 'radar'
  ) => {
    if (key === 'model') {
      if (sortKey !== 'model') {
        setSortKey('model');
        setModelSortMode('default');
      } else {
        if (modelSortMode === 'default') {
          setModelSortMode('asc');
        } else if (modelSortMode === 'asc') {
          setModelSortMode('desc');
        } else {
          setModelSortMode('default');
        }
      }
      return;
    }

    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // 6軸カードから生データ比較テーブルへジャンプ & ソート連動
  const handleJumpToTable = (targetSortKey: 'swe' | 'aime' | 'arena' | 'speed' | 'cost' | 'context') => {
    setSortKey(targetSortKey);
    setSortAsc(false);
    const target = document.getElementById('radar-table');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 6軸カードから出典解説カードへジャンプ & ハイライト
  const handleJumpToSource = (sourceId: string) => {
    setHighlightedSourceId(sourceId);
    const target = document.getElementById(`source-${sourceId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    } else {
      document.getElementById('radar-sources')?.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => {
      setHighlightedSourceId((prev) => (prev === sourceId ? null : prev));
    }, 3000);
  };

  // 6軸と対応するテーブルソートキー・出典解説の紐付け定義
  const AXIS_LINK_CONFIG: Record<
    string,
    {
      sortKey: 'swe' | 'aime' | 'arena' | 'speed' | 'cost' | 'context';
      sourceId: string;
      sourceName: string;
      icon: React.ComponentType<{ className?: string }>;
      colorClass: string;
      borderHoverClass: string;
    }
  > = {
    coding_swe: {
      sortKey: 'swe',
      sourceId: 'swe-bench',
      sourceName: 'SWE-bench Verified',
      icon: Code2,
      colorClass: 'text-indigo-400',
      borderHoverClass: 'hover:border-indigo-500/80',
    },
    reasoning_logic: {
      sortKey: 'aime',
      sourceId: 'frontier-papers',
      sourceName: 'Frontier Reports',
      icon: Brain,
      colorClass: 'text-purple-400',
      borderHoverClass: 'hover:border-purple-500/80',
    },
    arena_elo: {
      sortKey: 'arena',
      sourceId: 'lmsys-arena',
      sourceName: 'LMSYS Arena',
      icon: Trophy,
      colorClass: 'text-amber-400',
      borderHoverClass: 'hover:border-amber-500/80',
    },
    speed_latency: {
      sortKey: 'speed',
      sourceId: 'artificial-analysis',
      sourceName: 'Artificial Analysis',
      icon: Zap,
      colorClass: 'text-emerald-400',
      borderHoverClass: 'hover:border-emerald-500/80',
    },
    cost_efficiency: {
      sortKey: 'cost',
      sourceId: 'artificial-analysis',
      sourceName: 'Artificial Analysis',
      icon: Coins,
      colorClass: 'text-green-400',
      borderHoverClass: 'hover:border-green-500/80',
    },
    architecture_design: {
      sortKey: 'context',
      sourceId: 'frontier-papers',
      sourceName: 'Frontier Reports',
      icon: Maximize2,
      colorClass: 'text-cyan-400',
      borderHoverClass: 'hover:border-cyan-500/80',
    },
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
    <div className="flex flex-col space-y-6 relative">
      {/* 右側固定: ページ内構成カテゴリ一覧 & スムーズジャンプ目次 (表示/非表示トグル可能) */}
      <RadarTableOfContents />

      {/* 1. タイトル & ステータスヘッダー */}
      <div id="radar-overview" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden scroll-mt-20">
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
                <span
                  className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/80 flex items-center space-x-1"
                  title={`個別バージョン (日付・連番管理): ${dataset.version}`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>v{dataset.version}</span>
                </span>
                <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center space-x-1.5">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>最終ベンチマーク確認: {lastBenchmarkConfirmDate}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                SWE-bench Verified、AIME 2024、LMSYS Chatbot Arena、Artificial Analysis 等の著名ベンチマーク実測値をまとめて正規化したものです。各AIモデルの得意分野・推奨ユースケースの情報とセットで整理することで、エンジニアのモデル選択を助ける情報を提供します。
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
      </div>

      {/* 2カラム構成: 左側フレーム (AIモデル選択) & 右側メインエリア (各分析ウィジェット) */}
      <div className="flex flex-col lg:flex-row items-start gap-6 relative w-full">
        {/* 左側フレーム: AIモデル選択 (表示 / 省幅 / 非表示 切り替え & 画面追従 sticky) */}
        <ModelSelectorSidebar
          dataset={dataset}
          selectedModelIds={selectedModelIds}
          focusedModelId={focusedModelId}
          usageStats={usageStats}
          sidebarMode={sidebarMode}
          onSidebarModeChange={handleSidebarModeChange}
          onToggleModel={handleToggleModel}
          onBatchSelectModels={handleBatchSelectModels}
          onSelectAllCopilot={handleSelectAllCopilot}
          onClearSelection={handleClearSelection}
          onApplyPreset={handleApplyPreset}
          groupingMode={groupingMode}
          onGroupingModeChange={setGroupingMode}
          selectedVendorFilter={selectedVendorFilter}
          onVendorFilterChange={setSelectedVendorFilter}
          selectedTierFilter={selectedTierFilter}
          onTierFilterChange={setSelectedTierFilter}
        />

        {/* 右側メインエリア: 各分析ウィジェット */}
        <div className="flex-1 min-w-0 flex flex-col space-y-6 w-full">

      {/* 2. レーダーチャート & フォーカスモデル判定カード */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左: レーダーチャート (7 cols) */}
        <div id="radar-chart" className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between scroll-mt-20">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Compass className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">6軸多次元特性マップ (0 - 100)</h3>
              </div>
              <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                <span className="hidden sm:inline-flex items-center space-x-1.5">
                  <span className="inline-block w-3.5 h-0.5 bg-indigo-400 rounded" />
                  <span className="text-slate-300 font-medium">実線(太): アクティブ</span>
                  <span className="text-slate-600">|</span>
                  <span className="inline-block w-4 border-b border-dashed border-slate-400" />
                  <span>点線: 比較モデル</span>
                </span>
                <span>
                  選択中: <strong className="text-indigo-300">{selectedModels.length}</strong> / {dataset.models.length} モデル
                </span>
              </div>
            </div>

            {/* チャート描画領域 */}
            <div className="w-full h-[400px] flex items-center justify-center relative">
              {selectedModels.length === 0 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs rounded-xl p-6 text-center space-y-2.5">
                  <RadarIcon className="w-10 h-10 text-slate-600 animate-pulse" />
                  <p className="text-sm font-bold text-slate-300">モデルが選択されていません</p>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    左側の「AIモデル選択」フレームから比較したいモデルを選択するか、「Copilot公式全選択」またはプリセットをクリックしてください。
                  </p>
                  <button
                    onClick={handleSelectAllCopilot}
                    className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
                  >
                    Copilot公式モデルを選択
                  </button>
                </div>
              )}
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
                    content={() => (
                      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3">
                        {selectedModels.map((model) => {
                          const isFocused = (focusedModel?.id ?? focusedModelId) === model.id;
                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => setFocusedModelId(model.id)}
                              className={`group inline-flex items-center space-x-2 px-2.5 py-1 rounded-lg text-xs transition-all border cursor-pointer select-none ${
                                isFocused
                                  ? 'bg-slate-800 text-white font-bold border-indigo-500/70 shadow-sm ring-1 ring-indigo-500/40'
                                  : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                              }`}
                              title={`クリックして「${model.name}」を詳細カードに表示（アクティブ切替）`}
                            >
                              {/* 色ブロック (現在の色ブロック表示を維持) */}
                              <span
                                className="w-2.5 h-2.5 rounded-sm flex-shrink-0 shadow-sm transition-transform group-hover:scale-110"
                                style={{ backgroundColor: model.color }}
                                aria-hidden="true"
                              />

                              {/* 線/点線の状態表示 (スマートなミニチュアインジケータ) */}
                              <span
                                className="inline-flex items-center flex-shrink-0"
                                aria-label={isFocused ? '実線(アクティブ)' : '点線(比較対象)'}
                              >
                                {isFocused ? (
                                  <svg width="18" height="6" className="overflow-visible" aria-hidden="true">
                                    <line
                                      x1="0"
                                      y1="3"
                                      x2="18"
                                      y2="3"
                                      stroke={model.color}
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                ) : (
                                  <svg width="18" height="6" className="overflow-visible" aria-hidden="true">
                                    <line
                                      x1="0"
                                      y1="3"
                                      x2="18"
                                      y2="3"
                                      stroke={model.color}
                                      strokeWidth="1.75"
                                      strokeDasharray="5 2"
                                      strokeOpacity="0.85"
                                    />
                                  </svg>
                                )}
                              </span>

                              {/* モデル名 */}
                              <span className="truncate max-w-[130px] sm:max-w-none">{model.name}</span>

                              {/* アクティブ時のスマートバッジ */}
                              {isFocused && (
                                <span className="text-[9px] font-semibold px-1 py-0.2 bg-indigo-500/25 text-indigo-300 rounded border border-indigo-500/30 leading-none">
                                  選択中
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                  {selectedModels.map((model) => {
                    const isFocused = (focusedModel?.id ?? focusedModelId) === model.id;
                    return (
                      <Radar
                        key={model.id}
                        name={model.name}
                        dataKey={model.name}
                        stroke={model.color}
                        fill={model.color}
                        fillOpacity={
                          isFocused
                            ? selectedModels.length === 1
                              ? 0.35
                              : selectedModels.length > 4
                              ? 0.14
                              : 0.22
                            : selectedModels.length > 4
                            ? 0.04
                            : 0.08
                        }
                        strokeWidth={isFocused ? 3.5 : 1.75}
                        strokeDasharray={isFocused ? undefined : '8 3'}
                        strokeOpacity={isFocused ? 1 : 0.85}
                        className="cursor-pointer"
                        onClick={() => setFocusedModelId(model.id)}
                      />
                    );
                  })}
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 軸の凡例クイックリファレンス & ウィジェット間相互リンク */}
          <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>6軸評価基準 & 実測ベンチマーク対応</span>
              </div>
              <span className="text-[10px] text-slate-400">
                各軸をクリックで実測テーブル（ソート連動）や出典解説へジャンプ
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 text-[11px]">
              {dataset.axis_definitions.map((axis) => {
                const config = AXIS_LINK_CONFIG[axis.key] || {
                  sortKey: 'overall' as const,
                  sourceId: 'swe-bench',
                  sourceName: 'Benchmark',
                  icon: HelpCircle,
                  colorClass: 'text-slate-400',
                  borderHoverClass: 'hover:border-slate-700',
                };
                const IconComponent = config.icon;

                return (
                  <div
                    key={axis.key}
                    onClick={() => handleJumpToTable(config.sortKey)}
                    className={`bg-slate-950/70 hover:bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 ${config.borderHoverClass} transition-all cursor-pointer group shadow-sm flex flex-col justify-between space-y-2 select-none`}
                    title={`クリックして「04 著名ベンチマーク実測テーブル」で【${axis.primaryMetric}】順にソート表示`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleJumpToTable(config.sortKey);
                      }
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1.5">
                          <IconComponent className={`w-3.5 h-3.5 ${config.colorClass}`} />
                          <span className="font-bold text-slate-200 group-hover:text-white transition-colors">
                            {axis.shortLabel}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">
                          {(axis.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="font-semibold text-indigo-300 text-xs truncate">
                        {axis.primaryMetric}
                      </div>
                      <p className="text-slate-400 text-[10px] line-clamp-1 mt-0.5" title={axis.description}>
                        {axis.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                      <span className="text-indigo-400 font-medium group-hover:underline flex items-center space-x-0.5">
                        <Table className="w-3 h-3" />
                        <span>実測テーブルソート ↓</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJumpToSource(config.sourceId);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 hover:border-slate-500 transition-all flex items-center space-x-0.5"
                        title={`「05 出典の設計背景・現場の見え方」の【${config.sourceName}】へジャンプ`}
                      >
                        <BookOpen className="w-2.5 h-2.5 text-slate-400" />
                        <span>出典解説 ↗</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右: フォーカスモデルの特性判定カード (5 cols) */}
        <div id="radar-detail" className="lg:col-span-5 flex flex-col space-y-4 scroll-mt-20">
          {focusedModel ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex-1 flex flex-col">
              <div>
                {/* 1. 詳細カード切り替えバー (ウィジェット最上部: 最初から2段構成で全幅を活用) */}
                <div className="mb-4 pb-3.5 border-b border-slate-800 space-y-2 text-xs">
                  {/* 上段: ラベル & カウンター表示 */}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-semibold text-slate-300">詳細カード切り替え:</span>
                    </div>
                    {selectedModels.length > 1 && (
                      <span className="text-[11px] font-mono text-slate-400 select-none">
                        位置: <strong className="text-indigo-400">{currentFocusedIndex >= 0 ? currentFocusedIndex + 1 : 1}</strong> / {selectedModels.length} モデル
                      </span>
                    )}
                  </div>

                  {/* 下段: ウィジェット横幅をフル活用した左右移動ボタン ＆ 幅広モデルセレクタ */}
                  <div className="flex items-center space-x-1.5 w-full">
                    {/* 左移動ボタン */}
                    <button
                      type="button"
                      onClick={handlePrevModel}
                      disabled={selectedModels.length <= 1}
                      className={`p-2 rounded-lg border transition-all flex-shrink-0 ${
                        selectedModels.length > 1
                          ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border-slate-700 active:scale-95 shadow-sm cursor-pointer'
                          : 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed opacity-40'
                      }`}
                      title={
                        selectedModels.length > 1
                          ? `前のモデルへ (${
                              selectedModels[
                                (currentFocusedIndex - 1 + selectedModels.length) % selectedModels.length
                              ]?.name || ''
                            })`
                          : '複数モデル選択時に左右移動可能'
                      }
                      aria-label="前のモデルへ移動"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* モデル名表示部 (プルダウン切り替え) - flex-1 で横幅を最大活用 */}
                    <div className="relative flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedModels.length > 1) {
                            setIsDetailCardDropdownOpen((prev) => !prev);
                          }
                        }}
                        disabled={selectedModels.length <= 1}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                          selectedModels.length > 1
                            ? isDetailCardDropdownOpen
                              ? 'bg-indigo-900/60 border-indigo-500 text-white shadow ring-2 ring-indigo-500/30'
                              : 'bg-slate-800/90 hover:bg-slate-750 border-slate-700 text-white hover:border-slate-600 shadow-sm cursor-pointer'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 cursor-default'
                        }`}
                        aria-expanded={isDetailCardDropdownOpen}
                        aria-haspopup="listbox"
                        title={selectedModels.length > 1 ? 'クリックしてモデルを選択 (プルダウン)' : focusedModel.name}
                      >
                        <div className="flex items-center space-x-2 min-w-0 truncate pr-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: focusedModel.color }}
                          />
                          <span className="truncate font-bold text-slate-100">{focusedModel.name}</span>
                          {focusedModel.extended_capabilities?.tier && (
                            <span className="hidden sm:inline-block text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 font-mono flex-shrink-0">
                              {focusedModel.extended_capabilities.tier}
                            </span>
                          )}
                        </div>
                        {selectedModels.length > 1 && (
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ml-1.5 ${
                              isDetailCardDropdownOpen ? 'rotate-180 text-white' : ''
                            }`}
                          />
                        )}
                      </button>

                      {/* プルダウンメニュー */}
                      {isDetailCardDropdownOpen && selectedModels.length > 1 && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsDetailCardDropdownOpen(false)}
                            aria-hidden="true"
                          />
                          <div
                            className="absolute left-0 right-0 top-full mt-1.5 w-full min-w-[280px] max-h-80 overflow-y-auto bg-slate-900/98 border border-slate-700/90 rounded-xl shadow-2xl z-50 backdrop-blur-md p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150"
                            role="listbox"
                          >
                            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 flex items-center justify-between">
                              <span>選択中のモデル一覧 ({selectedModels.length})</span>
                              <span className="text-[10px] text-indigo-400 font-mono">
                                {currentFocusedIndex >= 0 ? currentFocusedIndex + 1 : 1} / {selectedModels.length}
                              </span>
                            </div>
                            {selectedModels.map((m) => {
                              const isCurrent = focusedModel.id === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setFocusedModelId(m.id);
                                    setIsDetailCardDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-all ${
                                    isCurrent
                                      ? 'bg-indigo-600/30 border border-indigo-500/60 text-white shadow-sm'
                                      : 'hover:bg-slate-800 text-slate-300 hover:text-white border border-transparent'
                                  }`}
                                  role="option"
                                  aria-selected={isCurrent}
                                >
                                  <div className="flex items-center space-x-2 min-w-0 pr-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: m.color }}
                                    />
                                    <div className="truncate">
                                      <div className="font-bold truncate text-slate-100">{m.name}</div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {m.vendor} {m.extended_capabilities?.tier ? `• ${m.extended_capabilities.tier}` : ''}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2 flex-shrink-0">
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px] font-black text-white"
                                      style={{ backgroundColor: m.color }}
                                    >
                                      {m.evaluation.grade}
                                    </span>
                                    {isCurrent && (
                                      <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 右移動ボタン */}
                    <button
                      type="button"
                      onClick={handleNextModel}
                      disabled={selectedModels.length <= 1}
                      className={`p-2 rounded-lg border transition-all flex-shrink-0 ${
                        selectedModels.length > 1
                          ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border-slate-700 active:scale-95 shadow-sm cursor-pointer'
                          : 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed opacity-40'
                      }`}
                      title={
                        selectedModels.length > 1
                          ? `次のモデルへ (${
                              selectedModels[
                                (currentFocusedIndex + 1) % selectedModels.length
                              ]?.name || ''
                            })`
                          : '複数モデル選択時に左右移動可能'
                      }
                      aria-label="次のモデルへ移動"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

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

                {/* GitHub Copilot 公式仕様・コスト単価 (Context Window & Pricing) */}
                <div className="mt-4 p-3.5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
                      <CreditCard className="w-4 h-4 text-indigo-400" />
                      <span>GitHub Copilot 公式仕様・コスト単価</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {focusedModel.extended_capabilities?.tier && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            focusedModel.extended_capabilities.tier === 'powerful'
                              ? 'bg-purple-950/80 text-purple-300 border-purple-700/60'
                              : focusedModel.extended_capabilities.tier === 'lightweight'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                              : 'bg-sky-950/80 text-sky-300 border-sky-700/60'
                          }`}
                        >
                          {focusedModel.extended_capabilities.tier.toUpperCase()} TIER
                        </span>
                      )}
                      {focusedModel.extended_capabilities?.release_status && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            focusedModel.extended_capabilities.release_status === 'ga'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                              : focusedModel.extended_capabilities.release_status === 'lts'
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60'
                              : focusedModel.extended_capabilities.release_status === 'preview'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          {focusedModel.extended_capabilities.release_status.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {/* コンテキスト長 */}
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                      <span className="text-[11px] text-slate-400 block">Context 窓容量</span>
                      <span className="text-sm font-mono font-bold text-white mt-1">
                        {focusedModel.raw_metrics.context_window_display || `${focusedModel.raw_metrics.context_window_k}K Tok`}
                      </span>
                      {focusedModel.extended_capabilities?.supports_1m_context ? (
                        <span className="text-[9px] text-indigo-300 font-semibold mt-0.5">✨ 最大 1M Tok</span>
                      ) : (
                        <span className="text-[9px] text-slate-500 mt-0.5">標準ウィンドウ</span>
                      )}
                    </div>

                    {/* Input 単価 */}
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                      <span className="text-[11px] text-slate-400 block">Input 単価 (/1M)</span>
                      <span className="text-sm font-mono font-bold text-emerald-400 mt-1">
                        ${focusedModel.raw_metrics.input_cost_per_m}
                      </span>
                      <span className="text-[9px] text-slate-500 mt-0.5">Base prompt</span>
                    </div>

                    {/* Output 単価 */}
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                      <span className="text-[11px] text-slate-400 block">Output 単価 (/1M)</span>
                      <span className="text-sm font-mono font-bold text-indigo-300 mt-1">
                        ${focusedModel.raw_metrics.output_cost_per_m}
                      </span>
                      <span className="text-[9px] text-slate-500 mt-0.5">Generation</span>
                    </div>

                    {/* キャッシュ読み取り単価 */}
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                      <span className="text-[11px] text-slate-400 block">Cache 読取 (/1M)</span>
                      <span className="text-sm font-mono font-bold text-cyan-300 mt-1">
                        ${focusedModel.raw_metrics.cached_input_cost_per_m ?? (focusedModel.raw_metrics.input_cost_per_m * 0.1).toFixed(2)}
                      </span>
                      {focusedModel.raw_metrics.cache_write_cost_per_m ? (
                        <span className="text-[9px] text-slate-400 mt-0.5">書込: ${focusedModel.raw_metrics.cache_write_cost_per_m}</span>
                      ) : (
                        <span className="text-[9px] text-cyan-500/80 mt-0.5">Prompt Caching</span>
                      )}
                    </div>
                  </div>

                  {/* Long Context 単価補足 (該当モデルのみ) */}
                  {focusedModel.raw_metrics.long_context_input_cost_per_m !== undefined && (
                    <div className="text-[11px] bg-indigo-950/30 border border-indigo-800/40 p-2 rounded-lg flex items-center justify-between text-indigo-200">
                      <span>超長文 (Long Context &gt; 200K) 課金:</span>
                      <span className="font-mono">
                        In: <strong>${focusedModel.raw_metrics.long_context_input_cost_per_m}</strong> / Out: <strong>${focusedModel.raw_metrics.long_context_output_cost_per_m}</strong> (/1M Tok)
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                    <span>※ 価格出典: GitHub Copilot 公式モデル価格表 (2026年最新)</span>
                    <a
                      href="https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                    >
                      <span>公式価格表を確認</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
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
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl flex-1 flex flex-col items-center justify-center text-center space-y-3 min-h-[400px]">
              <Sliders className="w-10 h-10 text-slate-600 animate-pulse" />
              <p className="text-sm font-bold text-slate-300">モデルが選択されていません</p>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                AIモデルを選択すると、ここに「詳細カード（総合スコア、適性タグ、推奨ユースケース、強み・弱み、現場の評判）」が表示されます。
              </p>
              <button
                onClick={handleSelectAllCopilot}
                className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
              >
                Copilot公式モデルを選択
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. 著名ベンチマーク生データ詳細比較テーブル */}
      <div id="radar-table" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl scroll-mt-20">
        <div className="flex flex-col space-y-3 border-b border-slate-800 pb-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              <span className="text-slate-400">表示件数:</span>
              <span className="font-mono font-bold text-indigo-300 bg-indigo-950/70 border border-indigo-700/60 px-2 py-0.5 rounded">
                {sortedModels.length} / {dataset.models.length} モデル
              </span>
            </div>
          </div>

          {/* メーカー & カテゴリ 絞り込みバー */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-1 text-xs">
            {/* メーカー絞り込み */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center space-x-1">
                <Building2 className="w-3 h-3 text-indigo-400" />
                <span>メーカー:</span>
              </span>
              {(['all', ...CANONICAL_VENDOR_ORDER] as const)
                .filter((v) => v === 'all' || v === 'Other' || dataset.models.some((m) => m.vendor === v))
                .map((v) => {
                  const label = v === 'all' ? 'すべて' : v === 'Other' ? 'その他' : v;
                  const isSelected = tableVendorFilter === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setTableVendorFilter(v)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
            </div>

            {/* カテゴリ絞り込み */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center space-x-1">
                <Tag className="w-3 h-3 text-purple-400" />
                <span>カテゴリ:</span>
              </span>
              {[
                { id: 'all', label: '全カテゴリ' },
                { id: 'powerful', label: '⚡ Powerful' },
                { id: 'versatile', label: '🛠️ Versatile' },
                { id: 'lightweight', label: '🚀 Lightweight' },
              ].map((t) => {
                const isSelected = tableTierFilter === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTableTierFilter(t.id)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ソート基準バー */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-400 mr-1 flex items-center space-x-1">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <span>ソート基準:</span>
            </span>
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
              onClick={() => handleSort('aime')}
              className={`px-2.5 py-1 rounded-md font-medium border ${
                sortKey === 'aime'
                  ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              AIME 2024
            </button>
            <button
              onClick={() => handleSort('arena')}
              className={`px-2.5 py-1 rounded-md font-medium border ${
                sortKey === 'arena'
                  ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              Arena Elo
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
              onClick={() => handleSort('context')}
              className={`px-2.5 py-1 rounded-md font-medium border ${
                sortKey === 'context'
                  ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              Context 窓
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
                <th
                  className="py-3 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors"
                  onClick={() => handleSort('model')}
                  title="モデル順ソート (クリックで巡回: デフォルト並び順 → 昇順 → 降順)"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>モデル / 仕様・Tier</span>
                    <ArrowUpDown
                      className={`w-3 h-3 ${sortKey === 'model' ? 'text-indigo-400' : 'text-slate-500'}`}
                    />
                    {sortKey === 'model' && (
                      <span className="text-[10px] font-mono font-normal px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
                        {modelSortMode === 'default'
                          ? 'デフォルト'
                          : modelSortMode === 'asc'
                          ? '昇順'
                          : '降順'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort('overall')}>
                  <div className="flex items-center space-x-1">
                    <span>総合 Grade</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortKey === 'overall' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort('usage')}>
                  <div className="flex items-center space-x-1">
                    <span>社内利用シェア</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortKey === 'usage' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort('swe')}>
                  <div className="flex items-center space-x-1">
                    <span>SWE-bench Verified</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortKey === 'swe' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort('aime')}>
                  <div className="flex items-center space-x-1">
                    <span>AIME 2024 / GPQA</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortKey === 'aime' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors"
                  onClick={() => handleSort('arena')}
                  title="Arena Coding Elo 順ソート"
                >
                  <div className="flex items-center space-x-1">
                    <span>Arena Coding Elo</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortKey === 'arena' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort('speed')}>
                  <div className="flex items-center space-x-1">
                    <span>速度 (TPS)</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortKey === 'speed' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort('cost')}>
                  <div className="flex items-center space-x-1">
                    <span>単価 ($/1M Tok)</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortKey === 'cost' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort('context')}>
                  <div className="flex items-center space-x-1">
                    <span>Context 窓</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortKey === 'context' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer select-none hover:text-slate-200 transition-colors"
                  onClick={() => handleSort('radar')}
                  title="レーダー表示中モデルでソート (選択中優先 ⇔ 非選択優先)"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>レーダー表示</span>
                    <ArrowUpDown
                      className={`w-3 h-3 ${sortKey === 'radar' ? 'text-indigo-400' : 'text-slate-500'}`}
                    />
                  </div>
                </th>
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
                          <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
                            <span>{m.vendor}</span>
                            <span>•</span>
                            {m.extended_capabilities?.tier && (
                              <span className={`px-1 py-0.2 rounded text-[9px] font-mono ${
                                m.extended_capabilities.tier === 'powerful'
                                  ? 'bg-purple-950/80 text-purple-300'
                                  : m.extended_capabilities.tier === 'lightweight'
                                  ? 'bg-emerald-950/80 text-emerald-300'
                                  : 'bg-sky-950/80 text-sky-300'
                              }`}>
                                {m.extended_capabilities.tier}
                              </span>
                            )}
                            {m.extended_capabilities?.release_status && (
                              <span className="text-[9px] text-slate-400 font-mono">
                                {m.extended_capabilities.release_status.toUpperCase()}
                              </span>
                            )}
                          </div>
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
                        <div className="flex flex-col min-w-[52px]">
                          <span className="font-mono text-slate-300 font-bold text-xs">
                            {m.evaluation.overall_score} pt
                          </span>
                          {maxMetrics && (
                            <div className="mt-1 h-[3px] rounded-full bg-slate-800 w-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${(m.evaluation.overall_score / maxMetrics.overall) * 100}%` }}
                              />
                            </div>
                          )}
                        </div>
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
                      <div className="flex flex-col min-w-[80px]">
                        <span className="font-bold text-slate-200 text-xs">
                          {m.raw_metrics.swe_bench_verified}%
                        </span>
                        {maxMetrics && (
                          <div className="mt-1 h-[3px] rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-violet-500"
                              style={{ width: `${(m.raw_metrics.swe_bench_verified / maxMetrics.swe) * 100}%` }}
                            />
                          </div>
                        )}
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          HumanEval+: {m.raw_metrics.humaneval_plus}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="flex flex-col min-w-[80px]">
                        <span className="font-bold text-slate-200 text-xs">
                          AIME: {m.raw_metrics.aime_2024}%
                        </span>
                        {maxMetrics && (
                          <div className="mt-1 h-[3px] rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500"
                              style={{ width: `${(m.raw_metrics.aime_2024 / maxMetrics.aime) * 100}%` }}
                            />
                          </div>
                        )}
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          GPQA: {m.raw_metrics.gpqa_diamond}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="flex flex-col min-w-[72px]">
                        <span className="font-bold text-indigo-300 text-xs">
                          {m.raw_metrics.arena_coding_elo}
                        </span>
                        {maxMetrics && (
                          <div className="mt-1 h-[3px] rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-sky-500"
                              style={{ width: `${(m.raw_metrics.arena_coding_elo / maxMetrics.arena_elo) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="flex flex-col min-w-[60px]">
                        <div className="flex items-center space-x-1">
                          <Gauge className="w-3 h-3 text-cyan-400" />
                          <span className="font-bold text-white text-xs">
                            {m.raw_metrics.output_speed_tps} tps
                          </span>
                        </div>
                        {maxMetrics && (
                          <div className="mt-1 h-[3px] rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-cyan-500"
                              style={{ width: `${(m.raw_metrics.output_speed_tps / maxMetrics.speed_tps) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-300">
                      <div className="flex flex-col min-w-[100px]">
                        <div className="flex items-center space-x-1 text-xs">
                          <span className="text-emerald-400">In: ${m.raw_metrics.input_cost_per_m}</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-indigo-300">Out: ${m.raw_metrics.output_cost_per_m}</span>
                        </div>
                        {maxMetrics && (
                          <div className="mt-1 h-[3px] rounded-full bg-slate-800 overflow-hidden" title="コスト効率 (高いほど安い)">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${(m.radar_scores.cost_efficiency / maxMetrics.cost_eff) * 100}%` }}
                            />
                          </div>
                        )}
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          Cache: ${m.raw_metrics.cached_input_cost_per_m ?? (m.raw_metrics.input_cost_per_m * 0.1).toFixed(2)}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <span>
                          {m.raw_metrics.context_window_display || (
                            m.raw_metrics.context_window_k >= 1000
                              ? `${m.raw_metrics.context_window_k / 1000}M Tok`
                              : `${m.raw_metrics.context_window_k}K Tok`
                          )}
                        </span>
                        {m.extended_capabilities?.supports_1m_context && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-mono">
                            1M
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleToggleModel(m.id)}
                        title={isSelected ? '選択解除' : 'レーダー追加'}
                        aria-label={isSelected ? '選択解除' : 'レーダー追加'}
                        className={`p-1.5 rounded-lg inline-flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white hover:bg-rose-600 border border-indigo-500/60 hover:border-rose-500 shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:bg-indigo-600 hover:text-white border border-slate-700/60'
                        }`}
                      >
                        {isSelected ? (
                          <Trash2 className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
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
      <div id="radar-sources" className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl scroll-mt-20">
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
              id={`source-${src.id}`}
              className={`p-4 bg-slate-950/70 rounded-xl border flex flex-col justify-between space-y-3.5 transition-all scroll-mt-24 ${
                highlightedSourceId === src.id
                  ? 'border-indigo-500 ring-2 ring-indigo-500/60 shadow-xl shadow-indigo-500/20 bg-slate-900'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
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

      {/* 5. GitHub Copilot 公式ドキュメント・仕様リファレンス引用カード */}
      <div id="radar-references" className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>GitHub Copilot 公式ドキュメント・仕様リファレンス引用</span>
          </div>
          <span className="text-[11px] text-slate-400">
            公式仕様・サポートモデル一覧・課金体系への直接リンク
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* 引用1: サポートモデル一覧 */}
          <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3 hover:border-indigo-500/40 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <h4 className="font-bold text-white text-sm">GitHub Copilot サポートAIモデル一覧</h4>
                </div>
                <a
                  href="https://docs.github.com/ja/copilot/reference/ai-models/supported-models"
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-colors flex items-center space-x-1"
                  title="公式ドキュメントを開く"
                >
                  <span className="text-[11px] font-semibold">公式Doc</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                GitHub Copilot のエージェントモード、コード補完、Chat で利用可能な各社（Anthropic, OpenAI, Google, Microsoft, DeepSeek, xAI, Moonshot AI）の全モデル一覧と、Tier分類（Powerful, Versatile, Lightweight）、提供ステータス（GA, LTS, Preview）の公式リファレンスです。
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-indigo-300/80 font-mono truncate">
              URL: https://docs.github.com/ja/copilot/reference/ai-models/supported-models
            </div>
          </div>

          {/* 引用2: モデル別課金・単価表 */}
          <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3 hover:border-indigo-500/40 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <h4 className="font-bold text-white text-sm">GitHub Copilot モデル別課金・単価表 (Models and Pricing)</h4>
                </div>
                <a
                  href="https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing"
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-colors flex items-center space-x-1"
                  title="公式価格表を開く"
                >
                  <span className="text-[11px] font-semibold">公式価格表</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                各モデルの 100万トークン（1M tokens）あたりの Input / Output 課金単価、Prompt Caching（キャッシュ読み取り・書き込み）割引単価、超長文コンテキスト（Long Context &gt; 128K/200K）価格体系、およびコンテキスト窓容量（128K〜1M）の公式料金規定です。
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-indigo-300/80 font-mono truncate">
              URL: https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

export default ModelRadarView;
