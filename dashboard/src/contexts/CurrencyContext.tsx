import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  CurrencyConfig,
  DEFAULT_CURRENCY_JPY,
  DEFAULT_CURRENCY_EUR,
} from '../../../src/domain/entities/billing-config.js';
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
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children, indexMeta }) => {
  // Built-in presets or configured subCurrency from indexMeta
  const configuredSub = indexMeta?.billing?.subCurrency;

  const availableSubCurrencies = useMemo(() => {
    const list: Array<{ code: string; label: string; config: CurrencyConfig | null }> = [
      { code: 'none', label: 'USD Only ($)', config: null },
    ];

    // If custom subCurrency was defined in billingConfig with non-standard code or rate
    if (configuredSub && configuredSub.code !== 'USD') {
      list.push({
        code: configuredSub.code,
        label: `USD + ${configuredSub.code} (${configuredSub.symbol}) [設定済]`,
        config: configuredSub,
      });
    }

    if (!list.some((c) => c.code === 'JPY')) {
      list.push({
        code: 'JPY',
        label: 'USD + JPY (¥)',
        config: DEFAULT_CURRENCY_JPY,
      });
    }

    if (!list.some((c) => c.code === 'EUR')) {
      list.push({
        code: 'EUR',
        label: 'USD + EUR (€)',
        config: DEFAULT_CURRENCY_EUR,
      });
    }

    return list;
  }, [configuredSub]);

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
