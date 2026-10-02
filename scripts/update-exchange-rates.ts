/**
 * 為替カタログ (data/catalog/exchange-rates.json) を ECB の月次平均レートで更新する。
 * 取得に失敗しても既存カタログは変更せず、警告を出して正常終了する (為替は表示の補助であり、収集を止めない)。
 * 使い方: npm run catalog:fx
 */
import { ForkSafeStorage } from '../src/storage/fork-safe-storage.js';
import { updateExchangeRateCatalog } from '../src/application/services/ExchangeRateCatalogUpdater.js';
import type { ExchangeRateCatalog } from '../src/domain/services/PublicExchangeRatesService.js';

async function main(): Promise<void> {
  const storage = new ForkSafeStorage();
  const existing = storage.loadCatalog<ExchangeRateCatalog>('exchange-rates');
  const result = await updateExchangeRateCatalog(existing, {
    now: new Date(),
    fetchText: async (url) => {
      const res = await fetch(url, { headers: { Accept: 'text/csv' } });
      if (!res.ok) throw new Error(`ECB request failed: HTTP ${res.status}`);
      return res.text();
    },
  });
  if (result.error) {
    console.warn(`⚠️ Exchange-rate catalog not updated: ${result.error}. Existing catalog (if any) is kept.`);
    return;
  }
  if (result.catalog && result.addedMonths.length > 0) {
    storage.saveCatalog('exchange-rates', result.catalog);
    console.log(`💱 Exchange-rate catalog updated: +${result.addedMonths.length} month(s) (${result.addedMonths.join(', ')}).`);
  } else {
    console.log('💱 Exchange-rate catalog is up to date.');
  }
}

main().catch((e) => {
  console.warn(`⚠️ Exchange-rate catalog update failed: ${e instanceof Error ? e.message : e}`);
});
