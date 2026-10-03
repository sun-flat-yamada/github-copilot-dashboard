import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  forecastMonthEnd,
  compareToPrevious,
  previousScopeKey,
  previousPeriodLabel,
  daysInMonth,
  type DailyPoint,
} from '../domain/metrics/kpi-analysis.js';

/** 2026-09-01 から n 日分、一定値の系列 */
const flat = (n: number, value: number, month = '2026-09'): DailyPoint[] =>
  Array.from({ length: n }, (_, i) => ({ date: `${month}-${String(i + 1).padStart(2, '0')}`, value }));

const MID_SEPT = new Date('2026-09-16T00:00:00Z');

describe('forecastMonthEnd (月末着地予測)', () => {
  it('当月途中: 実績累計 + 直近ペース × 残日数', () => {
    const r = forecastMonthEnd(flat(15, 10), { month: '2026-09', now: MID_SEPT });
    assert.equal(r.status, 'forecast');
    if (r.status !== 'forecast') return;
    assert.equal(r.actualToDate, 150);
    assert.equal(r.dailyPace, 10);
    assert.equal(r.remainingDays, 15); // 9 月は 30 日
    assert.equal(r.projected, 300);
    assert.equal(r.low, 300); // 変動なし: レンジは点
    assert.equal(r.high, 300);
    assert.match(r.formula, /当月実績累計/);
    assert.match(r.window, /2026-09/);
  });

  it('直近 7 観測日のペースを使う (序盤の値は影響しない)', () => {
    const series = [...flat(8, 100), ...Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-${String(i + 9).padStart(2, '0')}`, value: 10 }))];
    const r = forecastMonthEnd(series, { month: '2026-09', now: MID_SEPT });
    assert.equal(r.status, 'forecast');
    if (r.status !== 'forecast') return;
    assert.equal(r.dailyPace, 10);
    assert.equal(r.projected, 800 + 70 + 10 * 15);
  });

  it('月初 (観測 7 日未満) は予測せず理由を返す', () => {
    const r = forecastMonthEnd(flat(3, 10), { month: '2026-09', now: new Date('2026-09-04T00:00:00Z') });
    assert.equal(r.status, 'unavailable');
    if (r.status === 'unavailable') assert.match(r.reason, /7 日未満/);
  });

  it('観測データが無い月は予測しない', () => {
    const r = forecastMonthEnd([], { month: '2026-09' });
    assert.equal(r.status, 'unavailable');
  });

  it('欠損 (null / NaN) は 0 として扱わず観測日に数えない', () => {
    const series: DailyPoint[] = [...flat(10, 10), { date: '2026-09-11', value: null }, { date: '2026-09-12', value: Number.NaN }];
    const r = forecastMonthEnd(series, { month: '2026-09', now: MID_SEPT });
    assert.equal(r.status, 'forecast');
    if (r.status !== 'forecast') return;
    assert.equal(r.observedDays, 10);
    assert.equal(r.actualToDate, 100);
  });

  it('欠損が多い (カバレッジ 50% 未満) 場合は予測しない', () => {
    // 1〜7 日 + 20 日の 8 観測 / 20 日経過 = 40%
    const series: DailyPoint[] = [1, 2, 3, 4, 5, 6, 7, 20].map((d) => ({ date: `2026-09-${String(d).padStart(2, '0')}`, value: 5 }));
    const r = forecastMonthEnd(series, { month: '2026-09', now: new Date('2026-09-21T00:00:00Z') });
    assert.equal(r.status, 'unavailable');
    if (r.status === 'unavailable') assert.match(r.reason, /欠損が多い/);
  });

  it('締め済み月 (過去月) は予測ではなく実績を返す', () => {
    const r = forecastMonthEnd(flat(20, 10, '2026-08'), { month: '2026-08', now: MID_SEPT });
    assert.deepEqual(r.status === 'closed' ? r.actual : null, 200);
  });

  it('月末までの観測がある月は now が無くても締め済み', () => {
    const r = forecastMonthEnd(flat(30, 2), { month: '2026-09' });
    assert.equal(r.status, 'closed');
    if (r.status === 'closed') assert.equal(r.actual, 60);
  });

  it('信頼度: 安定した長い観測は高、短く変動が大きいと低', () => {
    const high = forecastMonthEnd(flat(24, 10), { month: '2026-09', now: new Date('2026-09-25T00:00:00Z') });
    assert.equal(high.status === 'forecast' ? high.confidence : null, 'high');
    const noisy: DailyPoint[] = Array.from({ length: 8 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: i % 2 === 0 ? 1 : 30 }));
    const low = forecastMonthEnd(noisy, { month: '2026-09', now: new Date('2026-09-09T00:00:00Z') });
    assert.equal(low.status === 'forecast' ? low.confidence : null, 'low');
    if (low.status === 'forecast') {
      assert.ok(low.low >= low.actualToDate);
      assert.ok(low.high >= low.projected);
      assert.ok(low.low <= low.projected);
    }
  });

  it('他月の日付・不正な月は無視する', () => {
    assert.equal(forecastMonthEnd(flat(15, 10, '2026-08'), { month: '2026-09' }).status, 'unavailable');
    assert.equal(forecastMonthEnd([], { month: 'bad' }).status, 'unavailable');
  });

  it('うるう年の 2 月の日数', () => {
    assert.equal(daysInMonth('2028-02'), 29);
    assert.equal(daysInMonth('2026-02'), 28);
    assert.equal(daysInMonth('2026-13'), null);
  });
});

describe('compareToPrevious (前期比)', () => {
  it('増加・減少・横ばい', () => {
    const up = compareToPrevious(120, 100);
    assert.equal(up.status === 'compared' ? up.direction : null, 'up');
    assert.equal(up.status === 'compared' ? up.ratio : null, 0.2);
    const down = compareToPrevious(50, 100);
    assert.equal(down.status === 'compared' ? down.ratio : null, -0.5);
    const flatR = compareToPrevious(5, 5);
    assert.equal(flatR.status === 'compared' ? flatR.direction : null, 'flat');
  });

  it('前期が 0 のときは変化率を出さない (差分のみ)', () => {
    const r = compareToPrevious(10, 0);
    assert.equal(r.status, 'compared');
    if (r.status === 'compared') {
      assert.equal(r.ratio, null);
      assert.equal(r.delta, 10);
    }
  });

  it('欠損は理由付きで算出不能 (0 と比較しない)', () => {
    const r = compareToPrevious(10, null, { previousReason: '前月のデータがありません' });
    assert.equal(r.status, 'unavailable');
    if (r.status === 'unavailable') assert.equal(r.reason, '前月のデータがありません');
    assert.equal(compareToPrevious(null, 10).status, 'unavailable');
    assert.equal(compareToPrevious(Number.NaN, 10).status, 'unavailable');
  });
});

describe('previousScopeKey', () => {
  it('月次は前月 (年跨ぎ含む)、日次は前日 (月跨ぎ含む)、期間は無し', () => {
    assert.equal(previousScopeKey('monthly', '2026-09'), '2026-08');
    assert.equal(previousScopeKey('monthly', '2026-01'), '2025-12');
    assert.equal(previousScopeKey('daily', '2026-09-01'), '2026-08-31');
    assert.equal(previousScopeKey('daily', '2026-01-01'), '2025-12-31');
    assert.equal(previousScopeKey('custom', 'custom:2026-08-11_2026-09-09'), null);
    assert.equal(previousScopeKey('monthly', 'x'), null);
    assert.equal(previousPeriodLabel('monthly'), '前月比');
    assert.equal(previousPeriodLabel('custom'), null);
  });
});
