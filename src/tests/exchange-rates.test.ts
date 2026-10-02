import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { PublicExchangeRatesService, type ExchangeRateCatalog } from '../domain/services/PublicExchangeRatesService.js';
import {
  buildEcbUrl,
  parseEcbCsv,
  toUsdBase,
  updateExchangeRateCatalog,
} from '../application/services/ExchangeRateCatalogUpdater.js';

const CSV = [
  'KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE',
  'EXR.M.USD.EUR.SP00.A,M,USD,EUR,SP00,A,2026-07,1.10',
  'EXR.M.JPY.EUR.SP00.A,M,JPY,EUR,SP00,A,2026-07,165',
  'EXR.M.USD.EUR.SP00.A,M,USD,EUR,SP00,A,2026-08,1.25',
  'EXR.M.JPY.EUR.SP00.A,M,JPY,EUR,SP00,A,2026-08,175',
  'EXR.M.USD.EUR.SP00.A,M,USD,EUR,SP00,A,2026-10,1.00',
  'EXR.M.JPY.EUR.SP00.A,M,JPY,EUR,SP00,A,2026-10,150',
].join('\n');

const fixture = (): ExchangeRateCatalog => ({
  schema_version: 1,
  source: 'fixture',
  fetched_at: '2026-01-01T00:00:00Z',
  base: 'USD',
  rates: { '2026-01': { JPY: 140 }, '2026-03': { JPY: 150, EUR: 0.9 } },
});

describe('PublicExchangeRatesService (catalog only)', () => {
  afterEach(() => PublicExchangeRatesService.setCatalog(null));

  it('has no rates without a catalog (no fabricated fallback)', () => {
    assert.ok(Number.isNaN(PublicExchangeRatesService.getExchangeRate('JPY', '2025-04')));
    assert.equal(PublicExchangeRatesService.getExchangeRate('USD'), 1);
  });

  it('uses the exact month, else the nearest earlier month, never a later one', () => {
    PublicExchangeRatesService.setCatalog(fixture());
    assert.deepEqual(PublicExchangeRatesService.findExchangeRate('JPY', '2026-03'), { rate: 150, month: '2026-03', exact: true });
    assert.deepEqual(PublicExchangeRatesService.findExchangeRate('JPY', '2026-02'), { rate: 140, month: '2026-01', exact: false });
    assert.equal(PublicExchangeRatesService.findExchangeRate('JPY', '2025-12'), null);
    assert.equal(PublicExchangeRatesService.getExchangeRate('EA-JPY', '2026-05'), 150);
    assert.equal(PublicExchangeRatesService.findExchangeRate('EUR', '2026-02'), null);
  });
});

describe('ExchangeRateCatalogUpdater', () => {
  it('parses ECB csv and converts to a USD base', () => {
    const usd = toUsdBase(parseEcbCsv(CSV), ['JPY', 'EUR']);
    assert.equal(usd['2026-07'].JPY, 150);
    assert.equal(usd['2026-07'].EUR, Math.round((1 / 1.1) * 1e6) / 1e6);
    assert.ok(buildEcbUrl(['JPY', 'EUR'], '2025-01').includes('M.USD+JPY.EUR.SP00.A'));
  });

  it('rejects unexpected csv layouts', () => {
    assert.throws(() => parseEcbCsv('a,b\n1,2'));
  });

  it('adds only completed months and never overwrites stored ones', async () => {
    const existing = { ...fixture(), rates: { '2026-07': { JPY: 999 } } };
    const r = await updateExchangeRateCatalog(existing, {
      now: new Date('2026-10-02T00:00:00Z'),
      fetchText: async () => CSV,
      currencies: ['JPY', 'EUR'],
    });
    assert.deepEqual(r.addedMonths, ['2026-08']); // 07 is kept, 10 is in progress
    assert.equal(r.catalog?.rates['2026-07'].JPY, 999);
    assert.equal(r.catalog?.rates['2026-10'], undefined);
    assert.equal(r.catalog?.source.includes('ECB'), true);
  });

  it('keeps the existing catalog when the fetch fails', async () => {
    const existing = fixture();
    const r = await updateExchangeRateCatalog(existing, {
      now: new Date('2026-10-02T00:00:00Z'),
      fetchText: async () => {
        throw new Error('offline');
      },
    });
    assert.equal(r.catalog, existing);
    assert.equal(r.error, 'offline');
  });
});
