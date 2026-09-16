import test from 'node:test';
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
