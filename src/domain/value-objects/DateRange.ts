import { DomainError } from './DomainError.js';

export class DateRange {
  readonly start: string; // YYYY-MM-DD
  readonly end: string;   // YYYY-MM-DD
  readonly daysCount: number;

  constructor(start: string, end: string) {
    if (!start || !end) {
      throw new DomainError('DateRange start and end must not be empty');
    }
    if (start > end) {
      throw new DomainError(`start date (${start}) must be <= end date (${end})`);
    }
    this.start = start;
    this.end = end;
    this.daysCount = this.calcDays();
  }

  private calcDays(): number {
    const s = new Date(this.start);
    const e = new Date(this.end);
    const diffTime = e.getTime() - s.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  contains(date: string): boolean {
    return date >= this.start && date <= this.end;
  }

  equals(other: DateRange): boolean {
    return this.start === other.start && this.end === other.end;
  }
}
