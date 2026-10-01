/**
 * FinOps & Enterprise Billing Configuration (2026.09 Specification)
 * Supports dynamic multi-currency, exchange rates, and EA volume discounts / custom unit pricing.
 * Enhanced with period-based billing configuration, public exchange rate auto-calculation,
 * and EA-USD secondary display support.
 */

import { PublicExchangeRatesService } from '../services/PublicExchangeRatesService.js';
import { BASELINE_PRICING } from '../pricing/pricing-catalog.js';

export interface CurrencyConfig {
  code: string;                // e.g. 'USD', 'JPY', 'EUR', 'GBP', 'EA-USD' (ISO 4217 or internal code)
  symbol: string;              // e.g. '$', '¥', '€', '£'
  exchangeRateFromUSD: number; // Conversion rate: 1 USD = N units of target currency
  displayDecimals: number;     // e.g. 0 for JPY, 2 for USD/EUR/EA-USD
}

export interface BillingPeriodConfig {
  startMonth: string; // "YYYY-MM" (inclusive, e.g. '2025-04')
  endMonth: string;   // "YYYY-MM" (inclusive, e.g. '2026-03')
  currency?: CurrencyConfig;
  subCurrency?: CurrencyConfig | null;
  seatPricing?: {
    businessMonthlyUSD?: number;
    enterpriseMonthlyUSD?: number;
  };
  creditsPricing?: {
    costPerCreditUSD?: number;
    includedCreditsPerSeat?: number;
  };
  discountPercent?: number; // EA volume discount percent: 0 to 100

  // Direct Contract Unit Pricing Options (Enterprise Agreement)
  customPricePerCredit?: number; // Fixed unit price per AI Credit in subCurrency or target currency (e.g. 1.273 JPY/AIC)
  customPricePerCreditCurrency?: string; // Currency unit (e.g. 'JPY', 'USD')
  customSeatPricing?: {
    businessMonthly?: number; // Fixed seat price in target currency
    enterpriseMonthly?: number; // Fixed seat price in target currency
    currency?: string; // Currency unit (e.g. 'JPY', 'USD')
  };

  // Custom Exchange Rate Overrides for this period
  exchangeRateFromUSD?: number; // Override rate for subCurrency
  exchangeRates?: Record<string, number>; // Map of currency code to rate relative to 1 USD
}

export interface EnterpriseBillingConfig {
  currency: CurrencyConfig;        // Base/Primary currency (defaults to DEFAULT_CURRENCY_USD)
  subCurrency?: CurrencyConfig | null; // Optional secondary/sub display currency (e.g. JPY, EUR, EA-USD)
  seatPricing: {
    businessMonthlyUSD: number;    // Default: 19 (GitHub Catalog Price USD)
    enterpriseMonthlyUSD: number;  // Default: 39 (GitHub Catalog Price USD)
  };
  creditsPricing: {
    costPerCreditUSD: number;      // Default: 0.01 (GitHub Catalog Price USD)
    /**
     * 全プラン共通の包含クレジットを契約等で明示的に上書きする場合のみ指定する。
     * 未指定のときは価格カタログ (pricing-catalog.ts) のプラン別・実効期間付きの値を使う。
     */
    includedCreditsPerSeat?: number;
  };
  discountPercent: number;         // EA volume discount percent: 0 to 100 (Default: 0)

  // Direct Contract Unit Pricing Options (Enterprise Agreement)
  customPricePerCredit?: number;   // Fixed unit price per AI Credit in subCurrency or target currency (e.g. 1.273 JPY/AIC)
  customPricePerCreditCurrency?: string;
  customSeatPricing?: {
    businessMonthly?: number;      // Fixed seat price in target currency
    enterpriseMonthly?: number;    // Fixed seat price in target currency
    currency?: string;
  };

  // Optional period-based parameters (startMonth to endMonth)
  periods?: BillingPeriodConfig[];
}

export const DEFAULT_CURRENCY_USD: CurrencyConfig = {
  code: 'USD',
  symbol: '$',
  exchangeRateFromUSD: 1.0,
  displayDecimals: 2,
};

export const DEFAULT_CURRENCY_EA_USD: CurrencyConfig = {
  code: 'EA-USD',
  symbol: '$',
  exchangeRateFromUSD: 1.0,
  displayDecimals: 2,
};

export const DEFAULT_CURRENCY_EA_JPY: CurrencyConfig = {
  code: 'EA-JPY',
  symbol: '¥',
  exchangeRateFromUSD: 150.0,
  displayDecimals: 0,
};

export const DEFAULT_CURRENCY_EA_EUR: CurrencyConfig = {
  code: 'EA-EUR',
  symbol: '€',
  exchangeRateFromUSD: 0.92,
  displayDecimals: 2,
};

export const DEFAULT_CURRENCY_JPY: CurrencyConfig = {
  code: 'JPY',
  symbol: '¥',
  exchangeRateFromUSD: 150.0,
  displayDecimals: 0,
};

export const DEFAULT_CURRENCY_EUR: CurrencyConfig = {
  code: 'EUR',
  symbol: '€',
  exchangeRateFromUSD: 0.92,
  displayDecimals: 2,
};

export const DEFAULT_BILLING_CONFIG: EnterpriseBillingConfig = {
  currency: DEFAULT_CURRENCY_USD,
  subCurrency: null,
  // 価格の既定値は価格カタログ (src/domain/pricing) が唯一のソース
  seatPricing: {
    businessMonthlyUSD: BASELINE_PRICING.seatPriceUsd.business,
    enterpriseMonthlyUSD: BASELINE_PRICING.seatPriceUsd.enterprise,
  },
  creditsPricing: {
    costPerCreditUSD: BASELINE_PRICING.creditUnitPriceUsd,
  },
  discountPercent: 0,
};

/**
 * Resolves the effective billing configuration for a given month ('YYYY-MM').
 * If a matching period config exists (startMonth <= month <= endMonth), its values
 * override the base configuration. Otherwise, base configuration defaults are applied.
 * Exchange rates omitted in the period configuration are automatically resolved
 * using reliable public exchange rates (ECB / Bank of Japan).
 */
export function resolveBillingConfigForMonth(
  baseConfig: EnterpriseBillingConfig,
  targetMonth?: string
): EnterpriseBillingConfig {
  const ym = targetMonth && targetMonth.length >= 7 ? targetMonth.slice(0, 7) : undefined;
  let matchingPeriod: BillingPeriodConfig | undefined;

  if (ym && Array.isArray(baseConfig.periods)) {
    matchingPeriod = baseConfig.periods.find((p) => {
      const start = p.startMonth.slice(0, 7);
      const end = p.endMonth.slice(0, 7);
      return start <= ym && ym <= end;
    });
  }

  // Base cloning
  const resolved: EnterpriseBillingConfig = {
    currency: { ...baseConfig.currency },
    subCurrency: baseConfig.subCurrency ? { ...baseConfig.subCurrency } : null,
    seatPricing: { ...baseConfig.seatPricing },
    creditsPricing: { ...baseConfig.creditsPricing },
    discountPercent: baseConfig.discountPercent,
    customPricePerCredit: baseConfig.customPricePerCredit,
    customPricePerCreditCurrency: baseConfig.customPricePerCreditCurrency,
    customSeatPricing: baseConfig.customSeatPricing ? { ...baseConfig.customSeatPricing } : undefined,
    periods: baseConfig.periods,
  };

  if (matchingPeriod) {
    if (matchingPeriod.discountPercent !== undefined) {
      resolved.discountPercent = matchingPeriod.discountPercent;
    }
    if (matchingPeriod.seatPricing) {
      if (matchingPeriod.seatPricing.businessMonthlyUSD !== undefined) {
        resolved.seatPricing.businessMonthlyUSD = matchingPeriod.seatPricing.businessMonthlyUSD;
      }
      if (matchingPeriod.seatPricing.enterpriseMonthlyUSD !== undefined) {
        resolved.seatPricing.enterpriseMonthlyUSD = matchingPeriod.seatPricing.enterpriseMonthlyUSD;
      }
    }
    if (matchingPeriod.creditsPricing) {
      if (matchingPeriod.creditsPricing.costPerCreditUSD !== undefined) {
        resolved.creditsPricing.costPerCreditUSD = matchingPeriod.creditsPricing.costPerCreditUSD;
      }
      if (matchingPeriod.creditsPricing.includedCreditsPerSeat !== undefined) {
        resolved.creditsPricing.includedCreditsPerSeat = matchingPeriod.creditsPricing.includedCreditsPerSeat;
      }
    }
    if (matchingPeriod.customPricePerCredit !== undefined) {
      resolved.customPricePerCredit = matchingPeriod.customPricePerCredit;
      resolved.customPricePerCreditCurrency = matchingPeriod.customPricePerCreditCurrency;
    }
    if (matchingPeriod.customSeatPricing) {
      resolved.customSeatPricing = { ...matchingPeriod.customSeatPricing };
    }
    if (matchingPeriod.subCurrency !== undefined) {
      resolved.subCurrency = matchingPeriod.subCurrency ? { ...matchingPeriod.subCurrency } : null;
    }
  }

  // Auto-calculate exchange rate from reliable public data if not explicitly set
  if (resolved.subCurrency && resolved.subCurrency.code !== 'USD' && resolved.subCurrency.code !== 'EA-USD') {
    const subCode = resolved.subCurrency.code;
    let rateOverride: number | undefined;

    if (matchingPeriod) {
      if (typeof matchingPeriod.exchangeRateFromUSD === 'number' && matchingPeriod.exchangeRateFromUSD > 0) {
        rateOverride = matchingPeriod.exchangeRateFromUSD;
      } else if (matchingPeriod.exchangeRates) {
        if (typeof matchingPeriod.exchangeRates[subCode] === 'number') {
          rateOverride = matchingPeriod.exchangeRates[subCode];
        } else {
          const rawCode = subCode.startsWith('EA-') ? subCode.slice(3) : subCode;
          if (typeof matchingPeriod.exchangeRates[rawCode] === 'number') {
            rateOverride = matchingPeriod.exchangeRates[rawCode];
          }
        }
      }
    }

    if (rateOverride !== undefined) {
      resolved.subCurrency.exchangeRateFromUSD = rateOverride;
    } else if (resolved.subCurrency.exchangeRateFromUSD <= 0 || !matchingPeriod) {
      // Use public reliable rate auto-calculation for omitted or non-period months
      const autoRate = PublicExchangeRatesService.getExchangeRate(subCode, ym);
      if (autoRate > 0) {
        resolved.subCurrency.exchangeRateFromUSD = autoRate;
      }
    }
  }

  return resolved;
}

export interface DualCreditRate {
  usdRate: number;
  subRate?: number;
  formattedUSD: string;
  formattedSub?: string;
  formattedCombined: string;
}

/**
 * Calculates dual effective unit prices for AI Credits (Catalog USD & optional Sub-currency / EA-USD).
 */
export function calculateDualCreditRate(config: EnterpriseBillingConfig): DualCreditRate {
  const baseUSD = config.creditsPricing.costPerCreditUSD;
  const discountMultiplier = Math.max(0, 1 - config.discountPercent / 100);
  const sub = config.subCurrency ?? (config.currency.code !== 'USD' ? config.currency : undefined);

  let usdRate: number;
  let subRate: number | undefined;

  const isEaUsd = sub?.code === 'EA-USD';

  if (isEaUsd) {
    usdRate = baseUSD; // Catalog USD rate
    subRate = typeof config.customPricePerCredit === 'number' && config.customPricePerCredit >= 0
      ? config.customPricePerCredit
      : Math.round(baseUSD * discountMultiplier * 10000) / 10000;
  } else if (typeof config.customPricePerCredit === 'number' && config.customPricePerCredit >= 0) {
    if (sub && sub.code !== 'USD' && sub.exchangeRateFromUSD > 0) {
      subRate = config.customPricePerCredit;
      usdRate = Math.round((config.customPricePerCredit / sub.exchangeRateFromUSD) * 10000) / 10000;
    } else {
      usdRate = config.customPricePerCredit;
      if (sub && sub.code !== 'USD') {
        subRate = Math.round(usdRate * sub.exchangeRateFromUSD * 10000) / 10000;
      }
    }
  } else {
    usdRate = Math.round(baseUSD * discountMultiplier * 10000) / 10000;
    if (sub && sub.code !== 'USD') {
      subRate = Math.round(usdRate * sub.exchangeRateFromUSD * 10000) / 10000;
    }
  }

  const usdPrecision = usdRate < 0.01
    ? (Number.isInteger(usdRate * 1000) ? 3 : 4)
    : (!Number.isInteger(usdRate * 100) ? 3 : 2);
  const formattedUSD = `$${usdRate.toFixed(usdPrecision)} / AIC`;

  let formattedSub: string | undefined;
  let formattedCombined = formattedUSD;

  if (sub && sub.code !== 'USD' && subRate !== undefined) {
    if (isEaUsd) {
      const eaPrecision = subRate < 0.01 ? 4 : 3;
      formattedSub = `$${subRate.toFixed(eaPrecision)} / AIC (EA)`;
      formattedCombined = `${formattedUSD} (${formattedSub})`;
    } else {
      const subPrecision = !Number.isInteger(subRate)
        ? (!Number.isInteger(subRate * 100) ? 3 : 2)
        : sub.displayDecimals;
      formattedSub = `${sub.symbol}${subRate.toFixed(subPrecision)} / AIC`;
      formattedCombined = `${formattedUSD} (${formattedSub})`;
    }
  }

  return {
    usdRate,
    subRate,
    formattedUSD,
    formattedSub,
    formattedCombined,
  };
}

/**
 * Calculates effective unit price for AI Credits.
 * Precedence:
 * 1. customPricePerCredit (if defined)
 * 2. costPerCreditUSD * exchangeRateFromUSD * (1 - discountPercent / 100)
 */
export function calculateEffectiveCreditRate(config: EnterpriseBillingConfig): number {
  if (typeof config.customPricePerCredit === 'number' && config.customPricePerCredit >= 0) {
    return config.customPricePerCredit;
  }
  const baseUSD = config.creditsPricing.costPerCreditUSD;
  const rate = config.currency.exchangeRateFromUSD;
  const discountMultiplier = Math.max(0, 1 - config.discountPercent / 100);
  return Math.round(baseUSD * rate * discountMultiplier * 10000) / 10000;
}

/**
 * Calculates effective seat unit price per month.
 * Precedence:
 * 1. customSeatPricing (if defined for the plan)
 * 2. basePlanUSD * exchangeRateFromUSD * (1 - discountPercent / 100)
 */
export function calculateEffectiveSeatPrice(
  config: EnterpriseBillingConfig,
  plan: 'business' | 'enterprise'
): number {
  if (config.customSeatPricing) {
    const custom = plan === 'business'
      ? config.customSeatPricing.businessMonthly
      : config.customSeatPricing.enterpriseMonthly;
    if (typeof custom === 'number' && custom >= 0) {
      return custom;
    }
  }

  const baseUSD = plan === 'business'
    ? config.seatPricing.businessMonthlyUSD
    : config.seatPricing.enterpriseMonthlyUSD;
  const rate = config.currency.exchangeRateFromUSD;
  const discountMultiplier = Math.max(0, 1 - config.discountPercent / 100);
  return Math.round(baseUSD * rate * discountMultiplier * 100) / 100;
}
