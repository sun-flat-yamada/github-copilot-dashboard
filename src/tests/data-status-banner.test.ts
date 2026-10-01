import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildDataStatusItems,
  formatStatusTimestamp,
  isMockModeData,
  resolveIsDemoData,
} from '../../dashboard/src/utils/dataStatus.js';
import { IndexMetadata, SourceStatus } from '../types/copilot.js';

function index(overrides: Partial<IndexMetadata> = {}): IndexMetadata {
  return {
    repository: { owner: 'acme', name: 'dashboard', is_fork: false },
    generated_at: '2026-09-10T00:00:00Z',
    data_retention_days: 365,
    available_months: ['2026-09'],
    available_days: ['2026-09-10'],
    default_scopes: { latest_month: '2026-09' },
    summary: { total_seats: 10, active_seats_30d: 8, idle_seats_30d: 2, total_monthly_spend_usd: 300, idle_waste_spend_usd: 40 },
    ...overrides,
  };
}

function src(source: SourceStatus['source'], status: SourceStatus['status'], extra: Partial<SourceStatus> = {}): SourceStatus {
  return {
    source,
    status,
    records: 0,
    last_attempt_at: '2026-09-10T00:00:00Z',
    last_success_at: null,
    ...extra,
  };
}

describe('Data status banner: demo and failed sources are visible at the top of the screen (P0-7 / P0-3)', () => {
  it('shows nothing for healthy real data', () => {
    const items = buildDataStatusItems({
      indexMeta: index({ source_status: [src('metrics', 'ok'), src('seats', 'ok'), src('cost_centers', 'skipped')] }),
      activeSource: 'live_metrics',
      activeDataIsDemoSourced: false,
    });
    assert.deepEqual(items, []);
  });

  it('shows a demo banner when the active data is demo sourced', () => {
    const items = buildDataStatusItems({ indexMeta: index(), activeSource: 'live_metrics', activeDataIsDemoSourced: true });
    assert.equal(items.length, 1);
    assert.equal(items[0].level, 'demo');
    assert.match(items[0].title, /デモ/);
    assert.match(items[0].detail ?? '', /架空|シミュレーション/);
  });

  it('never marks an uploaded file as demo', () => {
    const items = buildDataStatusItems({
      indexMeta: index({ is_mock_mode: true }),
      activeSource: 'user_upload',
      activeDataIsDemoSourced: true,
    });
    assert.deepEqual(items, []);
    assert.equal(resolveIsDemoData({ indexMeta: index({ is_mock_mode: true }), activeSource: 'user_upload' }), false);
  });

  it('falls back to the index declaration only while the active data is not loaded yet', () => {
    assert.equal(resolveIsDemoData({ indexMeta: index({ is_mock_mode: true }), activeSource: 'live_metrics' }), true);
    assert.equal(resolveIsDemoData({ indexMeta: index({ is_mock_mode: false }), activeSource: 'live_metrics' }), false);
    // 取得済みデータの実態 (activeDataIsDemoSourced) が index の宣言より優先される
    assert.equal(
      resolveIsDemoData({ indexMeta: index({ is_mock_mode: true }), activeSource: 'live_metrics', activeDataIsDemoSourced: false }),
      false
    );
  });

  it('a failed source is an error that tells when the shown data was last good', () => {
    const items = buildDataStatusItems({
      indexMeta: index({
        source_status: [
          src('metrics', 'failed', { last_success_at: '2026-09-08T09:30:00Z', error: 'HTTP 503 from /enterprises/x/copilot/metrics' }),
          src('seats', 'ok'),
        ],
      }),
      activeSource: 'live_metrics',
      activeDataIsDemoSourced: false,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].level, 'error');
    assert.match(items[0].title, /利用状況メトリクス.*失敗/);
    assert.match(items[0].detail ?? '', /2026-09-08 09:30 UTC/);
    assert.match(items[0].detail ?? '', /HTTP 503/);
  });

  it('a source that never succeeded says so instead of showing an empty / zero value silently', () => {
    const items = buildDataStatusItems({
      indexMeta: index({ source_status: [src('seats', 'failed', { last_success_at: null, error: 'COPILOT_READ_TOKEN is not set' })] }),
      activeSource: 'live_metrics',
      activeDataIsDemoSourced: false,
    });
    assert.equal(items[0].level, 'error');
    assert.match(items[0].detail ?? '', /一度もない|未取得/);
  });

  it('a partially fetched source is a warning with the quarantined count', () => {
    const items = buildDataStatusItems({
      indexMeta: index({ source_status: [src('seats', 'partial', { quarantined: 3, records: 117 })] }),
      activeSource: 'live_metrics',
      activeDataIsDemoSourced: false,
    });
    assert.equal(items[0].level, 'warning');
    assert.match(items[0].detail ?? '', /3 件/);
  });

  it('a skipped source (not configured) is not a failure and shows nothing', () => {
    const items = buildDataStatusItems({
      indexMeta: index({ source_status: [src('cost_centers', 'skipped')] }),
      activeSource: 'live_metrics',
      activeDataIsDemoSourced: false,
    });
    assert.deepEqual(items, []);
  });

  it('source failures concern live collection only (not monthly reports / uploads)', () => {
    const meta = index({ source_status: [src('metrics', 'failed')] });
    assert.deepEqual(buildDataStatusItems({ indexMeta: meta, activeSource: 'monthly_report', activeDataIsDemoSourced: false }), []);
    assert.deepEqual(buildDataStatusItems({ indexMeta: meta, activeSource: 'user_upload' }), []);
  });

  it('orders errors before warnings before the demo notice', () => {
    const items = buildDataStatusItems({
      indexMeta: index({ source_status: [src('seats', 'partial', { quarantined: 1 }), src('metrics', 'failed')] }),
      activeSource: 'live_metrics',
      activeDataIsDemoSourced: true,
    });
    assert.deepEqual(
      items.map((i) => i.level),
      ['error', 'warning', 'demo']
    );
  });

  it('formats timestamps defensively', () => {
    assert.equal(formatStatusTimestamp('2026-09-08T09:30:45Z'), '2026-09-08 09:30 UTC');
    assert.equal(formatStatusTimestamp(null), null);
    assert.equal(formatStatusTimestamp('not a date'), null);
  });
});

describe('Demo detection does not guess from names or empty metrics (P0-3 / P0-7)', () => {
  it('only an explicit is_mock_mode: true declares demo', () => {
    assert.equal(isMockModeData(index({ is_mock_mode: true })), true);
    assert.equal(isMockModeData(index({ is_mock_mode: false })), false);
    assert.equal(isMockModeData(index()), false);
    assert.equal(isMockModeData(null), false);
  });

  it('a repository owner called proud-corp or an empty collection does not turn real data into demo', () => {
    assert.equal(isMockModeData(index({ repository: { owner: 'proud-corp', name: 'x', is_fork: false } })), false);
    assert.equal(
      isMockModeData(
        index({
          available_days: [],
          summary: { total_seats: 0, active_seats_30d: 0, idle_seats_30d: 0, total_monthly_spend_usd: 0, idle_waste_spend_usd: 0 },
        })
      ),
      false
    );
  });
});

describe('App wiring for the banner and the explicit demo call-to-action', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const app = fs.readFileSync(path.join(root, 'dashboard/src/App.tsx'), 'utf-8');
  const hook = fs.readFileSync(path.join(root, 'dashboard/src/hooks/useDashboardData.ts'), 'utf-8');

  it('App renders the data status banner above the main content', () => {
    assert.match(app, /<DataStatusBanner items=\{dataStatusItems\}/);
    assert.match(app, /buildDataStatusItems\(\{ indexMeta, activeSource, activeDataIsDemoSourced \}\)/);
  });

  it('demo is offered as an explicit action when the live data cannot be loaded', () => {
    assert.match(app, /data-testid="show-demo-data-button"/);
    assert.match(app, /toggleDemoMode\(true\)/);
  });

  it('the hook never falls back to demo paths implicitly and ends loading when the index fails', () => {
    assert.doesNotMatch(hook, /includeAlternateMode/);
    assert.doesNotMatch(hook, /proud-corp/);
    // index.json の取得失敗で loading=true のまま (エラー表示に到達しない) にならない
    assert.match(hook, /setError\(e\.message \|\| 'Failed to initialize analytics index'\);\s*\/\/[^\n]*\n\s*setLoading\(false\);/);
  });

  it('the toggle handler treats only a real boolean as a forced mode (a MouseEvent must not force demo)', () => {
    assert.match(hook, /typeof forcedMode === 'boolean' \? forcedMode : !prev/);
  });
});
