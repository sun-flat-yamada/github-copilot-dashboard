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
      { code: 'none', label: 'USD Only ($) [GitHubカタログ価格]', config: null },
    ];

    // EA-USD: Enterprise Agreement discounted USD display option
    const discountPercent = effectiveConfig.discountPercent ?? 0;
    const eaRate = Math.max(0, 1 - discountPercent / 100);
    const eaConfig: CurrencyConfig = {
      code: 'EA-USD',
      symbol: '$',
      exchangeRateFromUSD: eaRate,
      displayDecimals: 2,
    };
    list.push({
      code: 'EA-USD',
      label: `USD + EA-USD ($) [EA契約価格${discountPercent > 0 ? ` -${discountPercent}%` : ''}]`,
      config: eaConfig,
    });

    // If custom subCurrency was defined in billingConfig with non-standard code or rate
    if (configuredSub && configuredSub.code !== 'USD' && configuredSub.code !== 'EA-USD') {
      list.push({
        code: configuredSub.code,
        label: `USD + ${configuredSub.code} (${configuredSub.symbol}) [設定済]`,
        config: configuredSub,
      });
    }

    // Dynamic public exchange rate for current context/month from reliable public data (ECB/BOJ)
    const jpyPublicRate = PublicExchangeRatesService.getExchangeRate('JPY', targetMonth);
    const eurPublicRate = PublicExchangeRatesService.getExchangeRate('EUR', targetMonth);

    if (!list.some((c) => c.code === 'JPY')) {
      list.push({
        code: 'JPY',
        label: `USD + JPY (¥) [公的参照: 1$=${jpyPublicRate}円]`,
        config: {
          code: 'JPY',
          symbol: '¥',
          exchangeRateFromUSD: jpyPublicRate,
          displayDecimals: 0,
        },
      });
    }

    if (!list.some((c) => c.code === 'EUR')) {
      list.push({
        code: 'EUR',
        label: `USD + EUR (€) [公的参照: 1$=${eurPublicRate}€]`,
        config: {
          code: 'EUR',
          symbol: '€',
          exchangeRateFromUSD: eurPublicRate,
          displayDecimals: 2,
        },
      });
    }

    return list;
  }, [configuredSub, effectiveConfig, targetMonth]);

  // Determine initial code from localStorage or configured subCurrency
  const [subCurrencyCode, setSubCurrencyCodeState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    } catch {
      // ignore
    }
    return configuredSub?.code ?? 'none';
  });

  // Keep in sync if configuredSub changes and user has not set a preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored && configuredSub?.code) {
        setSubCurrencyCodeState(configuredSub.code);
      }
    } catch {
      // ignore
    }
  }, [configuredSub]);

  const setSubCurrencyCode = (code: string) => {
    setSubCurrencyCodeState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  };

  const activeSubConfig = useMemo<CurrencyConfig | null>(() => {
    if (subCurrencyCode === 'none' || subCurrencyCode === 'USD') return null;
    const found = availableSubCurrencies.find((c) => c.code === subCurrencyCode);
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
