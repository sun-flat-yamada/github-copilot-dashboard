import { DomainError } from './DomainError.js';
import { CurrencyConfig, DEFAULT_CURRENCY_USD } from '../entities/billing-config.js';

export class Money {
  readonly amount: number;
  readonly currency: string;

  constructor(amount: number, currency: string = 'USD') {
    if (isNaN(amount) || !isFinite(amount)) {
      throw new DomainError('Money amount must be a finite number');
    }
    // 小数第4位に丸めて浮動小数点誤差を防止
    this.amount = Math.round(amount * 10000) / 10000;
    this.currency = currency;
  }

  add(other: Money): Money {
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  applyDiscount(discountPercent: number): Money {
    const multiplier = Math.max(0, 1 - discountPercent / 100);
    return new Money(this.amount * multiplier, this.currency);
  }

  convertCurrency(exchangeRate: number, targetCurrencyCode: string): Money {
    return new Money(this.amount * exchangeRate, targetCurrencyCode);
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  format(): string {
    return `$${this.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatWithCurrency(currencyConfig: CurrencyConfig = DEFAULT_CURRENCY_USD, options?: { precision?: number }): string {
    const decimals = typeof options?.precision === 'number'
      ? options.precision
      : currencyConfig.displayDecimals;

    const formattedNum = this.amount.toLocaleString(
      currencyConfig.code === 'JPY' ? 'ja-JP' : 'en-US',
      {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }
    );

    return `${currencyConfig.symbol}${formattedNum}`;
  }

  equals(other: Money): boolean {
    return Math.abs(this.amount - other.amount) < 0.0001 && this.currency === other.currency;
  }

  static zero(currency: string = 'USD'): Money {
    return new Money(0, currency);
  }

  static fromUsd(amount: number): Money {
    return new Money(amount, 'USD');
  }

  static of(amount: number, currency: string = 'USD'): Money {
    return new Money(amount, currency);
  }
}

export interface SeatPricing {
  business: Money;
  enterprise: Money;
}

export function getSeatPricing(): SeatPricing {
  const defaultBusiness = 19;
  const defaultEnterprise = 39;
  const overrideStr = typeof process !== 'undefined' ? process.env?.COPILOT_SEAT_PRICING_OVERRIDE : undefined;
  if (overrideStr) {
    try {
      const parsed = JSON.parse(overrideStr);
      return {
        business: Money.fromUsd(Number(parsed.business ?? defaultBusiness)),
        enterprise: Money.fromUsd(Number(parsed.enterprise ?? defaultEnterprise)),
      };
    } catch {
      const matchB = overrideStr.match(/business=(\d+(\.\d+)?)/i);
      const matchE = overrideStr.match(/enterprise=(\d+(\.\d+)?)/i);
      return {
        business: Money.fromUsd(matchB ? Number(matchB[1]) : defaultBusiness),
        enterprise: Money.fromUsd(matchE ? Number(matchE[1]) : defaultEnterprise),
      };
    }
  }
  return {
    business: Money.fromUsd(defaultBusiness),
    enterprise: Money.fromUsd(defaultEnterprise),
  };
}
