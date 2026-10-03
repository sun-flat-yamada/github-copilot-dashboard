import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { RawApiFetcher } from '../../adapters/github-api/RawApiFetcher.js';
import { GitHubApiCopilotDataSource } from '../../adapters/github-api/GitHubApiCopilotDataSource.js';
import { AiCreditUsageClient } from '../../adapters/github-api/ai-credits/AiCreditUsageClient.js';
import { reportWindowDays } from '../../adapters/github-api/usage-reports/UsageReportsClient.js';
import { toCostLine } from '../../domain/facts/mappers.js';
import { costLineSchema } from '../../domain/facts/schemas.js';

const BASE = 'https://api.github.com';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const item = (extra: Record<string, unknown> = {}) => ({
  product: 'Copilot',
  sku: 'Copilot AI Credits',
  model: 'model-x',
  unitType: 'credits',
  pricePerUnit: 0.01,
  grossQuantity: 100,
  grossAmount: 1,
  discountQuantity: 0,
  discountAmount: 0,
  netQuantity: 100,
  netAmount: 1,
  ...extra,
});

interface ServerOptions {
  failDays?: number[];
  missingAll?: boolean;
  items?: unknown[];
  periodOffset?: number;
}

function server(opts: ServerOptions = {}) {
  const requests: URL[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    if (!url.pathname.endsWith('/settings/billing/ai_credit/usage')) return new Response('nf', { status: 404 });
    const [year, month, day] = ['year', 'month', 'day'].map((k) => Number(url.searchParams.get(k)));
    if (opts.missingAll) return new Response('', { status: 404 });
    if (opts.failDays?.includes(day)) return new Response('boom', { status: 500 });
    return json({
      timePeriod: { year, month, day: day + (opts.periodOffset ?? 0) },
      enterprise: 'acme-ent',
      usageItems: opts.items ?? [item()],
    });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

const fetcher = (fetchImpl: typeof fetch) =>
  new RawApiFetcher({ token: 'test-token', baseUrl: BASE, fetchImpl, maxRetries: 0, retryDelayMs: 0 });

describe('AI credit usage adapter (P1-5)', () => {
  it('requests one day at a time with year / month / day and validates the items', async () => {
    const { fetchImpl, requests } = server({ items: [item(), item({ unitType: 'requests', sku: 'Premium Request', grossQuantity: 3, model: '' })] });
    const result = await new AiCreditUsageClient(fetcher(fetchImpl)).fetchDay('acme-ent', '2026-09-05');
    assert.equal(result.items?.length, 2);
    assert.deepEqual(
      ['year', 'month', 'day'].map((k) => requests[0].searchParams.get(k)),
      ['2026', '9', '5']
    );
    assert.match(requests[0].pathname, /\/enterprises\/acme-ent\/settings\/billing\/ai_credit\/usage$/);
  });

  it('quarantines an invalid item (without echoing values) and keeps the rest', async () => {
    const { fetchImpl } = server({ items: [item(), item({ grossAmount: 'a lot' }), 'not-an-object'] });
    const result = await new AiCreditUsageClient(fetcher(fetchImpl)).fetchDay('acme-ent', '2026-09-05');
    assert.equal(result.items?.length, 1);
    assert.equal(result.quarantined, 2);
    assert.doesNotMatch(result.reasons.join('\n'), /a lot/);
  });

  it('rejects a response for another period', async () => {
    const { fetchImpl } = server({ periodOffset: 1 });
    await assert.rejects(new AiCreditUsageClient(fetcher(fetchImpl)).fetchDay('acme-ent', '2026-09-05'), /period mismatch/);
  });

  it('maps lines to cost_line facts: units stay separate, a blank model is null, no currency is assumed', () => {
    const credits = toCostLine('2026-09-05', item());
    const requests = toCostLine('2026-09-05', item({ unitType: 'requests', model: '', discountAmount: -0.5 }));
    costLineSchema.parse(credits);
    costLineSchema.parse(requests);
    assert.equal(credits.unit_type, 'credits');
    assert.equal(requests.unit_type, 'requests');
    assert.equal(requests.model, null);
    assert.equal(requests.discount, -0.5);
    assert.equal(credits.currency, null);
    assert.equal(credits.user_key, null);
    assert.equal(credits.quantity, 100);
  });

  describe('as a data source (SourceStatus)', () => {
    const make = (srv: ReturnType<typeof server>, enterprise: string | null = 'acme-ent') =>
      new GitHubApiCopilotDataSource({
        fetcher: fetcher(srv.fetchImpl),
        enterprise: enterprise ?? undefined,
        orgs: enterprise ? [] : ['acme-org'],
      });
    const statusOf = (s: GitHubApiCopilotDataSource) => s.getSourceStatuses().find((x) => x.source === 'ai_credits');

    it('is ok when every day arrives', async () => {
      const srv = server();
      const source = make(srv);
      const lines = await source.fetchAiCreditUsage();
      assert.equal(lines.length, reportWindowDays().length);
      assert.equal(statusOf(source)?.status, 'ok');
    });

    it('is partial (with an issue) when some days fail or items are quarantined', async () => {
      const failing = make(server({ failDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }));
      const lines = await failing.fetchAiCreditUsage();
      assert.ok(lines.length > 0);
      assert.equal(statusOf(failing)?.status, 'partial');
      assert.ok(failing.getIssues().some((i) => i.target.includes('ai_credit')));

      const quarantined = make(server({ items: [item(), item({ netAmount: null })] }));
      await quarantined.fetchAiCreditUsage();
      const status = statusOf(quarantined);
      assert.equal(status?.status, 'partial');
      assert.ok((status?.quarantined ?? 0) > 0);
    });

    it('is failed (not "no data") when no day can be read', async () => {
      const source = make(server({ missingAll: true }));
      assert.deepEqual(await source.fetchAiCreditUsage(), []);
      assert.equal(statusOf(source)?.status, 'failed');
      assert.ok(source.getIssues().some((i) => /billing/i.test(i.details ?? '')));
    });

    it('is skipped without an enterprise (the endpoint has no organization form)', async () => {
      const srv = server();
      const source = make(srv, null);
      assert.deepEqual(await source.fetchAiCreditUsage(), []);
      assert.equal(statusOf(source)?.status, 'skipped');
      assert.equal(srv.requests.length, 0);
    });
  });
});
