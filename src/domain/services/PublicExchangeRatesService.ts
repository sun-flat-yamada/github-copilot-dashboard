/**
 * PublicExchangeRatesService
 *
 * 為替カタログ (月次平均レート) から換算レート (1 USD = N 通貨) を引く。
 *
 * - レートは **パイプラインが公的ソース (ECB) から取得して保存したカタログ** (`catalog/exchange-rates.json`) だけを使う。
 *   コードに書いた数値表や、閲覧時のブラウザからの外部取得は使わない。以前はブラウザが閲覧日の最新レートを取得して
 *   過去月の換算にも使っていたため、同じ月の金額が閲覧日によって変わっていた (B-14)。
 * - 過去月の換算値は、カタログに保存された値から決まる (閲覧日に依存しない)。
 * - カタログに無い月は、**それより前の最も近い月のレート** を引き継ぐ (未来の値や既定値で補わない)。
 *   引き継いだ場合は `carried_forward` と、実際に使った月を返す。前の月も無ければ「レート無し」(null / NaN)。
 */

export interface MonthlyExchangeRates {
  [currencyCode: string]: number; // 1 USD = N units (例: JPY: 148.3, EUR: 0.86)
}

export interface ExchangeRateCatalog {
  schema_version: 1;
  /** 出典の説明 (例: ECB euro foreign exchange reference rates, monthly averages) */
  source: string;
  source_url?: string;
  /** 最後にカタログを更新した時刻 (ISO 8601) */
  fetched_at: string;
  /** レートの基準通貨。常に USD (1 USD = N 通貨) */
  base: 'USD';
  /** 'YYYY-MM' → 通貨コード → レート。確定した (終了した) 月のみを保存する */
  rates: Record<string, MonthlyExchangeRates>;
}

export interface ResolvedExchangeRate {
  rate: number;
  /** レートを引いた月 (対象月と異なる場合は引き継ぎ) */
  month: string;
  exact: boolean;
}

let catalog: ExchangeRateCatalog | null = null;

export class PublicExchangeRatesService {
  /** 為替カタログを設定する (null で解除)。パイプラインは保存済みのファイル、SPA は配信された JSON を渡す */
  public static setCatalog(next: ExchangeRateCatalog | null): void {
    catalog = next;
  }

  public static getCatalog(): ExchangeRateCatalog | null {
    return catalog;
  }

  public static hasRates(): boolean {
    return catalog !== null && Object.keys(catalog.rates).length > 0;
  }

  /**
   * 対象月 (YYYY-MM) のレートを、出所 (実際に使った月) つきで返す。無ければ null。
   * 対象月が無い場合は、それ以前で最も近い月を使う (未来の月は使わない)。
   */
  public static findExchangeRate(currencyCode: string, targetMonth?: string): ResolvedExchangeRate | null {
    const raw = currencyCode.toUpperCase();
    if (raw === 'USD' || raw === 'EA-USD') {
      return { rate: 1, month: targetMonth?.slice(0, 7) ?? '', exact: true };
    }
    const code = raw.startsWith('EA-') ? raw.slice(3) : raw;
    if (!catalog) return null;

    const months = Object.keys(catalog.rates).sort();
    if (months.length === 0) return null;

    const ym = targetMonth && targetMonth.length >= 7 ? targetMonth.slice(0, 7) : months[months.length - 1];
    const exact = catalog.rates[ym]?.[code];
    if (typeof exact === 'number' && exact > 0) return { rate: exact, month: ym, exact: true };

    for (let i = months.length - 1; i >= 0; i--) {
      if (months[i] > ym) continue;
      const r = catalog.rates[months[i]]?.[code];
      if (typeof r === 'number' && r > 0) return { rate: r, month: months[i], exact: false };
    }
    return null;
  }

  /**
   * 1 USD = N 通貨 のレート。USD は 1。カタログにレートが無いときは NaN
   * (呼び出し側は `> 0` で判定し、無ければ換算を出さない。仮の値は返さない)。
   */
  public static getExchangeRate(currencyCode: string, targetMonth?: string): number {
    return this.findExchangeRate(currencyCode, targetMonth)?.rate ?? NaN;
  }
}
