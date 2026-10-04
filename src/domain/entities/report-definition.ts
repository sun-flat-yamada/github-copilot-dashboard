/**
 * 定義駆動レポート (P4-5 / E-04)。`reports/{id}.yaml` に宣言したレポートを Report Engine が生成する。
 * 契約は親計画の付録 A.7.3 (`ReportDefinition`)。指標は指標カタログ (METRIC_REGISTRY) の ID だけを参照する。
 * 定義にも生成物にも、利用者単位の行・ログイン・氏名・部署名は載せない (aggregate-only)。
 */
import type { MetricId } from '../metrics/metric-registry.js';
import type { PrivacyTier } from '../privacy-profile.js';

export const REPORT_DEFINITION_SCHEMA_VERSION = 1;

/** 入力データセット。monthly = processed/monthly/{month}.json、reports = processed/reports/{month}.json (CSV 取り込みの月次レポート) */
export const REPORT_DATASETS = ['monthly', 'reports'] as const;
export type ReportDataset = (typeof REPORT_DATASETS)[number];

/** monthly-close = 月次締め済みの月ごと、weekly = ISO 週ごと。省略時は手動生成のみ */
export const REPORT_SCHEDULES = ['monthly-close', 'weekly'] as const;
export type ReportSchedule = (typeof REPORT_SCHEDULES)[number];

export const REPORT_OUTPUTS = ['markdown', 'csv'] as const;
export type ReportOutput = (typeof REPORT_OUTPUTS)[number];

/** プライバシー階層 (P4-6、SDD-17 §7)。既定は aggregate-only。identified は生成ゲートを満たす場合だけ生成する */
export type ReportPrivacyTier = PrivacyTier;

export type ReportLanguage = 'ja' | 'en';

export const FILTER_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq'] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export interface ReportFilter {
  column: string;
  op: FilterOperator;
  value: number;
}

export interface KpiSection {
  type: 'kpi';
  id: string;
  title: string;
  metrics: MetricId[];
}

export interface BreakdownSection {
  type: 'breakdown';
  id: string;
  title: string;
  group_by: string;
  columns: string[];
  sort_by?: string;
  order?: 'asc' | 'desc';
  /** 出力する行数の上限 (既定 20、最大 200) */
  limit?: number;
  filters?: ReportFilter[];
}

export type ReportSection = KpiSection | BreakdownSection;

export interface ReportDefinition {
  id: string;
  title: string;
  description?: string;
  schedule?: ReportSchedule;
  dataset: ReportDataset;
  privacy_tier: ReportPrivacyTier;
  language: ReportLanguage;
  outputs: ReportOutput[];
  sections: ReportSection[];
}

export const DEFAULT_BREAKDOWN_LIMIT = 20;
export const MAX_BREAKDOWN_LIMIT = 200;

/** 生成物の一覧 (audit/report-outputs/index.json)。生成時刻と入力・定義の版だけを持つ */
export interface ReportOutputEntry {
  report_id: string;
  /** YYYY-MM (monthly-close / 手動) または YYYY-Www (weekly) */
  period: string;
  /** 入力に使った月次集計の月 */
  data_month: string;
  generated_at: string;
  /** 定義ファイル内容の SHA-256 (hex)。定義の版として記録する */
  definition_sha256: string;
  outputs: ReportOutput[];
  /** 入力が demo (架空データ) のとき true */
  demo: boolean;
  /** 生成時に宣言されていたプライバシー階層 (P4-6)。古い出力には無い (aggregate-only 扱い) */
  privacy_tier?: ReportPrivacyTier;
}

export interface ReportOutputIndex {
  schema_version: number;
  outputs: ReportOutputEntry[];
}
