import { SEAT_AUDIT_SCHEMA_VERSION, type SeatAuditEvent, type SeatAuditMonthDocument, type SeatSnapshot } from '../../domain/entities/seat-audit.js';
import type { IStorageWriter } from '../../domain/ports/IStorageWriter.js';
import { diffSeatSnapshots, mergeSeatAuditEvents, toSeatSnapshot } from '../../processor/seat-audit.js';

/**
 * シート監査イベントの更新 (P4-3 / E-02)。
 * Raw のシートパーティション (日次スナップショット) を日付順にたどり、連続する 2 日の差分をイベントとして
 * `audit/seat-events/{month}.json` (検出日の月) へ冪等に追記する。最初のスナップショットは基準でイベントなし。
 * 保存は IStorageWriter の任意メソッド経由。未対応の実装では何もしない。
 */

export interface SeatAuditUpdateResult {
  /** 追加したイベント数 (既存と重複するものは数えない) */
  added: number;
  /** 処理したスナップショット対の数 */
  pairs: number;
  /** 今回書き込んだ月 */
  months: string[];
}

export class SeatAuditService {
  constructor(private readonly storage: IStorageWriter) {}

  isSupported(): boolean {
    return !!(this.storage.listRawSeatDays && this.storage.loadRawSeats && this.storage.saveSeatAuditMonth && this.storage.loadSeatAuditMonth);
  }

  /** @param rebuild true なら処理済みの位置を無視して全対を再計算する (event_id による冪等マージなので重複しない) */
  update(options: { rebuild?: boolean } = {}): SeatAuditUpdateResult {
    const result: SeatAuditUpdateResult = { added: 0, pairs: 0, months: [] };
    if (!this.isSupported()) return result;
    const days = this.storage.listRawSeatDays!();
    if (days.length === 0) return result;

    const docs = new Map<string, SeatAuditMonthDocument>();
    const loadDoc = (month: string): SeatAuditMonthDocument | null => {
      if (!docs.has(month)) {
        const stored = this.storage.loadSeatAuditMonth!(month);
        if (stored) docs.set(month, stored);
      }
      return docs.get(month) ?? null;
    };
    const through = options.rebuild
      ? null
      : (this.storage.getSeatAuditMonths?.() ?? []).reduce<string | null>((max, m) => {
          const t = loadDoc(m)?.through ?? null;
          return t && (!max || t > max) ? t : max;
        }, null);

    const dirty = new Set<string>();
    const snapshots = new Map<string, SeatSnapshot | null>();
    const snapshotOf = (day: string): SeatSnapshot | null => {
      if (!snapshots.has(day)) {
        const seats = this.storage.loadRawSeats!(day);
        snapshots.set(day, seats ? toSeatSnapshot(day, seats) : null);
      }
      return snapshots.get(day) ?? null;
    };

    // 読めないパーティションは飛ばし、その前後を比較する (previous_snapshot_day に欠落が現れる)
    const usable = days.filter((d) => snapshotOf(d) !== null);
    for (let i = 0; i < usable.length; i++) {
      const day = usable[i];
      if (through && day <= through) continue;
      const curr = snapshotOf(day)!;
      const month = day.slice(0, 7);
      const doc = loadDoc(month) ?? { schema_version: SEAT_AUDIT_SCHEMA_VERSION, month, pseudonymized: true, through: day, events: [] };
      let incoming: SeatAuditEvent[] = [];
      let pseudonymized = curr.pseudonymized;
      if (i > 0) {
        const prev = snapshotOf(usable[i - 1])!;
        incoming = diffSeatSnapshots(prev, curr);
        pseudonymized = pseudonymized && prev.pseudonymized;
        result.pairs++;
      }
      const events = mergeSeatAuditEvents(doc.events, incoming);
      result.added += events.length - doc.events.length;
      docs.set(month, {
        ...doc,
        // 1 件でも実ログインを含む入力があれば false (安全側)
        pseudonymized: doc.pseudonymized && pseudonymized,
        through: doc.through > day ? doc.through : day,
        events,
      });
      dirty.add(month);
    }

    for (const month of [...dirty].sort()) {
      this.storage.saveSeatAuditMonth!(docs.get(month)!);
      result.months.push(month);
    }
    return result;
  }

  /** 検出日が [from, to] (両端を含む) のイベントと、含まれる文書がすべて仮名か */
  collect(from: string, to: string): { events: SeatAuditEvent[]; pseudonymized: boolean } {
    const events: SeatAuditEvent[] = [];
    let pseudonymized = true;
    const months = (this.storage.getSeatAuditMonths?.() ?? []).filter((m) => m >= from.slice(0, 7) && m <= to.slice(0, 7)).sort();
    for (const m of months) {
      const doc = this.storage.loadSeatAuditMonth?.(m);
      if (!doc) continue;
      pseudonymized = pseudonymized && doc.pseudonymized;
      events.push(...doc.events.filter((e) => e.day >= from && e.day <= to));
    }
    return { events, pseudonymized };
  }
}
