/**
 * Raw Landing の Run Manifest (P1-2)。
 *
 * 1 回の収集 (run) で行った HTTP 取得を、リクエスト単位で記録する台帳。
 * 応答本文は内容ハッシュ (sha256) で不変に保存し、manifest はそれらを指す。
 * `npm run pipeline:reprocess` は、この manifest を再生して収集と同じ入力から成果物を作り直す。
 */
export const RUN_MANIFEST_SCHEMA_VERSION = 1;

export type RawEntryKind = 'json' | 'paginated' | 'download';

export type RawEntryOutcome =
  /** 本文を取得し、object に保存した */
  | 'ok'
  /** 204 / 404 など、想定内で本文が無い (障害ではない) */
  | 'empty'
  /** 取得に失敗した (error に要約だけを残す。本文は保存しない) */
  | 'error';

export interface RawEntry {
  /** 正準化したリクエスト。例: `GET /enterprises/acme/copilot/metrics/reports/users-1-day?day=2026-09-30` */
  request: string;
  kind: RawEntryKind;
  outcome: RawEntryOutcome;
  status: number;
  fetched_at: string;
  /** `raw/landing/` からの相対パス (outcome が ok のときのみ) */
  object?: string;
  sha256?: string;
  bytes?: number;
  error?: { name: string; status?: number; message: string };
}

export interface RunManifest {
  schema_version: typeof RUN_MANIFEST_SCHEMA_VERSION;
  /** 時刻順に並ぶ識別子 (`20261003T041500Z-ab12`) */
  run_id: string;
  started_at: string;
  finished_at: string;
  /** 収集時の X-GitHub-Api-Version */
  api_version: string;
  /** 再処理が同じ入力を組み立てるのに必要な収集設定 (スラッグと日付のみ。個人情報を含まない) */
  config: {
    enterprise?: string;
    orgs: string[];
    /** 取得したレポート日 (昇順) */
    report_days: string[];
  };
  /** リクエスト文字列の昇順 */
  entries: RawEntry[];
}

/** index.json に残す、成果物がどの run から作られたかの印 */
export interface RunReference {
  run_id: string;
  /** 再処理で作った成果物のとき true */
  reprocessed?: boolean;
}
