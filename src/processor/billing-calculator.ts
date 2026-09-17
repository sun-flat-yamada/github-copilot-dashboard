import {
  CopilotPlanType,
  CopilotSeatAssignment,
  CostCenterBudget,
  EnrichedUserSeat,
  EnterpriseCostCenter,
  UserSeatStatus,
} from '../types/copilot.js';
import { AttributeResolver } from '../collector/attribute-resolver.js';

export const COPILOT_PRICING: Record<CopilotPlanType, number> = {
  business: 19.0,
  enterprise: 39.0,
};

/**
 * 管理者が COPILOT_COST_CENTER_BUDGETS 環境変数(JSON)で宣言する予算設定。
 * GitHub の公開APIには Cost Center の上限額(Budget)/無料枠を取得するエンドポイントが
 * 存在しないため、この値は必ず管理者による明示的な設定に由来し、絶対に自動生成/推測しない。
 */
export interface CostCenterBudgetConfigEntry {
  cost_center_id?: string;
  cost_center_name?: string;
  spending_limit_usd: number;
  free_tier_budget_usd: number;
}

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

  /**
   * COPILOT_COST_CENTER_BUDGETS 環境変数(JSON配列 or 単一オブジェクト)をパースする。
   * 未設定・不正な値の場合は例外を投げず空配列を返す（実データ運用を止めないため）。
   */
  public static parseBudgetConfig(raw?: string): CostCenterBudgetConfigEntry[] {
    if (!raw || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  /**
   * 実データ運用時の Cost Center Budget を計算する。
   * GitHub Public API には Budget(上限額/無料枠)を返すエンドポイントが存在しないため、
   * - 上限額(spending_limit_usd) / 無料枠(free_tier_budget_usd) は管理者が宣言した budgetConfig からのみ取得（未宣言時は 0）
   * - 現在使用額(current_spend_usd) は実際の EnrichedUserSeat.monthly_cost_usd をCost Center単位で集計した実値
   * を用いる。モックデータやランダム値は一切生成しない。
   */
  public static computeCostCenterBudgets(
    enrichedSeats: EnrichedUserSeat[],
    costCenters: EnterpriseCostCenter[],
    budgetConfig: CostCenterBudgetConfigEntry[]
  ): CostCenterBudget[] {
    if (enrichedSeats.length === 0) return [];

    const nameToId = new Map(costCenters.map((cc) => [cc.name.toLowerCase(), cc.id]));
    const nameToCode = new Map(costCenters.map((cc) => [cc.name.toLowerCase(), cc.cost_center_code]));

    const configByKey = new Map<string, CostCenterBudgetConfigEntry>();
    for (const cfg of budgetConfig) {
      if (cfg.cost_center_id) configByKey.set(`id:${cfg.cost_center_id}`, cfg);
      if (cfg.cost_center_name) configByKey.set(`name:${cfg.cost_center_name.toLowerCase()}`, cfg);
    }

    const spendByName = new Map<string, number>();
    for (const seat of enrichedSeats) {
      spendByName.set(seat.cost_center, (spendByName.get(seat.cost_center) || 0) + seat.monthly_cost_usd);
    }

    const results: CostCenterBudget[] = [];
    for (const [ccName, spend] of spendByName.entries()) {
      const ccId = nameToId.get(ccName.toLowerCase()) || ccName;
      const ccCode = nameToCode.get(ccName.toLowerCase()) || '';
      const cfg = configByKey.get(`id:${ccId}`) || configByKey.get(`name:${ccName.toLowerCase()}`);
      const limit = cfg?.spending_limit_usd ?? 0;
      const free = cfg?.free_tier_budget_usd ?? 0;

      const netBillable = Math.max(0, spend - free);
      const remaining = Math.max(0, limit - netBillable);
      const utilPercent = limit > 0 ? Number(((netBillable / limit) * 100).toFixed(1)) : 0;

      let status: CostCenterBudget['status'] = 'normal';
      if (utilPercent >= 100) {
        status = 'exceeded';
      } else if (utilPercent >= 80) {
        status = 'warning';
      }

      results.push({
        cost_center_id: ccId,
        cost_center_name: ccName,
        cost_center_code: ccCode,
        spending_limit_usd: limit,
        free_tier_budget_usd: free,
        current_spend_usd: Number(spend.toFixed(2)),
        net_billable_spend_usd: Number(netBillable.toFixed(2)),
        remaining_budget_usd: Number(remaining.toFixed(2)),
        budget_utilization_percent: utilPercent,
        status,
      });
    }

    return results;
  }
}
