import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModelDotPlot } from '../../dashboard/src/components/radar/ModelDotPlot.js';
import { buildDotPlotRows, formatAxisRaw, summarizeDotPlot } from '../../dashboard/src/components/radar/model-dot-plot-data.js';
import { generateBenchmarkDataset, loadBenchmarkRecords } from '../../scripts/update-benchmarks.js';

const dataset = generateBenchmarkDataset(undefined, new Date('2026-10-04T00:00:00Z'), loadBenchmarkRecords());
const models = dataset.models.slice(0, 6);

describe('ModelDotPlot (P3-7 / B-15, D-03)', () => {
  const rows = buildDotPlotRows(dataset.axis_definitions, models);

  it('builds one row per axis with one dot per selected model, raw value attached', () => {
    assert.equal(rows.length, 6);
    for (const row of rows) {
      assert.equal(row.dots.length, models.length);
      for (const dot of row.dots) assert.ok(dot.raw.length > 0);
    }
    assert.match(formatAxisRaw('coding_swe', models[0]), /SWE-bench .*% \/ HumanEval\+ .*%/);
    assert.match(formatAxisRaw('cost_efficiency', models[0]), /\$.* in \/ \$.* out per 1M/);
  });

  it('summarises the leader per axis for assistive technology', () => {
    const summary = summarizeDotPlot(rows);
    assert.ok(summary.includes('Coding/SWE'));
    assert.equal(summarizeDotPlot([]), 'モデルが選択されていません。');
  });

  const html = renderToStaticMarkup(
    React.createElement(ModelDotPlot, { axes: dataset.axis_definitions, models, focusedModelId: models[0].id })
  );

  it('renders a row per axis and a dot per model with a text tooltip (title)', () => {
    assert.equal((html.match(/data-testid="dot-row-/g) ?? []).length, 6);
    assert.equal((html.match(/data-testid="dot-coding_swe-/g) ?? []).length, models.length);
    assert.ok(html.includes(`<title>${models[0].name} / `));
  });

  it('distinguishes models by marker shape, not colour alone', () => {
    assert.ok(html.includes('<circle'));
    assert.ok(html.includes('<rect'));
    assert.ok(html.includes('<polygon'));
  });

  it('is wrapped for accessibility: image role, summary and a table toggle', () => {
    assert.ok(html.includes('role="img"'));
    assert.ok(html.includes('data-testid="model-dot-plot-toggle"'));
    assert.ok(html.includes('表で見る'));
    assert.ok(html.includes('aria-pressed="false"'));
  });
});
