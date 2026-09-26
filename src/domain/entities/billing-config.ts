/**
 * FinOps & Enterprise Billing Configuration (2026.09 Specification)
 * Supports dynamic multi-currency, exchange rates, and EA volume discounts / custom unit pricing.
 */

export interface CurrencyConfig {
  code: string;                // e.g. 'USD', 'JPY', 'EUR', 'GBP' (ISO 4217)
  symbol: string;              // e.g. '$', '¥', '€', '£'
  exchangeRateFromUSD: number; // Conversion rate: 1 USD = N units of target currency
  displayDecimals: number;     // e.g. 0 for JPY, 2 for USD/EUR
}

export interface EnterpriseBillingConfig {
  currency: CurrencyConfig;        // Base/Primary currency (defaults to DEFAULT_CURRENCY_USD)
  subCurrency?: CurrencyConfig | null; // Optional secondary/sub display currency (e.g. JPY, EUR)
  seatPricing: {
    businessMonthlyUSD: number;    // Default: 19
    enterpriseMonthlyUSD: number;  // Default: 39
  };
  creditsPricing: {
    costPerCreditUSD: number;      // Default: 0.01
    includedCreditsPerSeat: number;// Default: 3900
  };
  discountPercent: number;         // EA volume discount percent: 0 to 100 (Default: 0)

  // Direct Contract Unit Pricing Options (Enterprise Agreement)
  customPricePerCredit?: number;   // Fixed unit price per AI Credit in subCurrency or target currency (e.g. 1.273 JPY/AIC)
  customSeatPricing?: {
    businessMonthly?: number;      // Fixed seat price in target currency
    enterpriseMonthly?: number;    // Fixed seat price in target currency
  };
}

export const DEFAULT_CURRENCY_USD: CurrencyConfig = {
  code: 'USD',
  symbol: '$',
  exchangeRateFromUSD: 1.0,
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
  seatPricing: {
    businessMonthlyUSD: 19,
    enterpriseMonthlyUSD: 39,
  },
  creditsPricing: {
    costPerCreditUSD: 0.01,
    includedCreditsPerSeat: 3900,
  },
  discountPercent: 0,
};

export interface DualCreditRate {
  usdRate: number;
  subRate?: number;
  formattedUSD: string;
  formattedSub?: string;
  formattedCombined: string;
}

/**
 * Calculates dual effective unit prices for AI Credits (Primary USD & optional Sub-currency).
 */
export function calculateDualCreditRate(config: EnterpriseBillingConfig): DualCreditRate {
  const baseUSD = config.creditsPricing.costPerCreditUSD;
  const discountMultiplier = Math.max(0, 1 - config.discountPercent / 100);
  const sub = config.subCurrency ?? (config.currency.code !== 'USD' ? config.currency : undefined);

  let usdRate: number;
  let subRate: number | undefined;

  if (typeof config.customPricePerCredit === 'number' && config.customPricePerCredit >= 0) {
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
    const subPrecision = !Number.isInteger(subRate)
      ? (!Number.isInteger(subRate * 100) ? 3 : 2)
      : sub.displayDecimals;
    formattedSub = `${sub.symbol}${subRate.toFixed(subPrecision)} / AIC`;
    formattedCombined = `${formattedUSD} (${formattedSub})`;
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
