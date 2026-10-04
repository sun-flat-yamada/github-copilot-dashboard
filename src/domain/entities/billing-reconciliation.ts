/**
 * 請求突合 (P4-4 / E-03)。
 *
 * ダッシュボードの計算額 (Billing API が返した数量 × ダッシュボードの単価) と、Billing API の金額 (gross) を
 * 月ごとに突合する。保存するのは日 × SKU × モデルの数量と金額の集計だけで、利用者・組織・Cost Center の
 * 識別子は持たない。ただし実際の請求額に由来するため GitHub Pages へは配信しない (`audit/` 配下、SDD-17 §5)。
 */
export const BILLING_RECONCILIATION_SCHEMA_VERSION = 1;

/** 突合の対象。現在は AI Credits のみ (GET /enterprises/{enterprise}/settings/billing/ai_credit/usage) */
export type ReconciliationScope = 'ai_credits';

/** 許容差。絶対額 (USD) と割合 (%) の**両方**を超えたときだけ超過とする */
export interface ReconciliationTolerance {
  absolute_usd: number;
  percent: number;
}

export const DEFAULT_RECONCILIATION_TOLERANCE: ReconciliationTolerance = { absolute_usd: 1, percent: 1 };

/** この額 (USD) 未満の差は丸め誤差とみなして一致とする */
export const RECONCILIATION_MATCH_EPSILON_USD = 0.005;

/**
 * - match: 差が丸め誤差の範囲
 * - within_tolerance: 差はあるが許容差内
 * - exceeded: 許容差超過 (issue 化の対象)
 * - unavailable: 請求データが無い (API 欠損)。0 円として突合しない。超過扱いにも一致扱いにもしない
 */
export type ReconciliationStatus = 'match' | 'within_tolerance' | 'exceeded' | 'unavailable';

/** 1 日 × SKU × モデルの集計 (請求 API の数量・金額) */
export interface ReconciliationDayRow {
  sku: string;
  model: string | null;
  quantity: number;
  billed_gross: number;
  billed_discount: number;
  billed_net: number;
}

/** 突合に使った版・前提 (結果を後から説明できるように記録する) */
export interface ReconciliationVersions {
  /** 価格カタログの版 (`PRICING_CATALOG_VERSION`) */
  pricing_catalog_version: string;
  /** 為替カタログ (P1-6) の `fetched_at` と収録月数。カタログが無ければ null。突合は USD で行い、換算には使わない */
  exchange_rate_catalog: { fetched_at: string; months: number } | null;
  /** 計算に使った AI クレジット単価 (USD / credit) */
  unit_price_usd: number;
  /** API は通貨を返さない。請求単位のまま USD と仮定する */
  currency_assumed: 'USD';
}

export interface BillingReconciliationMonthDocument {
  schema_version: number;
  month: string;
  scope: ReconciliationScope;
  /** 保存済みの日 (YYYY-MM-DD) → 行。再取得した日は置き換える */
  days: Record<string, ReconciliationDayRow[]>;
  /** 最後に更新した時刻 (ISO) */
  updated_at: string;
  versions: ReconciliationVersions;
  tolerance: ReconciliationTolerance;
}

export interface ReconciliationBreakdownRow {
  sku: string;
  model: string | null;
  quantity: number;
  computed_usd: number;
  billed_gross_usd: number;
  difference_usd: number;
}

export interface BillingReconciliationReport {
  month: string;
  scope: ReconciliationScope;
  status: ReconciliationStatus;
  days_covered: number;
  quantity: number;
  computed_usd: number;
  billed_gross_usd: number;
  billed_discount_usd: number;
  billed_net_usd: number;
  /** computed - billed_gross。請求データが無いときは null */
  difference_usd: number | null;
  /** |差| / |billed_gross| × 100。請求額が 0 のときは差が 0 なら 0、差があれば null (定義できない) */
  difference_percent: number | null;
  tolerance: ReconciliationTolerance;
  versions: ReconciliationVersions;
  breakdown: ReconciliationBreakdownRow[];
}
