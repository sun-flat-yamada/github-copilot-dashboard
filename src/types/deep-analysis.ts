/**
 * Deep Analysis & Advanced Diagnostic Types (2026.09 Specification)
 */

import { UserUsageProfile, DataSourceType } from './copilot.js';

// ==========================================
// 1. Extensible Analysis Methods Architecture
// ==========================================

export type AnalysisMethodId =
  | 'inefficient_usage_diagnostic'
  | 'model_cost_efficiency'
  | 'prompt_churn_loop'
  | 'peer_gap_benchmark';

export interface AnalysisMethodDefinition {
  id: AnalysisMethodId;
  title: string;
  shortTitle: string;
  subtitle: string;
  category: 'behavioral' | 'cost' | 'quality' | 'team';
  status: 'active' | 'coming_soon';
  badge?: string;
  description: string;
}

// ==========================================
// 2. Period Scope & Filtering
// ==========================================

export type AnalysisPeriodScopeType = '30d' | 'today' | '7d' | 'custom';

export interface CustomDateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface DiagnosticPeriodInfo {
  scopeType: AnalysisPeriodScopeType;
  startDate: string;
  endDate: string;
  totalDays: number;
  activeDays: number;
  label: string;
}

// ==========================================
// 3. Inefficient Usage Patterns & Diagnostic
// ==========================================

export type InefficiencyPatternId =
  | 'tab_spamming_roulette'
  | 'overkill_model_addiction'
  | 'context_blind_chat_churn'
  | 'passive_seat_disengaged'
  | 'off_hours_workload_spike';

export type PatternRiskLevel = 'high' | 'medium' | 'low' | 'healthy';

export interface ContributingFactor {
  metricName: string;
  currentValueFormatted: string;
  recommendedThresholdFormatted: string;
  description: string;
  severity: 'danger' | 'warning' | 'neutral' | 'good';
}

export interface InefficiencyPatternResult {
  id: InefficiencyPatternId;
  name: string;
  nameEn: string;
  probabilityPercent: number; // 0 - 100%
  riskLevel: PatternRiskLevel;
  tagline: string;
  summary: string;
  contributingFactors: ContributingFactor[];
  recommendations: string[];
  isExpandedDefault?: boolean;
}

export interface PeerBenchmarkComparison {
  metricName: string;
  userValue: number;
  userFormatted: string;
  peerAverageValue: number;
  peerAverageFormatted: string;
  differenceFormatted: string;
  isPositiveForEfficiency: boolean;
}

export interface UserDiagnosticDrilldown {
  dailyActivity: {
    date: string;
    suggestions: number;
    acceptances: number;
    acceptanceRatePercent: number;
    chats: number;
    costUsd: number;
    modelBreakdown: Record<string, number>;
  }[];
  modelDistribution: {
    modelName: string;
    chatsCount: number;
    percentage: number;
    estimatedCostUsd: number;
  }[];
  peerBenchmarks: PeerBenchmarkComparison[];
}

export interface UserDiagnosticResult {
  user: UserUsageProfile;
  period: DiagnosticPeriodInfo;
  healthScore: number; // 0 - 100 (100 = 完全健全, 0 = 深刻な非効率)
  healthStatus: 'healthy' | 'warning' | 'critical';
  metricsSummary: {
    totalChats: number;
    totalSuggestions: number;
    totalAcceptances: number;
    acceptanceRatePercent: number;
    totalCostUsd: number;
    dailyAvgChats: number;
    dailyAvgSuggestions: number;
  };
  patterns: InefficiencyPatternResult[];
  drilldown: UserDiagnosticDrilldown;
}

// ==========================================
// 4. Archive & Multi-Source Context Types
// ==========================================

export interface DeepAnalysisArchive {
  month: string;
  generated_at: string;
  user_profiles: UserUsageProfile[];
}

export interface DeepAnalysisDataSourceInfo {
  sourceType: DataSourceType;
  label: string;
  isEstimated: boolean;
  isSynthesized?: boolean;
  details?: string;
  monthOrFileName?: string;
  totalUsers: number;
  filteredUsers: number;
}
