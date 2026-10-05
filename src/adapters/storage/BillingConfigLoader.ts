import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import {
  EnterpriseBillingConfig,
  DEFAULT_BILLING_CONFIG,
  DEFAULT_CURRENCY_USD,
  resolveBillingConfigForMonth,
} from '../../domain/entities/billing-config.js';
import { BASELINE_PRICING } from '../../domain/pricing/pricing-catalog.js';
import type { BillingConfigLoadResult, IBillingConfigProvider } from '../../domain/ports/IBillingConfigProvider.js';

export const CurrencyConfigSchema = z.object({
  code: z.string().min(1),
  symbol: z.string().min(1),
  exchangeRateFromUSD: z.number().positive(),
  displayDecimals: z.number().int().min(0).max(4),
});

/**
 * Normalizes period configuration objects to allow flexible aliases:
 * - seatPricing: { enterprise, business, enterpriseMonthly, currency, ... }
 * - creditPricing / aiCreditPricing: { pricePerCredit, unitPrice, currency, ... }
 * - exchangeRates / rates: { JPY: 155.0, ... }
 */
export function normalizePeriodInput(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const p = { ...raw };

  // 1. seatPricing normalization
  if (p.seatPricing && typeof p.seatPricing === 'object') {
    const sp = p.seatPricing;
    const curr = (sp.currency || p.currency?.code || p.currency || 'USD').toString().toUpperCase();
    const entVal = sp.enterpriseMonthlyUSD ?? sp.enterpriseMonthly ?? sp.enterprise;
    const bizVal = sp.businessMonthlyUSD ?? sp.businessMonthly ?? sp.business;

    if (curr !== 'USD' && curr !== 'EA-USD') {
      p.customSeatPricing = {
        ...(p.customSeatPricing || {}),
        enterpriseMonthly: entVal,
        businessMonthly: bizVal,
        currency: curr,
      };
    } else {
      p.seatPricing = {
        enterpriseMonthlyUSD: entVal,
        businessMonthlyUSD: bizVal,
      };
    }
  }

  // 2. creditPricing / creditsPricing / aiCreditPricing normalization
  const cp = p.creditPricing || p.creditsPricing || p.aiCreditPricing;
  if (cp && typeof cp === 'object') {
    const curr = (cp.currency || p.currency?.code || p.currency || 'USD').toString().toUpperCase();
    const unitVal = cp.pricePerCredit ?? cp.unitPrice ?? cp.costPerCreditUSD ?? cp.costPerCredit;
    if (typeof unitVal === 'number') {
      if (curr !== 'USD' && curr !== 'EA-USD') {
        p.customPricePerCredit = unitVal;
        p.customPricePerCreditCurrency = curr;
      } else {
        p.creditsPricing = {
          ...(p.creditsPricing || {}),
          costPerCreditUSD: unitVal,
          // 未指定のときは価格カタログのプラン別の値を使うため、既定値を注入しない
          ...(cp.includedCreditsPerSeat !== undefined ? { includedCreditsPerSeat: cp.includedCreditsPerSeat } : {}),
        };
      }
    }
  }

  // 3. exchangeRates / rates normalization
  if (p.rates && typeof p.rates === 'object') {
    p.exchangeRates = { ...(p.exchangeRates || {}), ...p.rates };
  }

  return p;
}

export const BillingPeriodConfigSchema = z.preprocess(
  normalizePeriodInput,
  z.object({
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
  })
);

export function normalizeBillingConfigInput(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const cfg = { ...raw };

  // Normalize top-level seatPricing & creditPricing if defined with aliases
  if (cfg.seatPricing && typeof cfg.seatPricing === 'object') {
    const sp = cfg.seatPricing;
    const curr = (sp.currency || cfg.currency?.code || 'USD').toString().toUpperCase();
    const entVal = sp.enterpriseMonthlyUSD ?? sp.enterpriseMonthly ?? sp.enterprise;
    const bizVal = sp.businessMonthlyUSD ?? sp.businessMonthly ?? sp.business;

    if (curr !== 'USD' && curr !== 'EA-USD') {
      cfg.customSeatPricing = {
        ...(cfg.customSeatPricing || {}),
        enterpriseMonthly: entVal,
        businessMonthly: bizVal,
        currency: curr,
      };
    } else if (entVal !== undefined || bizVal !== undefined) {
      cfg.seatPricing = {
        enterpriseMonthlyUSD: entVal ?? BASELINE_PRICING.seatPriceUsd.enterprise,
        businessMonthlyUSD: bizVal ?? BASELINE_PRICING.seatPriceUsd.business,
      };
    }
  }

  const cp = cfg.creditPricing || cfg.creditsPricing || cfg.aiCreditPricing;
  if (cp && typeof cp === 'object') {
    const curr = (cp.currency || cfg.currency?.code || 'USD').toString().toUpperCase();
    const unitVal = cp.pricePerCredit ?? cp.unitPrice ?? cp.costPerCreditUSD ?? cp.costPerCredit;
    if (typeof unitVal === 'number') {
      if (curr !== 'USD' && curr !== 'EA-USD') {
        cfg.customPricePerCredit = unitVal;
        cfg.customPricePerCreditCurrency = curr;
      } else {
        cfg.creditsPricing = {
          costPerCreditUSD: unitVal,
          // 未指定のときは価格カタログのプラン別の値を使うため、既定値を注入しない
          ...(cp.includedCreditsPerSeat !== undefined ? { includedCreditsPerSeat: cp.includedCreditsPerSeat } : {}),
        };
      }
    }
  }

  if (Array.isArray(cfg.periods)) {
    cfg.periods = cfg.periods.map(normalizePeriodInput);
  }

  return cfg;
}

export const BillingConfigSchema = z.preprocess(
  normalizeBillingConfigInput,
  z.object({
    currency: CurrencyConfigSchema.default(DEFAULT_CURRENCY_USD),
    subCurrency: CurrencyConfigSchema.nullable().optional(),
    seatPricing: z.object({
      businessMonthlyUSD: z.number().nonnegative().default(BASELINE_PRICING.seatPriceUsd.business),
      enterpriseMonthlyUSD: z.number().nonnegative().default(BASELINE_PRICING.seatPriceUsd.enterprise),
    }).default({
      businessMonthlyUSD: BASELINE_PRICING.seatPriceUsd.business,
      enterpriseMonthlyUSD: BASELINE_PRICING.seatPriceUsd.enterprise,
    }),
    creditsPricing: z.object({
      costPerCreditUSD: z.number().nonnegative().default(BASELINE_PRICING.creditUnitPriceUsd),
      // 指定時のみ全プラン共通の上書きとして扱う (未指定はカタログのプラン別・期間別の値)
      includedCreditsPerSeat: z.number().nonnegative().optional(),
    }).default({ costPerCreditUSD: BASELINE_PRICING.creditUnitPriceUsd }),
    discountPercent: z.number().min(0).max(100).default(0),
    customPricePerCredit: z.number().nonnegative().optional(),
    customPricePerCreditCurrency: z.string().optional(),
    customSeatPricing: z.object({
      businessMonthly: z.number().nonnegative().optional(),
      enterpriseMonthly: z.number().nonnegative().optional(),
      currency: z.string().optional(),
    }).optional(),
    periods: z.array(BillingPeriodConfigSchema).optional(),
  })
);

export type { BillingConfigLoadResult } from '../../domain/ports/IBillingConfigProvider.js';

/** 検証エラーを、入力値 (契約単価など) を含まない 1 行の要約にする */
function summarizeConfigError(err: any): string {
  const issues: Array<{ path?: Array<string | number>; message?: string }> | undefined = err?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    return (
      'invalid value(s): ' +
      issues
        .slice(0, 5)
        .map((i) => `${(i.path ?? []).join('.') || '(root)'}: ${i.message ?? 'invalid'}`)
        .join('; ')
    );
  }
  return err instanceof SyntaxError ? 'not valid JSON' : 'could not be parsed';
}

export class BillingConfigLoader {
  /** 同じエラーを毎シート・毎呼び出しで警告し続けないための既出メッセージ */
  private static warned = new Set<string>();

  /**
   * Loads and validates EnterpriseBillingConfig.
   * Checks process.env.COPILOT_BILLING_CONFIG, data/config/billing.json, or raw JSON string.
   * Falls back cleanly to DEFAULT_BILLING_CONFIG on missing or invalid configuration.
   * 不正な設定の診断結果が必要な場合は loadWithDiagnostics() を使う。
   */
  static load(rawConfigStr?: string): EnterpriseBillingConfig {
    return this.loadWithDiagnostics(rawConfigStr).config;
  }

  /**
   * load() と同じ解決順で設定を読み込み、取得元と (不正だった場合の) エラー要約も返す。
   */
  static loadWithDiagnostics(rawConfigStr?: string): BillingConfigLoadResult {
    let configStr = rawConfigStr;
    let source: BillingConfigLoadResult['source'] = rawConfigStr ? 'argument' : 'default';

    if (!configStr && typeof process !== 'undefined') {
      configStr = process.env?.COPILOT_BILLING_CONFIG;
      if (configStr) {
        source = 'env';
      } else {
        try {
          const configFile = path.resolve(process.cwd(), 'data/config/billing.json');
          if (fs.existsSync(configFile)) {
            configStr = fs.readFileSync(configFile, 'utf-8');
            source = 'file';
          }
        } catch {
          // Ignore filesystem lookup errors in browser/non-node environments
        }
      }
    }

    if (!configStr) {
      return { config: DEFAULT_BILLING_CONFIG, source: 'default' };
    }

    try {
      const parsed = JSON.parse(configStr);
      const validated = BillingConfigSchema.parse(parsed);
      return { config: validated as EnterpriseBillingConfig, source };
    } catch (err: any) {
      const summary = summarizeConfigError(err);
      if (!this.warned.has(summary)) {
        this.warned.add(summary);
        console.warn(`[BillingConfigLoader] Failed to parse billing configuration (${source}), falling back to defaults: ${summary}`);
      }
      return { config: DEFAULT_BILLING_CONFIG, source, error: summary };
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

/** IBillingConfigProvider adapter: reads `COPILOT_BILLING_CONFIG` / `data/config/billing.json` (Composition Root wires it). */
export const billingConfigProvider: IBillingConfigProvider = {
  loadForMonth: (targetMonth) => BillingConfigLoader.loadForMonth(targetMonth),
  loadWithDiagnostics: () => BillingConfigLoader.loadWithDiagnostics(),
};
