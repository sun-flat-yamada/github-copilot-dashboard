import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { CacheService } from '../../application/services/CacheService.js';

describe('CacheService Tests', () => {
  it('stores and retrieves cached items with LRU update', () => {
    const cache = new CacheService<string>(3);
    cache.set('a', 'alpha');
    cache.set('b', 'beta');
    cache.set('c', 'gamma');

    assert.equal(cache.get('a'), 'alpha'); // Refreshes 'a'
    assert.equal(cache.size(), 3);

    // Insert 4th item -> should evict 'b' (oldest since 'a' was refreshed)
    cache.set('d', 'delta');
    assert.equal(cache.has('b'), false);
    assert.equal(cache.has('a'), true);
    assert.equal(cache.has('c'), true);
    assert.equal(cache.has('d'), true);
  });

  it('clears all cached entries', () => {
    const cache = new CacheService<number>(5);
    cache.set('1', 1);
    cache.set('2', 2);
    assert.equal(cache.size(), 2);

    cache.clear();
    assert.equal(cache.size(), 0);
    assert.equal(cache.get('1'), undefined);
  });
});
