/**
 * Signal transparency and data sufficiency helpers (SDD-11 §3, §5).
 */
import {
  ContributingFactor,
  DataSufficiency,
  InefficiencyPatternResult,
  SignalBand,
  SignalRuleEvidence,
} from '../types/deep-analysis.js';
import {
  DEFAULT_DIAGNOSTIC_CONFIG,
  DiagnosticConfig,
  DiagnosticPatternKey,
  PatternMinimums,
} from './diagnostic-config.js';

/** Signal strength (0-100) to a band. Boundaries are inclusive lower bounds. */
export function signalStrengthBand(
  strength: number,
  config: DiagnosticConfig = DEFAULT_DIAGNOSTIC_CONFIG
): Exclude<SignalBand, 'unknown'> {
  const t = config.bandThresholds;
  if (strength >= t.strong) return 'strong';
  if (strength >= t.medium) return 'medium';
  if (strength >= t.weak) return 'weak';
  return 'none';
}

export const SIGNAL_BAND_LABELS: Record<SignalBand, string> = {
  none: 'シグナルなし',
  weak: '弱',
  medium: '中',
  strong: '強',
  unknown: '判定不能',
};

/** Turn the contributing factors of a pattern into transparent rules (input / threshold / rationale). */
export function buildSignalEvidence(factors: ContributingFactor[]): SignalRuleEvidence[] {
  return factors.map((f) => ({
    input: f.metricName,
    value: f.currentValueFormatted,
    threshold: f.recommendedThresholdFormatted,
    rationale: f.description,
    status: f.severity === 'danger' || f.severity === 'warning' ? 'met' : f.severity === 'good' ? 'not_met' : 'reference',
  }));
}

export interface SufficiencyInput {
  activeDays: number;
  windowDays: number;
  suggestions: number;
  chats: number;
}

const CHECK_LABELS = {
  minActiveDays: '稼働日数',
  minWindowDays: '対象期間の日数',
  minSuggestions: 'Inline 提案数',
  minChats: 'チャット回数',
  minActions: '操作数 (提案 + チャット)',
} as const;

/** Check the sample of the window against the minimums of a pattern. Boundary: observed >= required is sufficient. */
export function assessDataSufficiency(
  key: DiagnosticPatternKey,
  input: SufficiencyInput,
  config: DiagnosticConfig = DEFAULT_DIAGNOSTIC_CONFIG
): DataSufficiency {
  const mins: PatternMinimums = config.minimums[key] || {};
  const observedBy: Record<keyof PatternMinimums, number> = {
    minActiveDays: input.activeDays,
    minWindowDays: input.windowDays,
    minSuggestions: input.suggestions,
    minChats: input.chats,
    minActions: input.suggestions + input.chats,
  };
  const checks: DataSufficiency['checks'] = [];
  for (const field of Object.keys(CHECK_LABELS) as (keyof PatternMinimums)[]) {
    const required = mins[field];
    if (required === undefined) continue;
    const observed = observedBy[field];
    checks.push({ name: CHECK_LABELS[field], observed, required, met: observed >= required });
  }
  const failed = checks.filter((c) => !c.met);
  return {
    sufficient: failed.length === 0,
    ...(failed.length > 0
      ? {
          reason: `データ不足のため判定しません (${failed
            .map((c) => `${c.name}: ${c.observed} / 必要 ${c.required} 以上`)
            .join('、')})`,
        }
      : {}),
    checks,
  };
}

/** Fill the v2 fields (strength, band, evidence, sufficiency) on a pattern result. Returns a new object. */
export function withSignalFields(
  pattern: InefficiencyPatternResult,
  sufficiency: DataSufficiency | undefined,
  config: DiagnosticConfig = DEFAULT_DIAGNOSTIC_CONFIG
): InefficiencyPatternResult {
  const evaluable = pattern.evaluable !== false;
  return {
    ...pattern,
    signalStrengthPercent: pattern.probabilityPercent,
    signalBand: evaluable ? signalStrengthBand(pattern.probabilityPercent, config) : 'unknown',
    evidence: buildSignalEvidence(pattern.contributingFactors),
    ...(sufficiency ? { dataSufficiency: sufficiency } : {}),
  };
}
