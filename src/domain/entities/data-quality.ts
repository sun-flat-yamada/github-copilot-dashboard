import type { DataSourceId, SourceFetchStatus } from './copilot.js';

/**
 * データ品質レポート (P1-7, D-05 / E-01)。
 *
 * 実行ごとに「欠損日・重複・範囲外・隔離件数・ソース別ステータス」を残し、履歴にする。
 * 件数・日付・ソース名だけを持つ (個人情報・ログイン名・値は含めない)。公開配信してよい。
 */
export const DATA_QUALITY_SCHEMA_VERSION = 1;

/** 履歴に残す最大件数 (1 日 1 回の実行で約 3 か月) */
export const DATA_QUALITY_HISTORY_LIMIT = 90;

export type DataQualityLevel = 'ok' | 'warning' | 'error';

/** データソースが収集時に観測した品質の事実 (ICopilotDataSource.getQualityObservations) */
export interface QualityObservations {
  /** 要求したレポート日 (昇順) */
  requested_days: string[];
  /** 1 件以上の行を取得できた日 (昇順) */
  available_days: string[];
  /** Enterprise と Org の両方に現れた同一ユーザーの行を 1 件に集約した数 (障害ではなく情報) */
  duplicates_collapsed: number;
  /** 要求した日と異なる日付の行 (範囲外。集計から除外) */
  out_of_range: number;
  /** 検証に失敗して隔離した行 (範囲外を除く) */
  quarantined: number;
  /** NDJSON として壊れていた行 */
  malformed_lines: number;
}

export interface DataQualitySourceEntry {
  source: DataSourceId;
  status: SourceFetchStatus;
  records: number;
  quarantined: number;
}

export interface DataQualityReport {
  schema_version: typeof DATA_QUALITY_SCHEMA_VERSION;
  generated_at: string;
  /** Raw Landing の Run Manifest の ID (無い運用では省略) */
  run_id?: string;
  /** 要求したレポート日の範囲 */
  window: { start: string; end: string } | null;
  /** 範囲内で 1 件も取得できなかった日 */
  missing_days: string[];
  duplicates_collapsed: number;
  out_of_range: number;
  quarantined: number;
  malformed_lines: number;
  sources: DataQualitySourceEntry[];
  level: DataQualityLevel;
}

export interface DataQualityHistory {
  schema_version: typeof DATA_QUALITY_SCHEMA_VERSION;
  /** 古い順。同じ run_id の再処理は置き換える */
  entries: DataQualityReport[];
}

export type DataQualityTrend = 'first' | 'unchanged' | 'degraded' | 'recovered';

/** index.json に載せる、最新の品質と直前との比較 */
export interface DataQualitySummary {
  level: DataQualityLevel;
  generated_at: string;
  missing_days_count: number;
  out_of_range: number;
  quarantined: number;
  malformed_lines: number;
  trend: DataQualityTrend;
  /** 直前の実行の品質 (初回は null) */
  previous_level: DataQualityLevel | null;
  /** 直近で level が変わった時刻 (悪化・回復の起点。変化が無ければ null) */
  last_change_at: string | null;
  /** 配信ルートからの履歴ファイルの相対パス */
  history_file: string;
}
