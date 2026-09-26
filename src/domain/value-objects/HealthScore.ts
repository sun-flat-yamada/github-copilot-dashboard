import { DomainError } from './DomainError.js';

export class HealthScore {
  readonly value: number;

  constructor(value: number) {
    if (isNaN(value) || value < 0 || value > 100) {
      throw new DomainError(`HealthScore must be between 0 and 100, received: ${value}`);
    }
    this.value = Math.round(value);
  }

  get status(): 'healthy' | 'warning' | 'critical' {
    if (this.value >= 70) return 'healthy';
    if (this.value >= 40) return 'warning';
    return 'critical';
  }

  equals(other: HealthScore): boolean {
    return this.value === other.value;
  }
}
