/**
 * AI Model Benchmark & Characteristics Types
 * 2026.09 Specification for AI Model Radar & Ingestion Evaluation
 */

export type BenchmarkMetricKey =
  | 'swe_bench_verified'
  | 'humaneval_plus'
  | 'aime_2024'
  | 'gpqa_diamond'
  | 'arena_coding_elo'
  | 'output_speed_tps'
  | 'input_cost_per_m'
  | 'output_cost_per_m'
  | 'context_window_k';

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
  swe_bench_verified: number; // SWE-bench Verified (%: 0 - 100)
  humaneval_plus: number; // HumanEval+ (%: 0 - 100)
  aime_2024: number; // AIME 2024 (%: 0 - 100)
  gpqa_diamond: number; // GPQA Diamond (%: 0 - 100)
  arena_coding_elo: number; // LMSYS Chatbot Arena Coding Elo (e.g. 1300 - 1500)
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
  last_updated: string;
  sources: BenchmarkSourceMeta[];
  axis_definitions: RadarAxisMeta[];
  models: ModelBenchmarkProfile[];
}
