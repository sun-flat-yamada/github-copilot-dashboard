import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  addUsageRow,
  computeOrgBaseline,
  computeUsageInsight,
  createUserUsageAccumulator,
  median,
  UsageRow,
} from '../../processor/usage-insight.js';
import { USAGE_INSIGHT_THRESHOLDS as T } from '../../processor/usage-insight-definitions.js';
import { ReportParser, classifyRecordUnit } from '../../processor/report-parser.js';
import { MockDataGenerator } from '../../collector/mock-generator.js';

const row = (over: Partial<UsageRow>): UsageRow => ({
  date: '2026-08-03',
  model: 'm1',
  requests: 0,
  isRequestRow: false,
  isCreditRow: false,
  gross: 0,
  ...over,
});

const aiRow = (date: string, model: string, input: number, output: number, cacheRead: number, gross = 1): UsageRow =>
  row({ date, model, input, output, cacheRead, cacheWrite: 0, credits: 1, isCreditRow: true, gross });

/** n 日分の同一パターンの利用 */
const userWith = (days: number, mk: (d: number) => UsageRow[]) => {
  const a = createUserUsageAccumulator();
  for (let d = 1; d <= days; d++) for (const r of mk(d)) addUsageRow(a, r);
  return a;
};
const date = (d: number) => `2026-08-${String(d).padStart(2, '0')}`;

describe('usage-insight: 指標', () => {
  it('median は空なら null、偶数個は中央 2 値の平均', () => {
    assert.equal(median([]), null);
    assert.equal(median([1, 3, 2, 4]), 2.5);
  });

  it('トークンは 4 種の合計。内訳と取得率を出す', () => {
    const a = userWith(6, (d) => [aiRow(date(d), 'm1', 100, 10, 50)]);
    const i = computeUsageInsight(a, computeOrgBaseline([a]));
    assert.deepEqual(i.tokens, { input: 600, output: 60, cache_read: 300, cache_write: 0, total: 960, coverage: 1 });
  });

  it('トークンが無いユーザーは tokens と単価(トークン)が null で、S1/S2/S5 は判定しない', () => {
    const a = userWith(6, (d) => [row({ date: date(d), requests: 10, isRequestRow: true, gross: 0.4 })]);
    const i = computeUsageInsight(a, computeOrgBaseline([a]));
    assert.equal(i.tokens, null);
    assert.equal(i.unit_cost.per_million_tokens_usd, null);
    assert.equal(i.unit_cost.per_request_usd, 0.04);
    for (const id of ['S1', 'S2', 'S5']) assert.equal(i.signals.find((s) => s.id === id)?.level, 'insufficient');
  });

  it('単価は分母と同じ種類の明細の費用だけで割る (シート料金を混ぜない)', () => {
    const a = createUserUsageAccumulator();
    addUsageRow(a, row({ date: '2026-08-01', gross: 39 })); // シート行: requests でもトークンでもない
    addUsageRow(a, row({ date: '2026-08-02', requests: 10, isRequestRow: true, gross: 0.4 }));
    addUsageRow(a, aiRow('2026-08-03', 'm1', 1_000_000, 0, 0, 2));
    const i = computeUsageInsight(a, computeOrgBaseline([a]));
    assert.equal(i.unit_cost.per_request_usd, 0.04);
    assert.equal(i.unit_cost.per_million_tokens_usd, 2);
    assert.equal(i.unit_cost.per_credit_usd, 2);
  });

  it('1 利用日あたりとピーク日 (requests があれば requests、無ければ credits)', () => {
    const a = userWith(5, (d) => [row({ date: date(d), requests: d === 3 ? 30 : 10, isRequestRow: true })]);
    const i = computeUsageInsight(a, computeOrgBaseline([a]));
    assert.equal(i.usage.per_active_day, 14);
    assert.equal(i.usage.per_active_day_unit, 'requests');
    assert.deepEqual(i.usage.peak_day, { date: date(3), value: 30, unit: 'requests' });
    const c = userWith(5, (d) => [aiRow(date(d), 'm1', 1, 1, 1)]);
    assert.equal(computeUsageInsight(c, computeOrgBaseline([c])).usage.per_active_day_unit, 'credits');
  });

  it('日付なしの行は合計に含み、日別には載せない', () => {
    const a = createUserUsageAccumulator();
    addUsageRow(a, row({ date: '', requests: 5, isRequestRow: true }));
    const i = computeUsageInsight(a, computeOrgBaseline([a]));
    assert.equal(i.usage.requests, 5);
    assert.equal(i.usage.active_days, 0);
    assert.deepEqual(i.daily, []);
  });

  it('トークンを持つ行が一部なら取得率が下がる', () => {
    const a = createUserUsageAccumulator();
    addUsageRow(a, aiRow('2026-08-01', 'm1', 1, 1, 1));
    addUsageRow(a, row({ date: '2026-08-02', requests: 1, isRequestRow: true }));
    assert.equal(computeUsageInsight(a, computeOrgBaseline([a])).tokens?.coverage, 0.5);
  });
});

describe('usage-insight: 兆候', () => {
  const normal = () => userWith(10, (d) => [aiRow(date(d), 'm1', 40000, 6000, 60000)]);
  const peers = [normal(), normal(), normal(), normal()];

  const levelOf = (a: ReturnType<typeof normal>, id: string, accs = [...peers, a]) =>
    computeUsageInsight(a, computeOrgBaseline(accs)).signals.find((s) => s.id === id)!;

  it('最低利用日数に満たなければ判定しない', () => {
    const few = userWith(T.minActiveDays - 1, (d) => [aiRow(date(d), 'm1', 400000, 1000, 600000)]);
    const i = computeUsageInsight(few, computeOrgBaseline([...peers, few]));
    assert.ok(i.signals.every((s) => s.level === 'insufficient'));
    assert.equal(i.level, 'insufficient');
  });

  it('S1: 持ち越し比が組織中央値の 3 倍以上で「確認を推奨」、2 倍以上で「参考」', () => {
    const heavy = userWith(10, (d) => [aiRow(date(d), 'm1', 40000, 2000, 60000)]); // 比 50 vs 16.7 → 3.0 倍
    assert.equal(levelOf(heavy, 'S1').level, 'review');
    const mid = userWith(10, (d) => [aiRow(date(d), 'm1', 40000, 3000, 60000)]); // 33.3 vs 16.7 → 2.0 倍
    assert.equal(levelOf(mid, 'S1').level, 'watch');
    assert.equal(levelOf(normal(), 'S1').level, 'none');
  });

  it('S1: 内訳が無い (合計だけの) トークンでは判定しない', () => {
    const totalOnly = userWith(10, (d) => [row({ date: date(d), tokenTotal: 1000, gross: 1 })]);
    assert.equal(levelOf(totalOnly, 'S1').level, 'insufficient');
  });

  it('S2: 高トークン日が 3 日以上かつ 3 割以上で「確認を推奨」', () => {
    const spiky = userWith(10, (d) => [aiRow(date(d), 'm1', d <= 4 ? 400000 : 40000, 6000, 60000)]);
    const s = levelOf(spiky, 'S2');
    assert.equal(s.level, 'review');
    assert.equal(s.detail?.high_days, 4);
    const two = userWith(10, (d) => [aiRow(date(d), 'm1', d <= 2 ? 400000 : 40000, 6000, 60000)]);
    assert.equal(levelOf(two, 'S2').level, 'watch');
    assert.equal(levelOf(normal(), 'S2').level, 'none');
  });

  it('S3: 1 利用日あたりが中央値の 3 倍で「確認を推奨」', () => {
    const mk = (n: number) => userWith(10, (d) => [row({ date: date(d), requests: n, isRequestRow: true })]);
    const all = [mk(10), mk(10), mk(10), mk(10), mk(30)];
    assert.equal(computeUsageInsight(all[4], computeOrgBaseline(all)).signals[2].level, 'review');
    assert.equal(computeUsageInsight(all[0], computeOrgBaseline(all)).signals[2].level, 'none');
  });

  it('S4: 日内のモデル数の平均が高くても、単独では総合を「参考」より上げず、S4 だけでは総合は none', () => {
    const sw = userWith(10, (d) =>
      ['a', 'b', 'c'].map((m) => ({ ...aiRow(date(d), m, 13000, 2000, 20000), credits: 1 / 3 }))
    );
    const i = computeUsageInsight(sw, computeOrgBaseline([...peers, sw]));
    assert.equal(i.signals.find((s) => s.id === 'S4')?.level, 'watch');
    assert.notEqual(i.level, 'review');
  });

  it('組織基準は渡した全ユーザーから作られ、他ユーザーの追加で判定が変わる (表示フィルターとは無関係に固定)', () => {
    const heavy = userWith(10, (d) => [aiRow(date(d), 'm1', 40000, 2000, 60000)]);
    const alone = computeUsageInsight(heavy, computeOrgBaseline([heavy]));
    assert.equal(alone.signals[0].level, 'none'); // 自分だけなら基準と同じ
    assert.equal(levelOf(heavy, 'S1').level, 'review');
  });
});

describe('usage-insight: 取り込み (ReportParser)', () => {
  const parser = new ReportParser();

  it('AI usage report の token 列 (input/output/cache_read/cache_write) を取り込む', () => {
    const csv = [
      'date,username,model,quantity,unit_type,gross_amount,net_amount,input,output,cache_read,cache_write',
      '2026-08-03,u1,claude-sonnet-4,2.5,ai-credits,0.025,0,1000,200,3000,100',
    ].join('\n');
    const [r] = parser.parseRecords(csv);
    assert.equal(r.input_tokens, 1000);
    assert.equal(r.output_tokens, 200);
    assert.equal(r.cache_read_tokens, 3000);
    assert.equal(r.cache_write_tokens, 100);
    assert.equal(classifyRecordUnit(r), 'credits');
  });

  it('unit_type が無い AI usage 行の quantity はリクエスト数に混ぜない', () => {
    const csv = ['date,username,model,quantity,input,output', '2026-08-03,u1,m,2.5,10,5'].join('\n');
    const data = parser.aggregate(parser.parseRecords(csv), '2026-08', 'x.csv');
    assert.equal(data.overview.total_requests, 0);
    assert.equal(data.user_details[0].usage_insight?.tokens?.total, 15);
  });

  it('token 列の無い従来 CSV は従来どおり (unit_type 無しは requests)', () => {
    const csv = ['date,username,model,quantity', '2026-08-03,u1,m,4'].join('\n');
    const data = parser.aggregate(parser.parseRecords(csv), '2026-08', 'x.csv');
    assert.equal(data.overview.total_requests, 4);
    assert.equal(data.user_details[0].usage_insight?.tokens, null);
  });

  it('token 内訳だけが違う行は重複として潰さない', () => {
    const a = ['date,username,model,quantity,unit_type,input,output', '2026-08-03,u1,m,1,ai-credits,10,5'].join('\n');
    const b = ['date,username,model,quantity,unit_type,input,output', '2026-08-03,u1,m,1,ai-credits,99,5'].join('\n');
    const merged = parser.mergeRecordSets([
      { fileName: 'a.csv', records: parser.parseRecords(a) },
      { fileName: 'b.csv', records: parser.parseRecords(b) },
    ]);
    assert.equal(merged.records.length, 2);
    assert.equal(merged.duplicatesSkipped, 0);
  });

  it('デモ CSV: 典型パターンが想定どおりの兆候になる', () => {
    const csv = new MockDataGenerator().generateAiUsageReportCSV('2026-08');
    const data = parser.aggregate(parser.parseRecords(csv), '2026-08', 'demo.csv');
    const find = (login: string) => data.user_details.find((u) => u.login === login)!.usage_insight!;
    assert.equal(find('demo-long-context').signals[0].level, 'review');
    assert.equal(find('demo-spiky').signals[1].level, 'review');
    assert.equal(find('demo-switcher').signals[3].level, 'watch');
    assert.equal(find('demo-light').level, 'insufficient');
    assert.equal(find('demo-user-01').level, 'none');
  });
});
