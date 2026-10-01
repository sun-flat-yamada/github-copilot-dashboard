import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  ExposureProbe,
  checkPublicExposure,
  indexHasUserLevelData,
  indexIsAnonymized,
  parseGitHubRepoSlug,
} from '../../scripts/verify-fork-health.js';

const SLUG = 'acme/copilot-dashboard';

/** URL → 応答 の対応表から匿名 GET を模す。登録の無い URL は 404 */
function fakeProbe(routes: Record<string, { status: number; body?: unknown } | null>): { probe: ExposureProbe; calls: string[] } {
  const calls: string[] = [];
  const probe: ExposureProbe = async (url) => {
    calls.push(url);
    for (const [needle, response] of Object.entries(routes)) {
      if (url.includes(needle)) return response;
    }
    return { status: 404 };
  };
  return { probe, calls };
}

const REAL_INDEX = {
  is_mock_mode: false,
  summary: { total_seats: 120 },
  available_days: ['2026-09-10'],
  privacy: { anonymized: false, contains_user_level_data: true },
};
const ANONYMIZED_INDEX = { ...REAL_INDEX, privacy: { anonymized: true, contains_user_level_data: true } };
const DEMO_INDEX = { is_mock_mode: true, summary: { total_seats: 80 }, available_days: ['2026-09-10'] };

const PUBLIC_REPO = { status: 200, body: { private: false } };

async function run(
  routes: Record<string, { status: number; body?: unknown } | null>,
  env: NodeJS.ProcessEnv = {},
  extra: { localIndex?: Record<string, unknown> | null } = {}
) {
  const { probe, calls } = fakeProbe(routes);
  const results = await checkPublicExposure({ env, repository: SLUG, probe, localIndex: extra.localIndex ?? null });
  assert.equal(results.length, 1);
  return { result: results[0], calls };
}

describe('fork:verify public exposure check (P0-11 / E-05)', () => {
  it('FAILS when the repository is public and real, non-anonymized data is published on the data branch', async () => {
    const { result } = await run({
      'api.github.com/repos': PUBLIC_REPO,
      'copilot-data/data/index.json': { status: 200, body: REAL_INDEX },
    });
    assert.equal(result.status, 'fail');
    assert.match(result.message, /public/);
    assert.match(result.message, /copilot-data/);
    assert.match(result.remediation ?? '', /private/);
    assert.match(result.remediation ?? '', /ANONYMIZE_SECRET/);
  });

  it('FAILS when Pages serves real data even though the repository itself is private (Pages are public by default)', async () => {
    const { result } = await run({
      'api.github.com/repos': { status: 404 },
      'copilot-data/data/index.json': { status: 404 },
      'acme.github.io/copilot-dashboard/data/index.json': { status: 200, body: REAL_INDEX },
    });
    assert.equal(result.status, 'fail');
    assert.match(result.message, /GitHub Pages serves/);
  });

  it('FAILS up front (before anything is published) when live collection is configured on a public repository without pseudonymization', async () => {
    const { result } = await run(
      { 'api.github.com/repos': PUBLIC_REPO },
      { COPILOT_READ_TOKEN: 'ghp_dummy', COPILOT_ENTERPRISE: 'acme-ent' }
    );
    assert.equal(result.status, 'fail');
  });

  it('PASSES for a public repository that only holds demo data (the upstream project itself)', async () => {
    const { result } = await run({
      'api.github.com/repos': PUBLIC_REPO,
      'copilot-data/data/index.json': { status: 200, body: DEMO_INDEX },
      'acme.github.io/copilot-dashboard/data/index.json': { status: 200, body: DEMO_INDEX },
    });
    assert.equal(result.status, 'pass');
    assert.match(result.message, /demo/);
  });

  it('PASSES for a public repository with live collection when pseudonymization is fully configured', async () => {
    const { result } = await run(
      { 'api.github.com/repos': PUBLIC_REPO, 'copilot-data/data/index.json': { status: 200, body: ANONYMIZED_INDEX } },
      {
        COPILOT_READ_TOKEN: 'ghp_dummy',
        COPILOT_ENTERPRISE: 'acme-ent',
        ANONYMIZE_USERS: 'true',
        ANONYMIZE_SECRET: 'a-sufficiently-long-secret-value',
      }
    );
    assert.equal(result.status, 'pass');
  });

  it('does NOT count ANONYMIZE_USERS=true with a missing or short secret as anonymized', async () => {
    const withoutSecret = await run(
      { 'api.github.com/repos': PUBLIC_REPO },
      { COPILOT_READ_TOKEN: 'ghp_dummy', COPILOT_ENTERPRISE: 'acme-ent', ANONYMIZE_USERS: 'true' }
    );
    assert.equal(withoutSecret.result.status, 'fail');

    const shortSecret = await run(
      { 'api.github.com/repos': PUBLIC_REPO },
      { COPILOT_READ_TOKEN: 'ghp_dummy', COPILOT_ORGS: 'acme-org', ANONYMIZE_USERS: 'true', ANONYMIZE_SECRET: 'short' }
    );
    assert.equal(shortSecret.result.status, 'fail');
  });

  it('PASSES when nothing is anonymously readable (private repository, no public Pages)', async () => {
    const { result } = await run(
      { 'api.github.com/repos': { status: 404 } },
      { COPILOT_READ_TOKEN: 'ghp_dummy', COPILOT_ENTERPRISE: 'acme-ent' }
    );
    assert.equal(result.status, 'pass');
    assert.match(result.message, /not readable/);
  });

  it('is only a WARNING (never a failure) when the network is unreachable, so offline runs do not break', async () => {
    const { result } = await run(
      { 'api.github.com/repos': null, 'copilot-data/data/index.json': null, 'github.io': null },
      { COPILOT_READ_TOKEN: 'ghp_dummy', COPILOT_ENTERPRISE: 'acme-ent' }
    );
    assert.equal(result.status, 'warn');
    assert.match(result.message, /Could not verify/);
  });

  it('a rate-limited response (403/429) is also "could not verify", not "private"', async () => {
    const { result } = await run({ 'api.github.com/repos': { status: 403 } });
    assert.equal(result.status, 'warn');
  });

  it('the explicit acknowledgement downgrades a failure to a warning', async () => {
    const { result } = await run(
      { 'api.github.com/repos': PUBLIC_REPO, 'copilot-data/data/index.json': { status: 200, body: REAL_INDEX } },
      { COPILOT_ALLOW_PUBLIC_DATA: 'true' }
    );
    assert.equal(result.status, 'warn');
    assert.match(result.message, /acknowledged/);
  });

  it('uses the local data/index.json too: a public repository with unpublished real data is already at risk', async () => {
    const { result } = await run({ 'api.github.com/repos': PUBLIC_REPO }, {}, { localIndex: REAL_INDEX });
    assert.equal(result.status, 'fail');
  });

  it('sends anonymous requests only to the three expected endpoints (a custom Pages URL is honoured)', async () => {
    const { calls } = await run(
      { 'api.github.com/repos': { status: 404 } },
      { COPILOT_PAGES_URL: 'https://copilot.example.com/dashboard' }
    );
    assert.deepEqual(calls.sort(), [
      'https://api.github.com/repos/acme/copilot-dashboard',
      'https://copilot.example.com/dashboard/data/index.json',
      'https://raw.githubusercontent.com/acme/copilot-dashboard/copilot-data/data/index.json',
    ]);
  });

  it('warns (does not fail) when the repository cannot be determined', async () => {
    const { probe, calls } = fakeProbe({});
    const results = await checkPublicExposure({ env: {}, repository: null, probe, localIndex: null });
    assert.equal(results[0].status, 'warn');
    assert.equal(calls.length, 0, 'no request must be made without a repository');
  });
});

describe('fork:verify helpers', () => {
  it('parses GitHub repository slugs from remote URLs without exposing credentials', () => {
    assert.equal(parseGitHubRepoSlug('https://github.com/acme/copilot-dashboard.git'), 'acme/copilot-dashboard');
    assert.equal(parseGitHubRepoSlug('https://github.com/acme/copilot-dashboard'), 'acme/copilot-dashboard');
    assert.equal(parseGitHubRepoSlug('git@github.com:acme/copilot-dashboard.git'), 'acme/copilot-dashboard');
    assert.equal(parseGitHubRepoSlug('ssh://git@github.com/acme/copilot-dashboard.git'), 'acme/copilot-dashboard');
    assert.equal(
      parseGitHubRepoSlug('https://x-access-token:ghs_secret@github.com/acme/copilot-dashboard.git'),
      'acme/copilot-dashboard'
    );
    assert.equal(parseGitHubRepoSlug('https://gitlab.com/acme/repo.git'), null);
    assert.equal(parseGitHubRepoSlug(null), null);
  });

  it('classifies index.json: demo is not user-level data; legacy indexes are judged by seats / days', () => {
    assert.equal(indexHasUserLevelData(REAL_INDEX), true);
    assert.equal(indexHasUserLevelData(DEMO_INDEX), false);
    assert.equal(indexHasUserLevelData({ summary: { total_seats: 0 }, available_days: [] }), false);
    assert.equal(indexHasUserLevelData({ summary: { total_seats: 12 } }), true, 'legacy index with seats');
    assert.equal(indexHasUserLevelData(null), false);
    assert.equal(indexIsAnonymized(ANONYMIZED_INDEX), true);
    assert.equal(indexIsAnonymized(REAL_INDEX), false);
  });
});
