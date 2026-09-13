import React, { useState } from 'react';
import {
  Boxes,
  Building2,
  Tag,
  PanelLeftClose,
  PanelLeftOpen,
  Minimize2,
  Maximize2,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import {
  BenchmarkDataset,
  ModelBenchmarkProfile,
  CANONICAL_VENDOR_ORDER,
} from '../../../src/types/model-benchmark';
import { ModelUsageStat, PRESETS } from './ModelRadarView';

export type SidebarDisplayMode = 'expanded' | 'compact' | 'collapsed';

export interface ModelSelectorSidebarProps {
  dataset: BenchmarkDataset;
  selectedModelIds: string[];
  focusedModelId: string;
  usageStats: Record<string, ModelUsageStat>;
  sidebarMode: SidebarDisplayMode;
  onSidebarModeChange: (mode: SidebarDisplayMode) => void;
  onToggleModel: (modelId: string) => void;
  onBatchSelectModels: (modelIds: string[], select: boolean) => void;
  onSelectAllCopilot: () => void;
  onClearSelection: () => void;
  onApplyPreset?: (modelIds: string[]) => void;
  groupingMode: 'vendor' | 'category';
  onGroupingModeChange: (mode: 'vendor' | 'category') => void;
  selectedVendorFilter: string;
  onVendorFilterChange: (vendor: string) => void;
  selectedTierFilter: string;
  onTierFilterChange: (tier: string) => void;
}

/**
 * AIモデルの省幅表示用略称を生成
 * ルール: モデル派閥（gpt, opus, sonnet, fable, haiku, gemini, mai, grok, kimi, deepseek等）と
 * バージョンを示す番号（5.6, 6, 5, 4.8, 3.8等）は必ず省略せず含める。
 * ex. gpt-5.6-luna, gpt-6-astra, opus-5, sonnet-4.5
 */
export function getModelShortName(model: { id: string; name: string }): string {
  const id = model.id.toLowerCase();

  // 1. Anthropic Claude ファミリ: 派閥（opus/sonnet/fable/haiku）+ バージョン番号
  if (id === 'claude-opus-5') return 'opus-5';
  if (id === 'claude-opus-4-8') return 'opus-4.8';
  if (id === 'claude-opus-4-8-fast') return 'opus-4.8 (fast)';
  if (id === 'claude-opus-4-7') return 'opus-4.7';

  if (id === 'claude-sonnet-5') return 'sonnet-5';
  if (id === 'claude-sonnet-4-6') return 'sonnet-4.6';
  if (id === 'claude-sonnet-4') return 'sonnet-4';
  if (id === 'claude-3-7-sonnet') return 'sonnet-3.7';
  if (id === 'claude-3-5-sonnet') return 'sonnet-3.5';

  if (id === 'claude-fable-5-1') return 'fable-5.1';
  if (id === 'claude-fable-5') return 'fable-5';

  if (id === 'claude-haiku-4-5') return 'haiku-4.5';

  // 2. OpenAI GPT ファミリ: gpt + バージョン番号 + サブネーム
  if (id === 'gpt-6-astra') return 'gpt-6-astra';
  if (id === 'gpt-5-6-sol') return 'gpt-5.6-sol';
  if (id === 'gpt-5-6-terra') return 'gpt-5.6-terra';
  if (id === 'gpt-5-6-luna') return 'gpt-5.6-luna';
  if (id === 'gpt-5-5') return 'gpt-5.5';
  if (id === 'gpt-5-4') return 'gpt-5.4';
  if (id === 'gpt-5-4-mini') return 'gpt-5.4-mini';
  if (id === 'gpt-5-4-nano') return 'gpt-5.4-nano';
  if (id === 'gpt-5-3-codex') return 'gpt-5.3-codex';
  if (id === 'gpt-5-mini') return 'gpt-5-mini';
  if (id === 'gpt-4o') return 'gpt-4o';
  if (id === 'gpt-4o-mini') return 'gpt-4o-mini';
  if (id === 'o1') return 'gpt-o1';
  if (id === 'o3-mini') return 'gpt-o3-mini';

  // 3. Google Gemini ファミリ: gemini + バージョン番号 (+ エディション)
  if (id === 'gemini-3-8-flash') return 'gemini-3.8-flash';
  if (id === 'gemini-3-7-flash') return 'gemini-3.7-flash';
  if (id === 'gemini-3-6-flash') return 'gemini-3.6-flash';
  if (id === 'gemini-3-5-flash') return 'gemini-3.5-flash';
  if (id === 'gemini-2-5-pro') return 'gemini-2.5-pro';
  if (id === 'gemini-2-0-flash') return 'gemini-2.0-flash';

  // 4. その他の派閥: mai, grok, kimi, deepseek
  if (id === 'mai-code-1-1-flash') return 'mai-1.1-flash';
  if (id === 'grok-4-6') return 'grok-4.6';
  if (id === 'grok-4-5') return 'grok-4.5';
  if (id === 'kimi-k3') return 'kimi-k3';
  if (id === 'kimi-k2-7-code') return 'kimi-k2.7';
  if (id === 'deepseek-r1') return 'deepseek-r1';

  // 汎用フォールバック (Claudeプレフィックスのみ除去し、派閥名とバージョン番号を温存)
  let short = model.name
    .replace(/^Claude\s+/i, '')
    .replace(/^OpenAI\s+/i, '')
    .replace(/\s*\(.*?\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  return short || model.id;
}

const vendorIcons: Record<string, string> = {
  'Anthropic': '🟠',
  'OpenAI': '🟢',
  'Google': '🔵',
  'Microsoft': '🟣',
  'Microsoft (External)': '🟣',
  'DeepSeek': '🔍',
  'xAI': '⚡',
  'Moonshot AI': '🌙',
  'Other': '📦',
};

const tierOrder = ['powerful', 'versatile', 'lightweight', '_none'] as const;
const tierMeta: Record<string, { label: string; shortLabel: string; icon: string; badgeColor: string; cardBg: string; desc: string }> = {
  'powerful': {
    label: 'Powerful (最上位推論・深層アーキテクチャ設計)',
    shortLabel: 'Powerful',
    icon: '⚡',
    badgeColor: 'text-amber-300 bg-amber-950/60 border-amber-700/50',
    cardBg: 'border-amber-900/40 bg-amber-950/10',
    desc: '最高難度のバグ修正・アルゴリズム開発・高難度障害解析向け',
  },
  'versatile': {
    label: 'Versatile (実務開発・標準コーディング・バランス)',
    shortLabel: 'Versatile',
    icon: '🛠️',
    badgeColor: 'text-sky-300 bg-sky-950/60 border-sky-700/50',
    cardBg: 'border-sky-900/40 bg-sky-950/10',
    desc: '日々の開発・機能実装・対話型ペアプログラミング向け',
  },
  'lightweight': {
    label: 'Lightweight (超高速・低コスト日常補完)',
    shortLabel: 'Lightweight',
    icon: '🚀',
    badgeColor: 'text-emerald-300 bg-emerald-950/60 border-emerald-700/50',
    cardBg: 'border-emerald-900/40 bg-emerald-950/10',
    desc: 'インライン補完・定型テスト生成・高速タイピング追従向け',
  },
  '_none': {
    label: 'その他 / クラシックモデル',
    shortLabel: 'その他',
    icon: '📦',
    badgeColor: 'text-slate-400 bg-slate-900 border-slate-700',
    cardBg: 'border-slate-800/60 bg-slate-900/20',
    desc: '以前の世代のモデルまたは対照ベンチマークモデル',
  },
};

export const ModelSelectorSidebar: React.FC<ModelSelectorSidebarProps> = ({
  dataset,
  selectedModelIds,
  focusedModelId,
  usageStats,
  sidebarMode,
  onSidebarModeChange,
  onToggleModel,
  onBatchSelectModels,
  onSelectAllCopilot,
  onClearSelection,
  onApplyPreset,
  groupingMode,
  onGroupingModeChange,
  selectedVendorFilter,
  onVendorFilterChange,
  selectedTierFilter,
  onTierFilterChange,
}) => {
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);

  // フィルタの適用
  let filtered = dataset.models;
  if (selectedVendorFilter !== 'all') {
    if (selectedVendorFilter === 'Other') {
      const standardVendors = (CANONICAL_VENDOR_ORDER as readonly string[]).filter((x) => x !== 'Other');
      filtered = filtered.filter((m) => !standardVendors.includes(m.vendor));
    } else {
      filtered = filtered.filter((m) => m.vendor === selectedVendorFilter);
    }
  }
  if (selectedTierFilter !== 'all') {
    filtered = filtered.filter((m) => {
      const t = (m.extended_capabilities?.tier || m.capabilities?.tier || '').toLowerCase();
      return t === selectedTierFilter;
    });
  }

  // 1. 非表示モード (collapsed)
  if (sidebarMode === 'collapsed') {
    return (
      <div className="sticky top-20 z-30 flex-shrink-0 self-start">
        <div className="bg-slate-900/95 border border-slate-800 hover:border-indigo-500/60 rounded-xl shadow-xl backdrop-blur p-2 flex flex-col items-center space-y-2.5 transition-all">
          <button
            onClick={() => onSidebarModeChange('expanded')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/30 transition-all group"
            title="AIモデル選択フレームを展開 (表示)"
            aria-label="AIモデル選択フレームを展開"
          >
            <PanelLeftOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="tracking-wider">
              モデル選択
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-950 text-indigo-200 text-[10px] font-mono font-extrabold border border-indigo-700">
              {selectedModelIds.length}
            </span>
          </button>

          <div className="flex flex-col items-center space-y-1 pt-1 border-t border-slate-800 w-full">
            <button
              onClick={() => onSidebarModeChange('compact')}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] transition-colors"
              title="省幅表示で展開"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSidebarModeChange('expanded')}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] transition-colors"
              title="通常表示で展開"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isCompact = sidebarMode === 'compact';

  // 共通チップレンダラー
  const renderChip = (model: ModelBenchmarkProfile) => {
    const isSelected = selectedModelIds.includes(model.id);
    const isFocused = focusedModelId === model.id;
    const usage = usageStats[model.id] || { requests: 0, percentage: 0, hasUsage: false };
    const shortName = getModelShortName(model);

    // フル名称・属性のツールチップ情報
    const tooltipText = `${model.name} (${model.vendor})
Tier: ${(model.extended_capabilities?.tier || model.capabilities?.tier || '標準').toUpperCase()}
総合スコア: ${model.evaluation.overall_score}点 (${model.evaluation.grade})
社内利用シェア: ${usage.percentage}% (${usage.requests.toLocaleString()} 回)${usage.hasUsage ? '' : ' - 未利用'}`;

    if (isCompact) {
      // 省幅表示: 略称 + ドット + チェックマーク、ホバーで詳細ツールチップ
      return (
        <button
          key={model.id}
          onClick={() => onToggleModel(model.id)}
          className={`group relative inline-flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-xs transition-all border ${
            isSelected
              ? 'border-indigo-500/80 text-white shadow-sm'
              : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          } ${isFocused && isSelected ? 'ring-1 ring-indigo-400 ring-offset-1 ring-offset-slate-900' : ''}`}
          style={{
            backgroundColor: isSelected ? `${model.color}22` : undefined,
          }}
          title={tooltipText}
        >
          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
              style={{ backgroundColor: model.color }}
            />
            <span className="font-mono font-medium truncate text-[11px] text-slate-200 group-hover:text-white">
              {shortName}
            </span>
          </div>

          <div className="flex items-center space-x-1 flex-shrink-0 ml-1">
            {usage.hasUsage && (
              <span className="text-[9px] font-mono text-emerald-400 font-bold leading-none">
                {usage.percentage}%
              </span>
            )}
            {isSelected && (
              <span className="text-[10px] font-bold text-indigo-300">✓</span>
            )}
          </div>
        </button>
      );
    }

    // 通常表示 (expanded): フル名称 + Copilotバッジ + 利用シェア%
    return (
      <button
        key={model.id}
        onClick={() => onToggleModel(model.id)}
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border text-left ${
          isSelected
            ? 'border-indigo-500/80 text-white shadow-sm'
            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
        } ${isFocused && isSelected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900' : ''}`}
        style={{
          backgroundColor: isSelected ? `${model.color}25` : undefined,
        }}
        title={tooltipText}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: model.color }}
        />
        <span className="font-medium truncate">{model.name}</span>
        {model.is_copilot_native && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono leading-none">
            Copilot
          </span>
        )}
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded leading-none ${
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
  };

  // グループ化ロジック (vendor または category)
  const renderGroupedModels = () => {
    if (filtered.length === 0) {
      return (
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
          該当するモデルがありません。
        </div>
      );
    }

    if (groupingMode === 'vendor') {
      const grouped = new Map<string, ModelBenchmarkProfile[]>();
      for (const model of filtered) {
        const v = model.vendor || 'Other';
        if (!grouped.has(v)) grouped.set(v, []);
        grouped.get(v)!.push(model);
      }

      const sortedVendors = (CANONICAL_VENDOR_ORDER as readonly string[]).filter((v) => grouped.has(v));
      for (const v of grouped.keys()) {
        if (!sortedVendors.includes(v)) sortedVendors.push(v);
      }

      return sortedVendors.map((vendor) => {
        const models = grouped.get(vendor)!;

        // Tier でサブグループ化
        const byTier = new Map<string, ModelBenchmarkProfile[]>();
        for (const m of models) {
          const t = (m.extended_capabilities?.tier || m.capabilities?.tier || '').toLowerCase() || '_none';
          if (!byTier.has(t)) byTier.set(t, []);
          byTier.get(t)!.push(m);
        }
        for (const arr of byTier.values()) {
          arr.sort((a, b) => b.evaluation.overall_score - a.evaluation.overall_score);
        }

        const sortedTiers = tierOrder.filter((t) => byTier.has(t));
        const showTierHeaders = !isCompact && (sortedTiers.length > 1 || (sortedTiers.length === 1 && sortedTiers[0] !== '_none'));

        return (
          <div key={vendor} className="bg-slate-900/40 rounded-xl border border-slate-800/60 p-2.5 space-y-2">
            {/* ベンダー見出し */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 min-w-0">
                <span className="text-xs">{vendorIcons[vendor] || '📦'}</span>
                <span className="text-xs font-bold text-slate-200 truncate">{vendor}</span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1 py-0.2 rounded border border-slate-800">
                  {models.length}
                </span>
              </div>
              {!isCompact && (
                <button
                  onClick={() => {
                    const vendorIds = models.map((m) => m.id);
                    const allSelected = vendorIds.every((id) => selectedModelIds.includes(id));
                    onBatchSelectModels(vendorIds, !allSelected);
                  }}
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-all"
                >
                  {models.every((m) => selectedModelIds.includes(m.id)) ? '全解除' : '全選択'}
                </button>
              )}
            </div>

            {/* Tier サブグループ */}
            {sortedTiers.map((tierKey) => {
              const tierModels = byTier.get(tierKey);
              if (!tierModels || tierModels.length === 0) return null;
              const meta = tierMeta[tierKey] || tierMeta['_none'];

              return (
                <div key={tierKey} className="space-y-1">
                  {showTierHeaders && tierKey !== '_none' && (
                    <div className="flex items-center space-x-1 ml-0.5">
                      <span className={`text-[8px] font-bold uppercase px-1 py-0.2 rounded border ${meta.badgeColor}`}>
                        {meta.icon} {tierKey.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className={isCompact ? 'flex flex-col space-y-1' : 'flex flex-wrap items-center gap-1.5'}>
                    {tierModels.map((model) => renderChip(model))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      });
    }

    // カテゴリ別グループ表示
    const groupedByTier = new Map<string, ModelBenchmarkProfile[]>();
    for (const model of filtered) {
      const t = (model.extended_capabilities?.tier || model.capabilities?.tier || '').toLowerCase() || '_none';
      if (!groupedByTier.has(t)) groupedByTier.set(t, []);
      groupedByTier.get(t)!.push(model);
    }

    const sortedTiers = tierOrder.filter((t) => groupedByTier.has(t));

    return sortedTiers.map((tierKey) => {
      const models = groupedByTier.get(tierKey)!;
      const meta = tierMeta[tierKey] || tierMeta['_none'];

      // ベンダーでサブグループ化
      const byVendor = new Map<string, ModelBenchmarkProfile[]>();
      for (const m of models) {
        const v = m.vendor || 'Other';
        if (!byVendor.has(v)) byVendor.set(v, []);
        byVendor.get(v)!.push(m);
      }
      for (const arr of byVendor.values()) {
        arr.sort((a, b) => b.evaluation.overall_score - a.evaluation.overall_score);
      }

      const sortedVendors = (CANONICAL_VENDOR_ORDER as readonly string[]).filter((v) => byVendor.has(v));
      for (const v of byVendor.keys()) {
        if (!sortedVendors.includes(v)) sortedVendors.push(v);
      }

      return (
        <div key={tierKey} className={`rounded-xl border p-2.5 space-y-2 ${meta.cardBg}`}>
          {/* カテゴリ見出し */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className="text-xs">{meta.icon}</span>
              <span className="text-xs font-bold text-slate-100 truncate">
                {isCompact ? meta.shortLabel : meta.label}
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1 py-0.2 rounded border border-slate-800">
                {models.length}
              </span>
            </div>
            {!isCompact && (
              <button
                onClick={() => {
                  const tierIds = models.map((m) => m.id);
                  const allSelected = tierIds.every((id) => selectedModelIds.includes(id));
                  onBatchSelectModels(tierIds, !allSelected);
                }}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all"
              >
                {models.every((m) => selectedModelIds.includes(m.id)) ? '全解除' : '全選択'}
              </button>
            )}
          </div>

          {/* ベンダー別サブグループ */}
          {sortedVendors.map((vendor) => {
            const vendorModels = byVendor.get(vendor);
            if (!vendorModels || vendorModels.length === 0) return null;

            return (
              <div key={vendor} className="space-y-1">
                {!isCompact && (
                  <div className="flex items-center space-x-1 ml-0.5">
                    <span className="text-[10px]">{vendorIcons[vendor] || '📦'}</span>
                    <span className="text-[10px] font-semibold text-slate-400">{vendor}</span>
                  </div>
                )}
                <div className={isCompact ? 'flex flex-col space-y-1' : 'flex flex-wrap items-center gap-1.5'}>
                  {vendorModels.map((model) => renderChip(model))}
                </div>
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <aside
      className={`sticky top-20 z-30 flex-shrink-0 self-start transition-all duration-300 max-h-[calc(100vh-5.5rem)] flex flex-col bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur overflow-hidden ${
        isCompact ? 'w-52 sm:w-56' : 'w-72 sm:w-80 xl:w-84'
      }`}
    >
      {/* 1. サイドバー最上部ヘッダー: タイトル & 3段階モード切り替え */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800/90 flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 min-w-0">
            <Boxes className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span className="text-xs font-bold text-white tracking-wide truncate">
              AIモデル選択
            </span>
            <span
              className="text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/80"
              title={`選択中: ${selectedModelIds.length} / 全${dataset.models.length}モデル`}
            >
              {selectedModelIds.length}/{dataset.models.length}
            </span>
          </div>

          {/* 3段階表示切り替え (表示 / 省幅 / 非表示) */}
          <div className="inline-flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[10px]">
            <button
              onClick={() => onSidebarModeChange('expanded')}
              className={`px-1.5 py-0.5 rounded font-bold transition-all flex items-center space-x-1 ${
                sidebarMode === 'expanded'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="表示 (通常幅・フル名称表示)"
            >
              <Maximize2 className="w-3 h-3" />
              <span className="hidden sm:inline">表示</span>
            </button>
            <button
              onClick={() => onSidebarModeChange('compact')}
              className={`px-1.5 py-0.5 rounded font-bold transition-all flex items-center space-x-1 ${
                sidebarMode === 'compact'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="省幅表示 (略称表示・ホバーでフル名称)"
            >
              <Minimize2 className="w-3 h-3" />
              <span className="hidden sm:inline">省幅</span>
            </button>
            <button
              onClick={() => onSidebarModeChange('collapsed')}
              className="p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"
              title="非表示 (折りたたみ)"
            >
              <PanelLeftClose className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* クイック一括アクションバー */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <button
            onClick={onSelectAllCopilot}
            className="flex-1 px-2 py-1 text-[10px] font-semibold rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 transition-all text-center truncate"
            title="GitHub Copilot公式提供の全モデルを一括選択"
          >
            {isCompact ? '公式全選択' : 'Copilot公式全選択'}
          </button>
          <button
            onClick={onClearSelection}
            className="px-2 py-1 text-[10px] font-medium rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all"
            title="全モデルの選択を解除"
          >
            クリア
          </button>

          {/* プリセットのクイックアクセス */}
          {onApplyPreset && (
            <div className="relative">
              <button
                onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                className="px-2 py-1 text-[10px] font-medium rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all flex items-center space-x-1"
                title="プリセット選択メニュー"
              >
                <Sliders className="w-2.5 h-2.5 text-indigo-400" />
                {!isCompact && <span>プリセット</span>}
                <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
              </button>

              {isPresetDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1">
                    比較プリセット適用
                  </div>
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onApplyPreset(p.modelIds);
                        setIsPresetDropdownOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors truncate"
                      title={p.description}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 通常表示時の整理モード切り替え */}
        {!isCompact && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/70 text-[11px]">
            <span className="text-slate-400 text-[10px] font-semibold">分類軸:</span>
            <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[10px]">
              <button
                onClick={() => onGroupingModeChange('vendor')}
                className={`px-2 py-0.5 rounded font-semibold transition-all flex items-center space-x-1 ${
                  groupingMode === 'vendor'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="メーカー/ベンダーごとに整理"
              >
                <Building2 className="w-2.5 h-2.5" />
                <span>メーカー別</span>
              </button>
              <button
                onClick={() => onGroupingModeChange('category')}
                className={`px-2 py-0.5 rounded font-semibold transition-all flex items-center space-x-1 ${
                  groupingMode === 'category'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tierカテゴリごとに整理"
              >
                <Tag className="w-2.5 h-2.5" />
                <span>Tier別</span>
              </button>
            </div>
          </div>
        )}

        {/* 通常表示時のメーカー & Tier 絞り込みセレクタ */}
        {!isCompact && (
          <div className="flex flex-col space-y-1.5 pt-1.5 border-t border-slate-800/60 text-[10px]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-slate-400 font-medium">メーカー:</span>
              <select
                value={selectedVendorFilter}
                onChange={(e) => onVendorFilterChange(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-[10px] focus:outline-none focus:border-indigo-500 max-w-[150px]"
              >
                <option value="all">全メーカー ({dataset.models.length})</option>
                {CANONICAL_VENDOR_ORDER.filter((v) => v === 'Other' || dataset.models.some((m) => m.vendor === v)).map((v) => (
                  <option key={v} value={v}>
                    {v === 'Other' ? 'その他' : v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-slate-400 font-medium">Tier:</span>
              <select
                value={selectedTierFilter}
                onChange={(e) => onTierFilterChange(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-[10px] focus:outline-none focus:border-indigo-500 max-w-[150px]"
              >
                <option value="all">全カテゴリ (Tier)</option>
                <option value="powerful">Powerful (最上位推論)</option>
                <option value="versatile">Versatile (実務標準)</option>
                <option value="lightweight">Lightweight (高速)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 2. モデル一覧スクロール領域 (独立スクロール) */}
      <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-12rem)] scrollbar-thin scrollbar-thumb-slate-700">
        {renderGroupedModels()}
      </div>

      {/* 3. 最下部フッター: 注釈 */}
      <div className="p-2 bg-slate-950/70 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
        {isCompact ? (
          <span>ホバーでフル情報</span>
        ) : (
          <span>未利用モデルも0%で選択可能</span>
        )}
      </div>
    </aside>
  );
};
