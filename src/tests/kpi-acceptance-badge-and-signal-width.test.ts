import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'fs';
import * as path from 'path';
import { UsageSignalBadge } from '../../dashboard/src/components/common/UsageSignalBadge.js';

describe('Inline completion acceptance badge & signal width improvements', () => {
  it('KpiSummaryCards: missing metrics badge displays alert icon only with detailed tooltip and sr-only label', () => {
    const kpiPath = path.resolve(process.cwd(), 'dashboard/src/components/KpiSummaryCards.tsx');
    const content = fs.readFileSync(kpiPath, 'utf-8');

    // missing-metrics-badge exists with detailed tooltip
    assert.match(content, /data-testid="missing-metrics-badge"/);
    assert.match(content, /title="データ一部不明: 一部のメトリクスがAPIエラーにより取得不能でした"/);

    // Displays icon with screen-reader text, without raw inline text span that wraps
    assert.match(content, /<AlertTriangle[^>]*\/>/);
    assert.match(content, /<span className="sr-only">データ一部不明<\/span>/);
    assert.doesNotMatch(content, /<span>データ一部不明<\/span>/);
  });

  it('UsageSignalBadge: enforces shrink-0, min-width, and whitespace-nowrap to prevent line breaks for "参考"', () => {
    const badgePath = path.resolve(process.cwd(), 'dashboard/src/components/common/UsageSignalBadge.tsx');
    const content = fs.readFileSync(badgePath, 'utf-8');

    assert.match(content, /whitespace-nowrap/);
    assert.match(content, /shrink-0/);
    assert.match(content, /min-w-\[\d+px\]/);

    const html = renderToStaticMarkup(React.createElement(UsageSignalBadge, { level: 'watch' }));
    assert.match(html, /参考/);
    assert.match(html, /whitespace-nowrap/);
    assert.match(html, /shrink-0/);
  });

  it('UserDetailTable: ensures adequate min-width on signal column header and data cells', () => {
    const tablePath = path.resolve(process.cwd(), 'dashboard/src/components/UserDetailTable.tsx');
    const content = fs.readFileSync(tablePath, 'utf-8');

    // Th has min-w
    assert.match(content, /<th[^>]*min-w-\[\d+px\][^>]*onClick=\{\(\) => handleSort\('signal'\)\}/);
    // Td has min-w
    assert.match(content, /<td className="px-2\.5 py-2 min-w-\[\d+px\]">\s*\{ins \?/);
  });
});
