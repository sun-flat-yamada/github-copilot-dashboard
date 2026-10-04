/**
 * 保持期間ポリシー (P4-6 / E-05)。SDD-17 §8。
 * 期限を超えた Raw と監査・レポートの派生物を、計画 (ドライラン) → 明示実行 → 記録の順で削除する。
 */

export const DEFAULT_RETENTION_MONTHS = 60;
export const MIN_RETENTION_MONTHS = 12;
export const MAX_RETENTION_MONTHS = 600;

export const RETENTION_LOG_SCHEMA_VERSION = 1;
/** 記録に残す実行の最大数 (古いものから落とす) */
export const MAX_RETENTION_LOG_RUNS = 1000;

export const RETENTION_CATEGORIES = [
  'raw_daily',
  'raw_landing_manifests',
  'raw_landing_objects',
  'report_csv',
  'seat_events',
  'billing_reconciliation',
  'report_outputs',
] as const;
export type RetentionCategory = (typeof RETENTION_CATEGORIES)[number];

/** 削除候補 1 件。`key` は月・run_id・オブジェクトの相対パス・`{report_id}/{period}` のいずれか (個人情報を含まない) */
export interface RetentionItem {
  category: RetentionCategory;
  key: string;
  /** 期限判定に使った月 (YYYY-MM) */
  month: string;
}

export interface RetentionSkip {
  category: RetentionCategory;
  key: string;
  month: string;
  reason: 'not_closed' | 'unparsable';
}

export interface RetentionPlan {
  retention_months: number;
  /** 保持する最も古い月 (これより前の月が期限切れ) */
  keep_from: string;
  items: RetentionItem[];
  skipped: RetentionSkip[];
}

export interface RetentionCategorySummary {
  count: number;
  /** 削除した (または削除する) ものの月・ID の一覧 */
  keys: string[];
  bytes: number;
}

export type RetentionRunStatus = 'started' | 'completed' | 'failed';

export interface RetentionRunRecord {
  run_id: string;
  started_at: string;
  finished_at?: string;
  status: RetentionRunStatus;
  retention_months: number;
  keep_from: string;
  /** 運用者が選んだ別名・役割名 (CI ユーザーや GitHub ログインは自動で入れない) */
  actor?: string;
  categories: Partial<Record<RetentionCategory, RetentionCategorySummary>>;
  skipped: RetentionSkip[];
  errors: string[];
}

export interface RetentionLog {
  schema_version: number;
  runs: RetentionRunRecord[];
}
