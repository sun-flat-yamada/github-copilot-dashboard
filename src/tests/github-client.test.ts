import test, { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { GitHubCopilotClient } from '../collector/github-client.js';

test('GitHubCopilotClient: defaults to latest API version 2026-03-10', () => {
  const originalEnv = process.env.GITHUB_API_VERSION;
  delete process.env.GITHUB_API_VERSION;

  try {
    const client = new GitHubCopilotClient({
      token: 'ghp_mocktoken00000000000000000000000000',
    });

    const headers = client.getHeaders();
    assert.strictEqual(headers['X-GitHub-Api-Version'], '2026-03-10');
    assert.strictEqual(headers['Accept'], 'application/vnd.github+json');
    assert.strictEqual(headers['Authorization'], 'Bearer ghp_mocktoken00000000000000000000000000');
    assert.ok(headers['User-Agent'].startsWith('GitHub-Copilot-Analytics-Platform/'));
  } finally {
    if (originalEnv !== undefined) {
      process.env.GITHUB_API_VERSION = originalEnv;
    }
  }
});

test('GitHubCopilotClient: respects apiVersion specified in constructor config', () => {
  const client = new GitHubCopilotClient({
    token: 'ghp_mocktoken00000000000000000000000000',
    apiVersion: '2022-11-28',
  });

  const headers = client.getHeaders();
  assert.strictEqual(headers['X-GitHub-Api-Version'], '2022-11-28');
});

test('GitHubCopilotClient: respects GITHUB_API_VERSION environment variable fallback', () => {
  const originalEnv = process.env.GITHUB_API_VERSION;
  process.env.GITHUB_API_VERSION = '2026-03-10';

  try {
    const client = new GitHubCopilotClient({
      token: 'ghp_mocktoken00000000000000000000000000',
    });

    const headers = client.getHeaders();
    assert.strictEqual(headers['X-GitHub-Api-Version'], '2026-03-10');
  } finally {
    if (originalEnv !== undefined) {
      process.env.GITHUB_API_VERSION = originalEnv;
    } else {
      delete process.env.GITHUB_API_VERSION;
    }
  }
});

test('GitHubCopilotClient: constructor config overrides GITHUB_API_VERSION environment variable', () => {
  const originalEnv = process.env.GITHUB_API_VERSION;
  process.env.GITHUB_API_VERSION = '2022-11-28';

  try {
    const client = new GitHubCopilotClient({
      token: 'ghp_mocktoken00000000000000000000000000',
      apiVersion: '2026-03-10',
    });

    const headers = client.getHeaders();
    assert.strictEqual(headers['X-GitHub-Api-Version'], '2026-03-10');
  } finally {
    if (originalEnv !== undefined) {
      process.env.GITHUB_API_VERSION = originalEnv;
    } else {
      delete process.env.GITHUB_API_VERSION;
    }
  }
});

test('GitHubCopilotClient: generates mock bundle and records mock issues in mock mode', async () => {
  const client = new GitHubCopilotClient({
    mockMode: true,
  });

  const metrics = await client.fetchMetrics();
  assert.ok(Array.isArray(metrics));
  assert.strictEqual(metrics.length, 30);

  const seats = await client.fetchSeats();
  assert.ok(Array.isArray(seats));
  assert.ok(seats.length > 0);

  const issues = client.getIssues();
  assert.ok(Array.isArray(issues));
  assert.ok(issues.length >= 2);
  assert.ok(issues.some((i) => i.category === 'rate_limit'));
  assert.ok(issues.some((i) => i.category === 'api_auth'));
});

describe('GitHubCopilotClient (real-data mode: no silent mock fallback)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetchCostCenters returns an empty array (not mock data) when no enterprise is configured in real mode', async () => {
    const client = new GitHubCopilotClient({ mockMode: false, token: 'dummy-token', orgs: ['proud-org'] });
    const costCenters = await client.fetchCostCenters();
    assert.deepStrictEqual(costCenters, []);
  });

  it('fetchMetrics returns an empty array (never silently falls back to mock data) when the API call fails', async () => {
    globalThis.fetch = (async () => {
      throw new Error('simulated network failure');
    }) as typeof fetch;

    const client = new GitHubCopilotClient({ mockMode: false, token: 'dummy-token', orgs: ['proud-org'] });
    const metrics = await client.fetchMetrics();

    assert.deepStrictEqual(metrics, []);
    const issues = client.getIssues();
    assert.ok(issues.some((i) => i.severity === 'error'), 'expected an error issue to be recorded');
  });

  it('fetchSeats returns an empty array (never silently falls back to mock data) when the API call fails', async () => {
    globalThis.fetch = (async () => {
      throw new Error('simulated network failure');
    }) as typeof fetch;

    const client = new GitHubCopilotClient({ mockMode: false, token: 'dummy-token', orgs: ['proud-org'] });
    const seats = await client.fetchSeats();

    assert.deepStrictEqual(seats, []);
  });

  it('fetchCostCenters returns an empty array (not mock data) when the Enterprise API call fails', async () => {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'boom',
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const client = new GitHubCopilotClient({ mockMode: false, token: 'dummy-token', enterprise: 'proud-corp' });
    const costCenters = await client.fetchCostCenters();
    assert.deepStrictEqual(costCenters, []);
  });

  it('uses the current GitHub REST API version header for real requests', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return {
        ok: true,
        status: 200,
        json: async () => ({ cost_centers: [] }),
      };
    }) as unknown as typeof fetch;

    const client = new GitHubCopilotClient({ mockMode: false, token: 'dummy-token', enterprise: 'proud-corp' });
    await client.fetchCostCenters();

    assert.strictEqual(capturedHeaders?.['X-GitHub-Api-Version'], '2026-03-10');
  });
});
