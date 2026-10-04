import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ForkSafeStorageWriter } from '../adapters/storage/ForkSafeStorageWriter.js';
import { BillingReconciliationService } from '../application/pipeline/billing-reconciliation.js';
import {
  createGitHubRestIssuesApi,
  fileReconciliationIssues,
  type ExistingIssue,
  type GitHubIssuesApi,
} from '../application/pipeline/billing-reconciliation-issues.js';
import {
  DEFAULT_RECONCILIATION_TOLERANCE,
  type BillingReconciliationMonthDocument,
} from '../domain/entities/billing-reconciliation.js';
import type { CostLine } from '../domain/facts/schemas.js';
import { PRICING_CATALOG_VERSION } from '../domain/pricing/pricing-catalog.js';
import {
  aggregateCostLines,
  buildIssueDraft,
  classifyDifference,
  mergeDays,
  parseTolerance,
  reconcileMonth,
  reconciliationMarker,
} from '../processor/billing-reconciliation.js';

// 架空の SKU・モデル・金額のみ (実請求データ・トークンは使わない)
function line(day: string, quantity: number, gross: number, over: Partial<CostLine> = {}): CostLine {
  return {
    schema_version: 1,
    day,
    user_key: null,
    sku: 'fake_ai_credit',
    model: 'fake-model-a',
    quantity,
    unit_type: 'ai-credits',
    unit_price: 0.01,
    gross,
    discount: 0,
    net: gross,
    currency: null,
    pricing_version: null,
    source: 'api',
    quality: 'measured',
    ...over,
  } as CostLine;
}

function doc(lines: CostLine[], over: Partial<BillingReconciliationMonthDocument> = {}): BillingReconciliationMonthDocument {
  const month = lines[0]?.day.slice(0, 7) ?? '2026-09';
  return {
    schema_version: 1,
    month,
    scope: 'ai_credits',
    days: Object.fromEntries(aggregateCostLines(lines).get(month) ?? []),
    updated_at: '2026-10-01T00:00:00.000Z',
    versions: { pricing_catalog_version: PRICING_CATALOG_VERSION, exchange_rate_catalog: null, unit_price_usd: 0.01, currency_assumed: 'USD' },
    tolerance: { ...DEFAULT_RECONCILIATION_TOLERANCE },
    ...over,
  };
}

describe('parseTolerance (P4-4)', () => {
  it('uses the default (1 USD and 1 %) when unset or blank', () => {
    assert.deepEqual(parseTolerance(undefined), { tolerance: { absolute_usd: 1, percent: 1 } });
    assert.deepEqual(parseTolerance('  ').tolerance, { absolute_usd: 1, percent: 1 });
  });

  it('accepts a full or partial setting (missing keys keep the default)', () => {
    assert.deepEqual(parseTolerance('{"absolute_usd":5,"percent":0.5}').tolerance, { absolute_usd: 5, percent: 0.5 });
    assert.deepEqual(parseTolerance('{"percent":3}').tolerance, { absolute_usd: 1, percent: 3 });
  });

  it('falls back to the default with a reason for invalid values (the value is not echoed)', () => {
    for (const raw of ['not-json', '[1]', '{"absolute_usd":-1}', '{"percent":"1"}', '{"percent":null}']) {
      const r = parseTolerance(raw);
      assert.deepEqual(r.tolerance, { absolute_usd: 1, percent: 1 });
      assert.ok(r.error && !r.error.includes(raw === 'not-json' ? 'not-json' : '"1"'));
    }
  });
});

describe('classifyDifference / reconcileMonth (P4-4)', () => {
  const tol = { absolute_usd: 1, percent: 1 };

  it('match: the computed amount equals the billed gross amount', () => {
    const r = reconcileMonth(doc([line('2026-09-01', 1000, 10), line('2026-09-02', 500, 5)]));
    assert.equal(r.status, 'match');
    assert.equal(r.computed_usd, 15);
    assert.equal(r.billed_gross_usd, 15);
    assert.equal(r.difference_usd, 0);
    assert.equal(r.days_covered, 2);
  });

  it('within_tolerance: exceeds one threshold but not both', () => {
    // 差 $2 (絶対額は超過) だが 0.5 % (割合は許容内)
    assert.equal(classifyDifference(402, 400, tol).status, 'within_tolerance');
    // 差 $0.6 (絶対額は許容内) だが 6 % (割合は超過)
    assert.equal(classifyDifference(10.6, 10, tol).status, 'within_tolerance');
  });

  it('exceeded: both the absolute and the relative tolerance are exceeded', () => {
    const r = reconcileMonth(doc([line('2026-09-01', 1000, 8)]));
    assert.equal(r.status, 'exceeded');
    assert.equal(r.difference_usd, 2);
    assert.equal(r.difference_percent, 25);
  });

  it('exceeded also for an under-computed amount (negative difference)', () => {
    const r = reconcileMonth(doc([line('2026-09-01', 500, 8)]));
    assert.equal(r.status, 'exceeded');
    assert.equal(r.difference_usd, -3);
  });

  it('a configured tolerance changes the verdict', () => {
    const lines = [line('2026-09-01', 1000, 8)];
    assert.equal(reconcileMonth(doc(lines, { tolerance: { absolute_usd: 5, percent: 50 } })).status, 'within_tolerance');
  });

  it('unavailable: no billing data is not reconciled as zero', () => {
    const r = reconcileMonth(doc([], { month: '2026-09' }));
    assert.equal(r.status, 'unavailable');
    assert.equal(r.difference_usd, null);
    assert.equal(r.difference_percent, null);
    assert.equal(r.days_covered, 0);
  });

  it('billed 0 with a computed amount has no defined percentage and exceeds the tolerance', () => {
    const c = classifyDifference(5, 0, tol);
    assert.equal(c.percent, null);
    assert.equal(c.status, 'exceeded');
    assert.equal(classifyDifference(0, 0, tol).status, 'match');
  });

  it('handles negative adjustment rows and keeps a per-SKU/model breakdown', () => {
    const r = reconcileMonth(
      doc([
        line('2026-09-01', 1000, 10),
        line('2026-09-01', 200, 2, { model: 'fake-model-b' }),
        line('2026-09-02', -100, -1),
      ])
    );
    assert.equal(r.status, 'match');
    assert.equal(r.quantity, 1100);
    assert.deepEqual(
      r.breakdown.map((b) => [b.model, b.quantity, b.computed_usd, b.billed_gross_usd]),
      [
        ['fake-model-a', 900, 9, 9],
        ['fake-model-b', 200, 2, 2],
      ]
    );
  });

  it('records the net and discount for reference without using them for the verdict', () => {
    const r = reconcileMonth(doc([line('2026-09-01', 1000, 10, { discount: 4, net: 6 })]));
    assert.equal(r.status, 'match');
    assert.equal(r.billed_discount_usd, 4);
    assert.equal(r.billed_net_usd, 6);
  });

  it('records the pricing and exchange-rate catalog versions in the result', () => {
    const r = reconcileMonth(
      doc([line('2026-09-01', 100, 1)], {
        versions: {
          pricing_catalog_version: 'test-v1',
          exchange_rate_catalog: { fetched_at: '2026-10-01T00:00:00Z', months: 12 },
          unit_price_usd: 0.01,
          currency_assumed: 'USD',
        },
      })
    );
    assert.equal(r.versions.pricing_catalog_version, 'test-v1');
    assert.deepEqual(r.versions.exchange_rate_catalog, { fetched_at: '2026-10-01T00:00:00Z', months: 12 });
  });
});

describe('aggregateCostLines / mergeDays (P4-4)', () => {
  it('splits by month and day, sums same SKU x model rows and carries no identifiers', () => {
    const agg = aggregateCostLines([
      line('2026-08-31', 100, 1),
      line('2026-09-01', 100, 1),
      line('2026-09-01', 50, 0.5),
    ]);
    assert.deepEqual([...agg.keys()].sort(), ['2026-08', '2026-09']);
    const sep = agg.get('2026-09')!.get('2026-09-01')!;
    assert.equal(sep.length, 1);
    assert.equal(sep[0].quantity, 150);
    assert.ok(!JSON.stringify([...agg.entries()]).includes('user'));
  });

  it('replaces a re-fetched day instead of adding to it (idempotent)', () => {
    const first = aggregateCostLines([line('2026-09-01', 100, 1), line('2026-09-02', 100, 1)]).get('2026-09')!;
    const again = aggregateCostLines([line('2026-09-02', 100, 1), line('2026-09-03', 100, 1)]).get('2026-09')!;
    const once = mergeDays(Object.fromEntries(first), again);
    const twice = mergeDays(once, again);
    assert.deepEqual(Object.keys(twice), ['2026-09-01', '2026-09-02', '2026-09-03']);
    assert.deepEqual(twice, once);
    assert.equal(twice['2026-09-02'][0].quantity, 100);
  });
});

describe('BillingReconciliationService (P4-4)', () => {
  let tmp: string;
  let storage: ForkSafeStorageWriter;
  const ctx = {
    now: '2026-10-02T00:00:00.000Z',
    tolerance: { ...DEFAULT_RECONCILIATION_TOLERANCE },
    unitPriceUsd: () => 0.01,
    exchangeCatalog: null,
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'billing-recon-'));
    storage = new ForkSafeStorageWriter({ baseDir: tmp, publicDir: path.join(tmp, 'public-should-stay-empty') });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('stores under audit/billing-reconciliation (outside processed/) and reloads', () => {
    const svc = new BillingReconciliationService(storage);
    const reports = svc.record([line('2026-09-01', 1000, 8), line('2026-10-01', 100, 1)], ctx);
    assert.deepEqual(reports.map((r) => [r.month, r.status]), [['2026-09', 'exceeded'], ['2026-10', 'match']]);
    assert.ok(fs.existsSync(path.join(tmp, 'audit', 'billing-reconciliation', '2026-09.json')));
    assert.ok(!fs.existsSync(path.join(tmp, 'processed')));
    assert.deepEqual(storage.getBillingReconciliationMonths(), ['2026-10', '2026-09']);
    assert.equal(svc.reportFor('2026-09').status, 'exceeded');
  });

  it('is idempotent: recording the same lines twice gives the same report', () => {
    const svc = new BillingReconciliationService(storage);
    const lines = [line('2026-09-01', 1000, 10)];
    const a = svc.record(lines, ctx);
    const b = svc.record(lines, ctx);
    assert.deepEqual(a, b);
  });

  it('writes nothing for an empty response and reports unavailable for an unknown month', () => {
    const svc = new BillingReconciliationService(storage);
    assert.deepEqual(svc.record([], ctx), []);
    assert.deepEqual(storage.getBillingReconciliationMonths(), []);
    assert.equal(svc.reportFor('2026-09').status, 'unavailable');
  });

  it('re-judges stored months with a new tolerance', () => {
    const svc = new BillingReconciliationService(storage);
    svc.record([line('2026-09-01', 1000, 8)], ctx);
    assert.equal(svc.reports()[0].status, 'exceeded');
    assert.equal(svc.reports({ absolute_usd: 10, percent: 50 })[0].status, 'within_tolerance');
  });

  it('does nothing on a storage without the optional methods', () => {
    const svc = new BillingReconciliationService({} as never);
    assert.equal(svc.isSupported(), false);
    assert.deepEqual(svc.record([line('2026-09-01', 1, 1)], ctx), []);
  });
});

describe('fileReconciliationIssues (P4-4)', () => {
  function fakeApi(existing: ExistingIssue[] = [], priv = true) {
    const created: Array<{ title: string; body: string; labels: string[] }> = [];
    let n = 100;
    const api: GitHubIssuesApi = {
      isPrivate: async () => priv,
      listIssues: async () => existing.map((e) => ({ ...e })),
      createIssue: async (input) => {
        created.push(input);
        return { number: ++n, url: `https://example.invalid/issues/${n}` };
      },
    };
    return { api, created };
  }
  const exceeded = reconcileMonth(doc([line('2026-09-01', 1000, 8)]));
  const matching = reconcileMonth(doc([line('2026-08-01', 1000, 10)]));
  const missing = reconcileMonth(doc([], { month: '2026-07' }));

  it('creates one issue for a tolerance-exceeded month and none for match / unavailable', async () => {
    const { api, created } = fakeApi();
    const r = await fileReconciliationIssues([exceeded, matching, missing], api);
    assert.equal(r.considered, 1);
    assert.deepEqual(r.entries.map((e) => [e.month, e.action]), [['2026-09', 'created']]);
    assert.equal(created.length, 1);
    assert.deepEqual(created[0].labels, ['billing-reconciliation']);
    assert.ok(created[0].body.includes(reconciliationMarker('2026-09')));
  });

  it('does not duplicate: a second run, and an existing open or closed issue, create nothing', async () => {
    const draft = buildIssueDraft(exceeded);
    for (const state of ['open', 'closed'] as const) {
      const { api, created } = fakeApi([{ number: 7, state, body: draft.body }]);
      const r = await fileReconciliationIssues([exceeded], api);
      assert.equal(created.length, 0);
      assert.deepEqual(r.entries.map((e) => [e.action, e.issue_number]), [['skipped_existing', 7]]);
    }
    const { api, created } = fakeApi();
    await fileReconciliationIssues([exceeded], api);
    await fileReconciliationIssues([exceeded], api); // 偽 API は作成を覚えないので、同じ呼び出しの中の重複だけを検査する
    assert.equal(created.length, 2);
    const same = await fileReconciliationIssues([exceeded, exceeded], fakeApi().api);
    assert.deepEqual(same.entries.map((e) => e.action), ['created', 'skipped_existing']);
  });

  it('a different month is not treated as a duplicate', async () => {
    const other = reconcileMonth(doc([line('2026-10-01', 1000, 8)]));
    const { api, created } = fakeApi([{ number: 7, state: 'open', body: buildIssueDraft(exceeded).body }]);
    await fileReconciliationIssues([exceeded, other], api);
    assert.equal(created.length, 1);
    assert.ok(created[0].body.includes(reconciliationMarker('2026-10')));
  });

  it('dry run creates nothing', async () => {
    const { api, created } = fakeApi();
    const r = await fileReconciliationIssues([exceeded], api, { dryRun: true });
    assert.equal(created.length, 0);
    assert.deepEqual(r.entries.map((e) => e.action), ['dry_run']);
  });

  it('does not file when the existing issues cannot be listed (no duplicate risk)', async () => {
    const { api, created } = fakeApi();
    api.listIssues = async () => {
      throw new Error('GitHub API GET /issues failed with HTTP 403');
    };
    await assert.rejects(fileReconciliationIssues([exceeded], api), /HTTP 403/);
    assert.equal(created.length, 0);
  });

  it('the issue body carries the difference but never the billed or computed totals; a public repository gets no amounts at all', async () => {
    const big = reconcileMonth(doc([line('2026-09-01', 123457, 1000.77)]));
    const priv = fakeApi([], true);
    await fileReconciliationIssues([big], priv.api);
    const body = priv.created[0].body;
    assert.ok(body.includes('$'));
    assert.ok(!body.includes('1000.77') && !body.includes('1234.57') && !body.includes('123457'));
    const pub = fakeApi([], false);
    await fileReconciliationIssues([big], pub.api);
    assert.ok(!pub.created[0].body.includes('差 (計算額'), 'no difference row for a public repository');
    assert.ok(!/\$\d/.test(pub.created[0].body.replace(/\$1\.00/, '')), 'no amounts other than the tolerance');
    assert.ok(pub.created[0].body.includes(PRICING_CATALOG_VERSION));
  });
});

describe('createGitHubRestIssuesApi (P4-4)', () => {
  it('lists labeled issues across pages, skips pull requests and never puts the token in a URL', async () => {
    const calls: Array<{ url: string; method: string; auth: string | null }> = [];
    const page1 = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, state: 'open', body: 'x' }));
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? 'GET', auth: (init.headers as Record<string, string>).Authorization });
      const u = new URL(url);
      const body =
        u.pathname.endsWith('/issues') && init.method === 'POST'
          ? { number: 5, html_url: 'https://example.invalid/5' }
          : u.pathname.endsWith('/issues')
            ? u.searchParams.get('page') === '1'
              ? page1
              : [{ number: 500, state: 'closed', body: 'y', pull_request: {} }, { number: 501, state: 'closed', body: 'z' }]
            : { private: true };
      return { ok: true, status: 200, json: async () => body } as Response;
    }) as unknown as typeof fetch;
    const api = createGitHubRestIssuesApi({ repository: 'example-owner/example-repo', token: 'ghp_mocktoken00000000000000000000000000', fetchImpl });
    const issues = await api.listIssues('billing-reconciliation');
    assert.equal(issues.length, 101);
    assert.ok(!issues.some((i) => i.number === 500));
    assert.equal(await api.isPrivate(), true);
    assert.deepEqual(await api.createIssue({ title: 't', body: 'b', labels: ['l'] }), { number: 5, url: 'https://example.invalid/5' });
    assert.ok(calls.every((c) => !c.url.includes('ghp_') && c.auth?.startsWith('Bearer ')));
  });

  it('treats an unknown visibility as public and surfaces HTTP errors without the response body', async () => {
    const fetchImpl = (async () => ({ ok: false, status: 404, json: async () => ({ message: 'secret-detail' }) }) as Response) as unknown as typeof fetch;
    const api = createGitHubRestIssuesApi({ repository: 'example-owner/example-repo', token: 'x', fetchImpl });
    assert.equal(await api.isPrivate(), false);
    await assert.rejects(api.listIssues('l'), (e: Error) => /HTTP 404/.test(e.message) && !e.message.includes('secret-detail'));
  });
});
