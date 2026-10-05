import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { RawApiFetcher } from '../../adapters/github-api/RawApiFetcher.js';
import { GitHubApiCopilotDataSource } from '../../adapters/github-api/GitHubApiCopilotDataSource.js';
import { validateUserReportRow, UserReportRow } from '../../adapters/github-api/usage-reports/user-report-schema.js';
import {
  buildTeamDailyMetrics,
  resolveTeamMembers,
  seatTeams,
} from '../../adapters/github-api/usage-reports/team-metrics-mapper.js';
import type { CopilotSeatAssignment } from '../../domain/entities/copilot.js';

/**
 * Issue #241: team metrics no longer call the retired GET /orgs/{org}/teams/{team}/copilot/metrics.
 * They are derived from the users-1-day rows (Reports API) joined with the seat assigning teams (SDD-03 §2.4).
 */

const BASE = 'https://api.github.com';
const BLOB = 'https://reports.example.test';
const DAYS = ['2026-09-29', '2026-09-30'];

const metric = (extra: Record<string, number> = {}) => ({
  user_initiated_interaction_count: 0,
  code_generation_activity_count: 0,
  code_acceptance_activity_count: 0,
  loc_suggested_to_add_sum: 0,
  loc_added_sum: 0,
  ...extra,
});

/** users-1-day row with official field names (SDD-03 §2.1) */
function userRow(day: string, login: string, id: number, overrides: Record<string, unknown> = {}) {
  return {
    day,
    user_id: id,
    user_login: login,
    enterprise_id: null,
    organization_id: 'o1',
    ai_credits_used: 2,
    user_initiated_interaction_count: 6,
    code_generation_activity_count: 100,
    code_acceptance_activity_count: 30,
    loc_suggested_to_add_sum: 400,
    loc_added_sum: 120,
    loc_deleted_sum: 4,
    totals_by_feature: [
      { feature: 'code_completion', ...metric({ code_generation_activity_count: 10, code_acceptance_activity_count: 4 }) },
      // agent / CLI activity must not leak into the completion counters (surface isolation, SDD-03 §2.2)
      { feature: 'agent_edit', ...metric({ code_generation_activity_count: 500, code_acceptance_activity_count: 500 }) },
      { feature: 'chat_panel_ask_mode', ...metric({ user_initiated_interaction_count: 3 }) },
      { feature: 'copilot_cli', ...metric({ user_initiated_interaction_count: 2 }) },
    ],
    ...overrides,
  };
}

function rows(day: string, specs: Array<[string, number, Record<string, unknown>?]>): UserReportRow[] {
  return specs.map(([login, id, overrides]) => {
    const result = validateUserReportRow(userRow(day, login, id, overrides));
    assert.ok(result.ok);
    return (result as { ok: true; row: UserReportRow }).row;
  });
}

const team = (slug: string, id = 1) => ({ id, name: `Team ${slug.toUpperCase()}`, slug });

function seat(login: string, teams: { assigning_team?: ReturnType<typeof team> | null; assigning_teams?: ReturnType<typeof team>[] }) {
  return {
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    pending_cancellation_date: null,
    last_activity_at: '2026-09-30T00:00:00Z',
    last_activity_editor: 'vscode',
    plan_type: 'business',
    assignee: { login, id: login.length, avatar_url: '', html_url: '', type: 'User' },
    organization: { login: 'acme-org', id: 1 },
    ...teams,
  } as CopilotSeatAssignment;
}

describe('team metrics mapper: users-1-day x seat assigning teams (Issue #241)', () => {
  const seats = [
    seat('alice', { assigning_team: team('backend') }),
    seat('Bob', { assigning_team: team('backend') }),
    seat('carol', { assigning_teams: [team('frontend', 2), team('backend')] }),
    seat('dave', { assigning_team: null }),
  ];

  it('resolves members from assigning_teams first, then assigning_team, case-insensitively', () => {
    assert.deepEqual(seatTeams(seats[2]).map((t) => t.slug), ['frontend', 'backend']);
    assert.deepEqual(seatTeams(seats[3]), [], 'a directly assigned seat belongs to no team');
    const backend = resolveTeamMembers('BACKEND', seats);
    assert.deepEqual([...backend.logins].sort(), ['alice', 'bob', 'carol']);
    assert.equal(backend.teamName, 'Team BACKEND');
    assert.deepEqual([...resolveTeamMembers('frontend', seats).logins], ['carol']);
  });

  it('aggregates member rows per day with the same per-user extraction as the org-wide metrics', () => {
    const rowsByDay = new Map<string, UserReportRow[]>([
      ['2026-09-30', rows('2026-09-30', [['alice', 1], ['bob', 2], ['dave', 4]])],
      [
        '2026-09-29',
        rows('2026-09-29', [
          ['carol', 3],
          // a row without any activity counts as active (it is in the report) but not engaged
          ['alice', 1, { user_initiated_interaction_count: 0, code_generation_activity_count: 0, code_acceptance_activity_count: 0, totals_by_feature: [] }],
        ]),
      ],
      ['2026-09-28', rows('2026-09-28', [['dave', 4]])],
    ]);

    const result = buildTeamDailyMetrics('backend', rowsByDay, seats);
    assert.deepEqual(result.map((r) => r.date), ['2026-09-29', '2026-09-30'], 'sorted; days without member rows are not filled with 0');

    const [d29, d30] = result;
    assert.equal(d30.team_slug, 'backend');
    assert.equal(d30.team_name, 'Team BACKEND');
    assert.equal(d30.total_active_users, 2, 'Bob matched case-insensitively; dave is not a member');
    assert.equal(d30.total_engaged_users, 2);
    assert.equal(d30.total_code_suggestions, 20, 'code_completion only (agent_edit excluded)');
    assert.equal(d30.total_code_acceptances, 8);
    assert.equal(d30.total_chat_turns, 6, 'chat_* features only (CLI excluded)');
    assert.equal(d30.ai_credits_used, 4);
    assert.equal(d30.total_agent_sessions, undefined, 'the reports carry no agent session counts');

    assert.equal(d29.total_active_users, 2);
    assert.equal(d29.total_engaged_users, 1);
  });

  it('omits ai_credits_used when no member row carries it, and keeps a reported 0', () => {
    const absent = new Map([['2026-09-30', rows('2026-09-30', [['alice', 1, { ai_credits_used: undefined }]])]]);
    assert.equal('ai_credits_used' in buildTeamDailyMetrics('backend', absent, seats)[0], false);
    const zero = new Map([['2026-09-30', rows('2026-09-30', [['alice', 1, { ai_credits_used: 0 }]])]]);
    assert.equal(buildTeamDailyMetrics('backend', zero, seats)[0].ai_credits_used, 0);
  });

  it('returns nothing for an unknown team', () => {
    const rowsByDay = new Map([['2026-09-30', rows('2026-09-30', [['alice', 1]])]]);
    assert.deepEqual(buildTeamDailyMetrics('nobody', rowsByDay, seats), []);
  });
});

describe('GitHubApiCopilotDataSource.fetchTeamMetrics (Issue #241)', () => {
  function fakeGitHub() {
    const calls: string[] = [];
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      if (url.host === 'reports.example.test') {
        const day = url.pathname.split('/').pop()!.replace('.ndjson', '');
        const body = [userRow(day, 'alice', 1), userRow(day, 'bob', 2), userRow(day, 'erin', 5)];
        return new Response(body.map((r) => JSON.stringify(r)).join('\n') + '\n');
      }
      if (url.pathname === '/orgs/acme-org/copilot/metrics/reports/users-1-day') {
        const day = url.searchParams.get('day')!;
        return json({ report_day: day, download_links: [`${BLOB}/acme-org/${day}.ndjson`] });
      }
      if (url.pathname === '/orgs/acme-org/copilot/billing/seats') {
        const seats = [
          seat('alice', { assigning_team: team('backend') }),
          seat('bob', { assigning_teams: [team('backend'), team('frontend', 2)] }),
          seat('erin', { assigning_team: team('frontend', 2) }),
        ];
        return json({ total_seats: seats.length, seats });
      }
      return json({ message: 'Not Found' }, 404);
    }) as typeof fetch;
    return { fetchImpl, calls };
  }

  const makeSource = (fetchImpl: typeof fetch) =>
    new GitHubApiCopilotDataSource({
      fetcher: new RawApiFetcher({ token: 'test-token', baseUrl: BASE, fetchImpl, maxRetries: 0, retryDelayMs: 0 }),
      orgs: ['acme-org'],
      reportDays: DAYS,
    });

  it('derives team metrics from the collected rows and seats and never calls the retired team endpoint', async () => {
    const gh = fakeGitHub();
    const source = makeSource(gh.fetchImpl);

    assert.deepEqual(await source.fetchTeamMetrics('backend'), [], 'nothing before metrics and seats are collected');
    assert.equal(gh.calls.length, 0, 'no HTTP call of its own');

    await source.fetchMetrics();
    assert.deepEqual(await source.fetchTeamMetrics('backend'), [], 'seats are still missing');
    await source.fetchSeats();
    const callsBefore = gh.calls.length;

    const backend = await source.fetchTeamMetrics('backend');
    const frontend = await source.fetchTeamMetrics('frontend');
    assert.equal(gh.calls.length, callsBefore, 'derived without another API call');
    assert.ok(!gh.calls.some((p) => p.includes('/teams/')), 'the sunset /orgs/{org}/teams/{team}/copilot/metrics is never called');

    assert.deepEqual(backend.map((t) => t.date), DAYS);
    assert.ok(backend.every((t) => t.total_active_users === 2 && t.total_code_suggestions === 20 && t.ai_credits_used === 4));
    assert.ok(frontend.every((t) => t.total_active_users === 2), 'bob is in both teams');
    assert.ok(source.getIssues().every((i) => !i.target.includes('teams/')), 'no failure issue is recorded');
  });

  it('fetchCostCenterBudgets is not an API source: empty by contract, no request, no issue', async () => {
    const gh = fakeGitHub();
    const source = new GitHubApiCopilotDataSource({
      fetcher: new RawApiFetcher({ token: 'test-token', baseUrl: BASE, fetchImpl: gh.fetchImpl, maxRetries: 0, retryDelayMs: 0 }),
      enterprise: 'acme-ent',
      reportDays: DAYS,
    });
    assert.deepEqual(await source.fetchCostCenterBudgets(), []);
    assert.equal(gh.calls.length, 0);
    assert.deepEqual(source.getIssues(), []);
  });
});
