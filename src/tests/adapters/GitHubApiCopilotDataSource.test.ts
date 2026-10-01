import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { RawApiFetcher, parseLinkHeader, resolveGitHubToken } from '../../adapters/github-api/RawApiFetcher.js';
import { GitHubApiCopilotDataSource } from '../../adapters/github-api/GitHubApiCopilotDataSource.js';

const BASE = 'https://api.github.com';

type RouteHandler = (url: URL, init: RequestInit | undefined) => Response;

/** URL のパス (クエリ除く) ごとにレスポンスを返す fetch の差し替え。呼び出し履歴も残す */
function createFakeFetch(routes: Record<string, RouteHandler>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), headers: (init?.headers ?? {}) as Record<string, string> });
    const handler = routes[url.pathname];
    if (!handler) return new Response('not found', { status: 404 });
    return handler(url, init);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function json(body: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function rawSeat(index: number, overrides: Record<string, unknown> = {}) {
  return {
    created_at: '2026-01-15T00:00:00Z',
    last_activity_at: '2026-09-01T00:00:00Z',
    last_activity_editor: 'vscode/1.92',
    plan_type: index % 2 === 0 ? 'business' : 'enterprise',
    assignee: { login: `user-${index}`, id: 1000 + index, avatar_url: '', html_url: '', type: 'User' },
    organization: { login: 'acme-org', id: 1 },
    ...overrides,
  };
}

function makeFetcher(fetchImpl: typeof fetch, token: string | undefined = 'test-token') {
  return new RawApiFetcher({ token, baseUrl: BASE, fetchImpl, maxRetries: 0, retryDelayMs: 0 });
}

/** 環境変数のトークンに依存せず「トークン未設定」を再現する */
async function withoutGitHubTokens<T>(fn: () => Promise<T>): Promise<T> {
  const keys = ['COPILOT_READ_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN'] as const;
  const saved = keys.map((k) => [k, process.env[k]] as const);
  for (const k of keys) delete process.env[k];
  try {
    return await fn();
  } finally {
    for (const [k, v] of saved) {
      if (v !== undefined) process.env[k] = v;
    }
  }
}

describe('RawApiFetcher: token resolution & Link-header pagination', () => {
  it('resolves the token as explicit -> COPILOT_READ_TOKEN -> GITHUB_TOKEN -> GH_TOKEN', () => {
    assert.equal(resolveGitHubToken('explicit', { COPILOT_READ_TOKEN: 'a', GITHUB_TOKEN: 'b' }), 'explicit');
    assert.equal(resolveGitHubToken(undefined, { COPILOT_READ_TOKEN: 'a', GITHUB_TOKEN: 'b' }), 'a');
    assert.equal(resolveGitHubToken(undefined, { GITHUB_TOKEN: 'b', GH_TOKEN: 'c' }), 'b');
    assert.equal(resolveGitHubToken(undefined, { GH_TOKEN: 'c' }), 'c');
    assert.equal(resolveGitHubToken(undefined, {}), undefined);
  });

  it('parses Link headers into a rel -> url map', () => {
    const links = parseLinkHeader(
      '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=5>; rel="last"'
    );
    assert.equal(links.next, 'https://api.github.com/x?page=2');
    assert.equal(links.last, 'https://api.github.com/x?page=5');
    assert.deepEqual(parseLinkHeader(null), {});
  });

  it('follows rel="next" to the last page, sends per_page=100 and the auth / version headers', async () => {
    const path = '/orgs/acme-org/copilot/billing/seats';
    const { fetchImpl, calls } = createFakeFetch({
      [path]: (url) => {
        const page = Number(url.searchParams.get('page') ?? '1');
        const items = Array.from({ length: page === 1 ? 100 : 20 }, (_, i) => rawSeat(page * 1000 + i));
        const headers: Record<string, string> =
          page === 1 ? { link: `<${BASE}${path}?per_page=100&page=2>; rel="next"` } : {};
        return json({ total_seats: 120, seats: items }, headers);
      },
    });

    const fetcher = makeFetcher(fetchImpl);
    const result = await fetcher.fetchPaginated<{ seats: unknown[] }, unknown>(
      '/orgs/{org}/copilot/billing/seats',
      { org: 'acme-org' },
      (page) => page.seats
    );

    assert.equal(result.items.length, 120);
    assert.equal(result.pages, 2);
    assert.equal(result.truncated, false);
    assert.equal(new URL(calls[0].url).searchParams.get('per_page'), '100');
    assert.equal(calls[0].headers.Authorization, 'Bearer test-token');
    assert.equal(calls[0].headers['X-GitHub-Api-Version'], fetcher.getApiVersion());
  });

  it('refuses to follow a pagination link to another origin (credential leak guard)', async () => {
    const path = '/orgs/acme-org/copilot/billing/seats';
    const { fetchImpl, calls } = createFakeFetch({
      [path]: () => json({ seats: [] }, { link: '<https://evil.example.com/steal?page=2>; rel="next"' }),
    });
    const fetcher = makeFetcher(fetchImpl);
    await assert.rejects(
      fetcher.fetchPaginated('/orgs/{org}/copilot/billing/seats', { org: 'acme-org' }, () => []),
      /different origin/
    );
    assert.equal(calls.length, 1, 'must not send a request (with the token) to the other origin');
  });

  it('reports truncation when the page safety limit is reached', async () => {
    const path = '/orgs/acme-org/copilot/billing/seats';
    const { fetchImpl } = createFakeFetch({
      [path]: (url) => {
        const page = Number(url.searchParams.get('page') ?? '1');
        return json({ seats: [rawSeat(page)] }, { link: `<${BASE}${path}?page=${page + 1}>; rel="next"` });
      },
    });
    const fetcher = makeFetcher(fetchImpl);
    const result = await fetcher.fetchPaginated<{ seats: unknown[] }, unknown>(
      '/orgs/{org}/copilot/billing/seats',
      { org: 'acme-org' },
      (page) => page.seats,
      { maxPages: 3 }
    );
    assert.equal(result.pages, 3);
    assert.equal(result.truncated, true);
  });

  it('does not send an unauthenticated request when no token is configured', async () => {
    await withoutGitHubTokens(async () => {
      const { fetchImpl, calls } = createFakeFetch({});
      const fetcher = makeFetcher(fetchImpl, '');
      assert.equal(fetcher.hasToken(), false);
      await assert.rejects(fetcher.fetchRaw('/orgs/{org}/copilot/metrics', { org: 'acme-org' }), /token is not configured/);
      assert.equal(calls.length, 0);
    });
  });
});

describe('GitHubApiCopilotDataSource: seats (P0-2)', () => {
  const seatsPath = '/orgs/acme-org/copilot/billing/seats';

  function seatsServer(seats: unknown[], opts: { total?: number; perPage?: number } = {}) {
    const perPage = opts.perPage ?? 100;
    return createFakeFetch({
      [seatsPath]: (url) => {
        const page = Number(url.searchParams.get('page') ?? '1');
        const slice = seats.slice((page - 1) * perPage, page * perPage);
        const hasNext = page * perPage < seats.length;
        return json(
          { total_seats: opts.total ?? seats.length, seats: slice },
          hasNext ? { link: `<${BASE}${seatsPath}?per_page=${perPage}&page=${page + 1}>; rel="next"` } : {}
        );
      },
    });
  }

  it('returns all 120 seats across pages (the first page alone used to be the whole list)', async () => {
    const { fetchImpl } = seatsServer(Array.from({ length: 120 }, (_, i) => rawSeat(i)));
    const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(fetchImpl), orgs: ['acme-org'] });

    const seats = await source.fetchSeats();
    assert.equal(seats.length, 120);

    const status = source.getSourceStatuses().find((s) => s.source === 'seats');
    assert.equal(status?.status, 'ok');
    assert.equal(status?.records, 120);
    assert.equal(source.getIssues().length, 0);
  });

  it('keeps plan_type: unknown and organization: null, and warns instead of guessing', async () => {
    const seats = [
      rawSeat(1, { plan_type: undefined }),
      rawSeat(2, { plan_type: 'some_future_plan' }),
      rawSeat(3, { organization: null }),
      rawSeat(4),
    ];
    const { fetchImpl } = seatsServer(seats);
    const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(fetchImpl), orgs: ['acme-org'] });

    const result = await source.fetchSeats();
    assert.equal(result.length, 4);
    assert.equal(result[0].plan_type, 'unknown', 'a missing plan_type must not be treated as enterprise');
    assert.equal(result[1].plan_type, 'unknown', 'an unrecognized plan_type must be preserved as unknown');
    assert.equal(result[2].organization, null);

    const messages = source.getIssues().map((i) => i.message);
    assert.ok(messages.some((m) => /plan_type/.test(m)), 'must warn about unknown plan_type');
    assert.ok(messages.some((m) => /organization: null/.test(m)), 'must warn about null organization');
    assert.ok(source.getIssues().every((i) => i.severity === 'warning'));
  });

  it('quarantines a malformed record instead of losing the whole batch, without leaking values', async () => {
    const seats = [rawSeat(1), { created_at: '2026-01-01T00:00:00Z', assignee: { id: 5, secret_login: 'leak-me' } }, rawSeat(3)];
    const { fetchImpl } = seatsServer(seats);
    const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(fetchImpl), orgs: ['acme-org'] });

    const result = await source.fetchSeats();
    assert.equal(result.length, 2);

    const issue = source.getIssues().find((i) => i.category === 'data_integrity' && /quarantined/.test(i.message));
    assert.ok(issue, 'must report the quarantined record as data_integrity');
    assert.ok(!JSON.stringify(issue).includes('leak-me'), 'quarantine report must not contain record values');

    const status = source.getSourceStatuses().find((s) => s.source === 'seats');
    assert.equal(status?.status, 'partial');
    assert.equal(status?.quarantined, 1);
  });

  it('warns when total_seats does not match the number of retrieved records', async () => {
    const { fetchImpl } = seatsServer(Array.from({ length: 5 }, (_, i) => rawSeat(i)), { total: 9 });
    const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(fetchImpl), orgs: ['acme-org'] });

    const result = await source.fetchSeats();
    assert.equal(result.length, 5);
    assert.ok(source.getIssues().some((i) => /count mismatch/i.test(i.message)));
    assert.equal(source.getSourceStatuses().find((s) => s.source === 'seats')?.status, 'partial');
  });

  it('treats a missing token as a failed source with an actionable api_auth issue (no unauthenticated call)', async () => {
    await withoutGitHubTokens(async () => {
      const { fetchImpl, calls } = createFakeFetch({});
      const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(fetchImpl, ''), orgs: ['acme-org'] });

      assert.deepEqual(await source.fetchSeats(), []);
      assert.equal(calls.length, 0);
      const issue = source.getIssues().find((i) => i.target === 'config:github-token');
      assert.equal(issue?.category, 'api_auth');
      assert.match(issue?.message ?? '', /COPILOT_READ_TOKEN/);
      assert.equal(source.getSourceStatuses().find((s) => s.source === 'seats')?.status, 'failed');
    });
  });

  it('fails the whole seats source when any target org fails (no partial headcount posing as current)', async () => {
    const { fetchImpl } = createFakeFetch({
      '/orgs/org-a/copilot/billing/seats': () => json({ total_seats: 2, seats: [rawSeat(1), rawSeat(2)] }),
      '/orgs/org-b/copilot/billing/seats': () => json({ message: 'boom' }, {}, 500),
    });
    const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(fetchImpl), orgs: ['org-a', 'org-b'] });

    assert.deepEqual(await source.fetchSeats(), []);
    const status = source.getSourceStatuses().find((s) => s.source === 'seats');
    assert.equal(status?.status, 'failed');
    assert.equal(status?.last_success_at, null);
    assert.ok(source.getIssues().some((i) => i.severity === 'error' && i.category === 'server_error'));
  });

  it('classifies 403 as api_auth and 429 as rate_limit', async () => {
    const forbidden = createFakeFetch({ [seatsPath]: () => json({ message: 'nope' }, {}, 403) });
    const s1 = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(forbidden.fetchImpl), orgs: ['acme-org'] });
    await s1.fetchSeats();
    assert.equal(s1.getIssues()[0].category, 'api_auth');

    const limited = createFakeFetch({ [seatsPath]: () => json({}, { 'x-ratelimit-reset': '1700000000' }, 429) });
    const s2 = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(limited.fetchImpl), orgs: ['acme-org'] });
    await s2.fetchSeats();
    assert.equal(s2.getIssues()[0].category, 'rate_limit');
  });

  it('reports "skipped" (not an error) when neither COPILOT_ENTERPRISE nor COPILOT_ORGS is configured', async () => {
    const { fetchImpl } = createFakeFetch({});
    const saved = { ent: process.env.COPILOT_ENTERPRISE, orgs: process.env.COPILOT_ORGS };
    delete process.env.COPILOT_ENTERPRISE;
    delete process.env.COPILOT_ORGS;
    try {
      const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(fetchImpl) });
      assert.deepEqual(await source.fetchSeats(), []);
      assert.deepEqual(await source.fetchMetrics(), []);
      assert.ok(source.getSourceStatuses().every((s) => s.status === 'skipped'));
    } finally {
      if (saved.ent !== undefined) process.env.COPILOT_ENTERPRISE = saved.ent;
      if (saved.orgs !== undefined) process.env.COPILOT_ORGS = saved.orgs;
    }
  });
});

describe('GitHubApiCopilotDataSource: Cost Centers (P0-2)', () => {
  const ccPath = '/enterprises/acme-ent/settings/billing/cost-centers';

  it('reads the documented { costCenters: [...] } response and normalizes resource types', async () => {
    const { fetchImpl } = createFakeFetch({
      [ccPath]: () =>
        json({
          costCenters: [
            {
              id: 'cc-1',
              name: 'Platform',
              state: 'active',
              resources: [
                { type: 'Organization', name: 'acme-org' },
                { type: 'User', name: 'user-1' },
                { type: 'Repo', name: 'acme/api' },
              ],
            },
            { id: 'cc-2', name: 'Retired', state: 'deleted', resources: [] },
          ],
        }),
    });
    const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(fetchImpl), enterprise: 'acme-ent' });

    const costCenters = await source.fetchCostCenters();
    assert.equal(costCenters.length, 1, 'deleted cost centers are excluded from allocation');
    assert.equal(costCenters[0].name, 'Platform');
    assert.deepEqual(
      costCenters[0].resources.map((r) => r.type),
      ['Org', 'User', 'Repository']
    );
    assert.equal(source.getSourceStatuses().find((s) => s.source === 'cost_centers')?.status, 'ok');
  });

  it('marks cost centers as skipped for org-only operation and failed on an API error', async () => {
    const orgOnly = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(createFakeFetch({}).fetchImpl), orgs: ['acme-org'] });
    assert.deepEqual(await orgOnly.fetchCostCenters(), []);
    assert.equal(orgOnly.getSourceStatuses().find((s) => s.source === 'cost_centers')?.status, 'skipped');

    const broken = createFakeFetch({ [ccPath]: () => json({ message: 'oops' }, {}, 500) });
    const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(broken.fetchImpl), enterprise: 'acme-ent' });
    assert.deepEqual(await source.fetchCostCenters(), []);
    assert.equal(source.getSourceStatuses().find((s) => s.source === 'cost_centers')?.status, 'failed');
  });
});
