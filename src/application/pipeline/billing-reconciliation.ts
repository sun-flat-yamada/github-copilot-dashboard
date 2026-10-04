import {
  BILLING_RECONCILIATION_SCHEMA_VERSION,
  DEFAULT_RECONCILIATION_TOLERANCE,
  type BillingReconciliationMonthDocument,
  type BillingReconciliationReport,
  type ReconciliationTolerance,
  type ReconciliationVersions,
} from '../../domain/entities/billing-reconciliation.js';
import type { CostLine } from '../../domain/facts/schemas.js';
import type { IStorageWriter } from '../../domain/ports/IStorageWriter.js';
import { PRICING_CATALOG_VERSION } from '../../domain/pricing/pricing-catalog.js';
import type { ExchangeRateCatalog } from '../../domain/services/PublicExchangeRatesService.js';
import { aggregateCostLines, mergeDays, reconcileMonth } from '../../processor/billing-reconciliation.js';

/**
 * 請求突合の記録と取得 (P4-4 / E-03)。
 * Billing API (AI credit usage) の明細を月 × 日の集計として `audit/billing-reconciliation/{month}.json` へ冪等に重ね、
 * 計算額 (数量 × ダッシュボードの単価) と請求額 (gross) を突合する。保存は IStorageWriter の任意メソッド経由。
 * 未対応の実装では何もしない。
 */

export interface BillingReconciliationContext {
  /** 記録時刻 (ISO) */
  now: string;
  tolerance: ReconciliationTolerance;
  /** 月 (YYYY-MM) → 計算に使う AI クレジット単価 (USD / credit)。請求設定 → 既定は価格カタログ */
  unitPriceUsd: (month: string) => number;
  /** 為替カタログ (P1-6)。突合は USD で行い、版の記録だけに使う */
  exchangeCatalog?: ExchangeRateCatalog | null;
}

export function exchangeCatalogVersion(catalog: ExchangeRateCatalog | null | undefined): ReconciliationVersions['exchange_rate_catalog'] {
  return catalog ? { fetched_at: catalog.fetched_at, months: Object.keys(catalog.rates ?? {}).length } : null;
}

export class BillingReconciliationService {
  constructor(private readonly storage: IStorageWriter) {}

  isSupported(): boolean {
    return !!(
      this.storage.saveBillingReconciliationMonth &&
      this.storage.loadBillingReconciliationMonth &&
      this.storage.getBillingReconciliationMonths
    );
  }

  /**
   * 取得した請求明細を記録し、触れた月の突合結果を返す。
   * 明細が空のときは何も書かない (請求データが無い月を 0 円として突合しない)。呼び出し側は、ソースが取得できたときだけ呼ぶ。
   */
  record(lines: readonly CostLine[], ctx: BillingReconciliationContext): BillingReconciliationReport[] {
    if (!this.isSupported() || lines.length === 0) return [];
    const reports: BillingReconciliationReport[] = [];
    for (const [month, days] of [...aggregateCostLines(lines)].sort(([a], [b]) => a.localeCompare(b))) {
      const prev = this.storage.loadBillingReconciliationMonth!(month);
      const doc: BillingReconciliationMonthDocument = {
        schema_version: BILLING_RECONCILIATION_SCHEMA_VERSION,
        month,
        scope: 'ai_credits',
        days: mergeDays(prev?.days ?? {}, days),
        updated_at: ctx.now,
        versions: {
          pricing_catalog_version: PRICING_CATALOG_VERSION,
          exchange_rate_catalog: exchangeCatalogVersion(ctx.exchangeCatalog),
          unit_price_usd: ctx.unitPriceUsd(month),
          currency_assumed: 'USD',
        },
        tolerance: ctx.tolerance,
      };
      this.storage.saveBillingReconciliationMonth!(doc);
      reports.push(reconcileMonth(doc));
    }
    return reports;
  }

  /** 月の突合結果。文書が無ければ unavailable (請求データなし) */
  reportFor(month: string): BillingReconciliationReport {
    const doc = this.storage.loadBillingReconciliationMonth?.(month) ?? null;
    if (doc) return reconcileMonth(doc);
    return reconcileMonth({
      schema_version: BILLING_RECONCILIATION_SCHEMA_VERSION,
      month,
      scope: 'ai_credits',
      days: {},
      updated_at: '',
      versions: {
        pricing_catalog_version: PRICING_CATALOG_VERSION,
        exchange_rate_catalog: null,
        unit_price_usd: 0,
        currency_assumed: 'USD',
      },
      tolerance: { ...DEFAULT_RECONCILIATION_TOLERANCE },
    });
  }

  /** 文書のあるすべての月の突合結果 (昇順)。`tolerance` を渡すと保存時の許容差ではなくそれで判定し直す */
  reports(tolerance?: ReconciliationTolerance): BillingReconciliationReport[] {
    const months = [...(this.storage.getBillingReconciliationMonths?.() ?? [])].sort();
    const out: BillingReconciliationReport[] = [];
    for (const month of months) {
      const doc = this.storage.loadBillingReconciliationMonth?.(month);
      if (doc) out.push(reconcileMonth(tolerance ? { ...doc, tolerance } : doc));
    }
    return out;
  }
}
