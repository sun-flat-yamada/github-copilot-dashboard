/**
 * 暫定価格カタログ (Provisional Pricing Catalog) — 価格の単一ソース。
 *
 * これまで価格は 19 / 39 / 0.01 / 0.05 / 3,900 が各所に散在し、経路によって同じ消費量で
 * 金額が 5 倍ずれていた (AI クレジット単価 $0.05 と $0.01 の混在)。値はこのモジュールに集約し、
 * 他のモジュールはここ (または billing-config 経由) からだけ価格を取得する。
 *
 * 値の根拠 (GitHub 公開情報。出典は 2026-10-02 時点で複数の二次情報が一致したもの。
 * GitHub 公式ドキュメント本文は作業環境のネットワーク制限で直接確認できていないため、
 * **一次情報との照合は未実施** (バージョン名の `unverified`)。照合したらバージョンから外し、`verifiedAt` を記録する):
 * - Copilot Business $19 / Enterprise $39 (1 ユーザー・月)
 * - 1 GitHub AI Credit = $0.01 (2026-06-01 から使用量ベース課金)
 * - 通常時の包含量: Business 1,900 / Enterprise 3,900 クレジット (ユーザー・月)。請求エンティティ単位のプール
 * - 移行プロモーション (2026-06 〜 2026-08): Business $30 = 3,000 / Enterprise $70 = 7,000 クレジット
 *
 * EA 契約等の個別価格・割引は COPILOT_BILLING_CONFIG (billing-config.ts) が上書きする。
 * このカタログは「設定が無いときの既定値」と「プラン別・期間別の包含量」を提供する。
 */

/** 料金が確定しているプラン。'unknown' (未確定) は含めない — 料金を推測しない */
export type PricedPlanType = 'business' | 'enterprise';

export function isPricedPlan(plan: string | null | undefined): plan is PricedPlanType {
  return plan === 'business' || plan === 'enterprise';
}

export interface PricingCatalogEntry {
  id: string;
  /** 適用開始月 (YYYY-MM, 含む)。省略は無期限 */
  effectiveFrom?: string;
  /** 適用終了月 (YYYY-MM, 含む)。省略は無期限 */
  effectiveTo?: string;
  /** シート単価 (USD / 月) */
  seatPriceUsd: Record<PricedPlanType, number>;
  /** AI クレジット単価 (USD / credit) */
  creditUnitPriceUsd: number;
  /** シートあたりの月間包含クレジット数 (プラン別) */
  includedCreditsPerSeat: Record<PricedPlanType, number>;
  note: string;
}

export const PRICING_CATALOG_VERSION = '2026-10-02-v1-unverified';

/** 通常時 (期間指定のないエントリ)。resolvePricingEntry の既定 */
const BASELINE_ENTRY: PricingCatalogEntry = {
  id: 'baseline',
  seatPriceUsd: { business: 19, enterprise: 39 },
  creditUnitPriceUsd: 0.01,
  includedCreditsPerSeat: { business: 1900, enterprise: 3900 },
  note: 'Baseline: included credits equal the seat price in credits ($19 = 1,900 / $39 = 3,900).',
};

/**
 * 実効期間付きのエントリ。上から順に評価し、最初に月が収まったものを採用する。
 * 期間外・期間指定なしは BASELINE_ENTRY。
 */
export const PRICING_CATALOG: readonly PricingCatalogEntry[] = [
  {
    id: 'usage-billing-transition-promotion-2026-06',
    effectiveFrom: '2026-06',
    effectiveTo: '2026-08',
    seatPriceUsd: { business: 19, enterprise: 39 },
    creditUnitPriceUsd: 0.01,
    includedCreditsPerSeat: { business: 3000, enterprise: 7000 },
    note: 'Transition promotion for usage-based billing: $30 (Business) / $70 (Enterprise) of credits per seat per month.',
  },
  BASELINE_ENTRY,
];

/** 設定・期間指定が無いときの既定値 (billing-config の DEFAULT_BILLING_CONFIG などが参照) */
export const BASELINE_PRICING: Readonly<PricingCatalogEntry> = BASELINE_ENTRY;

function normalizeMonth(month?: string): string | undefined {
  return month && month.length >= 7 ? month.slice(0, 7) : undefined;
}

/**
 * 指定月 (YYYY-MM) に適用されるカタログエントリを返す。月が不明な場合は通常時のエントリ。
 * 現在時刻には依存しない (同じ入力から同じ出力を得る)。
 */
export function resolvePricingEntry(month?: string): PricingCatalogEntry {
  const ym = normalizeMonth(month);
  if (!ym) return BASELINE_ENTRY;
  return (
    PRICING_CATALOG.find(
      (entry) =>
        (entry.effectiveFrom === undefined || entry.effectiveFrom <= ym) &&
        (entry.effectiveTo === undefined || ym <= entry.effectiveTo)
    ) ?? BASELINE_ENTRY
  );
}

/** シート単価 (USD)。プランが未確定の場合は null (推測しない) */
export function getSeatListPriceUsd(plan: string | null | undefined, month?: string): number | null {
  return isPricedPlan(plan) ? resolvePricingEntry(month).seatPriceUsd[plan] : null;
}

/** AI クレジット単価 (USD / credit) */
export function getCreditUnitPriceUsd(month?: string): number {
  return resolvePricingEntry(month).creditUnitPriceUsd;
}

/** シートあたりの月間包含クレジット。プランが未確定の場合は null */
export function getIncludedCreditsPerSeat(plan: string | null | undefined, month?: string): number | null {
  return isPricedPlan(plan) ? resolvePricingEntry(month).includedCreditsPerSeat[plan] : null;
}

export interface CreditsPoolEstimate {
  /** 包含クレジットの合計 (プラン未確定のシートは 0 として数える) */
  includedCredits: number;
  /** プラン未確定のため包含量を算入できなかったシート数 */
  unknownPlanSeats: number;
}

/**
 * 請求エンティティ単位のプール (全シートの包含クレジットの合計) を見積もる。
 * @param includedOverridePerSeat 設定 (EA 契約など) で全プラン共通の包含量が指定されている場合の上書き値
 */
export function estimateIncludedCreditsPool(
  plans: Iterable<string | null | undefined>,
  month?: string,
  includedOverridePerSeat?: number
): CreditsPoolEstimate {
  let includedCredits = 0;
  let unknownPlanSeats = 0;
  for (const plan of plans) {
    const perSeat =
      typeof includedOverridePerSeat === 'number' ? includedOverridePerSeat : getIncludedCreditsPerSeat(plan, month);
    if (perSeat === null) {
      unknownPlanSeats++;
    } else {
      includedCredits += perSeat;
    }
  }
  return { includedCredits, unknownPlanSeats };
}

/**
 * プール使用率 (%)。プールが 0 または未確定のときは算出できないため null。
 * 100% を超える場合 (超過) もそのまま返す (上限で丸めない)。
 */
export function computeCreditsPoolUtilizationPercent(usedCredits: number, poolCredits: number): number | null {
  if (!(poolCredits > 0)) return null;
  return Number(((usedCredits / poolCredits) * 100).toFixed(1));
}
