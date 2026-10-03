/**
 * Model classification catalog (SDD-11 §2, B-11).
 *
 * Diagnostics must not hardcode model IDs of one year. A model ID is normalized and classified into a tier by
 * family rules, so a newly released model of a known family is classified without code changes. A model that
 * matches no rule is `unknown`: it counts neither as heavy nor as light.
 */

export type ModelTier = 'reasoning_heavy' | 'heavy' | 'standard' | 'light' | 'unknown';

export interface ModelClassification {
  tier: ModelTier;
  /** Normalized id (lowercase, separators unified to '-') */
  normalizedId: string;
  /** Rule that matched (for display / debugging) */
  rule: string;
  /** Estimated cost per chat request in USD (an estimate by tier, not a billed amount) */
  estimatedChatCostUsd: number;
  /** true when the cost is an assumption for an unclassified model */
  costIsAssumed: boolean;
}

/** Estimated chat cost per tier (USD). Estimates only; billed cost comes from billing data. */
export const TIER_ESTIMATED_CHAT_COST_USD: Record<ModelTier, number> = {
  reasoning_heavy: 0.08,
  heavy: 0.04,
  standard: 0.015,
  light: 0.004,
  unknown: 0.02,
};

export const MODEL_TIER_LABELS: Record<ModelTier, string> = {
  reasoning_heavy: '推論特化・最上位',
  heavy: '大型',
  standard: '標準',
  light: '軽量・高速',
  unknown: '未分類',
};

interface TierRule {
  tier: ModelTier;
  name: string;
  pattern: RegExp;
}

/** Evaluated in order: the first match wins. Light variants are checked first ("o3-mini", "gpt-5-mini"). */
const TIER_RULES: TierRule[] = [
  { tier: 'light', name: 'light-variant', pattern: /(^|-)(flash|haiku|mini|nano|lite|small|instant)(-|$)/ },
  { tier: 'reasoning_heavy', name: 'reasoning-o-series', pattern: /^o\d+(-pro|-preview|-high)?$/ },
  { tier: 'reasoning_heavy', name: 'reasoning-opus', pattern: /(^|-)opus(-|$)/ },
  { tier: 'reasoning_heavy', name: 'reasoning-pro-or-thinking', pattern: /(^|-)(pro-max|thinking|reasoner|r1)(-|$)|^gpt-\d+(-\d+)?-pro$/ },
  { tier: 'heavy', name: 'heavy-sonnet', pattern: /(^|-)sonnet(-|$)/ },
  { tier: 'heavy', name: 'heavy-pro', pattern: /^gemini-[\d-]+-pro(-|$)/ },
  { tier: 'heavy', name: 'heavy-flagship', pattern: /^gpt-(4-5|4-1-preview|5)(-codex)?(-|$)/ },
  { tier: 'standard', name: 'standard-gpt', pattern: /^gpt-\d/ },
  { tier: 'standard', name: 'standard-gemini', pattern: /^gemini-/ },
  { tier: 'standard', name: 'standard-claude', pattern: /^claude-/ },
  { tier: 'standard', name: 'standard-grok', pattern: /^grok-/ },
];

export function normalizeModelId(modelId: string): string {
  return modelId
    .trim()
    .toLowerCase()
    .replace(/[._\s]+/g, '-')
    .replace(/-+/g, '-');
}

export function classifyModel(modelId: string): ModelClassification {
  const normalizedId = normalizeModelId(modelId || '');
  for (const rule of TIER_RULES) {
    if (rule.pattern.test(normalizedId)) {
      return {
        tier: rule.tier,
        normalizedId,
        rule: rule.name,
        estimatedChatCostUsd: TIER_ESTIMATED_CHAT_COST_USD[rule.tier],
        costIsAssumed: false,
      };
    }
  }
  return {
    tier: 'unknown',
    normalizedId,
    rule: 'unclassified',
    estimatedChatCostUsd: TIER_ESTIMATED_CHAT_COST_USD.unknown,
    costIsAssumed: true,
  };
}

export interface TierCounts {
  reasoning_heavy: number;
  heavy: number;
  standard: number;
  light: number;
  unknown: number;
  total: number;
}

/** Sum request counts per tier. Non-finite or negative counts are ignored. */
export function countByTier(models: Record<string, number>): TierCounts {
  const counts: TierCounts = { reasoning_heavy: 0, heavy: 0, standard: 0, light: 0, unknown: 0, total: 0 };
  for (const [id, raw] of Object.entries(models || {})) {
    const n = Number.isFinite(raw) && raw > 0 ? raw : 0;
    counts[classifyModel(id).tier] += n;
    counts.total += n;
  }
  return counts;
}
