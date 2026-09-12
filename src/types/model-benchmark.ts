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

export interface EngineerBuzz {
  headline: string; // キャッチコピー / 現場での通り名
  community_sentiments: string[]; // 現場エンジニアからのポジティブな実感・評価
  caution_rumor: string; // 現場で囁かれる注意点・ボヤキ
  source_note: string; // "※ SNS上のエンジニアの声・コミュニティの噂・所感"
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

export interface ModelBenchmarkProfile {
  id: string; // e.g. 'claude-3-7-sonnet', 'gpt-4o', 'o1'
  name: string; // 'Claude 3.7 Sonnet'
  vendor: 'Anthropic' | 'OpenAI' | 'Google' | 'DeepSeek' | 'Other';
  model_family: string; // 'Claude 3.7', 'GPT-4', 'o-series', 'Gemini 2.x'
  color: string; // Hex color code for radar & charts
  is_copilot_native: boolean; // GitHub Copilot公式対応モデルかどうか
  release_date: string;
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
