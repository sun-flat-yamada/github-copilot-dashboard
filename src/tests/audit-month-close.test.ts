import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditMonthClosePanel, buildCloseModel, figureLabel, formatFigure } from '../../dashboard/src/components/AuditMonthClosePanel.js';
import type { MonthCloseIndex, MonthCloseRecord } from '../domain/entities/month-close.js';
import { appendRevision, buildCloseIndex, createCloseRecord, parseBusinessCalendar } from '../processor/month-close.js';

const cal = parseBusinessCalendar(undefined).config;
const figures = { 'monthly.overview.total_spend_usd': 1000, 'monthly.overview.total_chats': 200 };
const closed = createCloseRecord('2026-08', figures, cal, { now: new Date('2026-09-08T04:00:00Z'), runId: 'run-a' });
const base = createCloseRecord('2026-09', figures, cal, { now: new Date('2026-10-07T04:00:00Z'), runId: 'run-b' });
const revised = appendRevision(base, { reason: 'late API data', actor: 'finops-team', figures: { ...figures, 'monthly.overview.total_spend_usd': 1250.5 } }, { now: new Date('2026-10-20T04:00:00Z'), runId: 'run-c' })!;
const index: MonthCloseIndex = buildCloseIndex([closed, revised]);
const render = (p: Partial<React.ComponentProps<typeof AuditMonthClosePanel>>) =>
  renderToStaticMarkup(React.createElement(AuditMonthClosePanel, { index: null, ...p }));

describe('Audit view: monthly close and revisions (P4-2)', () => {
  it('builds rows newest first with close date, checksum and revision count', () => {
    const m = buildCloseModel(index, { '2026-09': revised });
    assert.deepEqual(m.rows.map((r) => r.month), ['2026-09', '2026-08']);
    assert.equal(m.rows[0].revisionCount, 1);
    assert.equal(m.rows[0].closesOn, '2026-10-07');
    assert.equal(m.rows[1].revisionCount, 0);
    assert.equal(m.rows[0].revisions[0].runId, 'run-c');
    assert.equal(m.rows[0].revisions[0].actor, 'finops-team');
    assert.equal(m.rows[0].detailError, null);
  });

  it('shows the confirmed-vs-revised diff with the reason', () => {
    const html = render({ index, records: { '2026-09': revised } });
    assert.match(html, /data-testid="close-table"/);
    assert.match(html, /改訂 1 回/);
    assert.match(html, /late API data/);
    assert.match(html, /data-testid="close-diff-table"/);
    assert.match(html, /利用費用 \(USD\)/);
    assert.match(html, /1,000/);
    assert.match(html, /1,250\.5/);
    assert.match(html, /\+250\.5/);
    assert.match(html, /未改訂/);
  });

  it('a missing history file is shown with a reason, not as "no revision"', () => {
    const html = render({ index, records: {}, detailErrors: { '2026-09': 'HTTP 404' } });
    assert.match(html, /—（HTTP 404）/);
  });

  it('no data or an unreadable index shows "—（reason）", never an empty table', () => {
    assert.match(render({ index: null, indexError: 'HTTP 404' }), /HTTP 404/);
    assert.match(render({ index: { schema_version: 1, months: [] } }), /締め済みの月がありません/);
    assert.ok(!render({ index: null }).includes('data-testid="close-table"'));
    assert.match(render({ index: null, loading: true }), /close-loading/);
  });

  it('contains no personal data and labels figures', () => {
    const html = render({ index, records: { '2026-09': revised } });
    assert.ok(!/@|login|ghp_/.test(html.replace(/finops-team/g, '')));
    assert.equal(figureLabel('monthly.overview.total_seats'), 'シート数');
    assert.equal(figureLabel('x.unknown'), 'x.unknown');
    assert.equal(formatFigure(null), '—');
    const rec: MonthCloseRecord = revised;
    assert.equal(rec.revisions[0].diff.length, 1);
  });
});
