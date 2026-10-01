import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { RawApiFetcher } from '../../adapters/github-api/RawApiFetcher.js';
import { GitHubApiCopilotDataSource, mergeSeatsByLogin } from '../../adapters/github-api/GitHubApiCopilotDataSource.js';
import { parseNdjson } from '../../adapters/github-api/usage-reports/ndjson.js';
import { validateUserReportRow, UserReportRow } from '../../adapters/github-api/usage-reports/user-report-schema.js';
import { UsageReportsClient, reportWindowDays } from '../../adapters/github-api/usage-reports/UsageReportsClient.js';
import { buildAllDailyMetrics, buildUserProfiles } from '../../adapters/github-api/usage-reports/user-report-mapper.js';
import { enrichUserProfiles } from '../../processor/profile-enricher.js';

const BASE = 'https://api.github.com';
const BLOB = 'https://reports.example.test';

const metric = (extra: Record<string, number> = {}) => ({
  user_initiated_interaction_count: 0,
  code_generation_activity_count: 0,
  code_acceptance_activity_count: 0,
  loc_suggested_to_add_sum: 0,
  loc_added_sum: 0,
  ...extra,
});

/** users-1-day の 1 行 (公式の項目名。feature / model には未知の値も含める) */
function userRow(day: string, login: string, id: number, overrides: Record<string, unknown> = {}) {
  return {
    day,
    user_id: id,
    user_login: login,
    enterprise_id: 'e1',
    organization_id: null,
    ai_credits_used: 2,
    user_initiated_interaction_count: 14,
    code_generation_activity_count: 100,
    code_acceptance_activity_count: 30,
    loc_suggested_to_add_sum: 400,
    loc_added_sum: 170,
    loc_deleted_sum: 8,
    used_agent: true,
    totals_by_ide: [{ ide: 'vscode', ...metric({ code_generation_activity_count: 100, code_acceptance_activity_count: 30 }) }],
    totals_by_feature: [
      { feature: 'code_completion', ...metric({ code_generation_activity_count: 100, code_acceptance_activity_count: 30, loc_suggested_to_add_sum: 400, loc_added_sum: 120 }) },
      { feature: 'chat_panel_agent_mode', ...metric({ user_initiated_interaction_count: 8, loc_added_sum: 50 }) },
      { feature: 'chat_panel_ask_mode', ...metric({ user_initiated_interaction_count: 4 }) },
      { feature: 'copilot_cli', ...metric({ user_initiated_interaction_count: 2 }) },
      { feature: 'brand_new_feature', ...metric({ user_initiated_interaction_count: 1 }) },
    ],
    totals_by_language_feature: [
      { language: 'typescript', feature: 'code_completion', ...metric({ code_generation_activity_count: 100, code_acceptance_activity_count: 30, loc_suggested_to_add_sum: 400, loc_added_sum: 120 }) },
    ],
    totals_by_model_feature: [
      { model: 'gpt-5', feature: 'chat_panel_agent_mode', ...metric({ user_initiated_interaction_count: 8 }) },
      { model: 'claude-x', feature: 'chat_panel_ask_mode', ...metric({ user_initiated_interaction_count: 4 }) },
      { model: 'gpt-5', feature: 'code_completion', ...metric({ code_generation_activity_count: 100 }) },
    ],
    ...overrides,
  };
}

const ndjson = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

function validRows(day: string, specs: Array<[string, number]>): UserReportRow[] {
  return specs.map(([login, id]) => {
    const result = validateUserReportRow(userRow(day, login, id));
    assert.ok(result.ok);
    return (result as { ok: true; row: UserReportRow }).row;
  });
}

describe('NDJSON parser and the user report row schema (P1-1)', () => {
  it('parses LF / CRLF lines, skips blanks and counts malformed lines without echoing their content', () => {
    const text = `{"a":1}\r\n\r\nnot json with secret-login\n{"a":2}\n`;
    const result = parseNdjson(text);
    assert.deepEqual(result.rows, [{ a: 1 }, { a: 2 }]);
    assert.equal(result.malformed, 1);
    assert.ok(!result.malformedReasons.join(' ').includes('secret-login'));
  });

  it('keeps unknown features / models / extra fields and rejects negative counts without leaking values', () => {
    const ok = validateUserReportRow(userRow('2026-09-30', 'alice', 1, { future_field: 'x' }));
    assert.ok(ok.ok);
    assert.equal((ok as any).row.totals_by_feature.some((f: any) => f.feature === 'brand_new_feature'), true);
    assert.equal((ok as any).row.future_field, 'x');

    const bad = validateUserReportRow(userRow('2026-09-30', 'alice', 1, { code_generation_activity_count: -5 }));
    assert.equal(bad.ok, false);
    assert.match((bad as any).reason, /code_generation_activity_count/);
    assert.ok(!(bad as any).reason.includes('alice'));

    assert.equal(validateUserReportRow({ day: 'yesterday', user_login: 'a' }).ok, false);
    assert.equal(validateUserReportRow({ day: '2026-09-30' }).ok, false);
  });
});

describe('reportWindowDays: the days that are requested (P1-1)', () => {
  it('ends yesterday (UTC) and spans 30 days', () => {
    const days = reportWindowDays(new Date(Date.UTC(2026, 9, 1, 3)));
    assert.equal(days[days.length - 1], '2026-09-30');
    assert.equal(days[0], '2026-09-01');
    assert.equal(days.length, 30);
  });

  it('on the last day of a 31-day month the window still reaches the 1st (the monthly scope is complete)', () => {
    const days = reportWindowDays(new Date(Date.UTC(2026, 11, 31, 3)));
    assert.equal(days[0], '2026-12-01');
    assert.equal(days[days.length - 1], '2026-12-30');
  });
});

/** URL ごとのレスポンスを返す fetch の差し替え (署名付き URL の取得は別ホスト) */
function createFakeFetch(handler: (url: URL, init: RequestInit | undefined) => Response) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), headers: (init?.headers ?? {}) as Record<string, string> });
    return handler(url, init);
  }) as typeof fetch;
  return { fetchImpl, calls };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const makeFetcher = (fetchImpl: typeof fetch) =>
  new RawApiFetcher({ token: 'test-token', baseUrl: BASE, fetchImpl, maxRetries: 0, retryDelayMs: 0 });

describe('UsageReportsClient: users-1-day (P1-1)', () => {
  it('follows the signed download link WITHOUT the Authorization header and parses the NDJSON rows', async () => {
    const { fetchImpl, calls } = createFakeFetch((url) => {
      if (url.host === 'api.github.com') {
        return json({ report_day: '2026-09-30', download_links: [`${BLOB}/ent/2026-09-30-1.ndjson?sig=SECRET-SIGNATURE`] });
      }
      return new Response(ndjson([userRow('2026-09-30', 'alice', 1), userRow('2026-09-30', 'bob', 2)]), { status: 200 });
    });
    const client = new UsageReportsClient(makeFetcher(fetchImpl));
    const result = await client.fetchUsersDay({ kind: 'enterprise', slug: 'acme-ent' }, '2026-09-30');

    assert.equal(result.rows?.length, 2);
    const api = calls[0];
    assert.equal(api.url, `${BASE}/enterprises/acme-ent/copilot/metrics/reports/users-1-day?day=2026-09-30`);
    assert.equal(api.headers.Authorization, 'Bearer test-token');
    assert.equal(api.headers['X-GitHub-Api-Version'] !== undefined, true);
    const download = calls[1];
    assert.ok(download.url.startsWith(BLOB));
    assert.equal(download.headers.Authorization, undefined, 'the PAT must never be sent to the storage host');
  });

  it('treats 204 and 404 as "no report for that day" rather than a failure, and refuses non-https links', async () => {
    const { fetchImpl } = createFakeFetch((url) => {
      if (url.searchParams.get('day') === '2026-09-29') return new Response(null, { status: 204 });
      if (url.searchParams.get('day') === '2026-09-28') return new Response('nope', { status: 404 });
      return json({ report_day: url.searchParams.get('day'), download_links: ['http://insecure.example.test/x.ndjson'] });
    });
    const client = new UsageReportsClient(makeFetcher(fetchImpl));
    const scope = { kind: 'org' as const, slug: 'acme-org' };

    assert.equal((await client.fetchUsersDay(scope, '2026-09-29')).rows, null);
    assert.equal((await client.fetchUsersDay(scope, '2026-09-28')).rows, null);
    await assert.rejects(() => client.fetchUsersDay(scope, '2026-09-27'), /non-https/);
  });

  it('quarantines invalid rows and malformed lines but keeps the valid ones', async () => {
    const text =
      JSON.stringify(userRow('2026-09-30', 'alice', 1)) + '\n' +
      JSON.stringify(userRow('2026-09-30', 'bad', 2, { loc_added_sum: -1 })) + '\n' +
      '{ broken json\n' +
      JSON.stringify(userRow('2026-09-01', 'wrong-day', 3)) + '\n';
    const { fetchImpl } = createFakeFetch((url) =>
      url.host === 'api.github.com'
        ? json({ report_day: '2026-09-30', download_links: [`${BLOB}/a.ndjson`] })
        : new Response(text)
    );
    const result = await new UsageReportsClient(makeFetcher(fetchImpl)).fetchUsersDay(
      { kind: 'enterprise', slug: 'acme-ent' },
      '2026-09-30'
    );
    assert.equal(result.rows?.length, 1);
    assert.equal(result.quarantined, 2);
    assert.equal(result.malformedLines, 1);
  });

  it('rejects a report whose report_day differs from the requested day', async () => {
    const { fetchImpl } = createFakeFetch(() => json({ report_day: '2026-09-01', download_links: [] }));
    await assert.rejects(
      () => new UsageReportsClient(makeFetcher(fetchImpl)).fetchUsersDay({ kind: 'enterprise', slug: 'e' }, '2026-09-30'),
      /day mismatch/
    );
  });

  it('combines Enterprise and Organization reports and counts a user in both only once (Enterprise row wins)', async () => {
    const { fetchImpl } = createFakeFetch((url) => {
      if (url.host === 'api.github.com') {
        const scope = url.pathname.startsWith('/enterprises/') ? 'ent' : 'org';
        return json({ report_day: '2026-09-30', download_links: [`${BLOB}/${scope}.ndjson`] });
      }
      return url.pathname === '/ent.ndjson'
        ? new Response(ndjson([userRow('2026-09-30', 'alice', 1, { ai_credits_used: 7 }), userRow('2026-09-30', 'bob', 2)]))
        : new Response(ndjson([userRow('2026-09-30', 'Alice', 1, { ai_credits_used: 99 }), userRow('2026-09-30', 'carol', 3)]));
    });
    const result = await new UsageReportsClient(makeFetcher(fetchImpl)).fetchUsersRange(
      [{ kind: 'enterprise', slug: 'acme-ent' }, { kind: 'org', slug: 'outside-org' }],
      ['2026-09-30']
    );
    const rows = result.rowsByDay.get('2026-09-30') ?? [];
    assert.deepEqual(rows.map((r) => r.user_login).sort(), ['alice', 'bob', 'carol']);
    assert.equal(rows.find((r) => r.user_id === 1)?.ai_credits_used, 7, 'the Enterprise record must win');
    assert.equal(result.duplicatesCollapsed, 1);
  });
});

describe('report mapper: daily metrics and per-user profiles (P1-1)', () => {
  const day = '2026-09-30';
  const rows = validRows(day, [['alice', 1], ['bob', 2]]);

  it('counts completion suggestions / acceptances only from code_completion (chat, CLI and unknown features are separate)', () => {
    const [m] = buildAllDailyMetrics(new Map([[day, rows]]));
    const completions = m.copilot_ide_code_completions;
    assert.equal(completions.languages.length, 1);
    assert.equal(completions.languages[0].name, 'typescript');
    assert.equal(completions.languages[0].total_code_suggestions, 200);
    assert.equal(completions.languages[0].total_code_acceptances, 60);
    assert.equal(completions.languages[0].total_code_lines_accepted, 240);
    assert.equal(m.copilot_ide_chat.total_chats, 24, '(8 + 4) interactions per user x 2 users, CLI and unknown features excluded');
    assert.equal(m.copilot_in_cli.total_cli_completions, 4);
    assert.deepEqual(
      Object.fromEntries((m.copilot_ide_chat.models ?? []).map((x) => [x.name, x.total_chats])),
      { 'gpt-5': 16, 'claude-x': 8 },
      'completion activity of a model is not a chat'
    );
  });

  it('reports users, credits and lines, and says "not provided" (null) for PR summaries instead of 0', () => {
    const [m] = buildAllDailyMetrics(new Map([[day, rows]]));
    assert.equal(m.total_active_users, 2);
    assert.equal(m.ai_credits?.total_used, 4);
    assert.equal(m.code_generation?.total_lines_added, 340);
    assert.equal(m.copilot_dotcom_pull_requests.total_pr_summaries_created, null);
    assert.equal(m.copilot_ide_agent, undefined, 'no session count in the report: the agent block is not invented');
  });

  it('builds per-user profiles from measurements: history, totals, models and the 28-day credits', () => {
    const second = validRows('2026-09-29', [['alice', 1]]);
    const profiles = buildUserProfiles(new Map([[day, rows], ['2026-09-29', second]]));
    const alice = profiles.find((p) => p.login === 'alice')!;
    assert.equal(alice.daily_history.length, 2);
    assert.deepEqual(alice.daily_history.map((h) => h.date), ['2026-09-29', '2026-09-30']);
    assert.equal(alice.total_suggestions, 200);
    assert.equal(alice.total_acceptances, 60);
    assert.equal(alice.acceptance_rate, 0.3);
    assert.equal(alice.total_chats, 24);
    assert.deepEqual(alice.model_usage_totals, { 'gpt-5': 16, 'claude-x': 8 });
    assert.equal(alice.ai_credits_used_28d, 4);
    assert.equal(alice.plan_type, 'unknown', 'attributes come from the seats later, not from the report');
  });
});

describe('profile enrichment from seats and the attribute mapping (P1-1)', () => {
  it('uses the enriched seat for known users and the resolver for users without a seat', () => {
    const [profile] = buildUserProfiles(new Map([['2026-09-30', validRows('2026-09-30', [['alice', 1]])]])); 
    const [noSeat] = buildUserProfiles(new Map([['2026-09-30', validRows('2026-09-30', [['dave', 4]])]]));
    const seats: any[] = [{ assignee: { login: 'Alice' } }];
    const enriched: any[] = [
      { login: 'dev_pseudonym', display_name: 'User-1', avatar_url: '', department: 'Platform', cost_center: 'CC-1', organization: 'acme-org', plan_type: 'business', tags: ['t'] },
    ];
    const resolver = { resolve: (login: string) => ({ login: `r_${login}`, displayName: `Name ${login}`, department: 'Unassigned', costCenterOverride: undefined }) };

    const [a, d] = enrichUserProfiles([profile, noSeat], seats, enriched, resolver);
    assert.equal(a.login, 'dev_pseudonym');
    assert.equal(a.department, 'Platform');
    assert.equal(a.plan_type, 'business');
    assert.deepEqual(a.tags, ['t']);
    assert.equal(d.login, 'r_dave');
    assert.equal(d.plan_type, 'unknown');
  });
});

describe('GitHubApiCopilotDataSource: metrics through the Reports API (P1-1)', () => {
  beforeEach(() => mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 1, 12) }));
  afterEach(() => mock.timers.reset());

  /** 全日にデータがあるサーバー。failDays の日だけ 500 を返す */
  function reportServer(opts: { failDays?: string[]; missingDays?: string[]; scopes?: string[] } = {}) {
    return createFakeFetch((url) => {
      if (url.host === 'api.github.com' && url.pathname.endsWith('/users-1-day')) {
        const day = url.searchParams.get('day')!;
        if (opts.failDays?.includes(day)) return new Response('boom', { status: 500 });
        if (opts.missingDays?.includes(day)) return new Response('nope', { status: 404 });
        const scope = url.pathname.startsWith('/enterprises/') ? 'ent' : 'org';
        return json({ report_day: day, download_links: [`${BLOB}/${scope}/${day}.ndjson`] });
      }
      if (url.host === 'reports.example.test') {
        const [, scope, file] = url.pathname.split('/');
        const day = file.replace('.ndjson', '');
        return new Response(ndjson(scope === 'ent' ? [userRow(day, 'alice', 1), userRow(day, 'bob', 2)] : [userRow(day, 'alice', 1)]));
      }
      return new Response('not found', { status: 404 });
    });
  }

  it('is ok when every day arrives, never calls the retired /copilot/metrics endpoints, and exposes measured profiles', async () => {
    const { fetchImpl, calls } = reportServer();
    const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(fetchImpl), enterprise: 'acme-ent', orgs: ['acme-org'] });

    const metrics = await source.fetchMetrics();
    assert.equal(metrics.length, 30);
    assert.equal(metrics[0].total_active_users, 2, 'alice is in both the Enterprise and the Org report: counted once');
    const status = source.getSourceStatuses().find((s) => s.source === 'metrics');
    assert.equal(status?.status, 'ok');
    assert.equal(status?.records, 30);

    const apiPaths = calls.filter((c) => c.url.startsWith(BASE)).map((c) => new URL(c.url).pathname);
    assert.ok(apiPaths.every((p) => p.includes('/copilot/metrics/reports/')), 'only the Reports API is called');
    assert.ok(!apiPaths.some((p) => /\/copilot\/metrics$/.test(p)));

    const profiles = await source.fetchUserProfiles();
    assert.deepEqual(profiles.map((p) => p.login), ['alice', 'bob']);
    assert.equal(profiles[0].daily_history.length, 30);
  });

  it('is partial (with an issue) when some days fail, and failed when no report can be read at all', async () => {
    const days = reportWindowDays();
    const partial = reportServer({ failDays: [days[3]] });
    const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(partial.fetchImpl), enterprise: 'acme-ent' });
    const metrics = await source.fetchMetrics();
    assert.equal(metrics.length, 29);
    assert.equal(source.getSourceStatuses().find((s) => s.source === 'metrics')?.status, 'partial');
    assert.ok(source.getIssues().some((i) => i.target.includes('users-1-day')));

    const allMissing = reportServer({ missingDays: days });
    const failedSource = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(allMissing.fetchImpl), enterprise: 'acme-ent' });
    assert.deepEqual(await failedSource.fetchMetrics(), []);
    const status = failedSource.getSourceStatuses().find((s) => s.source === 'metrics');
    assert.equal(status?.status, 'failed', 'an empty result is not presented as "no data"');
    assert.ok(failedSource.getIssues().some((i) => /manage_billing:copilot|read:org/.test(i.details ?? '')));
    assert.deepEqual(await failedSource.fetchUserProfiles(), []);
  });

  it('a missing latest day alone (not generated yet) is not an error', async () => {
    const days = reportWindowDays();
    const { fetchImpl } = reportServer({ missingDays: [days[days.length - 1]] });
    const source = new GitHubApiCopilotDataSource({ fetcher: makeFetcher(fetchImpl), enterprise: 'acme-ent' });
    const metrics = await source.fetchMetrics();
    assert.equal(metrics.length, 29);
    assert.equal(source.getSourceStatuses().find((s) => s.source === 'metrics')?.status, 'ok');
  });
});

describe('seats from the Enterprise and its Organizations together (P1-1 / decision 5)', () => {
  const seat = (login: string, org: string | null) =>
    ({ assignee: { login }, organization: org ? { login: org } : null }) as any;

  it('counts a user once and fills a missing organization from the later record', () => {
    const merged = mergeSeatsByLogin([seat('Alice', null), seat('bob', 'o1'), seat('alice', 'o2'), seat('BOB', 'o3')]);
    assert.equal(merged.length, 2);
    assert.equal(merged.find((s) => s.assignee.login === 'Alice')?.organization?.login, 'o2');
    assert.equal(merged.find((s) => s.assignee.login === 'bob')?.organization?.login, 'o1');
  });
});
