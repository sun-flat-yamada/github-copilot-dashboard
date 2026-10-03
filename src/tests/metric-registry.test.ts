import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { METRIC_REGISTRY, qualify } from '../domain/metrics/metric-registry.js';
import { MetricValue } from '../../dashboard/src/components/common/MetricValue.js';

const render = (q: ReturnType<typeof qualify>) =>
  renderToStaticMarkup(React.createElement(MetricValue, { qualified: q, format: (v: number) => `${v}!` }));

describe('Metric Registry', () => {
  it('全指標が ID・ラベル(日英)・単位・窓・出典を宣言する', () => {
    for (const [key, def] of Object.entries(METRIC_REGISTRY)) {
      assert.equal(def.id, key);
      assert.ok(def.label.ja && def.label.en && def.sources.length > 0);
    }
  });

  it('品質属性の決定: 欠損 > デモ > 既定', () => {
    assert.equal(qualify('active_rate', 0.5).quality, 'measured');
    assert.equal(qualify('idle_waste', 10).quality, 'estimated');
    assert.equal(qualify('active_rate', 0.5, { isDemo: true }).quality, 'demo');
    assert.equal(qualify('active_rate', null, { isDemo: true }).quality, 'missing');
    assert.equal(qualify('active_rate', undefined).value, null);
  });

  it('実測は値のみ、推定・デモはバッジ付き、欠損は「—（理由）」で 0 を描画しない', () => {
    const measured = render(qualify('active_rate', 0.5));
    assert.match(measured, /data-quality="measured"/);
    assert.doesNotMatch(measured, /metric-badge/);

    assert.match(render(qualify('idle_waste', 10)), /metric-badge-estimated[^>]*>推定</);
    assert.match(render(qualify('active_rate', 0.5, { isDemo: true })), /metric-badge-demo[^>]*>デモ</);

    const missing = render(qualify('acceptance_rate', null, { missingReason: '取得不可' }));
    assert.match(missing, /—/);
    assert.match(missing, /（取得不可）/);
    assert.doesNotMatch(missing, /!/);
  });
});
