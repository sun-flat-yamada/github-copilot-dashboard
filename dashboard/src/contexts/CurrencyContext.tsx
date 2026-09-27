import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  CurrencyConfig,
  resolveBillingConfigForMonth,
  EnterpriseBillingConfig,
  DEFAULT_BILLING_CONFIG,
} from '../../../src/domain/entities/billing-config.js';
import { PublicExchangeRatesService } from '../../../src/domain/services/PublicExchangeRatesService.js';
import { Money } from '../../../src/domain/value-objects/Money.js';
import { IndexMetadata } from '../../../src/domain/entities/copilot.js';

export interface CurrencyContextType {
  subCurrency: CurrencyConfig | null;
  subCurrencyCode: string;
  setSubCurrencyCode: (code: string) => void;
  availableSubCurrencies: Array<{ code: string; label: string; config: CurrencyConfig | null }>;
  formatMoney: (
    amountUsd: number,
    options?: { precisionUSD?: number; precisionSub?: number }
  ) => { usd: string; sub?: string; combined: string };
  formatWithSubCurrency: (
    amountUsd: number,
    options?: { precisionUSD?: number; precisionSub?: number }
  ) => string;
}

const STORAGE_KEY = 'copilot_dashboard_preferred_sub_currency';

const CurrencyContext = createContext<CurrencyContextType>({
  subCurrency: null,
  subCurrencyCode: 'none',
  setSubCurrencyCode: () => {},
  availableSubCurrencies: [],
  formatMoney: (amountUsd: number) => ({
    usd: `$${amountUsd.toFixed(2)}`,
    combined: `$${amountUsd.toFixed(2)}`,
  }),
  formatWithSubCurrency: (amountUsd: number) => `$${amountUsd.toFixed(2)}`,
});

export interface CurrencyProviderProps {
  children: ReactNode;
  indexMeta?: IndexMetadata | null;
  activeMonth?: string;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children, indexMeta, activeMonth }) => {
  const targetMonth = activeMonth || indexMeta?.default_scopes?.latest_month;

  // Try refreshing live rates in the background (non-blocking)
  useEffect(() => {
    PublicExchangeRatesService.refreshLiveRates(targetMonth).catch(() => {});
  }, [targetMonth]);

  // Resolve effective billing config for the currently active target month
  const effectiveConfig = useMemo<EnterpriseBillingConfig>(() => {
    const rawBilling = indexMeta?.billing;
    const base: EnterpriseBillingConfig = {
      ...DEFAULT_BILLING_CONFIG,
      currency: rawBilling?.currency || DEFAULT_BILLING_CONFIG.currency,
      subCurrency: rawBilling?.subCurrency ?? null,
      discountPercent: rawBilling?.discountPercent ?? 0,
      periods: rawBilling?.periods,
    };
    return resolveBillingConfigForMonth(base, targetMonth);
  }, [indexMeta, targetMonth]);

  const configuredSub = effectiveConfig.subCurrency;

  const availableSubCurrencies = useMemo(() => {
    const list: Array<{ code: string; label: string; config: CurrencyConfig | null }> = [
      { code: 'none', label: 'USD Only ($)', config: null },
    ];

    const discountPercent = effectiveConfig.discountPercent ?? 0;
    const eaDiscountRate = Math.max(0, 1 - discountPercent / 100);

    // 1. EA-USD ($)
    const eaUsdConfig: CurrencyConfig = {
      code: 'EA-USD',
      symbol: '$',
      exchangeRateFromUSD: eaDiscountRate,
      displayDecimals: 2,
    };
    list.push({
      code: 'EA-USD',
      label: 'USD + EA-USD ($)',
      config: eaUsdConfig,
    });

    // Resolve user-configured rates (or public fallback)
    const jpyBaseRate =
      configuredSub && (configuredSub.code === 'JPY' || configuredSub.code === 'EA-JPY') && configuredSub.exchangeRateFromUSD > 0
        ? configuredSub.exchangeRateFromUSD
        : PublicExchangeRatesService.getExchangeRate('JPY', targetMonth);

    const eurBaseRate =
      configuredSub && (configuredSub.code === 'EUR' || configuredSub.code === 'EA-EUR') && configuredSub.exchangeRateFromUSD > 0
        ? configuredSub.exchangeRateFromUSD
        : PublicExchangeRatesService.getExchangeRate('EUR', targetMonth);

    // 2. EA-JPY (¥)
    const eaJpyConfig: CurrencyConfig = {
      code: 'EA-JPY',
      symbol: '¥',
      exchangeRateFromUSD: Math.round(jpyBaseRate * eaDiscountRate * 10000) / 10000,
      displayDecimals: 0,
    };
    list.push({
      code: 'EA-JPY',
      label: 'USD + EA-JPY (¥)',
      config: eaJpyConfig,
    });

    // 3. EA-EUR (€)
    const eaEurConfig: CurrencyConfig = {
      code: 'EA-EUR',
      symbol: '€',
      exchangeRateFromUSD: Math.round(eurBaseRate * eaDiscountRate * 10000) / 10000,
      displayDecimals: 2,
    };
    list.push({
      code: 'EA-EUR',
      label: 'USD + EA-EUR (€)',
      config: eaEurConfig,
    });

    // If custom non-standard subCurrency was defined in billingConfig
    if (
      configuredSub &&
      !['USD', 'EA-USD', 'JPY', 'EA-JPY', 'EUR', 'EA-EUR'].includes(configuredSub.code)
    ) {
      const code = configuredSub.code.startsWith('EA-') ? configuredSub.code : `EA-${configuredSub.code}`;
      list.push({
        code,
        label: `USD + ${code} (${configuredSub.symbol})`,
        config: {
          ...configuredSub,
          code,
          exchangeRateFromUSD: Math.round(configuredSub.exchangeRateFromUSD * eaDiscountRate * 10000) / 10000,
        },
      });
    }

    return list;
  }, [configuredSub, effectiveConfig, targetMonth]);

  // Determine initial code from localStorage or configured subCurrency (normalizing JPY/EUR to EA-JPY/EA-EUR)
  const [subCurrencyCode, setSubCurrencyCodeState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        if (stored === 'JPY') return 'EA-JPY';
        if (stored === 'EUR') return 'EA-EUR';
        return stored;
      }
    } catch {
      // ignore
    }
    const defaultSub = configuredSub?.code;
    if (defaultSub === 'JPY') return 'EA-JPY';
    if (defaultSub === 'EUR') return 'EA-EUR';
    return defaultSub ?? 'none';
  });

  // Keep in sync if configuredSub changes and user has not set a preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored && configuredSub?.code) {
        const mapped = configuredSub.code === 'JPY' ? 'EA-JPY' : configuredSub.code === 'EUR' ? 'EA-EUR' : configuredSub.code;
        setSubCurrencyCodeState(mapped);
      }
    } catch {
      // ignore
    }
  }, [configuredSub]);

  const setSubCurrencyCode = (code: string) => {
    const normalized = code === 'JPY' ? 'EA-JPY' : code === 'EUR' ? 'EA-EUR' : code;
    setSubCurrencyCodeState(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // ignore
    }
  };

  const activeSubConfig = useMemo<CurrencyConfig | null>(() => {
    if (subCurrencyCode === 'none' || subCurrencyCode === 'USD') return null;
    const normalized = subCurrencyCode === 'JPY' ? 'EA-JPY' : subCurrencyCode === 'EUR' ? 'EA-EUR' : subCurrencyCode;
    const found = availableSubCurrencies.find((c) => c.code === normalized || c.code === subCurrencyCode);
    return found?.config ?? null;
  }, [subCurrencyCode, availableSubCurrencies]);

  const formatMoney = useMemo(() => {
    return (
      amountUsd: number,
      options?: { precisionUSD?: number; precisionSub?: number }
    ) => {
      return Money.formatDualAmount(amountUsd, activeSubConfig, options);
    };
  }, [activeSubConfig]);

  const formatWithSubCurrency = useMemo(() => {
    return (
      amountUsd: number,
      options?: { precisionUSD?: number; precisionSub?: number }
    ) => {
      return Money.formatDualAmount(amountUsd, activeSubConfig, options).combined;
    };
  }, [activeSubConfig]);

  const value: CurrencyContextType = {
    subCurrency: activeSubConfig,
    subCurrencyCode,
    setSubCurrencyCode,
    availableSubCurrencies,
    formatMoney,
    formatWithSubCurrency,
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = (): CurrencyContextType => useContext(CurrencyContext);
