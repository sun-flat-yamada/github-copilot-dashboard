import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { RawApiFetcher } from '../../adapters/github-api/RawApiFetcher.js';
import { RateLimitError, AuthorizationError, ApiError } from '../../adapters/github-api/errors/index.js';
import { resolveEffectiveApiVersion, DEFAULT_API_VERSION } from '../../adapters/github-api/api-compatibility.js';

describe('RawApiFetcher & ACL Error Tests', () => {
  it('resolves effective API version using compatibility table', () => {
    assert.equal(resolveEffectiveApiVersion('2026-03-10'), '2026-03-10');
    assert.equal(resolveEffectiveApiVersion('2025-09-01'), '2026-03-10'); // deprecated -> fallback
    assert.equal(resolveEffectiveApiVersion('invalid-version'), DEFAULT_API_VERSION);
    assert.equal(resolveEffectiveApiVersion(undefined), DEFAULT_API_VERSION);
  });

  it('instantiates RawApiFetcher with default api version', () => {
    const fetcher = new RawApiFetcher({ apiVersion: '2026-03-10' });
    assert.equal(fetcher.getApiVersion(), '2026-03-10');
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
