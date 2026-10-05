import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { RawApiFetcher } from '../../adapters/github-api/RawApiFetcher.js';
import { GitHubApiCopilotDataSource } from '../../adapters/github-api/GitHubApiCopilotDataSource.js';

/**
 * Issue #234: tokens without Enterprise Owner permission.
 * The enterprise scope answers 403; the collector keeps working with the organizations the token can read.
 */

const BASE = 'https://api.github.com';
const BLOB = 'https://reports.example.test';
const DAYS = ['2026-09-29', '2026-09-30'];

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

function userRow(day: string, login: string, id: number) {
  return {
    day,
    user_id: id,
    user_login: login,
    enterprise_id: null,
    organization_id: 'o1',
    ai_credits_used: 1,
    user_initiated_interaction_count: 3,
    code_generation_activity_count: 10,
    code_acceptance_activity_count: 4,
    loc_suggested_to_add_sum: 20,
    loc_added_sum: 8,
    loc_deleted_sum: 1,
    used_agent: false,
    totals_by_ide: [],
    totals_by_feature: [],
    totals_by_language_feature: [],
    totals_by_model_feature: [],
  };
}

/** The same login has the same user id in every organization */
const stableId = (login: string) => [...login].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 1_000_000;

function rawSeat(login: string, org: string) {
  return {
    created_at: '2026-01-15T00:00:00Z',
    last_activity_at: '2026-09-01T00:00:00Z',
    last_activity_editor: 'vscode/1.92',
    plan_type: 'business',
    assignee: { login, id: stableId(login), avatar_url: '', html_url: '', type: 'User' },
    organization: { login: org, id: 1 },
  };
}

interface FakeOrg {
  users?: string[];
  /** HTTP status for every endpoint of this organization (403 = no permission) */
  status?: number;
}

interface FakeGitHubOptions {
  /** status of every /enterprises/... endpoint (default 403: no Enterprise Owner permission) */
  enterpriseStatus?: number;
  orgs?: Record<string, FakeOrg>;
  /** body of GET /user/orgs, or a status code to fail it */
  userOrgs?: string[] | number;
}

function fakeGitHub(opts: FakeGitHubOptions) {
  const calls: string[] = [];
  const orgs = opts.orgs ?? {};
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.host === 'reports.example.test') {
      const [, org, file] = url.pathname.split('/');
      const day = file.replace('.ndjson', '');
      const users = orgs[org]?.users ?? [];
      return new Response(users.map((u) => JSON.stringify(userRow(day, u, stableId(u)))).join('\n') + '\n');
    }
    if (url.pathname === '/user/orgs') {
      if (typeof opts.userOrgs === 'number') return json({ message: 'denied' }, opts.userOrgs);
      return json((opts.userOrgs ?? Object.keys(orgs)).map((login, id) => ({ login, id })));
    }
    if (url.pathname.startsWith('/enterprises/')) {
      return json({ message: 'Must be an enterprise owner' }, opts.enterpriseStatus ?? 403);
    }
    const m = url.pathname.match(/^\/orgs\/([^/]+)\/copilot\/(metrics\/reports\/users-1-day|billing\/seats)$/);
    if (m) {
      const org = orgs[m[1]];
      if (!org) return json({ message: 'Not Found' }, 404);
      if (org.status && org.status !== 200) return json({ message: 'Resource not accessible' }, org.status);
      if (m[2] === 'billing/seats') {
        const users = org.users ?? [];
        return json({ total_seats: users.length, seats: users.map((u) => rawSeat(u, m[1])) });
      }
      const day = url.searchParams.get('day')!;
      return json({ report_day: day, download_links: [`${BLOB}/${m[1]}/${day}.ndjson`] });
    }
    return json({ message: 'Not Found' }, 404);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function makeSource(fetchImpl: typeof fetch, config: { enterprise?: string; orgs?: string[] }) {
  const fetcher = new RawApiFetcher({ token: 'test-token', baseUrl: BASE, fetchImpl, maxRetries: 0, retryDelayMs: 0 });
  return new GitHubApiCopilotDataSource({ fetcher, reportDays: DAYS, ...config });
}

const statusOf = (s: GitHubApiCopilotDataSource, id: string) => s.getSourceStatuses().find((x) => x.source === id);

/** Silence the discovery console line during a test */
async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
  }
}

describe('Graceful privilege fallback (Issue #234)', () => {
  it('Enterprise 403 without COPILOT_ORGS: discovers the organizations via /user/orgs and collects their metrics and seats', async () => {
    const gh = fakeGitHub({ orgs: { 'org-a': { users: ['alice', 'bob'] }, 'org-b': { users: ['bob', 'carol'] } } });
    const source = makeSource(gh.fetchImpl, { enterprise: 'acme-ent', orgs: [] });

    const [metrics, seats] = await quiet(() => Promise.all([source.fetchMetrics(), source.fetchSeats()]));

    assert.equal(metrics.length, DAYS.length);
    assert.equal(metrics[0].total_active_users, 3, 'bob is in both organizations: counted once');
    assert.deepEqual(seats.map((s) => s.assignee.login).sort(), ['alice', 'bob', 'carol']);

    assert.equal(statusOf(source, 'metrics')?.status, 'partial', 'the enterprise scope was not collected');
    assert.equal(statusOf(source, 'seats')?.status, 'partial');
    assert.equal(gh.calls.filter((p) => p === '/user/orgs').length, 1, 'discovery is shared by metrics and seats');

    const issues = source.getIssues();
    assert.ok(issues.length > 0);
    assert.ok(issues.every((i) => i.severity === 'warning'), 'a successful fallback is a warning, not an error');
    assert.ok(issues.some((i) => i.target.includes('enterprise:acme-ent') && i.http_status === 403 && i.category === 'api_auth'));
    assert.deepEqual(source.getCollectionConfig().orgs, ['org-a', 'org-b'], 'discovered orgs are recorded for reprocessing');
  });

  it('Enterprise 403 with COPILOT_ORGS set: keeps the configured organizations and does not call /user/orgs', async () => {
    const gh = fakeGitHub({ orgs: { 'org-a': { users: ['alice'] }, 'org-b': { users: ['bob'] } } });
    const source = makeSource(gh.fetchImpl, { enterprise: 'acme-ent', orgs: ['org-a'] });

    const metrics = await source.fetchMetrics();
    const seats = await source.fetchSeats();
    assert.equal(metrics[0].total_active_users, 1);
    assert.deepEqual(seats.map((s) => s.assignee.login), ['alice']);
    assert.ok(!gh.calls.includes('/user/orgs'));
    assert.equal(statusOf(source, 'seats')?.status, 'partial');
    assert.ok(source.getIssues().every((i) => i.severity === 'warning'));
  });

  it('one organization 403 among several: the others are still collected', async () => {
    const gh = fakeGitHub({
      enterpriseStatus: 200,
      orgs: { 'org-a': { users: ['alice'] }, 'org-locked': { status: 403 }, 'org-c': { users: ['carol'] } },
    });
    const source = makeSource(gh.fetchImpl, { orgs: ['org-a', 'org-locked', 'org-c'] });

    const metrics = await source.fetchMetrics();
    const seats = await source.fetchSeats();
    assert.equal(metrics[0].total_active_users, 2);
    assert.deepEqual(seats.map((s) => s.assignee.login).sort(), ['alice', 'carol']);
    assert.equal(statusOf(source, 'metrics')?.status, 'partial');
    assert.equal(statusOf(source, 'seats')?.status, 'partial');

    const locked = source.getIssues().filter((i) => i.target.includes('org:org-locked'));
    assert.ok(locked.length >= 2, 'the denied organization is recorded for metrics and seats');
    assert.ok(locked.every((i) => i.severity === 'warning' && i.category === 'api_auth'));
  });

  it('a transient seat failure still fails the whole seats source (no partial headcount posing as current)', async () => {
    const gh = fakeGitHub({ orgs: { 'org-a': { users: ['alice'] }, 'org-b': { status: 502 } } });
    const source = makeSource(gh.fetchImpl, { orgs: ['org-a', 'org-b'] });
    assert.deepEqual(await source.fetchSeats(), []);
    assert.equal(statusOf(source, 'seats')?.status, 'failed');
  });

  it('every scope denied: the source fails with an error issue', async () => {
    const gh = fakeGitHub({ orgs: { 'org-a': { status: 403 } } });
    const source = makeSource(gh.fetchImpl, { enterprise: 'acme-ent', orgs: [] });
    const [metrics, seats] = await quiet(() => Promise.all([source.fetchMetrics(), source.fetchSeats()]));
    assert.deepEqual(metrics, []);
    assert.deepEqual(seats, []);
    assert.equal(statusOf(source, 'metrics')?.status, 'failed');
    assert.equal(statusOf(source, 'seats')?.status, 'failed');
    assert.ok(source.getIssues().some((i) => i.severity === 'error' && i.category === 'api_auth'));
  });

  it('discovery failure (e.g. a GitHub App installation token) is a warning and the enterprise failure stays visible', async () => {
    const gh = fakeGitHub({ userOrgs: 403, orgs: { 'org-a': { users: ['alice'] } } });
    const source = makeSource(gh.fetchImpl, { enterprise: 'acme-ent', orgs: [] });
    assert.deepEqual(await source.fetchSeats(), []);
    assert.equal(statusOf(source, 'seats')?.status, 'failed');
    const discovery = source.getIssues().find((i) => i.target === 'config:org-discovery');
    assert.equal(discovery?.severity, 'warning');
    assert.match(discovery?.details ?? '', /COPILOT_ORGS/);
  });

  it('COPILOT_ORGS=auto discovers the organizations without an enterprise', async () => {
    const gh = fakeGitHub({ orgs: { 'org-a': { users: ['alice'] } } });
    const saved = process.env.COPILOT_ORGS;
    process.env.COPILOT_ORGS = 'auto';
    try {
      const fetcher = new RawApiFetcher({ token: 'test-token', baseUrl: BASE, fetchImpl: gh.fetchImpl, maxRetries: 0, retryDelayMs: 0 });
      const source = new GitHubApiCopilotDataSource({ fetcher, reportDays: DAYS });
      const seats = await quiet(() => source.fetchSeats());
      assert.deepEqual(seats.map((s) => s.assignee.login), ['alice']);
      assert.equal(statusOf(source, 'seats')?.status, 'ok');
      assert.ok(!gh.calls.some((p) => p.startsWith('/orgs/auto')), '"auto" is not an organization slug');
      assert.deepEqual(source.getCollectionConfig().orgs, ['org-a']);
    } finally {
      if (saved === undefined) delete process.env.COPILOT_ORGS;
      else process.env.COPILOT_ORGS = saved;
    }
  });

  it('Cost Centers 403: skipped with a warning (cost allocation continues with the user mapping)', async () => {
    const gh = fakeGitHub({});
    const source = makeSource(gh.fetchImpl, { enterprise: 'acme-ent' });
    assert.deepEqual(await source.fetchCostCenters(), []);
    assert.equal(statusOf(source, 'cost_centers')?.status, 'skipped');
    const issue = source.getIssues().find((i) => i.target === 'billing/cost-centers');
    assert.equal(issue?.severity, 'warning');
    assert.equal(issue?.http_status, 403);
    assert.match(issue?.details ?? '', /COPILOT_USER_MAPPING/);
  });

  it('AI Credits 403 on every day: skipped with a single warning', async () => {
    const gh = fakeGitHub({});
    const source = makeSource(gh.fetchImpl, { enterprise: 'acme-ent' });
    assert.deepEqual(await source.fetchAiCreditUsage(), []);
    assert.equal(statusOf(source, 'ai_credits')?.status, 'skipped');
    const issues = source.getIssues().filter((i) => i.target === 'billing/ai_credit/usage');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'warning');
    assert.equal(issues[0].category, 'api_auth');
  });

  it('Cost Centers server error stays failed (only permission denial is skipped)', async () => {
    const gh = fakeGitHub({ enterpriseStatus: 500 });
    const source = makeSource(gh.fetchImpl, { enterprise: 'acme-ent' });
    await source.fetchCostCenters();
    assert.equal(statusOf(source, 'cost_centers')?.status, 'failed');
  });
});
