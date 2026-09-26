import { DomainError } from './DomainError.js';

export class Money {
  readonly amount: number;
  readonly currency: 'USD';

  constructor(amount: number, currency: 'USD' = 'USD') {
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

  isZero(): boolean {
    return this.amount === 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  format(): string {
    return `$${this.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  equals(other: Money): boolean {
    return Math.abs(this.amount - other.amount) < 0.0001 && this.currency === other.currency;
  }

  static zero(): Money {
    return new Money(0);
  }

  static fromUsd(amount: number): Money {
    return new Money(amount, 'USD');
  }
}
