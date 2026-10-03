import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  METRIC_REGISTRY,
  describeMetric,
  windowLabel,
  PERSONAL_METRICS_NOTICE,
  type MetricId,
} from '../domain/metrics/metric-registry.js';
import { MetricLabel } from '../../dashboard/src/components/common/MetricLabel.js';

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** KPI を表示するコンポーネント。ここに載る指標はすべてカタログ登録が必要 */
const KPI_COMPONENTS = [
  'dashboard/src/components/KpiSummaryCards.tsx',
  'dashboard/src/components/monthly-report/MonthlyReportKpis.tsx',
  'dashboard/src/components/views/AdoptionMaturityView.tsx',
  'dashboard/src/components/views/AgentActivityView.tsx',
  'dashboard/src/components/views/CreditsView.tsx',
  'dashboard/src/components/YearlyTrendPanel.tsx',
];

const referencedIds = (src: string): string[] => {
  const ids = new Set<string>();
  for (const m of src.matchAll(/metricId="([^"]+)"/g)) ids.add(m[1]);
  for (const m of src.matchAll(/qualify\(\s*'([^']+)'/g)) ids.add(m[1]);
  return [...ids];
};

describe('Metric catalog v1', () => {
  it('全指標が定義・計算式・窓・単位・出典・日英ラベルを宣言する', () => {
    for (const [key, def] of Object.entries(METRIC_REGISTRY)) {
      assert.equal(def.id, key);
      assert.ok(def.label.ja && def.label.en, `${key}: label`);
      assert.ok(def.definition.ja && def.definition.en, `${key}: definition`);
      assert.ok(def.formula.length > 0, `${key}: formula`);
      assert.ok(def.window && def.unit, `${key}: window/unit`);
      assert.ok(def.sources.length > 0, `${key}: sources`);
    }
  });

  it('漏れ防止: KPI コンポーネントが参照する指標はすべてカタログに存在する', () => {
    const catalog = new Set(Object.keys(METRIC_REGISTRY));
    for (const file of KPI_COMPONENTS) {
      const ids = referencedIds(read(file));
      assert.ok(ids.length > 0, `${file}: カタログ指標を 1 つも参照していない`);
      for (const id of ids) assert.ok(catalog.has(id), `${file}: カタログに無い指標 "${id}"`);
    }
  });

  it('漏れ防止: KPI コンポーネントは MetricLabel を使い、素のラベルで KPI を増やさない', () => {
    // KPI カード = 大きな数値 (text-2xl) を持つ要素。カード数 <= MetricLabel 数であること
    const expectedLabels: Record<string, number> = {
      'dashboard/src/components/KpiSummaryCards.tsx': 5,
      'dashboard/src/components/monthly-report/MonthlyReportKpis.tsx': 6,
      'dashboard/src/components/views/AdoptionMaturityView.tsx': 4,
      'dashboard/src/components/views/AgentActivityView.tsx': 4,
      'dashboard/src/components/views/CreditsView.tsx': 4,
      'dashboard/src/components/YearlyTrendPanel.tsx': 2,
    };
    for (const [file, min] of Object.entries(expectedLabels)) {
      const count = (read(file).match(/<MetricLabel\b/g) ?? []).length;
      assert.ok(count >= min, `${file}: MetricLabel が ${count} 個 (必要 ${min} 個以上)`);
    }
  });

  it('カタログの全指標がいずれかの KPI コンポーネントで表示される (孤児定義を残さない)', () => {
    const used = new Set(KPI_COMPONENTS.flatMap((f) => referencedIds(read(f))));
    for (const id of Object.keys(METRIC_REGISTRY)) assert.ok(used.has(id), `未使用の指標定義: ${id}`);
  });

  it('MetricLabel は定義ツールチップと窓を表示し、scope 窓はスコープ種別に追従する', () => {
    const daily = renderToStaticMarkup(React.createElement(MetricLabel, { metricId: 'total_spend', scopeType: 'daily' }));
    assert.match(daily, /data-testid="metric-definition-total_spend"/);
    assert.match(daily, /当日/);
    assert.match(daily, /計算式/);
    assert.match(daily, /出典/);
    const custom = renderToStaticMarkup(React.createElement(MetricLabel, { metricId: 'total_spend', scopeType: 'custom' }));
    assert.match(custom, /選択期間/);
    const report = renderToStaticMarkup(React.createElement(MetricLabel, { metricId: 'report_requests' }));
    assert.match(report, /選択した月次レポートの月/);
  });

  it('describeMetric / windowLabel の文面', () => {
    const id: MetricId = 'acceptance_rate';
    const text = describeMetric(id);
    assert.match(text, /非対応 \(全社値\)/);
    assert.match(text, /生産性指標ではない/);
    assert.equal(windowLabel('point_in_time'), '時点値');
  });

  it('個人指標の注記が UserDetailTable に表示される', () => {
    assert.match(PERSONAL_METRICS_NOTICE, /閲覧権限のある社員向け/);
    assert.match(read('dashboard/src/components/UserDetailTable.tsx'), /PERSONAL_METRICS_NOTICE/);
  });
});
