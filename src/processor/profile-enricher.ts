import { CopilotSeatAssignment, EnrichedUserSeat, UserUsageProfile } from '../types/copilot.js';
import type { ResolvedUserAttribute } from '../collector/attribute-resolver.js';

/** 属性解決 (表示名・部署・Cost Center など)。匿名化モードではログイン名を仮名にして返す */
export interface ProfileAttributeResolver {
  resolve(login: string): ResolvedUserAttribute;
}

/**
 * レポート由来のユーザー別プロファイル (ログイン名は GitHub の実ログイン) に、
 * シートと属性マッピングから表示名・部署・Cost Center・組織・プランを補う。
 *
 * - seats[i] と enrichedSeats[i] は同じ順序 (BillingCalculator.enrichAllSeats は 1 対 1 の写像)
 * - シートの無いユーザー (席の解除後・Enterprise の対象外など) は、属性マッピングだけで補い、
 *   プランは未確定 (unknown) のままにする
 * - 匿名化モードでは、出力のログイン名を仮名にする (resolver が返す login / シート側の仮名と一致)
 */
export function enrichUserProfiles(
  profiles: UserUsageProfile[],
  seats: CopilotSeatAssignment[],
  enrichedSeats: EnrichedUserSeat[],
  resolver: ProfileAttributeResolver
): UserUsageProfile[] {
  const seatByRawLogin = new Map<string, EnrichedUserSeat>();
  seats.forEach((seat, i) => {
    const enriched = enrichedSeats[i];
    if (enriched) seatByRawLogin.set(seat.assignee.login.toLowerCase(), enriched);
  });

  return profiles.map((profile) => {
    const seat = seatByRawLogin.get(profile.login.toLowerCase());
    if (seat) {
      return {
        ...profile,
        login: seat.login,
        display_name: seat.display_name,
        avatar_url: seat.avatar_url,
        department: seat.department,
        cost_center: seat.cost_center,
        organization: seat.organization,
        plan_type: seat.plan_type,
        ...(seat.tags ? { tags: seat.tags } : {}),
      };
    }

    const resolved = resolver.resolve(profile.login);
    return {
      ...profile,
      login: resolved.login,
      display_name: resolved.displayName,
      department: resolved.department,
      cost_center: resolved.costCenterOverride ?? '',
      ...(resolved.tags ? { tags: resolved.tags } : {}),
    };
  });
}
