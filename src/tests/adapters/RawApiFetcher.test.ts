import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { RawApiFetcher } from '../../adapters/github-api/RawApiFetcher.js';
import { RateLimitError, AuthorizationError, ApiError } from '../../adapters/github-api/errors/index.js';
import { resolveEffectiveApiVersion, DEFAULT_API_VERSION } from '../../adapters/github-api/api-compatibility.js';

describe('RawApiFetcher & ACL Error Tests', () => {
  it('resolves effective API version using compatibility table', () => {
    assert.equal(resolveEffectiveApiVersion('2026-03-10'), '2026-03-10');
    assert.equal(resolveEffectiveApiVersion('2022-11-28'), '2022-11-28'); // official GA
    assert.equal(resolveEffectiveApiVersion('2025-09-01'), '2026-03-10'); // deprecated -> fallback
    assert.equal(resolveEffectiveApiVersion('invalid-version'), DEFAULT_API_VERSION);
    assert.equal(resolveEffectiveApiVersion(undefined), DEFAULT_API_VERSION);
  });

  it('instantiates RawApiFetcher with default api version', () => {
    const fetcher = new RawApiFetcher({ apiVersion: '2026-03-10' });
    assert.equal(fetcher.getApiVersion(), '2026-03-10');
  });

  it('sends User-Agent and X-GitHub-Api-Version in request headers', async () => {
    let capturedHeaders: HeadersInit | undefined;
    const mockFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const fetcher = new RawApiFetcher({
      token: 'test-token',
      apiVersion: '2022-11-28',
      fetchImpl: mockFetch as typeof fetch,
    });

    await fetcher.fetchRaw('/test-endpoint');
    const headers = capturedHeaders as Record<string, string>;
    assert.equal(headers['User-Agent'], 'GitHub-Copilot-Analytics-Platform/2026.09');
    assert.equal(headers['X-GitHub-Api-Version'], '2022-11-28');
    assert.equal(headers['Authorization'], 'Bearer test-token');
    assert.equal(headers['Accept'], 'application/vnd.github+json');
  });

  it('throws RateLimitError when HTTP 403 has x-ratelimit-remaining: 0', async () => {
    const mockFetch = async () => {
      return new Response('API rate limit exceeded', {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1730000000',
        },
      });
    };

    const fetcher = new RawApiFetcher({
      token: 'test-token',
      maxRetries: 0,
      fetchImpl: mockFetch as typeof fetch,
    });

    await assert.rejects(
      async () => {
        await fetcher.fetchRaw('/orgs/my-org/copilot/metrics');
      },
      (err: any) => {
        assert.ok(err instanceof RateLimitError);
        assert.equal(err.status, 429);
        assert.equal(err.resetAt, '1730000000');
        return true;
      }
    );
  });

  it('verifies RateLimitError properties and inheritance', () => {
    const err = new RateLimitError('/orgs/my-org/copilot/metrics', '1700000000');
    assert.equal(err.name, 'RateLimitError');
    assert.equal(err.status, 429);
    assert.equal(err.endpoint, '/orgs/my-org/copilot/metrics');
    assert.equal(err.resetAt, '1700000000');
    assert.ok(err instanceof ApiError);
  });

  it('verifies AuthorizationError properties and inheritance', () => {
    const err = new AuthorizationError('/enterprises/my-ent/copilot/billing/seats', 'Bad credentials');
    assert.equal(err.name, 'AuthorizationError');
    assert.equal(err.status, 401);
    assert.equal(err.endpoint, '/enterprises/my-ent/copilot/billing/seats');
    assert.ok(err.message.includes('Bad credentials'));
    assert.ok(err instanceof ApiError);
  });
});
