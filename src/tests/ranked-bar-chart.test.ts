import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RankedBarChart } from '../../dashboard/src/components/common/RankedBarChart.js';
import { AccessibleChart } from '../../dashboard/src/components/common/AccessibleChart.js';
import { rankWithOther } from '../../dashboard/src/utils/chart-series.js';

const rows = rankWithOther(
  Array.from({ length: 12 }, (_, i) => ({ n: `Group ${i + 1}`, v: (12 - i) * 100 })),
  (g) => ({ name: g.n, value: g.v }),
  5
);

const render = () =>
  renderToStaticMarkup(
    React.createElement(RankedBarChart, { title: 'コスト内訳', rows, formatValue: (v: number) => `$${v}`, valueLabel: '利用費用', testId: 'rb' })
  );

describe('RankedBarChart accessibility (P3-3 / D-07)', () => {
  const html = render();

  it('shows name, value and share as text for every row (not colour alone)', () => {
    assert.equal((html.match(/data-testid="rb-row"/g) ?? []).length, 6);
    assert.ok(html.includes('1. Group 1'));
    assert.ok(html.includes('$1200'));
    assert.match(html, /\(\d+\.\d%\)/);
  });

  it('marks the aggregated row with text and a hatch pattern', () => {
    assert.ok(html.includes('その他 (7 件)'));
    assert.ok(html.includes('data-other="true"'));
    assert.ok(html.includes('repeating-linear-gradient'));
  });

  it('is keyboard reachable and labelled; bars are hidden from assistive tech', () => {
    assert.ok(html.includes('tabindex="0"'));
    assert.match(html, /aria-label="Group 1: \$1200、シェア/);
    assert.ok(html.includes('aria-hidden="true"'));
  });

  it('offers a data-table toggle (aria-pressed) and an empty-state reason', () => {
    assert.ok(html.includes('表で見る'));
    assert.ok(html.includes('aria-pressed="false"'));
    const empty = renderToStaticMarkup(
      React.createElement(RankedBarChart, { title: 't', rows: [], formatValue: String, valueLabel: 'v', testId: 'e' })
    );
    assert.ok(empty.includes('表示できる値がありません'));
  });
});

describe('AccessibleChart', () => {
  it('exposes the chart as an image with a summary and a table toggle', () => {
    const html = renderToStaticMarkup(
      React.createElement(AccessibleChart, { testId: 'ac', title: 'T', summary: 'S', columns: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }] }, React.createElement('svg'))
    );
    assert.ok(html.includes('role="img"'));
    assert.ok(html.includes('aria-label="T。S"'));
    assert.ok(html.includes('表で見る'));
  });
});
