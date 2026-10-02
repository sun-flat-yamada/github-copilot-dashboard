import type {
  ExchangeRateCatalog,
  MonthlyExchangeRates,
} from '../../domain/services/PublicExchangeRatesService.js';

/**
 * 為替カタログの更新。ECB (欧州中央銀行) の月次平均レートを取得し、
 * 「1 USD = N 通貨」の月次カタログへ変換して追記する。
 *
 * - ECB の系列 `EXR/M.<通貨>.EUR.SP00.A` は「1 EUR = N 通貨」の月次平均。USD 基準へ変換する
 *   (JPY per USD = JPY per EUR / USD per EUR, EUR per USD = 1 / USD per EUR)。
 * - **終了した月だけ** を保存し、保存済みの月は上書きしない (確定した月の換算値は閲覧日・更新日に依存しない)。
 * - 取得に失敗しても既存カタログは壊さない (呼び出し側が結果の `error` を確認する)。
 */

export const ECB_SOURCE = 'ECB euro foreign exchange reference rates (monthly averages, converted to USD base)';
export const ECB_SOURCE_URL = 'https://data.ecb.europa.eu/data/datasets/EXR';
export const DEFAULT_CURRENCIES = ['JPY', 'EUR', 'GBP'] as const;

export type FetchText = (url: string) => Promise<string>;

export function buildEcbUrl(currencies: readonly string[], startMonth: string): string {
  const codes = Array.from(new Set(['USD', ...currencies.filter((c) => c !== 'EUR')])).join('+');
  return `https://data-api.ecb.europa.eu/service/data/EXR/M.${codes}.EUR.SP00.A?format=csvdata&startPeriod=${startMonth}`;
}

/** ECB の csvdata (CURRENCY, TIME_PERIOD, OBS_VALUE 列) から 'YYYY-MM' → 通貨 → (1 EUR あたりの通貨量) を読む */
export function parseEcbCsv(csv: string): Record<string, Record<string, number>> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return {};
  const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
  const cur = header.indexOf('CURRENCY');
  const per = header.indexOf('TIME_PERIOD');
  const val = header.indexOf('OBS_VALUE');
  if (cur < 0 || per < 0 || val < 0) throw new Error('Unexpected ECB CSV format: CURRENCY / TIME_PERIOD / OBS_VALUE columns not found.');

  const out: Record<string, Record<string, number>> = {};
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const month = cells[per];
    const value = Number(cells[val]);
    if (!/^\d{4}-\d{2}$/.test(month ?? '') || !Number.isFinite(value) || value <= 0) continue;
    (out[month] ??= {})[cells[cur]] = value;
  }
  return out;
}

/** EUR 基準の月次レートを USD 基準 (1 USD = N 通貨) へ変換する。USD レートが無い月は変換できないので除く */
export function toUsdBase(
  eurBased: Record<string, Record<string, number>>,
  currencies: readonly string[]
): Record<string, MonthlyExchangeRates> {
  const out: Record<string, MonthlyExchangeRates> = {};
  for (const [month, perEur] of Object.entries(eurBased)) {
    const usdPerEur = perEur.USD;
    if (!(usdPerEur > 0)) continue;
    const rates: MonthlyExchangeRates = {};
    for (const code of currencies) {
      const v = code === 'EUR' ? 1 : perEur[code];
      if (v > 0) rates[code] = Math.round((v / usdPerEur) * 1e6) / 1e6;
    }
    if (Object.keys(rates).length > 0) out[month] = rates;
  }
  return out;
}

export interface CatalogUpdateResult {
  catalog: ExchangeRateCatalog | null;
  addedMonths: string[];
  error?: string;
}

export async function updateExchangeRateCatalog(
  existing: ExchangeRateCatalog | null,
  options: { now: Date; fetchText: FetchText; currencies?: readonly string[]; monthsBack?: number }
): Promise<CatalogUpdateResult> {
  const currencies = options.currencies ?? DEFAULT_CURRENCIES;
  const currentMonth = options.now.toISOString().slice(0, 7);
  const start = new Date(Date.UTC(options.now.getUTCFullYear(), options.now.getUTCMonth() - (options.monthsBack ?? 24), 1));
  const startMonth = start.toISOString().slice(0, 7);

  let fetched: Record<string, MonthlyExchangeRates>;
  try {
    const csv = await options.fetchText(buildEcbUrl(currencies, startMonth));
    fetched = toUsdBase(parseEcbCsv(csv), currencies);
  } catch (e) {
    return { catalog: existing, addedMonths: [], error: e instanceof Error ? e.message : String(e) };
  }

  const rates: Record<string, MonthlyExchangeRates> = { ...(existing?.rates ?? {}) };
  const addedMonths: string[] = [];
  for (const [month, r] of Object.entries(fetched)) {
    if (month >= currentMonth) continue; // 進行中の月は確定していない
    if (rates[month]) continue; // 確定済みの月は上書きしない
    rates[month] = r;
    addedMonths.push(month);
  }
  if (addedMonths.length === 0 && existing) return { catalog: existing, addedMonths };

  return {
    catalog: {
      schema_version: 1,
      source: ECB_SOURCE,
      source_url: ECB_SOURCE_URL,
      fetched_at: options.now.toISOString(),
      base: 'USD',
      rates: Object.fromEntries(Object.entries(rates).sort(([a], [b]) => a.localeCompare(b))),
    },
    addedMonths: addedMonths.sort(),
  };
}
