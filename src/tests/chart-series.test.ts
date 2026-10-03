import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { rankWithOther, OTHER_LABEL } from '../../dashboard/src/utils/chart-series.js';

const pick = (g: { n: string; v: number }) => ({ name: g.n, value: g.v });
const mk = (vals: number[]) => vals.map((v, i) => ({ n: `g${i}`, v }));

describe('rankWithOther (P3-3 / D-03)', () => {
  it('sorts descending and keeps all rows when within top N', () => {
    const r = rankWithOther(mk([1, 5, 3]), pick, 8);
    assert.deepEqual(r.map((x) => x.name), ['g1', 'g2', 'g0']);
    assert.ok(r.every((x) => !x.isOther));
  });

  it('folds the tail into a single "その他 (k 件)" row with the summed value', () => {
    const r = rankWithOther(mk([10, 9, 8, 7, 6, 5, 4]), pick, 3);
    assert.equal(r.length, 4);
    const other = r[3];
    assert.equal(other.isOther, true);
    assert.equal(other.count, 4);
    assert.equal(other.value, 7 + 6 + 5 + 4);
    assert.ok(other.name.startsWith(OTHER_LABEL));
    assert.ok(other.name.includes('4 件'));
    assert.equal(other.source, null);
  });

  it('does not fold a single leftover row into "その他"', () => {
    const r = rankWithOther(mk([10, 9, 8, 7]), pick, 3);
    assert.equal(r.length, 4);
    assert.ok(r.every((x) => !x.isOther));
  });

  it('shares sum to 1 and exclude zero / missing / non-finite values', () => {
    const r = rankWithOther(mk([5, 0, -2, NaN, Infinity, 5]), pick, 8);
    assert.equal(r.length, 2);
    assert.ok(Math.abs(r.reduce((s, x) => s + x.share, 0) - 1) < 1e-9);
  });

  it('is stable for ties (by name) and returns [] for no positive values', () => {
    const r = rankWithOther([{ n: 'b', v: 1 }, { n: 'a', v: 1 }], pick, 8);
    assert.deepEqual(r.map((x) => x.name), ['a', 'b']);
    assert.deepEqual(rankWithOther(mk([0, 0]), pick, 8), []);
  });
});
