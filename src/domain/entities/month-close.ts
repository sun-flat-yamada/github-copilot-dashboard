/**
 * 月次締め・改訂履歴 (P4-2 / E-01)。
 *
 * 月次の数値 (figures) を締め日に確定 (凍結) し、チェックサムを付ける。締め後の変更は改訂として
 * 履歴に残し、元の確定値は消さない。数値・日付・チェックサムだけを持ち、個人情報は含めない (公開配信してよい)。
 */
export const MONTH_CLOSE_SCHEMA_VERSION = 1;

/** 既定: 翌月の第 5 営業日に締める (オーナー判断 2026-10-01) */
export const DEFAULT_CLOSE_BUSINESS_DAYS = 5;

/** 営業日カレンダーの設定 (COPILOT_BUSINESS_CALENDAR)。既定は土日除外・祝日なし */
export interface BusinessCalendarConfig {
  /** 翌月の第 N 営業日に締める */
  close_business_days: number;
  /** 休業とする曜日 (0=日 ... 6=土)。既定は [0, 6] */
  weekend_days: number[];
  /** 追加の休業日 (YYYY-MM-DD)。祝日は設定で追加する */
  holidays: string[];
}

export const DEFAULT_BUSINESS_CALENDAR: BusinessCalendarConfig = {
  close_business_days: DEFAULT_CLOSE_BUSINESS_DAYS,
  weekend_days: [0, 6],
  holidays: [],
};

/**
 * 確定の対象にする数値。キーは `monthly.overview.total_spend_usd` / `report.overview.total_net_spend_usd` の形。
 * 取得できていない指標は null (0 にしない)。利用者単位の値は含めない。
 */
export type CloseFigures = Record<string, number | null>;

/** 確定版・改訂版に共通の項目 */
export interface CloseVersion {
  /** 1 = 元の確定版、2 以降 = 改訂版 */
  version: number;
  /** 確定 / 改訂した時刻 (ISO) */
  at: string;
  /** 確定 / 改訂を行った実行の ID (Run Manifest の run_id。無ければ省略) */
  run_id?: string;
  figures: CloseFigures;
  /** SHA-256 (hex)。`{ month, figures }` の正準 JSON に対する値 */
  checksum: string;
}

export interface FigureDiff {
  key: string;
  /** 前の版に無い項目は null */
  before: number | null;
  /** この版に無い項目は null */
  after: number | null;
  /** after - before。どちらかが null のときは null */
  delta: number | null;
}

export interface CloseRevision extends CloseVersion {
  /** 改訂の理由 (必須) */
  reason: string;
  /** 運用者が明示した別名・役割。実名や GitHub ログインを自動では記録しない */
  actor?: string;
  /** 直前の版のチェックサム */
  previous_checksum: string;
  /** 直前の版との差分 (変わった項目だけ) */
  diff: FigureDiff[];
}

export interface MonthCloseRecord {
  schema_version: number;
  month: string; // YYYY-MM
  /** 締め日 (YYYY-MM-DD, UTC) */
  closes_on: string;
  calendar: BusinessCalendarConfig;
  /** 元の確定版。改訂しても書き換えない */
  closed: CloseVersion;
  /** 改訂版 (古い順)。空なら未改訂 */
  revisions: CloseRevision[];
}

/** processed/closes/index.json の 1 行 */
export interface MonthCloseIndexEntry {
  month: string;
  closes_on: string;
  closed_at: string;
  /** 現在有効な版のチェックサム */
  checksum: string;
  revision_count: number;
  last_revised_at: string | null;
}

export interface MonthCloseIndex {
  schema_version: number;
  /** 新しい月が先頭 */
  months: MonthCloseIndexEntry[];
}

export type MonthCloseProblemKind =
  /** 記録内のチェックサムが内容と合わない (記録の改ざん・破損) */
  | 'checksum_mismatch'
  /** 保存済みの成果物の数値が、現在有効な版と違う (改訂なしに数値が変わった) */
  | 'unrecorded_change';

export interface MonthCloseProblem {
  month: string;
  kind: MonthCloseProblemKind;
  message: string;
  diff: FigureDiff[];
}
