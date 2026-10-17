import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  computeActiveAccountStats,
  formatStatValue,
  computeDistributionBuckets,
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

describe('computeDistributionBuckets', () => {
  it('空配列または正の実績値なしの場合は空配列を返す', () => {
    assert.deepEqual(computeDistributionBuckets([]), []);
    assert.deepEqual(computeDistributionBuckets([0, null, undefined, -10]), []);
    assert.deepEqual(computeDistributionBuckets([10, 20], 0), []);
  });

  it('すべての値が等しい場合は単一バケット (100%) を返す', () => {
    const buckets = computeDistributionBuckets([100, 100, 100]);
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0].min, 100);
    assert.equal(buckets[0].max, 100);
    assert.equal(buckets[0].count, 3);
    assert.equal(buckets[0].percentage, 100);
    assert.equal(buckets[0].label, '100');
  });

  it('指定されたビン数で度数分布を算出し、全バケットのカウント合計が対象人数と一致する', () => {
    // 10 件のアカウント: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 (min=10, max=100)
    // 5 バケット: step = 18
    // [10~28), [28~46), [46~64), [64~82), [82~100]
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const buckets = computeDistributionBuckets(values, 5);

    assert.equal(buckets.length, 5);
    const totalCount = buckets.reduce((s, b) => s + b.count, 0);
    assert.equal(totalCount, 10);

    // 各ビンの比率合計が 100% (端数誤差許容)
    const totalPct = buckets.reduce((s, b) => s + b.percentage, 0);
    assert.ok(Math.abs(totalPct - 100) < 0.2);

    // ラベルが設定されていること
    for (const b of buckets) {
      assert.ok(b.label.length > 0);
      assert.ok(b.min <= b.max);
    }
  });

  it('未利用 (0, null) が混在していても除外して度数分布を算出する', () => {
    const values = [0, 50, null, 150, undefined, 200, 0];
    const buckets = computeDistributionBuckets(values, 3);

    assert.equal(buckets.length, 3);
    const totalCount = buckets.reduce((s, b) => s + b.count, 0);
    assert.equal(totalCount, 3); // 50, 150, 200 の 3 件
  });
});
