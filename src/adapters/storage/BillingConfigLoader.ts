import { z } from 'zod';
import {
  EnterpriseBillingConfig,
  DEFAULT_BILLING_CONFIG,
  DEFAULT_CURRENCY_USD,
} from '../../domain/entities/billing-config.js';

export const CurrencyConfigSchema = z.object({
  code: z.string().min(1),
  symbol: z.string().min(1),
  exchangeRateFromUSD: z.number().positive(),
  displayDecimals: z.number().int().min(0).max(4),
});

export const BillingConfigSchema = z.object({
  currency: CurrencyConfigSchema.default(DEFAULT_CURRENCY_USD),
  subCurrency: CurrencyConfigSchema.nullable().optional(),
  seatPricing: z.object({
    businessMonthlyUSD: z.number().nonnegative().default(19),
    enterpriseMonthlyUSD: z.number().nonnegative().default(39),
  }).default({ businessMonthlyUSD: 19, enterpriseMonthlyUSD: 39 }),
  creditsPricing: z.object({
    costPerCreditUSD: z.number().nonnegative().default(0.01),
    includedCreditsPerSeat: z.number().nonnegative().default(3900),
  }).default({ costPerCreditUSD: 0.01, includedCreditsPerSeat: 3900 }),
  discountPercent: z.number().min(0).max(100).default(0),
  customPricePerCredit: z.number().nonnegative().optional(),
  customSeatPricing: z.object({
    businessMonthly: z.number().nonnegative().optional(),
    enterpriseMonthly: z.number().nonnegative().optional(),
  }).optional(),
});

export class BillingConfigLoader {
  /**
   * Loads and validates EnterpriseBillingConfig.
   * Checks process.env.COPILOT_BILLING_CONFIG or raw JSON string.
   * Falls back cleanly to DEFAULT_BILLING_CONFIG on missing or invalid configuration.
   * Auto-promotes legacy non-USD currency to subCurrency to enforce USD as permanent primary.
   */
  static load(rawConfigStr?: string): EnterpriseBillingConfig {
    const configStr = rawConfigStr || (typeof process !== 'undefined' ? process.env?.COPILOT_BILLING_CONFIG : undefined);
    if (!configStr) {
      return DEFAULT_BILLING_CONFIG;
    }

    try {
      const parsed = JSON.parse(configStr);
      const validated = BillingConfigSchema.parse(parsed);
      return validated as EnterpriseBillingConfig;
    } catch (err: any) {
      console.warn('[BillingConfigLoader] Failed to parse COPILOT_BILLING_CONFIG, falling back to defaults:', err.message);
      return DEFAULT_BILLING_CONFIG;
    }
  }
}
