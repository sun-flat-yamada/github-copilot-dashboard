import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  computeActiveAccountStats,
  formatStatValue,
} from '../../dashboard/src/utils/accountStats.js';

describe('computeActiveAccountStats', () => {
  it('空配列や正の値が存在しない場合は null を返し activeCount は 0 になる', () => {
    assert.deepEqual(computeActiveAccountStats([]), {
      activeCount: 0,
      min: null,
      median: null,
      max: null,
    });

    assert.deepEqual(computeActiveAccountStats([0, 0, 0, null, undefined, -5]), {
      activeCount: 0,
      min: null,
      median: null,
      max: null,
    });
  });

  it('単一アカウントの利用実績の場合は min = median = max になる', () => {
    assert.deepEqual(computeActiveAccountStats([42]), {
      activeCount: 1,
      min: 42,
      median: 42,
      max: 42,
    });

    assert.deepEqual(computeActiveAccountStats([0, null, 150, 0]), {
      activeCount: 1,
      min: 150,
      median: 150,
      max: 150,
    });
  });

  it('奇数個のアカウント利用実績の中央値を正確に計算する (0 は除外)', () => {
    // 0 が混ざっていても除外され、[10, 25, 100] の 3 件
    const stats = computeActiveAccountStats([100, 0, 10, null, 25]);
    assert.equal(stats.activeCount, 3);
    assert.equal(stats.min, 10);
    assert.equal(stats.median, 25);
    assert.equal(stats.max, 100);
  });

  it('偶数個のアカウント利用実績の中央値を 2 数の平均として計算する', () => {
    // [10, 20, 30, 40] -> 中央値は (20 + 30) / 2 = 25
    const stats = computeActiveAccountStats([40, 10, 30, 20]);
    assert.equal(stats.activeCount, 4);
    assert.equal(stats.min, 10);
    assert.equal(stats.median, 25);
    assert.equal(stats.max, 40);

    // [10, 25, 30, 50] -> 中央値は (25 + 30) / 2 = 27.5
    const statsFloat = computeActiveAccountStats([50, 25, 10, 30]);
    assert.equal(statsFloat.median, 27.5);
  });
});

describe('formatStatValue', () => {
  it('null / undefined をハイフンに整形する', () => {
    assert.equal(formatStatValue(null), '—');
    assert.equal(formatStatValue(undefined), '—');
    assert.equal(formatStatValue(null, 'req'), '—');
  });

  it('数値を 3 桁区切りおよび単位付きで整形する', () => {
    assert.equal(formatStatValue(12345), '12,345');
    assert.equal(formatStatValue(12345, 'req'), '12,345 req');
    assert.equal(formatStatValue(500.5, 'AIC'), '500.5 AIC');
  });
});
