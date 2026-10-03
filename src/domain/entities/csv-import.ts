/**
 * CSV 取込レポート (P1-5, A-12 / B-16)。
 *
 * CSV の列構成が変わっても黙って誤集計しないよう、取込結果 (認識した列・未認識の列・スキップした行・
 * 単位別の合計) を利用者に見せるための記録。値 (ユーザー名・金額の個別値) は含めず、件数・列名・合計のみ。
 */
export const CSV_IMPORT_REPORT_SCHEMA_VERSION = 1;

export type CsvFormatProfileId = 'billing-usage-report' | 'ai-usage-report' | 'activity-report';

export type CsvUnitFamily = 'requests' | 'credits' | 'seats' | 'tokens' | 'other';

export interface CsvColumnMatch {
  /** CSV 上の列名 (そのまま) */
  header: string;
  /** 対応付けた正準フィールド名 */
  field: string;
}

export interface CsvSkippedRowSample {
  /** データ行の番号 (ヘッダーと空行を数えない。1 始まり) */
  row: number;
  reason: string;
}

/** 単位ごとの合計。単位の異なる値は合算しない。値が 1 件も無いものは 0 ではなく null */
export interface CsvUnitTotal {
  unit: CsvUnitFamily;
  rows: number;
  quantity: number | null;
  gross_usd: number | null;
  net_usd: number | null;
}

export interface CsvImportReport {
  schema_version: typeof CSV_IMPORT_REPORT_SCHEMA_VERSION;
  file_name?: string;
  /** 自動判別したフォーマット。判別できず取込を止めたときは null */
  profile: { id: CsvFormatProfileId; label: string } | null;
  /** profile が null のとき、取込を止めた理由 */
  stop_reason?: string;
  columns: {
    recognized: CsvColumnMatch[];
    /** どのフィールドにも対応付けられなかった列 (集計には使っていない) */
    unrecognized: string[];
  };
  rows: {
    /** ヘッダーを除くデータ行 (空行を除く) */
    total: number;
    imported: number;
    skipped: number;
    skipped_by_reason: Record<string, number>;
    /** 先頭の数件 (行番号と理由のみ) */
    skipped_samples: CsvSkippedRowSample[];
    /** 日付が無い、または解釈できず、日別推移に載せられない行 (合計には含む) */
    undated: number;
    /** 列数がヘッダーと異なる行 (列ずれの疑い。取り込みは試みている) */
    ragged: number;
    /** 同じファイル内で内容が完全に同一の行 (正当な複数明細の可能性があるため残している) */
    repeated: number;
  };
  totals_by_unit: CsvUnitTotal[];
  warnings: string[];
}
