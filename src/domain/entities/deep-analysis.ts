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
  | 'off_hours_workload_spike'
  | 'credit_burn_overdrive'
  | 'agent_abandonment'
  | 'model_cost_mismatch'
  | 'review_bypass';

export type PatternRiskLevel = 'high' | 'medium' | 'low' | 'healthy';

export interface ContributingFactor {
  metricName: string;
  currentValueFormatted: string;
  recommendedThresholdFormatted: string;
  description: string;
  severity: 'danger' | 'warning' | 'neutral' | 'good';
}

/** Signal strength band. 'unknown' = not evaluated (insufficient data), never "no signal". */
export type SignalBand = 'none' | 'weak' | 'medium' | 'strong' | 'unknown';

/** One transparent rule: the input value, the threshold, and why it matters. */
export interface SignalRuleEvidence {
  /** Input metric name */
  input: string;
  /** Observed value (formatted) */
  value: string;
  /** Threshold the value is compared with (formatted) */
  threshold: string;
  /** Rationale of the rule */
  rationale: string;
  /** met = the rule contributes to the signal, not_met = it does not, reference = informational only */
  status: 'met' | 'not_met' | 'reference';
}

/** Why a pattern was (not) evaluated, with the sample it saw and the minimum it needed. */
export interface DataSufficiency {
  sufficient: boolean;
  /** Reason shown when insufficient */
  reason?: string;
  /** Each requirement: name, observed, required */
  checks: { name: string; observed: number; required: number; met: boolean }[];
}

/** Calibration status of the signal rules (SDD-11 §4.6). */
export interface DiagnosticCalibration {
  status: 'uncalibrated' | 'calibrated';
  note: string;
}

export interface InefficiencyPatternResult {
  id: InefficiencyPatternId;
  name: string;
  nameEn: string;
  /**
   * @deprecated Same value as `signalStrengthPercent`. It is a heuristic rule score, not a probability.
   * Kept for compatibility; new code must use `signalStrengthPercent`.
   */
  probabilityPercent: number; // 0 - 100
  /** Signal strength 0 - 100 (heuristic rule score, NOT a probability). Meaningless when evaluable === false. */
  signalStrengthPercent?: number;
  signalBand?: SignalBand;
  /** Transparent rules: input value / threshold / rationale */
  evidence?: SignalRuleEvidence[];
  dataSufficiency?: DataSufficiency;
  /**
   * false のとき、判定に必要な実測値が揃っておらず評価できていない (probabilityPercent は意味を持たない)。
   * 固定値や推定値で埋めて「兆候なし」と見せかけない。省略時は評価済み。
   */
  evaluable?: boolean;
  /** evaluable = false の理由 (例: 「Agent の完了セッション数が取得できていません」) */
  insufficientDataReason?: string;
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
  calibration?: DiagnosticCalibration;
  /**
   * 判定に必要な実測値が揃い、評価できたパターン数 (evaluable !== false)。
   * healthScore は評価できたパターンだけから算出する参考値のため、0 のときはスコアを表示してはならない
   * (全パターンが判定不能なのに「健全 100 点」と見せかけない)。
   */
  evaluatedPatternCount: number;
  /** 診断対象のパターン総数 */
  patternCount: number;
  drilldown: UserDiagnosticDrilldown;
}

// ==========================================
// 4. Archive & Multi-Source Context Types
// ==========================================

export interface DeepAnalysisArchive {
  month: string;
  generated_at: string;
  user_profiles: UserUsageProfile[];
  credits_summary?: Record<string, unknown>;
  agent_summary?: Record<string, unknown>;
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

// ==========================================
// 5. Team-level diagnostic (default view)
// ==========================================

export interface TeamPatternSummary {
  id: InefficiencyPatternId;
  name: string;
  nameEn: string;
  /** Members whose pattern could be evaluated */
  evaluatedMembers: number;
  /** Members not evaluable for this pattern (insufficient data) */
  notEvaluableMembers: number;
  /** Count of members per signal band. null when suppressed (fewer evaluated members than the minimum team size) */
  distribution: { none: number; weak: number; medium: number; strong: number } | null;
  /** Percent of evaluated members with a medium or strong signal. null when suppressed */
  flaggedSharePercent: number | null;
  /** Reason when suppressed */
  suppressedReason?: string;
}

/** Team-level result. Never contains a login, name or per-person value. */
export interface TeamDiagnosticResult {
  period: DiagnosticPeriodInfo;
  memberCount: number;
  minTeamSize: number;
  /** false when the team is smaller than the minimum size */
  evaluable: boolean;
  insufficientReason?: string;
  metricsSummary: {
    totalChats: number;
    totalSuggestions: number;
    totalAcceptances: number;
    /** Pooled ratio (sum of acceptances / sum of suggestions), same definition as the overall KPI */
    acceptanceRatePercent: number;
  } | null;
  patterns: TeamPatternSummary[];
  calibration: DiagnosticCalibration;
}
