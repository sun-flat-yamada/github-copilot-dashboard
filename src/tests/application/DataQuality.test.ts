import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  appendQualityHistory,
  buildDataQualityReport,
  summarizeQualityHistory,
} from '../../application/pipeline/data-quality.js';
import { DATA_QUALITY_HISTORY_LIMIT, QualityObservations } from '../../domain/entities/data-quality.js';
import type { SourceStatus } from '../../domain/entities/copilot.js';
import { buildDataStatusItems } from '../../../dashboard/src/utils/dataStatus.js';
import type { IndexMetadata } from '../../types/copilot.js';

const obs = (extra: Partial<QualityObservations> = {}): QualityObservations => ({
  requested_days: ['2026-09-28', '2026-09-29', '2026-09-30'],
  available_days: ['2026-09-28', '2026-09-29', '2026-09-30'],
  duplicates_collapsed: 0,
  out_of_range: 0,
  quarantined: 0,
  malformed_lines: 0,
  ...extra,
});

const st = (status: SourceStatus['status'], extra: Partial<SourceStatus> = {}): SourceStatus => ({
  source: 'metrics',
  status,
  records: 3,
  last_attempt_at: '2026-10-01T00:00:00Z',
  last_success_at: null,
  ...extra,
});

const at = (n: number) => `2026-10-0${n}T00:00:00Z`;

describe('data quality report (P1-7)', () => {
  it('is ok when every day arrived and nothing was quarantined; duplicates are information only', () => {
    const r = buildDataQualityReport(obs({ duplicates_collapsed: 12 }), [st('ok')], at(1), 'run-1');
    assert.equal(r.level, 'ok');
    assert.deepEqual(r.missing_days, []);
    assert.equal(r.duplicates_collapsed, 12);
    assert.equal(r.run_id, 'run-1');
    assert.deepEqual(r.window, { start: '2026-09-28', end: '2026-09-30' });
  });

  it('warns on missing days, quarantined rows, out-of-range rows and malformed lines', () => {
    const missing = buildDataQualityReport(obs({ available_days: ['2026-09-28', '2026-09-30'] }), [st('ok')], at(1));
    assert.deepEqual(missing.missing_days, ['2026-09-29']);
    assert.equal(missing.level, 'warning');
    for (const extra of [{ quarantined: 1 }, { out_of_range: 1 }, { malformed_lines: 1 }]) {
      assert.equal(buildDataQualityReport(obs(extra), [st('ok')], at(1)).level, 'warning');
    }
  });

  it('is an error when a source failed', () => {
    assert.equal(buildDataQualityReport(obs(), [st('failed')], at(1)).level, 'error');
  });

  it('carries only counts, dates and source names (no logins or values)', () => {
    const r = buildDataQualityReport(obs({ quarantined: 2 }), [st('partial', { quarantined: 2, error: 'user-a failed' })], at(1));
    assert.doesNotMatch(JSON.stringify(r), /user-a/);
  });

  it('appends history, replaces a reprocessed run, and caps the length', () => {
    const a = buildDataQualityReport(obs(), [st('ok')], at(1), 'run-1');
    const b = buildDataQualityReport(obs({ quarantined: 1 }), [st('ok')], at(2), 'run-2');
    let h = appendQualityHistory(appendQualityHistory(null, a), b);
    assert.equal(h.entries.length, 2);
    const again = buildDataQualityReport(obs({ quarantined: 5 }), [st('ok')], at(3), 'run-2');
    h = appendQualityHistory(h, again);
    assert.equal(h.entries.length, 2);
    assert.equal(h.entries[1].quarantined, 5);

    let big = h;
    for (let i = 0; i < DATA_QUALITY_HISTORY_LIMIT + 5; i++) {
      big = appendQualityHistory(big, buildDataQualityReport(obs(), [st('ok')], `2026-11-01T00:${String(i).padStart(2, '0')}:00Z`));
    }
    assert.equal(big.entries.length, DATA_QUALITY_HISTORY_LIMIT);
  });

  it('summarizes the latest run and the trend against the previous one', () => {
    const ok = buildDataQualityReport(obs(), [st('ok')], at(1), 'r1');
    const bad = buildDataQualityReport(obs({ quarantined: 3 }), [st('partial')], at(2), 'r2');
    const fixed = buildDataQualityReport(obs(), [st('ok')], at(3), 'r3');
    const first = summarizeQualityHistory(appendQualityHistory(null, ok))!;
    assert.equal(first.trend, 'first');
    assert.equal(first.previous_level, null);
    const h2 = appendQualityHistory(appendQualityHistory(null, ok), bad);
    const degraded = summarizeQualityHistory(h2)!;
    assert.equal(degraded.trend, 'degraded');
    assert.equal(degraded.last_change_at, at(2));
    assert.equal(degraded.quarantined, 3);
    const recovered = summarizeQualityHistory(appendQualityHistory(h2, fixed))!;
    assert.equal(recovered.trend, 'recovered');
    assert.equal(recovered.last_change_at, at(3));
    assert.equal(summarizeQualityHistory({ schema_version: 1, entries: [] }), null);
  });
});

function index(extra: Partial<IndexMetadata> = {}): IndexMetadata {
  return {
    repository: { owner: 'acme', name: 'dashboard', is_fork: false },
    generated_at: at(3),
    data_retention_days: 365,
    available_months: [],
    available_days: [],
    default_scopes: {},
    summary: { total_seats: 1, active_seats_30d: 1, idle_seats_30d: 0, total_monthly_spend_usd: 0, idle_waste_spend_usd: 0 },
    source_status: [st('ok')],
    ...extra,
  } as IndexMetadata;
}
const items = (meta: IndexMetadata) =>
  buildDataStatusItems({ indexMeta: meta, activeSource: 'live_metrics', activeDataIsDemoSourced: false });

describe('data quality in the status banner (P1-7)', () => {
  it('shows "—（理由）" when there is no quality report, instead of implying all is well', () => {
    const [item] = items(index());
    assert.equal(item.id, 'data-quality-unknown');
    assert.equal(item.level, 'info');
    assert.match(item.title, /—/);
    assert.ok(item.detail);
  });

  it('shows nothing when the source is skipped (no live collection) and no report exists', () => {
    assert.deepEqual(items(index({ source_status: [st('skipped')] })), []);
  });

  it('shows nothing for steady good quality', () => {
    const q = summarizeQualityHistory(appendQualityHistory(null, buildDataQualityReport(obs(), [st('ok')], at(1))))!;
    assert.deepEqual(items(index({ data_quality: q })), []);
  });

  it('shows counts, the degradation and a link to the history', () => {
    const h = appendQualityHistory(
      appendQualityHistory(null, buildDataQualityReport(obs(), [st('ok')], at(1), 'a')),
      buildDataQualityReport(obs({ available_days: ['2026-09-28'], quarantined: 2 }), [st('partial')], at(2), 'b')
    );
    const [item] = items(index({ data_quality: summarizeQualityHistory(h)! }));
    assert.equal(item.level, 'warning');
    assert.match(item.title, /欠損日 2 日/);
    assert.match(item.title, /隔離 2 件/);
    assert.match(item.detail ?? '', /悪化/);
    assert.equal(item.link?.path, 'quality/history.json');
  });

  it('reports recovery as information', () => {
    const h = appendQualityHistory(
      appendQualityHistory(null, buildDataQualityReport(obs({ quarantined: 1 }), [st('partial')], at(1), 'a')),
      buildDataQualityReport(obs(), [st('ok')], at(2), 'b')
    );
    const [item] = items(index({ data_quality: summarizeQualityHistory(h)! }));
    assert.equal(item.id, 'data-quality-recovered');
    assert.equal(item.level, 'info');
  });
});
