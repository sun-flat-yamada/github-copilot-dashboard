/**
 * AI Credits Billing & Usage Entities
 * 2026.09 Specification for Token-based AI Credits Pooled Consumption Model
 */

export interface AiCreditsUsage {
  total_used: number;
  by_feature?: {
    agent_sessions?: number;
    chat_turns?: number;
    code_review?: number;
    custom_models?: number;
    other?: number;
  };
  by_model?: Record<string, number>;
}

import { BASELINE_PRICING } from '../pricing/pricing-catalog.js';

export interface AiCreditsPlanAllowance {
  monthly_included_credits: number;
  effective_date: string;
}

/**
 * 通常時のプラン別包含クレジット。値は価格カタログ (src/domain/pricing) が唯一のソースで、
 * 期間別 (移行プロモーション等) の値は resolvePricingEntry(month) で取得する。
 */
export const AI_CREDITS_ALLOWANCE: Record<'business' | 'enterprise', AiCreditsPlanAllowance> = {
  business: {
    monthly_included_credits: BASELINE_PRICING.includedCreditsPerSeat.business,
    effective_date: '2026-06-01',
  },
  enterprise: {
    monthly_included_credits: BASELINE_PRICING.includedCreditsPerSeat.enterprise,
    effective_date: '2026-06-01',
  },
};

export const AI_CREDIT_UNIT_PRICE_USD = BASELINE_PRICING.creditUnitPriceUsd; // 1 Credit = $0.01

export interface OrganizationCreditsPool {
  total_included_credits: number; // シート数 × プラン付帯クレジット
  total_used_credits: number;     // 実績消費クレジット
  remaining_credits: number;      // 残余クレジット (Math.max(0, included - used))
  overage_credits: number;        // 超過クレジット (Math.max(0, used - included))
  overage_cost_usd: number;       // 超過コスト ($0.01 / credit)
  utilization_percent: number;    // 使用率 (used / included * 100)
  status: 'normal' | 'warning' | 'exceeded';
}

export interface ModelCreditRate {
  model_id: string;
  credit_multiplier: number;
  input_token_rate_per_k: number;
  output_token_rate_per_k: number;
}
