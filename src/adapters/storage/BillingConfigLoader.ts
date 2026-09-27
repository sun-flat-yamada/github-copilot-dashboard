import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import {
  EnterpriseBillingConfig,
  DEFAULT_BILLING_CONFIG,
  DEFAULT_CURRENCY_USD,
  resolveBillingConfigForMonth,
} from '../../domain/entities/billing-config.js';

export const CurrencyConfigSchema = z.object({
  code: z.string().min(1),
  symbol: z.string().min(1),
  exchangeRateFromUSD: z.number().positive(),
  displayDecimals: z.number().int().min(0).max(4),
});

export const BillingPeriodConfigSchema = z.object({
  startMonth: z.string().regex(/^\d{4}-\d{2}$/),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/),
  currency: CurrencyConfigSchema.optional(),
  subCurrency: CurrencyConfigSchema.nullable().optional(),
  seatPricing: z.object({
    businessMonthlyUSD: z.number().nonnegative().optional(),
    enterpriseMonthlyUSD: z.number().nonnegative().optional(),
  }).optional(),
  creditsPricing: z.object({
    costPerCreditUSD: z.number().nonnegative().optional(),
    includedCreditsPerSeat: z.number().nonnegative().optional(),
  }).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  customPricePerCredit: z.number().nonnegative().optional(),
  customPricePerCreditCurrency: z.string().optional(),
  customSeatPricing: z.object({
    businessMonthly: z.number().nonnegative().optional(),
    enterpriseMonthly: z.number().nonnegative().optional(),
    currency: z.string().optional(),
  }).optional(),
  exchangeRateFromUSD: z.number().positive().optional(),
  exchangeRates: z.record(z.string(), z.number().positive()).optional(),
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
  customPricePerCreditCurrency: z.string().optional(),
  customSeatPricing: z.object({
    businessMonthly: z.number().nonnegative().optional(),
    enterpriseMonthly: z.number().nonnegative().optional(),
    currency: z.string().optional(),
  }).optional(),
  periods: z.array(BillingPeriodConfigSchema).optional(),
});

export class BillingConfigLoader {
  /**
   * Loads and validates EnterpriseBillingConfig.
   * Checks process.env.COPILOT_BILLING_CONFIG, data/config/billing.json, or raw JSON string.
   * Falls back cleanly to DEFAULT_BILLING_CONFIG on missing or invalid configuration.
   */
  static load(rawConfigStr?: string): EnterpriseBillingConfig {
    let configStr = rawConfigStr;

    if (!configStr && typeof process !== 'undefined') {
      configStr = process.env?.COPILOT_BILLING_CONFIG;
      if (!configStr) {
        try {
          const configFile = path.resolve(process.cwd(), 'data/config/billing.json');
          if (fs.existsSync(configFile)) {
            configStr = fs.readFileSync(configFile, 'utf-8');
          }
        } catch {
          // Ignore filesystem lookup errors in browser/non-node environments
        }
      }
    }

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

  /**
   * Loads the configuration and resolves it for a specific target month ('YYYY-MM').
   * If a period matches, its overrides are applied; otherwise default values are used.
   */
  static loadForMonth(targetMonth?: string, rawConfigStr?: string): EnterpriseBillingConfig {
    const baseConfig = this.load(rawConfigStr);
    return resolveBillingConfigForMonth(baseConfig, targetMonth);
  }
}
