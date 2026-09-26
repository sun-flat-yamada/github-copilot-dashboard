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
  currency: CurrencyConfig;
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
  customPricePerCredit?: number;   // Fixed unit price per AI Credit in target currency (e.g. 1.273 JPY/AIC)
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

export const DEFAULT_BILLING_CONFIG: EnterpriseBillingConfig = {
  currency: DEFAULT_CURRENCY_USD,
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
