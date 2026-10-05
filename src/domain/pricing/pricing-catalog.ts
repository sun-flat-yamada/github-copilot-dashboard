/**
 * 価格カタログ (Pricing Catalog) — 価格の単一ソース。
 *
 * これまで価格は 19 / 39 / 0.01 / 0.05 / 3,900 が各所に散在し、経路によって同じ消費量で
 * 金額が 5 倍ずれていた (AI クレジット単価 $0.05 と $0.01 の混在)。値はこのモジュールに集約し、
 * 他のモジュールはここ (または billing-config 経由) からだけ価格を取得する。
 *
 * 値の根拠 (一次情報との照合済み。照合日 2026-10-05):
 * GitHub 公式ドキュメント (docs.github.com) のソースである `github/docs` リポジトリの
 * コミット 45a0f053ac67e8d1f56fc8f7ee38f0b2a58925c3 の content/ と data/ で照合した
 * (docs.github.com 自体は作業環境から到達できないため。出典パスは各エントリの `verification`)。
 * - Copilot Business $19 / Enterprise $39 (1 ユーザー・月)
 * - 1 GitHub AI Credit = $0.01 (2026-06-01 から使用量ベース課金)
 * - 通常時の包含量: Business 1,900 / Enterprise 3,900 クレジット (ユーザー・月)。請求エンティティ単位のプール
 * - 移行プロモーション (2026-06 〜 2026-08): Business 3,000 / Enterprise 7,000 クレジット
 *   (公式では「既存顧客」のみが対象。このカタログは新規・既存を区別できず全シートに適用する — SDD-06 参照)
 *
 * 値を変えるとき・再照合したときは PRICING_CATALOG_VERSION を上げ、`verification` を更新する。
 * 一次情報で確認できない値を追加する場合は、版名に `unverified` を付け、`verification` を付けない (推測値を照合済みとして扱わない)。
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
  /** 一次情報との照合記録。照合できていないエントリには付けない */
  verification?: PricingVerification;
}

/** 一次情報 (GitHub 公式ドキュメント) との照合記録 */
export interface PricingVerification {
  /** 照合日 (YYYY-MM-DD) */
  verifiedAt: string;
  /** 照合した出典 (`github/docs` のパス。`@<commit>` 付き) */
  sources: readonly string[];
}

/** 照合に使った一次情報のソース (docs.github.com のソースリポジトリ) */
export const PRICING_CATALOG_VERIFICATION = {
  verifiedAt: '2026-10-05',
  repository: 'github/docs',
  commit: '45a0f053ac67e8d1f56fc8f7ee38f0b2a58925c3',
} as const;

const DOCS_AT = `@${PRICING_CATALOG_VERIFICATION.commit}`;
/** プロモーション記述は期限切れで削除済み (github/docs 19a110200a3b)。削除直前のコミットで照合した */
const DOCS_BEFORE_PROMO_REMOVAL = '@f169461e985f3820a38233db99648dc0e75fd4dc';

const BASELINE_SOURCES: readonly string[] = [
  `data/variables/copilot.yml${DOCS_AT}`,
  `data/variables/product.yml${DOCS_AT}`,
  `content/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing.md${DOCS_AT}`,
  `content/copilot/concepts/billing-and-usage/organizations-and-enterprises/seats-and-billing-cycles.md${DOCS_AT}`,
  `content/copilot/reference/copilot-billing/request-based-billing-legacy/what-changed-with-billing.md${DOCS_AT}`,
];

export const PRICING_CATALOG_VERSION = '2026-10-05-v2';

/** 通常時 (期間指定のないエントリ)。resolvePricingEntry の既定 */
const BASELINE_ENTRY: PricingCatalogEntry = {
  id: 'baseline',
  seatPriceUsd: { business: 19, enterprise: 39 },
  creditUnitPriceUsd: 0.01,
  includedCreditsPerSeat: { business: 1900, enterprise: 3900 },
  note: 'Baseline: included credits equal the seat price in credits ($19 = 1,900 / $39 = 3,900).',
  verification: { verifiedAt: PRICING_CATALOG_VERIFICATION.verifiedAt, sources: BASELINE_SOURCES },
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
    note:
      'Transition promotion for usage-based billing (June 1 - September 1, 2026): $30 (Business) / $70 (Enterprise) of credits per seat per month. ' +
      'Officially for existing customers only; applied to every seat here because new and existing customers cannot be told apart.',
    verification: {
      verifiedAt: PRICING_CATALOG_VERIFICATION.verifiedAt,
      sources: [
        `data/variables/copilot.yml${DOCS_AT}`,
        `content/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing.md${DOCS_BEFORE_PROMO_REMOVAL}`,
      ],
    },
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
