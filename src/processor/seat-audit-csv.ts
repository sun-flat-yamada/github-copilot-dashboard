import { SEAT_AUDIT_EVENT_TYPES, type SeatAuditEvent, type SeatAuditEventType } from '../domain/entities/seat-audit.js';

/**
 * シート監査イベントの CSV 出力 (P4-3 / E-02)。
 * - 文字コード UTF-8 (BOM 付き。Excel が文字化けしない)、改行 CRLF、RFC 4180 のクォート
 * - 列は固定 (順序を変えない。追加は末尾)
 * - CSV インジェクション対策: `=` `+` `-` `@` タブ CR で始まるセルは先頭に `'` を付けて数式として解釈させない
 */

export const SEAT_AUDIT_CSV_COLUMNS = [
  'event_id',
  'day',
  'type',
  'user',
  'organization',
  'previous_snapshot_day',
  'from',
  'to',
] as const;

export const CSV_BOM = '﻿';
const FORMULA_START = /^[=+\-@\t\r]/;

/** 1 セル分のエスケープ。null / undefined は空セル */
export function escapeCsvCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface SeatAuditCsvFilter {
  /** 検出日の下限 / 上限 (YYYY-MM-DD, 両端を含む) */
  from?: string;
  to?: string;
  types?: SeatAuditEventType[];
}

export function filterSeatAuditEvents(events: SeatAuditEvent[], filter: SeatAuditCsvFilter = {}): SeatAuditEvent[] {
  return events.filter(
    (e) =>
      (!filter.from || e.day >= filter.from) &&
      (!filter.to || e.day <= filter.to) &&
      (!filter.types || filter.types.length === 0 || filter.types.includes(e.type))
  );
}

export function parseSeatAuditTypes(value: string): SeatAuditEventType[] {
  const types = value.split(',').map((t) => t.trim()).filter(Boolean);
  const unknown = types.filter((t) => !(SEAT_AUDIT_EVENT_TYPES as readonly string[]).includes(t));
  if (unknown.length > 0) {
    throw new Error(`Unknown event type(s): ${unknown.join(', ')}. Allowed: ${SEAT_AUDIT_EVENT_TYPES.join(', ')}`);
  }
  return types as SeatAuditEventType[];
}

/** イベントを CSV にする (BOM + ヘッダー + 行、各行 CRLF 終端) */
export function seatAuditEventsToCsv(events: SeatAuditEvent[]): string {
  const lines = [SEAT_AUDIT_CSV_COLUMNS.join(',')];
  for (const e of events) {
    lines.push(SEAT_AUDIT_CSV_COLUMNS.map((c) => escapeCsvCell(e[c])).join(','));
  }
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}
