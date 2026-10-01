import {
  CopilotPlanType,
  CopilotSeatAssignment,
  CostCenterBudget,
  EnrichedUserSeat,
  EnterpriseCostCenter,
} from '../types/copilot.js';
import { AttributeResolver } from '../collector/attribute-resolver.js';
import { getSeatPricing, Money } from '../domain/value-objects/Money.js';
import { SeatClassificationRule } from '../domain/rules/SeatClassificationRule.js';
import { SeatBillingRule } from '../domain/rules/SeatBillingRule.js';
import { BudgetUtilizationRule } from '../domain/rules/BudgetUtilizationRule.js';
import { CreditsBillingService } from '../application/services/CreditsBillingService.js';
import { AdoptionPhase } from '../domain/entities/agent-metrics.js';
import { UNASSIGNED_LABELS } from '../domain/constants/unassigned.js';
import { BASELINE_PRICING, isPricedPlan, PricedPlanType } from '../domain/pricing/pricing-catalog.js';

import { BillingConfigLoader } from '../adapters/storage/BillingConfigLoader.js';
import { calculateEffectiveSeatPrice } from '../domain/entities/billing-config.js';

/** 料金が確定しているプランのシート単価。'unknown' (未確定) は含めない */
export const getCopilotPricing = (targetMonth?: string): Record<PricedPlanType, number> => {
  if (targetMonth) {
    const config = BillingConfigLoader.loadForMonth(targetMonth);
    const biz = calculateEffectiveSeatPrice(config, 'business');
    const ent = calculateEffectiveSeatPrice(config, 'enterprise');
    return {
      business: biz,
      enterprise: ent,
    };
  }
  const pricing = getSeatPricing();
  return {
    business: pricing.business.amount,
    enterprise: pricing.enterprise.amount,
  };
};

/** 価格カタログの通常時シート単価 (単一ソースは src/domain/pricing) */
export const COPILOT_PRICING: Record<PricedPlanType, number> = {
  business: BASELINE_PRICING.seatPriceUsd.business,
  enterprise: BASELINE_PRICING.seatPriceUsd.enterprise,
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

export interface BillingCalculatorOptions {
  /**
   * 「データ取得不可」として扱う Organization 名。
   * 本番のロジックにデモ用の Org 名を埋め込まないよう、モックデータの運用 (デモ表示用) でのみ
   * Composition Root / オーケストレーターから明示的に注入する。
   */
  dataUnavailableOrgs?: readonly string[];
}

export class BillingCalculator {
  private resolver: AttributeResolver;
  private costCenterMap: Map<string, string> = new Map(); // login or org -> cost_center_name
  private referenceDate: Date;
  private dataUnavailableOrgs: ReadonlySet<string>;

  constructor(
    resolver: AttributeResolver,
    costCenters: EnterpriseCostCenter[] = [],
    referenceDateStr: string = '2026-09-10',
    options: BillingCalculatorOptions = {}
  ) {
    this.resolver = resolver;
    this.referenceDate = new Date(referenceDateStr);
    this.dataUnavailableOrgs = new Set(options.dataUnavailableOrgs ?? []);
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
    const orgName = seat.organization?.login || UNASSIGNED_LABELS.organization;
    const attr = this.resolver.resolve(login);

    // Cost Centerの決定 (優先度: 1. 属性Override, 2. User紐付け, 3. Org紐付け, 4. デフォルト)
    let costCenter = attr.costCenterOverride;
    let costCenterError = false;

    if (!costCenter) {
      const found = this.costCenterMap.get(login.toLowerCase()) ||
                    this.costCenterMap.get(orgName.toLowerCase());
      if (found) {
        costCenter = found;
      } else {
        costCenter = UNASSIGNED_LABELS.costCenter;
        // 未割り当て・未解決の検出 (Organization も特定できない場合は要確認)
        if (orgName === UNASSIGNED_LABELS.organization || this.dataUnavailableOrgs.has(orgName)) {
          costCenterError = true;
        }
      }
    }

    // 取得エラー扱いの Organization (デモ用の模擬障害など。明示的に注入されたものだけ)
    const isDataUnavailable = this.dataUnavailableOrgs.has(orgName);

    const targetMonth = this.referenceDate.toISOString().slice(0, 7);
    const pricing = getCopilotPricing(targetMonth);

    // plan_type が未確定 (unknown / 欠損) のシートは料金を推測しない (旧: enterprise=$39 と見なしていた)。
    // 費用は 0 として集計に含め、cost_unconfirmed で「未確定」を明示する。
    const planType: CopilotPlanType = seat.plan_type ?? 'unknown';
    const costUnconfirmed = !isPricedPlan(planType);
    const monthlyCost = isPricedPlan(planType) ? pricing[planType] : 0;
    const proratedDailyCost = Number((monthlyCost / daysInMonth).toFixed(4));

    // 非アクティブ日数とステータス判定
    let daysInactive = 999;
    let daysSinceCreation = 999;
    if (seat.created_at) {
      const createdDate = new Date(seat.created_at);
      const diffMs = this.referenceDate.getTime() - createdDate.getTime();
      daysSinceCreation = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    if (seat.last_activity_at) {
      const lastAct = new Date(seat.last_activity_at);
      const diffMs = this.referenceDate.getTime() - lastAct.getTime();
      daysInactive = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    const status = SeatClassificationRule.classify({
      daysInactive,
      daysSinceCreation,
      aiCreditsUsed28d: seat.ai_credits_used,
      hasActivity: Boolean(seat.last_activity_at),
    });

    const aiCreditsUsed28d = seat.ai_credits_used ?? 0;
    const aiCreditsCostUsd = CreditsBillingService.calculateCreditsCost(
      aiCreditsUsed28d,
      undefined,
      undefined,
      targetMonth
    ).amount;

    const seatBilling = SeatBillingRule.evaluate({
      createdAt: seat.created_at,
      planType,
      monthlyPrice: Money.fromUsd(monthlyCost),
      targetMonth: this.referenceDate.toISOString().slice(0, 7),
      daysInMonth,
      isPrepaid: seat.prepaid ?? false,
    });

    // 採用成熟度は、実測 (チャット数・エージェントセッション数等) が無い段階では算出しない。
    // 旧実装は active なら「提案 100・チャット 10」といった代理値を与えており、active なユーザーが
    // 全員 agent_first 以上に分類されていた。管理者がマッピングで明示した値のみを採用する。
    const adoptionPhase = attr.targetAdoptionPhase as AdoptionPhase | undefined;

    return {
      login: attr.login,
      display_name: attr.displayName,
      // 匿名化モードでは avatar_url (数値ユーザー ID を含み、公開 API で本人に解決できる) を出力しない
      avatar_url: this.resolver.isAnonymizing() ? '' : seat.assignee.avatar_url,
      department: attr.department,
      cost_center: costCenter,
      organization: orgName,
      plan_type: planType,
      monthly_cost_usd: monthlyCost,
      prorated_daily_cost_usd: proratedDailyCost,
      ...(costUnconfirmed ? { cost_unconfirmed: true } : {}),
      created_at: seat.created_at,
      last_activity_at: seat.last_activity_at,
      last_activity_editor: seat.last_activity_editor,
      days_inactive: daysInactive,
      status,
      notes: attr.notes,
      tags: attr.tags,
      is_data_unavailable: isDataUnavailable,
      cost_center_error: costCenterError,
      ai_credits_used_28d: aiCreditsUsed28d,
      ai_credits_cost_usd: aiCreditsCostUsd,
      ai_adoption_phase: adoptionPhase,
      teams: attr.teams,
      projects: attr.projects,
      role: attr.role,
      prepaid: seatBilling.isPrepaid,
      billing_effective_date: seatBilling.billingEffectiveDate,
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
   * 使用率・残余・ステータスの評価は BudgetUtilizationRule (唯一の実装) に委譲する。
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

      const evaluation = BudgetUtilizationRule.evaluateUsd(limit, free, spend);

      results.push({
        cost_center_id: ccId,
        cost_center_name: ccName,
        cost_center_code: ccCode,
        spending_limit_usd: limit,
        free_tier_budget_usd: free,
        current_spend_usd: Number(spend.toFixed(2)),
        ...evaluation,
      });
    }

    return results;
  }
}
