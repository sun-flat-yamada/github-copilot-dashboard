import {
  CopilotPlanType,
  CopilotSeatAssignment,
  EnrichedUserSeat,
  EnterpriseCostCenter,
  UserSeatStatus,
} from '../types/copilot.js';
import { AttributeResolver } from '../collector/attribute-resolver.js';

export const COPILOT_PRICING: Record<CopilotPlanType, number> = {
  business: 19.0,
  enterprise: 39.0,
};

export class BillingCalculator {
  private resolver: AttributeResolver;
  private costCenterMap: Map<string, string> = new Map(); // login or org -> cost_center_name
  private referenceDate: Date;

  constructor(
    resolver: AttributeResolver,
    costCenters: EnterpriseCostCenter[] = [],
    referenceDateStr: string = '2026-09-10'
  ) {
    this.resolver = resolver;
    this.referenceDate = new Date(referenceDateStr);
    this.buildCostCenterIndex(costCenters);
  }

  private buildCostCenterIndex(costCenters: EnterpriseCostCenter[]): void {
    for (const cc of costCenters) {
      for (const res of cc.resources) {
        this.costCenterMap.set(res.name.toLowerCase(), cc.name);
      }
    }
  }

  /**
   * 単一ユーザーのシート情報をエンリッチメントし、費用とステータスを計算
   */
  public enrichSeat(seat: CopilotSeatAssignment, daysInMonth: number = 30): EnrichedUserSeat {
    const login = seat.assignee.login;
    const orgName = seat.organization?.login || 'Default-Org';
    const attr = this.resolver.resolve(login);

    // Cost Centerの決定 (優先度: 1. 属性Override, 2. User紐付け, 3. Org紐付け, 4. デフォルト)
    let costCenter = attr.costCenterOverride;
    let costCenterError = false;
    let isDataUnavailable = false;

    if (!costCenter) {
      const found = this.costCenterMap.get(login.toLowerCase()) ||
                    this.costCenterMap.get(orgName.toLowerCase());
      if (found) {
        costCenter = found;
      } else {
        costCenter = 'Default-CostCenter';
        // 未割り当て・未解決の検出
        if (orgName === 'proud-internal-sys' || orgName === 'Default-Org') {
          costCenterError = true;
        }
      }
    }

    // 異常Orgまたは特定ステータスでデータ取得エラーのフラグ
    if (orgName === 'proud-internal-sys') {
      isDataUnavailable = true;
    }

    const planType: CopilotPlanType = seat.plan_type === 'business' ? 'business' : 'enterprise';
    const monthlyCost = COPILOT_PRICING[planType];
    const proratedDailyCost = Number((monthlyCost / daysInMonth).toFixed(4));

    // 非アクティブ日数とステータス判定
    let daysInactive = 999;
    let status: UserSeatStatus = 'never_used';

    if (seat.last_activity_at) {
      const lastAct = new Date(seat.last_activity_at);
      const diffMs = this.referenceDate.getTime() - lastAct.getTime();
      daysInactive = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      if (daysInactive <= 14) {
        status = 'active';
      } else if (daysInactive <= 30) {
        status = 'low_active';
      } else {
        status = 'idle';
      }
    } else {
      status = 'never_used';
    }

    return {
      login: attr.login,
      display_name: attr.displayName,
      avatar_url: seat.assignee.avatar_url,
      department: attr.department,
      cost_center: costCenter,
      organization: orgName,
      plan_type: planType,
      monthly_cost_usd: monthlyCost,
      prorated_daily_cost_usd: proratedDailyCost,
      created_at: seat.created_at,
      last_activity_at: seat.last_activity_at,
      last_activity_editor: seat.last_activity_editor,
      days_inactive: daysInactive,
      status,
      notes: attr.notes,
      is_data_unavailable: isDataUnavailable,
      cost_center_error: costCenterError,
    };
  }

  /**
   * 全シートのエンリッチメントリストを生成
   */
  public enrichAllSeats(seats: CopilotSeatAssignment[], daysInMonth: number = 30): EnrichedUserSeat[] {
    return seats.map((seat) => this.enrichSeat(seat, daysInMonth));
  }

  /**
   * 対象年月の暦日数を取得
   */
  public static getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }
}
