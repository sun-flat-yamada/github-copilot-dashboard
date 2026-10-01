import { UserSeatStatus } from '../entities/copilot.js';

export interface SeatClassificationInput {
  daysInactive: number;
  daysSinceCreation: number;
  aiCreditsUsed28d?: number;
  /**
   * last_activity_at が存在するか。日数だけでは「付与日当日に利用した」のか「一度も使っていない」のかを
   * 区別できないため (daysInactive == daysSinceCreation)、分かっている場合は渡す。
   */
  hasActivity?: boolean;
}

/** 付与からこの日数未満の未使用シートは「導入期間 (onboarding)」とし、遊休に数えない */
export const SEAT_ONBOARDING_DAYS = 7;
/** この日数を超えて未使用なら遊休 (idle) */
export const SEAT_IDLE_DAYS = 30;
/** この日数を超えて未使用なら低稼働 (low_active)。AI クレジット消費が 0 と判明している場合は遊休 */
export const SEAT_LOW_ACTIVE_DAYS = 14;

/**
 * 遊休の判定基準を説明する表示用テキスト。UI のラベルはここから取得し、
 * 実際の判定 (classify) との乖離 (旧: ラベルは「30日以上未利用」だが判定はそれより緩い) を防ぐ。
 */
export const SEAT_IDLE_CRITERIA_TEXT = `${SEAT_IDLE_DAYS}日超 未利用 (AIクレジット消費0は${SEAT_LOW_ACTIVE_DAYS}日超)`;

/**
 * SDD-06 Specification & AI Credits Linked Seat Classification Rule.
 * Classifies seat usage into: 'active' | 'low_active' | 'idle' | 'never_used' | 'onboarding'
 *
 * - onboarding: 付与から SEAT_ONBOARDING_DAYS 日未満で、付与後まだ利用がない。遊休 (削減可能額) に含めない
 * - never_used: 付与から SEAT_ONBOARDING_DAYS 日以上経過しても一度も利用がない
 * - idle: SEAT_IDLE_DAYS 日超未使用、または SEAT_LOW_ACTIVE_DAYS 日超未使用かつ AI クレジット消費が 0
 * - low_active: SEAT_LOW_ACTIVE_DAYS 日超未使用
 * - active: それ以外
 */
export class SeatClassificationRule {
  static classify(input: SeatClassificationInput): UserSeatStatus {
    const { daysInactive, daysSinceCreation, aiCreditsUsed28d, hasActivity } = input;

    // 付与後に一度も利用していない (最終活動が付与日以前、または活動なし)。
    // 活動の有無が分かる場合、付与日当日の活動 (daysInactive == daysSinceCreation) は利用済みとする。
    const unusedSinceGrant = hasActivity === true ? daysInactive > daysSinceCreation : daysInactive >= daysSinceCreation;

    // 付与直後のシートが未使用なのは想定内。遊休 (削減可能) として誤検出しない
    if (daysSinceCreation < SEAT_ONBOARDING_DAYS && unusedSinceGrant) {
      return 'onboarding';
    }
    if (daysSinceCreation >= SEAT_ONBOARDING_DAYS && unusedSinceGrant) {
      return 'never_used';
    }
    // Inactive > 30 days, or > 14 days with zero AI credits consumption -> idle
    if (daysInactive > SEAT_IDLE_DAYS || (daysInactive > SEAT_LOW_ACTIVE_DAYS && aiCreditsUsed28d === 0)) {
      return 'idle';
    }
    if (daysInactive > SEAT_LOW_ACTIVE_DAYS) {
      return 'low_active';
    }
    return 'active';
  }
}

/** 遊休 (削減可能) として数えるステータス。onboarding は含めない */
export function isIdleSeatStatus(status: UserSeatStatus): boolean {
  return status === 'idle' || status === 'never_used';
}

/** 稼働中として数えるステータス */
export function isActiveSeatStatus(status: UserSeatStatus): boolean {
  return status === 'active' || status === 'low_active';
}
