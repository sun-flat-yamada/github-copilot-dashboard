import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AUDIT_RUN_DISPLAY_LIMIT,
  AuditDataQualityPanel,
  buildAuditModel,
  formatTimestamp,
} from '../../dashboard/src/components/AuditDataQualityPanel.js';
import { createViewRegistry } from '../../dashboard/src/views/viewRegistry.js';
import { discoverViewRegistry } from './ui/test-harness.js';
import type { DataQualityHistory, DataQualityReport } from '../domain/entities/data-quality.js';
import type { IndexMetadata } from '../types/copilot.js';

const report = (n: number, over: Partial<DataQualityReport> = {}): DataQualityReport => ({
  schema_version: 1,
  generated_at: `2026-10-${String(n).padStart(2, '0')}T04:15:00.000Z`,
  run_id: `2026100${n % 10}T041500Z-ab${n % 10}c`,
  window: { start: '2026-09-04', end: '2026-10-01' },
  missing_days: [],
  duplicates_collapsed: 0,
  out_of_range: 0,
  quarantined: 0,
  malformed_lines: 0,
  sources: [{ source: 'metrics', status: 'ok', records: 100, quarantined: 0 }],
  level: 'ok',
  ...over,
});

const history = (entries: DataQualityReport[]): DataQualityHistory => ({ schema_version: 1, entries });

const index = (over: Partial<IndexMetadata> = {}): IndexMetadata =>
  ({
    source_status: [
      { source: 'metrics', status: 'failed', records: 0, last_attempt_at: '2026-10-03T04:15:00.000Z', last_success_at: '2026-10-02T04:15:00.000Z', error: 'HTTP 500' },
      { source: 'seats', status: 'ok', records: 120, quarantined: 2, last_attempt_at: '2026-10-03T04:15:00.000Z', last_success_at: '2026-10-03T04:15:00.000Z' },
      { source: 'cost_centers', status: 'skipped', records: 0, last_attempt_at: '2026-10-03T04:15:00.000Z', last_success_at: null },
    ],
    data_quality: {
      level: 'error',
      generated_at: '2026-10-03T04:15:00.000Z',
      missing_days_count: 1,
      out_of_range: 0,
      quarantined: 2,
      malformed_lines: 0,
      trend: 'degraded',
      previous_level: 'ok',
      last_change_at: '2026-10-03T04:15:00.000Z',
      history_file: 'quality/history.json',
    },
    ...over,
  }) as unknown as IndexMetadata;

const render = (props: Partial<React.ComponentProps<typeof AuditDataQualityPanel>>) =>
  renderToStaticMarkup(React.createElement(AuditDataQualityPanel, { index: null, history: null, ...props }));

describe('Audit / data quality view (P4-1)', () => {
  it('formats timestamps and shows a reason for an empty one', () => {
    assert.equal(formatTimestamp('2026-10-03T04:15:00.000Z', 'x'), '2026-10-03 04:15 UTC');
    assert.equal(formatTimestamp(null, '成功した記録なし'), '—（成功した記録なし）');
  });

  it('builds the model: newest run first, last success is the latest across sources, no value is invented', () => {
    const m = buildAuditModel(index(), history([report(1), report(2, { level: 'warning', missing_days: ['2026-09-30'] })]));
    assert.equal(m.lastSuccessAt, '2026-10-03 04:15 UTC');
    assert.equal(m.latestLevel, 'error');
    assert.equal(m.runTotal, 2);
    assert.equal(m.runs[0].generatedAt, '2026-10-02 04:15 UTC');
    assert.equal(m.runs[0].missingDaysCount, 1);
    assert.equal(m.sources.find((s) => s.source === 'cost_centers')!.lastSuccessAt, '—（成功した記録なし）');
    assert.equal(m.sources.find((s) => s.source === 'metrics')!.error, 'HTTP 500');
  });

  it('limits the displayed runs and summarizes many missing days', () => {
    const many = Array.from({ length: AUDIT_RUN_DISPLAY_LIMIT + 5 }, (_, i) =>
      report((i % 28) + 1, { generated_at: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`, missing_days: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })
    );
    const m = buildAuditModel(null, history(many));
    assert.equal(m.runs.length, AUDIT_RUN_DISPLAY_LIMIT);
    assert.equal(m.runTotal, AUDIT_RUN_DISPLAY_LIMIT + 5);
    assert.match(m.runs[0].missingDaysText, /ほか 2 日/);
  });

  it('renders sources, runs and the summary', () => {
    const html = render({ index: index(), history: history([report(1), report(2, { level: 'warning', quarantined: 3 })]) });
    assert.match(html, /data-testid="audit-data-quality"/);
    assert.match(html, /data-testid="audit-sources-table"/);
    assert.match(html, /data-testid="audit-runs-table"/);
    assert.equal((html.match(/data-testid="audit-run-row"/g) ?? []).length, 2);
    assert.match(html, /<caption class="sr-only">/);
    assert.match(html, /失敗/);
    assert.match(html, /2026-10-03 04:15 UTC/);
  });

  it('shows "—（理由）" when nothing can be loaded, never 0 or an empty table', () => {
    const html = render({ indexError: 'HTTP 404', historyError: 'HTTP 404: quality/history.json' });
    assert.match(html, /data-testid="audit-sources-unavailable"/);
    assert.match(html, /data-testid="audit-runs-unavailable"/);
    assert.match(html, /—（index\.json を取得できません）/);
    assert.match(html, /品質履歴 \(quality\/history\.json\) を取得できません/);
    assert.doesNotMatch(html, /<table/);
  });

  it('explains that demo data has no run history', () => {
    const html = render({ index: index({ source_status: undefined }), historyError: 'HTTP 404', isDemo: true });
    assert.match(html, /デモデータには実行履歴がありません/);
    assert.match(html, /旧形式/);
    assert.match(html, /data-testid="audit-demo"/);
  });

  it('shows an empty history as a reason, not as zero runs', () => {
    const html = render({ index: index(), history: history([]) });
    assert.match(html, /品質履歴が空です/);
  });

  it('contains no personal identifier (counts, dates and source names only)', () => {
    const html = render({ index: index(), history: history([report(1)]) });
    assert.doesNotMatch(html, /@|login|ghp_/i);
  });

  it('is registered by manifest + component only and sits after the existing views', async () => {
    const registry: ReturnType<typeof createViewRegistry> = await discoverViewRegistry();
    const m = registry.get('audit')!;
    assert.equal(m.title, '監査・データ品質');
    assert.deepEqual(m.requiredDatasets, []);
    assert.equal(registry.getAll().at(-1)!.id, 'audit');
  });
});
