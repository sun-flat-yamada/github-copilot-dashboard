import type { CopilotSeatAssignment } from '../domain/entities/copilot.js';
import {
  SEAT_AUDIT_EVENT_TYPES,
  type SeatAuditEvent,
  type SeatAuditEventType,
  type SeatSnapshot,
  type SeatState,
} from '../domain/entities/seat-audit.js';

/**
 * シート監査イベントの生成 (P4-3 / E-02)。純関数のみ (I/O なし)。
 * 日次スナップショットの差分:
 *   granted               前日に無く、当日に在るユーザー
 *   revoked               前日に在り、当日に無いユーザー
 *   plan_changed          プラン (business / enterprise / unknown) が変わった
 *   last_activity_changed 最終利用日 (日付部分) が変わった
 */

const PSEUDONYM_LOGIN = /^dev_[0-9a-f]{16}$/;

function canonicalPlan(plan: unknown): string {
  return plan === 'business' || plan === 'enterprise' ? plan : 'unknown';
}

function dayOf(value: string | null | undefined): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

/** Raw パーティションの seats からスナップショットを作る。ID・アバター・氏名などは取り込まない */
export function toSeatSnapshot(day: string, rawSeats: CopilotSeatAssignment[]): SeatSnapshot {
  const byUser = new Map<string, SeatState>();
  let pseudonymized = true;
  for (const seat of rawSeats) {
    const login = seat?.assignee?.login;
    if (typeof login !== 'string' || login.trim() === '') continue;
    const assignee = seat.assignee;
    if (!(PSEUDONYM_LOGIN.test(login) && assignee.id === 0 && !assignee.avatar_url)) pseudonymized = false;
    // 同じログインが重複して返った場合は後勝ち (差分が日ごとに揺れないよう 1 ユーザー 1 行にする)
    byUser.set(login, {
      user: login,
      plan_type: canonicalPlan(seat.plan_type),
      organization: seat.organization?.login ?? null,
      last_activity_day: dayOf(seat.last_activity_at),
    });
  }
  const seats = [...byUser.values()].sort((a, b) => (a.user < b.user ? -1 : a.user > b.user ? 1 : 0));
  return { day, seats, pseudonymized };
}

/** event_id: 同じ差分から常に同じ ID。比較元の日は含めない (欠落日の有無で ID が変わらないように) */
export function seatAuditEventId(day: string, type: SeatAuditEventType, user: string, from: string | null, to: string | null): string {
  const hash = loadHash();
  return hash(`${day}\u0000${type}\u0000${user}\u0000${from ?? ''}\u0000${to ?? ''}`).slice(0, 16);
}

type Sha256Hex = (input: string) => string;
let cachedHash: Sha256Hex | undefined;

/** node:crypto は同期的に取得する (仮名化モジュールと同じ方針。ブラウザのバンドルには入れない) */
function loadHash(): Sha256Hex {
  if (cachedHash) return cachedHash;
  const crypto = typeof process !== 'undefined' && typeof process.getBuiltinModule === 'function' ? process.getBuiltinModule('node:crypto') : undefined;
  if (!crypto) throw new Error('Seat audit event ids require a Node.js runtime (node:crypto is not available here).');
  cachedHash = (input) => crypto.createHash('sha256').update(input).digest('hex');
  return cachedHash;
}

function compareEvents(a: SeatAuditEvent, b: SeatAuditEvent): number {
  return (
    (a.day < b.day ? -1 : a.day > b.day ? 1 : 0) ||
    SEAT_AUDIT_EVENT_TYPES.indexOf(a.type) - SEAT_AUDIT_EVENT_TYPES.indexOf(b.type) ||
    (a.user < b.user ? -1 : a.user > b.user ? 1 : 0) ||
    (a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0)
  );
}

/** 2 つの日次スナップショットの差分からイベントを生成する (prev は時間的に前) */
export function diffSeatSnapshots(prev: SeatSnapshot, curr: SeatSnapshot): SeatAuditEvent[] {
  const events: SeatAuditEvent[] = [];
  const push = (type: SeatAuditEventType, seat: SeatState, from: string | null, to: string | null) => {
    events.push({
      event_id: seatAuditEventId(curr.day, type, seat.user, from, to),
      day: curr.day,
      type,
      user: seat.user,
      organization: seat.organization,
      previous_snapshot_day: prev.day,
      from,
      to,
    });
  };

  const before = new Map(prev.seats.map((s) => [s.user, s]));
  const after = new Map(curr.seats.map((s) => [s.user, s]));

  for (const seat of curr.seats) {
    const old = before.get(seat.user);
    if (!old) {
      push('granted', seat, null, seat.plan_type);
      continue;
    }
    if (old.plan_type !== seat.plan_type) push('plan_changed', seat, old.plan_type, seat.plan_type);
    if (old.last_activity_day !== seat.last_activity_day) {
      push('last_activity_changed', seat, old.last_activity_day, seat.last_activity_day);
    }
  }
  for (const seat of prev.seats) {
    if (!after.has(seat.user)) push('revoked', seat, seat.plan_type, null);
  }
  return events.sort(compareEvents);
}

/** event_id で冪等にマージする (既存を優先)。day, type, user の昇順 */
export function mergeSeatAuditEvents(existing: SeatAuditEvent[], incoming: SeatAuditEvent[]): SeatAuditEvent[] {
  const byId = new Map<string, SeatAuditEvent>();
  for (const e of existing) byId.set(e.event_id, e);
  for (const e of incoming) if (!byId.has(e.event_id)) byId.set(e.event_id, e);
  return [...byId.values()].sort(compareEvents);
}
