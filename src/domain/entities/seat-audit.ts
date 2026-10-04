/**
 * シート監査イベント (P4-3 / E-02)。
 * 日次のシートスナップショット (Raw パーティションの seats) の差分から生成する、付与・剥奪・プラン変更・
 * 最終利用日の変化の記録。利用者単位の個人データなので GitHub Pages へは配信しない (SDD-17 §4)。
 */

export const SEAT_AUDIT_SCHEMA_VERSION = 1;

export const SEAT_AUDIT_EVENT_TYPES = ['granted', 'revoked', 'plan_changed', 'last_activity_changed'] as const;
export type SeatAuditEventType = (typeof SEAT_AUDIT_EVENT_TYPES)[number];

/** 差分の比較に使うシートの状態。氏名・メール・数値 ID・アバター URL・部署は含めない */
export interface SeatState {
  /** ログイン名。仮名化モードの Raw では HMAC 仮名 (`dev_<16 hex>`) */
  user: string;
  plan_type: string;
  organization: string | null;
  /** 最終利用日 (YYYY-MM-DD)。不明は null */
  last_activity_day: string | null;
}

export interface SeatSnapshot {
  /** スナップショットの日 (YYYY-MM-DD) */
  day: string;
  seats: SeatState[];
  /** 識別子がすべて仮名か (ID 0・アバターなし・`dev_` 仮名のみ)。シートが無ければ true */
  pseudonymized: boolean;
}

export interface SeatAuditEvent {
  /** 内容の SHA-256 先頭 16 hex。同じ差分から再生成しても同じ ID (冪等マージのキー) */
  event_id: string;
  /** 検出した日 (= 新しい側のスナップショットの日) */
  day: string;
  type: SeatAuditEventType;
  user: string;
  organization: string | null;
  /** 比較元スナップショットの日。連続していない場合は検出日との間に欠落がある */
  previous_snapshot_day: string;
  /** 変更前 (granted は null。プラン / 最終利用日) */
  from: string | null;
  /** 変更後 (revoked は null) */
  to: string | null;
}

export interface SeatAuditMonthDocument {
  schema_version: number;
  /** イベントの検出日の月 (YYYY-MM) */
  month: string;
  /** すべてのイベントが仮名のみか。1 件でも実ログインが混ざれば false */
  pseudonymized: boolean;
  /** この月で処理済みの最後のスナップショットの日 (次回はこれより後の対だけ処理する) */
  through: string;
  /** day, type, user の昇順 */
  events: SeatAuditEvent[];
}
