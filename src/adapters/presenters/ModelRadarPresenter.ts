import {
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
} from '../../domain/entities/copilot.js';
import {
  BenchmarkDataset,
  ModelBenchmarkProfile,
} from '../../domain/entities/model-benchmark.js';

export interface ModelRadarAxisItem {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
}

export interface ModelRadarModelSummary {
  id: string;
  name: string;
  vendor: string;
  color: string;
  isCopilotNative: boolean;
  overallScore: number;
  grade: string;
  strengths: string[];
}

export interface ModelRadarChartRow {
  axis: string;
  axisKey: string;
  [modelId: string]: any;
}

export interface ModelRadarViewModel {
  hasData: boolean;
  availableModels: { id: string; name: string; vendor: string; color: string; isCopilotNative: boolean }[];
  selectedModelIds: string[];
  topUsedModels: string[];
  axes: ModelRadarAxisItem[];
  radarChartData: ModelRadarChartRow[];
  modelSummaries: ModelRadarModelSummary[];
}

export interface ModelRadarPresenterInput {
  benchmarkData?: BenchmarkDataset | null;
  currentData?: ScopeAggregatedData | null;
  currentReportData?: MonthlyReportAggregatedData | null;
  selectedModelIds?: string[];
}

export class ModelRadarPresenter {
  public static present(input: ModelRadarPresenterInput): ModelRadarViewModel {
    const { benchmarkData, currentData, currentReportData, selectedModelIds } = input;

    if (!benchmarkData || !benchmarkData.models || benchmarkData.models.length === 0) {
      return {
        hasData: false,
        availableModels: [],
        selectedModelIds: [],
        topUsedModels: [],
        axes: [],
        radarChartData: [],
        modelSummaries: [],
      };
    }

    const allModels: ModelBenchmarkProfile[] = benchmarkData.models;

    // 1. Determine top used models from currentData or currentReportData
    const modelUsageCounts = new Map<string, number>();

    if (currentData?.user_profiles) {
      for (const profile of currentData.user_profiles) {
        if (profile.model_usage_totals) {
          for (const [m, count] of Object.entries(profile.model_usage_totals)) {
            const numericCount = typeof count === 'number' ? count : 0;
            modelUsageCounts.set(m, (modelUsageCounts.get(m) || 0) + numericCount);
          }
        }
      }
    } else if (currentReportData?.model_breakdown) {
      for (const b of currentReportData.model_breakdown) {
        modelUsageCounts.set(b.model_name, (modelUsageCounts.get(b.model_name) || 0) + (b.total_requests || 0));
      }
    }

    const topUsedModels = Array.from(modelUsageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m)
      .slice(0, 3);

    // 2. Determine which models are selected
    let effectiveSelectedModelIds: string[] = [];
    if (selectedModelIds && selectedModelIds.length > 0) {
      effectiveSelectedModelIds = selectedModelIds.filter((id) => allModels.some((m) => m.id === id));
    }

    if (effectiveSelectedModelIds.length === 0) {
      // Pick matching topUsedModels or fallback to first 3 models
      const matchedTop = topUsedModels.filter((id) => allModels.some((m) => m.id === id));
      if (matchedTop.length > 0) {
        effectiveSelectedModelIds = matchedTop;
      } else {
        effectiveSelectedModelIds = allModels.slice(0, 3).map((m) => m.id);
      }
    }

    // 3. Axes
    const axes: ModelRadarAxisItem[] = (benchmarkData.axis_definitions || []).map((ax) => ({
      key: ax.key,
      label: ax.label,
      shortLabel: ax.shortLabel,
      description: ax.description,
    }));

    // 4. Radar Chart Data
    const selectedProfiles = allModels.filter((m) => effectiveSelectedModelIds.includes(m.id));
    const radarChartData: ModelRadarChartRow[] = axes.map((ax) => {
      const row: ModelRadarChartRow = {
        axis: ax.shortLabel || ax.label,
        axisKey: ax.key,
      };

      for (const profile of selectedProfiles) {
        const scores = profile.radar_scores as any;
        row[profile.id] = scores ? scores[ax.key] || 0 : 0;
      }

      return row;
    });

    // 5. Model summaries
    const modelSummaries: ModelRadarModelSummary[] = selectedProfiles.map((m) => ({
      id: m.id,
      name: m.name,
      vendor: m.vendor,
      color: m.color,
      isCopilotNative: m.is_copilot_native,
      overallScore: m.evaluation?.overall_score || 0,
      grade: m.evaluation?.grade || 'A',
      strengths: m.evaluation?.strengths || [],
    }));

    return {
      hasData: true,
      availableModels: allModels.map((m) => ({
        id: m.id,
        name: m.name,
        vendor: m.vendor,
        color: m.color,
        isCopilotNative: m.is_copilot_native,
      })),
      selectedModelIds: effectiveSelectedModelIds,
      topUsedModels,
      axes,
      radarChartData,
      modelSummaries,
    };
  }
}
