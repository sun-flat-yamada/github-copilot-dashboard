import { BenchmarkDataset } from '../../../../src/types/model-benchmark';
import {
  ScopeAggregatedData,
  MonthlyReportAggregatedData,
} from '../../../../src/types/copilot';
import { normalizeModelId } from '../../../../src/processor/benchmark-evaluator';

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

// 選択モデルごとのレーダーカラー定義 (最大4モデル)
export const MODEL_RADAR_COLORS = [
  { stroke: '#a855f7', fill: '#a855f7', name: 'Purple (第1モデル)' },
  { stroke: '#3b82f6', fill: '#3b82f6', name: 'Blue (第2モデル)' },
  { stroke: '#10b981', fill: '#10b981', name: 'Emerald (第3モデル)' },
  { stroke: '#f59e0b', fill: '#f59e0b', name: 'Amber (第4モデル)' },
];
