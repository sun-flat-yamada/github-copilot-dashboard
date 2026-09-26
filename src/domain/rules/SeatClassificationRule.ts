import { UserSeatStatus } from '../entities/copilot.js';

export interface SeatClassificationInput {
  daysInactive: number;
  daysSinceCreation: number;
  aiCreditsUsed28d?: number;
}

/**
 * SDD-06 Specification & AI Credits Linked Seat Classification Rule.
 * Classifies seat usage into: 'active' | 'low_active' | 'idle' | 'never_used'
 */
export class SeatClassificationRule {
  static classify(input: SeatClassificationInput): UserSeatStatus {
    const { daysInactive, daysSinceCreation, aiCreditsUsed28d } = input;

    if (daysSinceCreation >= 7 && daysInactive >= daysSinceCreation) {
      return 'never_used';
    }
    // Inactive > 30 days, or > 14 days with zero AI credits consumption -> idle
    if (daysInactive > 30 || (daysInactive > 14 && aiCreditsUsed28d === 0)) {
      return 'idle';
    }
    if (daysInactive > 14) {
      return 'low_active';
    }
    return 'active';
  }
}
