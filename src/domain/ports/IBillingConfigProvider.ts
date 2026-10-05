import {
  DEFAULT_BILLING_CONFIG,
  EnterpriseBillingConfig,
  resolveBillingConfigForMonth,
} from '../entities/billing-config.js';

export interface BillingConfigLoadResult {
  config: EnterpriseBillingConfig;
  /** 設定の取得元。'default' は設定なし (価格カタログの既定値) */
  source: 'argument' | 'env' | 'file' | 'default';
  /**
   * 設定が不正で既定値にフォールバックした場合の要約 (設定値そのものは含めない)。
   * 呼び出し側 (パイプライン) は issue として記録し、画面上で気付けるようにする。
   */
  error?: string;
}

/**
 * Port for the enterprise billing configuration (C-07).
 * The application layer reads the configuration only through this port; the Composition Root
 * injects the adapter (`billingConfigProvider` in `src/adapters/storage/BillingConfigLoader.ts`,
 * which reads `COPILOT_BILLING_CONFIG` / `data/config/billing.json`).
 */
export interface IBillingConfigProvider {
  /** The configuration resolved for a target month ('YYYY-MM'); without a month, the base values. */
  loadForMonth(targetMonth?: string): EnterpriseBillingConfig;
  /** The base configuration with its source and, when it was invalid, an error summary. */
  loadWithDiagnostics(): BillingConfigLoadResult;
}

/** Catalog defaults only (no environment, no file). The fallback when nothing is injected. */
export const CATALOG_BILLING_CONFIG_PROVIDER: IBillingConfigProvider = {
  loadForMonth: (targetMonth) => resolveBillingConfigForMonth(DEFAULT_BILLING_CONFIG, targetMonth),
  loadWithDiagnostics: () => ({ config: DEFAULT_BILLING_CONFIG, source: 'default' }),
};
