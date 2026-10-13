/**
 * AI Model Benchmark & Characteristics Types
 * 2026.10 Specification for AI Model Radar & Ingestion Evaluation
 */

export type BenchmarkMetricKey =
  | 'terminal_bench_4'
  | 'aa_intelligence_index'
  | 'arena_webdev_elo'
  | 'output_speed_tps'
  | 'input_cost_per_m'
  | 'output_cost_per_m'
  | 'context_window_k';

/** Benchmark metrics that come from external leaderboards (as opposed to speed, prices and context). */
export const BENCHMARK_SCORE_METRICS: readonly BenchmarkMetricKey[] = [
  'terminal_bench_4',
  'aa_intelligence_index',
  'arena_webdev_elo',
] as const;

export type RadarAxisKey =
  | 'coding_swe'
  | 'reasoning_logic'
  | 'arena_elo'
  | 'speed_latency'
  | 'cost_efficiency'
  | 'architecture_design';

export interface RadarAxisMeta {
  key: RadarAxisKey;
  label: string;
  shortLabel: string;
  description: string;
  primaryMetric: string;
  weight: number;
}

export interface BenchmarkRawMetrics {
  terminal_bench_4: number; // Terminal-Bench 4.0 resolution rate (%: 0 - 100)
  aa_intelligence_index: number; // Artificial Analysis Intelligence Index v4.3 (index points, e.g. 15 - 60)
  arena_webdev_elo: number; // Arena Code Arena | WebDev Elo (e.g. 1200 - 1850)
  output_speed_tps: number; // Output generation speed (tokens/sec)
  input_cost_per_m: number; // USD per 1M input tokens
  output_cost_per_m: number; // USD per 1M output tokens
  context_window_k: number; // Context Window (in K tokens, e.g. 128, 200, 1000, 2000)
  context_window_display?: string; // 人間可読表記 (例: "272K (Max 1M)", "1M", "128K")
  cached_input_cost_per_m?: number; // キャッシュ入力単価 (USD / 1M tokens)
  cache_write_cost_per_m?: number; // キャッシュ書き込み単価 (USD / 1M tokens)
  long_context_threshold_k?: number; // 長文コンテキストしきい値 (例: 200, 272)
  long_context_input_cost_per_m?: number; // 長文コンテキスト入力単価 (USD / 1M tokens)
  long_context_output_cost_per_m?: number; // 長文コンテキスト出力単価 (USD / 1M tokens)
}

export interface RadarScores {
  coding_swe: number; // 0 - 100
  reasoning_logic: number; // 0 - 100
  arena_elo: number; // 0 - 100
  speed_latency: number; // 0 - 100
  cost_efficiency: number; // 0 - 100
  architecture_design: number; // 0 - 100
}

export type ModelSuitabilityTag =
  | 'Complex Refactoring'
  | 'Algorithm Specialist'
  | 'Fast Inline Suggestion'
  | 'Cost Saver'
  | 'Ultra-Long Context'
  | 'Agent & Multi-Turn'
  | 'High-Precision Coding';

export interface BuzzSource {
  title: string;
  url: string;
}

export interface EngineerBuzz {
  headline: string; // キャッチコピー / 現場での通り名
  community_sentiments: string[]; // 現場エンジニアからのポジティブな実感・評価
  caution_rumor: string; // 現場で囁かれる注意点・ボヤキ
  source_note: string; // "※ SNS上のエンジニアの声・コミュニティの噂・所感"
  sources?: BuzzSource[]; // 引用元・参考記事・コミュニティ等のURL一覧
}

export interface ModelEvaluation {
  overall_score: number; // 0 - 100
  grade: 'S+' | 'S' | 'A+' | 'A' | 'B+';
  suitability_tags: ModelSuitabilityTag[];
  recommended_for: string[];
  strengths: string[];
  weaknesses: string[];
  summary_verdict: string;
  copilot_usage_guidance: string;
  buzz?: EngineerBuzz;
}

export type ModelVendor =
  | 'Anthropic'
  | 'OpenAI'
  | 'Google'
  | 'Microsoft'
  | 'Microsoft (External)'
  | 'DeepSeek'
  | 'xAI'
  | 'Moonshot AI'
  | 'Other';

export const CANONICAL_VENDOR_ORDER: readonly ModelVendor[] = [
  'Anthropic',
  'OpenAI',
  'Google',
  'Microsoft',
  'Microsoft (External)',
  'DeepSeek',
  'xAI',
  'Moonshot AI',
  'Other',
] as const;

export type ModelReleaseStatus = 'GA' | 'Preview' | 'LTS' | 'Utility' | 'Retired';

export interface ModelExtendedCapabilities {
  tier?: 'powerful' | 'versatile' | 'lightweight' | 'Powerful' | 'Versatile' | 'Lightweight';
  release_status?: 'ga' | 'lts' | 'preview' | 'retired' | 'GA' | 'LTS' | 'Preview' | 'Retired' | ModelReleaseStatus;
  max_context_window?: number;
  has_1m_context?: boolean;
  supports_1m_context?: boolean;
  has_configurable_reasoning?: boolean;
  supports_cache?: boolean;
  supports_long_context?: boolean;
}

export interface ModelBenchmarkProfile {
  id: string; // e.g. 'claude-sonnet-5', 'gpt-5-6-sol', 'gpt-4o'
  name: string; // 'Claude Sonnet 5', 'GPT-5.6 Sol'
  vendor: ModelVendor;
  model_family: string; // 'Claude 5', 'GPT-5.6', 'Gemini 3.x'
  color: string; // Hex color code for radar & charts
  is_copilot_native: boolean; // GitHub Copilot公式対応モデルかどうか
  release_date: string;
  release_status?: ModelReleaseStatus;
  is_estimated?: boolean; // true: benchmark score metrics (BENCHMARK_SCORE_METRICS) are all estimates (要検証)
  /** Raw metrics whose value has no verified source and is an estimate (shown as 推測値 per value). */
  estimated_metrics?: BenchmarkMetricKey[];
  capabilities?: ModelExtendedCapabilities;
  extended_capabilities?: ModelExtendedCapabilities;
  raw_metrics: BenchmarkRawMetrics;
  radar_scores: RadarScores;
  evaluation: ModelEvaluation;
}

export interface BenchmarkSourceMeta {
  id: string;
  name: string;
  description: string;
  target_problem?: string;
  performance_view?: string;
  community_rumor?: string;
  url: string;
  last_fetched_at: string;
}

export interface BenchmarkDataset {
  version: string;
  /** sha256 (first 16 hex chars) of the records, axis definitions and normalisation method (P3-7) */
  content_hash?: string;
  /** e.g. 'percentile-rank-v1': radar scores are percentile ranks within this dataset */
  normalization_method?: string;
  last_updated: string;
  sources: BenchmarkSourceMeta[];
  /** Why former sources were dropped (shown under the source list). */
  sources_note?: string;
  axis_definitions: RadarAxisMeta[];
  models: ModelBenchmarkProfile[];
}
