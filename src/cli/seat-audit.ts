import * as fs from 'node:fs';
import * as path from 'node:path';
import { ForkSafeStorageWriter } from '../adapters/storage/ForkSafeStorageWriter.js';
import { SeatAuditService } from '../application/pipeline/seat-audit.js';
import { filterSeatAuditEvents, parseSeatAuditTypes, seatAuditEventsToCsv } from '../processor/seat-audit-csv.js';

/**
 * シート監査イベント (P4-3 / E-02)。
 *   npm run seat-audit:update [-- --rebuild]   Raw のシートスナップショットの差分からイベントを更新する
 *   npm run seat-audit:export -- [--month YYYY-MM | --from YYYY-MM-DD --to YYYY-MM-DD] [--types granted,revoked]
 *                                [--out <file>]  イベントを CSV (UTF-8 BOM / CRLF) に出力する
 * CSV は利用者単位の個人データ。社内の閲覧権限者だけに渡し、Pages や Issue・PR には載せない (SDD-17 §4)。
 */

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

function main(): number {
  const [command, ...args] = process.argv.slice(2);
  const storage = new ForkSafeStorageWriter({ isDemo: args.includes('--demo') });
  const svc = new SeatAuditService(storage);

  if (command === 'update') {
    const r = svc.update({ rebuild: args.includes('--rebuild') });
    console.log(`✅ Seat audit: ${r.added} new event(s) from ${r.pairs} snapshot pair(s)${r.months.length ? ` (${r.months.join(', ')})` : ''}.`);
    return 0;
  }

  if (command === 'export') {
    const month = option(args, '--month');
    let from = option(args, '--from');
    let to = option(args, '--to');
    if (month) {
      if (!MONTH.test(month)) return usage(`--month must be YYYY-MM: ${month}`);
      from = `${month}-01`;
      to = `${month}-31`;
    }
    if (!from || !to || !DAY.test(from) || !DAY.test(to) || from > to) {
      return usage('Specify --month YYYY-MM or --from YYYY-MM-DD --to YYYY-MM-DD (from <= to).');
    }
    let types;
    try {
      const raw = option(args, '--types');
      types = raw ? parseSeatAuditTypes(raw) : undefined;
    } catch (e) {
      return usage((e as Error).message);
    }
    const { events, pseudonymized } = svc.collect(from, to);
    const rows = filterSeatAuditEvents(events, { from, to, types });
    const out = option(args, '--out') ?? path.join(storage.getBaseDir(), 'audit', 'exports', `seat-events-${from}_${to}.csv`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, seatAuditEventsToCsv(rows), 'utf-8');
    console.log(`✅ ${rows.length} event(s) written to ${out}`);
    console.warn(
      pseudonymized
        ? 'ℹ️ The events contain pseudonyms only (ANONYMIZE_USERS). Pseudonyms are still personal data: share with authorized reviewers only.'
        : '⚠️ The events contain real GitHub logins. Share only with authorized internal reviewers; never publish (Pages, Issues, PRs, public repositories).'
    );
    return 0;
  }

  return usage('Usage: tsx src/cli/seat-audit.ts <update|export> [options]');
}

function usage(message: string): number {
  console.error(`❌ ${message}`);
  return 2;
}

process.exit(main());
