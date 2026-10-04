import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ForkSafeStorageWriter } from '../adapters/storage/ForkSafeStorageWriter.js';
import { SeatAuditService } from '../application/pipeline/seat-audit.js';
import { Pseudonymizer } from '../collector/pseudonymizer.js';
import type { CopilotSeatAssignment } from '../domain/entities/copilot.js';
import { diffSeatSnapshots, mergeSeatAuditEvents, toSeatSnapshot } from '../processor/seat-audit.js';
import {
  CSV_BOM,
  SEAT_AUDIT_CSV_COLUMNS,
  escapeCsvCell,
  filterSeatAuditEvents,
  parseSeatAuditTypes,
  seatAuditEventsToCsv,
} from '../processor/seat-audit-csv.js';

// 架空のログインのみ (実在の利用者名・メール・ID は使わない)
function seat(login: string, over: Partial<CopilotSeatAssignment> = {}): CopilotSeatAssignment {
  return {
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    pending_cancellation_date: null,
    last_activity_at: '2026-09-01T10:00:00Z',
    last_activity_editor: 'vscode',
    plan_type: 'business',
    assignee: { login, id: 4242, avatar_url: 'https://example.invalid/a.png', html_url: 'https://example.invalid/u', type: 'User' },
    organization: { login: 'example-org' } as CopilotSeatAssignment['organization'],
    ...over,
  };
}

const snap = (day: string, seats: CopilotSeatAssignment[]) => toSeatSnapshot(day, seats);

describe('diffSeatSnapshots (P4-3)', () => {
  it('records a grant for a user that appears, with the plan', () => {
    const ev = diffSeatSnapshots(snap('2026-09-01', [seat('alice-fake')]), snap('2026-09-02', [seat('alice-fake'), seat('bob-fake', { plan_type: 'enterprise' })]));
    assert.equal(ev.length, 1);
    assert.deepEqual(
      { type: ev[0].type, user: ev[0].user, day: ev[0].day, from: ev[0].from, to: ev[0].to, prev: ev[0].previous_snapshot_day, org: ev[0].organization },
      { type: 'granted', user: 'bob-fake', day: '2026-09-02', from: null, to: 'enterprise', prev: '2026-09-01', org: 'example-org' }
    );
  });

  it('records a revocation for a user that disappears', () => {
    const ev = diffSeatSnapshots(snap('2026-09-01', [seat('alice-fake'), seat('bob-fake')]), snap('2026-09-02', [seat('alice-fake')]));
    assert.deepEqual(ev.map((e) => [e.type, e.user, e.from, e.to]), [['revoked', 'bob-fake', 'business', null]]);
  });

  it('records a plan change', () => {
    const ev = diffSeatSnapshots(snap('2026-09-01', [seat('alice-fake')]), snap('2026-09-02', [seat('alice-fake', { plan_type: 'enterprise' })]));
    assert.deepEqual(ev.map((e) => [e.type, e.from, e.to]), [['plan_changed', 'business', 'enterprise']]);
  });

  it('records a last-activity change by date, not by time of day, and treats unknown plans as unknown', () => {
    const same = diffSeatSnapshots(snap('2026-09-01', [seat('a-fake')]), snap('2026-09-02', [seat('a-fake', { last_activity_at: '2026-09-01T23:59:00Z' })]));
    assert.deepEqual(same, []);
    const changed = diffSeatSnapshots(snap('2026-09-01', [seat('a-fake', { last_activity_at: null })]), snap('2026-09-02', [seat('a-fake', { last_activity_at: '2026-09-02T01:00:00Z' })]));
    assert.deepEqual(changed.map((e) => [e.type, e.from, e.to]), [['last_activity_changed', null, '2026-09-02']]);
    const unknown = toSeatSnapshot('2026-09-01', [seat('a-fake', { plan_type: 'something-new' as never })]);
    assert.equal(unknown.seats[0].plan_type, 'unknown');
  });

  it('produces no events for identical snapshots and deduplicates repeated logins', () => {
    const s = [seat('a-fake'), seat('a-fake'), seat('b-fake')];
    assert.equal(snap('2026-09-01', s).seats.length, 2);
    assert.deepEqual(diffSeatSnapshots(snap('2026-09-01', s), snap('2026-09-02', s)), []);
  });

  it('generates stable event ids and merges idempotently', () => {
    const a = snap('2026-09-01', [seat('a-fake')]);
    const b = snap('2026-09-02', [seat('a-fake'), seat('b-fake')]);
    const first = diffSeatSnapshots(a, b);
    const again = diffSeatSnapshots(a, b);
    assert.deepEqual(first.map((e) => e.event_id), again.map((e) => e.event_id));
    assert.match(first[0].event_id, /^[0-9a-f]{16}$/);
    assert.equal(mergeSeatAuditEvents(first, again).length, first.length);
  });

  it('never carries names, numeric ids or avatar urls into events', () => {
    const ev = diffSeatSnapshots(snap('2026-09-01', []), snap('2026-09-02', [seat('a-fake')]));
    const json = JSON.stringify(ev);
    assert.ok(!json.includes('4242') && !json.includes('example.invalid') && !json.includes('avatar'));
    assert.deepEqual(Object.keys(ev[0]).sort(), ['day', 'event_id', 'from', 'organization', 'previous_snapshot_day', 'to', 'type', 'user']);
  });
});

describe('seat audit CSV (P4-3)', () => {
  const ev = diffSeatSnapshots(snap('2026-09-01', [seat('a-fake')]), snap('2026-09-02', [seat('b-fake')]));

  it('writes a BOM, a fixed header, CRLF line endings and one row per event', () => {
    const csv = seatAuditEventsToCsv(ev);
    assert.ok(csv.startsWith(`${CSV_BOM}${SEAT_AUDIT_CSV_COLUMNS.join(',')}\r\n`));
    assert.ok(csv.endsWith('\r\n'));
    assert.equal(csv.split('\r\n').length, ev.length + 2);
    assert.ok(!/(?<!\r)\n/.test(csv));
    assert.equal(Buffer.from(csv, 'utf-8').subarray(0, 3).toString('hex'), 'efbbbf');
  });

  it('quotes commas, quotes and line breaks (RFC 4180)', () => {
    assert.equal(escapeCsvCell('a,b'), '"a,b"');
    assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
    assert.equal(escapeCsvCell('line1\nline2'), '"line1\nline2"');
    assert.equal(escapeCsvCell(null), '');
    assert.equal(escapeCsvCell('plain'), 'plain');
  });

  it('neutralizes CSV injection (formula prefixes) in every cell', () => {
    for (const bad of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tTAB', '\rCR']) {
      const cell = escapeCsvCell(bad);
      assert.ok(cell.replace(/^"/, '').startsWith("'"), `${JSON.stringify(bad)} -> ${cell}`);
    }
    const hostile = [{ ...ev[0], user: '=HYPERLINK("http://example.invalid","x")', organization: '@org' }];
    const csv = seatAuditEventsToCsv(hostile);
    assert.ok(csv.includes(`"'=HYPERLINK(""http://example.invalid"",""x"")"`));
    assert.ok(csv.includes(",'@org,"));
    // 日付などの通常の値は変えない
    assert.ok(escapeCsvCell('2026-09-02') === '2026-09-02');
  });

  it('filters by range and type and rejects unknown types', () => {
    const all = diffSeatSnapshots(snap('2026-09-01', [seat('a-fake')]), snap('2026-09-02', [seat('b-fake')]));
    assert.deepEqual(filterSeatAuditEvents(all, { types: ['granted'] }).map((e) => e.type), ['granted']);
    assert.equal(filterSeatAuditEvents(all, { from: '2026-09-03' }).length, 0);
    assert.deepEqual(parseSeatAuditTypes('granted, revoked'), ['granted', 'revoked']);
    assert.throws(() => parseSeatAuditTypes('granted,nope'), /Unknown event type/);
  });
});

describe('SeatAuditService (P4-3)', () => {
  let tmp: string;
  let storage: ForkSafeStorageWriter;
  const writeRaw = (day: string, seats: CopilotSeatAssignment[]) => {
    const dir = path.join(tmp, 'raw', day.slice(0, 4), day.slice(5, 7));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${day}-raw.json`), JSON.stringify({ date: day, metrics: {}, seats, cost_centers: [] }));
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seat-audit-'));
    storage = new ForkSafeStorageWriter({ baseDir: tmp, publicDir: path.join(tmp, 'public-should-stay-empty') });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('treats the first snapshot as the baseline and records later differences by month of detection', () => {
    writeRaw('2026-08-31', [seat('a-fake')]);
    writeRaw('2026-09-01', [seat('a-fake'), seat('b-fake')]);
    writeRaw('2026-09-02', [seat('b-fake', { plan_type: 'enterprise' })]);
    const r = new SeatAuditService(storage).update();
    assert.equal(r.pairs, 2);
    assert.equal(r.added, 3);
    assert.deepEqual(storage.loadSeatAuditMonth('2026-08')?.events, []);
    assert.deepEqual(storage.loadSeatAuditMonth('2026-09')?.events.map((e) => [e.day, e.type, e.user]), [
      ['2026-09-01', 'granted', 'b-fake'],
      ['2026-09-02', 'revoked', 'a-fake'],
      ['2026-09-02', 'plan_changed', 'b-fake'],
    ]);
    assert.equal(storage.loadSeatAuditMonth('2026-09')?.through, '2026-09-02');
  });

  it('is incremental and idempotent, and rebuild does not duplicate events', () => {
    writeRaw('2026-09-01', [seat('a-fake')]);
    writeRaw('2026-09-02', [seat('a-fake'), seat('b-fake')]);
    const svc = new SeatAuditService(storage);
    assert.equal(svc.update().added, 1);
    assert.equal(svc.update().pairs, 0);
    writeRaw('2026-09-03', [seat('b-fake')]);
    const next = svc.update();
    assert.equal(next.pairs, 1);
    assert.equal(next.added, 1);
    assert.equal(svc.update({ rebuild: true }).added, 0);
    assert.equal(storage.loadSeatAuditMonth('2026-09')?.events.length, 2);
  });

  it('writes events outside processed/ and never into the public directory', () => {
    writeRaw('2026-09-01', [seat('a-fake')]);
    writeRaw('2026-09-02', []);
    new SeatAuditService(storage).update();
    assert.ok(fs.existsSync(path.join(tmp, 'audit', 'seat-events', '2026-09.json')));
    assert.ok(!fs.existsSync(path.join(tmp, 'processed', 'audit')));
    assert.ok(!fs.existsSync(path.join(tmp, 'public-should-stay-empty')));
  });

  it('keeps pseudonyms only for pseudonymized raw partitions and flags real logins otherwise', () => {
    const pseudo = new Pseudonymizer('test-secret-0000000000000000');
    const redact = (s: CopilotSeatAssignment) => pseudo.redactSeat(s);
    writeRaw('2026-09-01', [redact(seat('alice-fake'))]);
    writeRaw('2026-09-02', [redact(seat('alice-fake')), redact(seat('bob-fake'))]);
    const svc = new SeatAuditService(storage);
    svc.update();
    const doc = storage.loadSeatAuditMonth('2026-09')!;
    assert.equal(doc.pseudonymized, true);
    const json = JSON.stringify(doc);
    assert.ok(!json.includes('alice-fake') && !json.includes('bob-fake'));
    assert.match(doc.events[0].user, /^dev_[0-9a-f]{16}$/);

    writeRaw('2026-09-03', [seat('carol-fake')]);
    svc.update();
    assert.equal(storage.loadSeatAuditMonth('2026-09')?.pseudonymized, false);
    assert.equal(svc.collect('2026-09-01', '2026-09-30').pseudonymized, false);
  });

  it('skips unreadable partitions and reports the gap in previous_snapshot_day', () => {
    writeRaw('2026-09-01', [seat('a-fake')]);
    fs.mkdirSync(path.join(tmp, 'raw', '2026', '09'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'raw', '2026', '09', '2026-09-02-raw.json'), '{broken');
    writeRaw('2026-09-04', [seat('a-fake'), seat('b-fake')]);
    new SeatAuditService(storage).update();
    const ev = storage.loadSeatAuditMonth('2026-09')!.events;
    assert.equal(ev.length, 1);
    assert.equal(ev[0].previous_snapshot_day, '2026-09-01');
    assert.equal(ev[0].day, '2026-09-04');
  });

  it('does nothing when the storage does not support seat audit', () => {
    const svc = new SeatAuditService({} as never);
    assert.equal(svc.isSupported(), false);
    assert.deepEqual(svc.update(), { added: 0, pairs: 0, months: [] });
  });
});
