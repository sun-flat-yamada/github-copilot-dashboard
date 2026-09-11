import {
  BenchmarkRawMetrics,
  BenchmarkSourceMeta,
  ModelBenchmarkProfile,
  ModelEvaluation,
  ModelSuitabilityTag,
  RadarAxisMeta,
  RadarScores,
} from '../types/model-benchmark';

/**
 * Radar Chart 6-Axis Metadata Definitions
 */
export const RADAR_AXIS_DEFINITIONS: RadarAxisMeta[] = [
  {
    key: 'coding_swe',
    label: 'Coding & SWE (実務開発力)',
    shortLabel: 'Coding/SWE',
    description: 'SWE-bench Verified 及び HumanEval+ に基づく実践的ソフトウェア開発・課題解決力',
    primaryMetric: 'SWE-bench Verified',
    weight: 0.25,
  },
  {
    key: 'reasoning_logic',
    label: 'Reasoning & Logic (論理推論力)',
    shortLabel: '推論・数学',
    description: 'AIME 2024 / MATH-500 / GPQA Diamond による高難度アルゴリズムと思考チェーン推論力',
    primaryMetric: 'AIME 2024',
    weight: 0.25,
  },
  {
    key: 'arena_elo',
    label: 'Community & Elo (総合・指示追従)',
    shortLabel: 'Arena Elo',
    description: 'LMSYS Chatbot Arena (Coding) での人間のブラインド総合評価と実世界満足度',
    primaryMetric: 'Chatbot Arena Elo',
    weight: 0.15,
  },
  {
    key: 'speed_latency',
    label: 'Speed & Latency (応答即時性)',
    shortLabel: '応答速度',
    description: 'トークン生成速度 (tokens/sec) によるストリーミング応答とインライン補完の体感速度',
    primaryMetric: 'Tokens / sec',
    weight: 0.10,
  },
  {
    key: 'cost_efficiency',
    label: 'Cost Efficiency (費用対効果)',
    shortLabel: 'コスト効率',
    description: '100万トークンあたりの入出力単価およびCopilotリクエスト効率に基づく経済性評価',
    primaryMetric: 'Price / 1M tokens',
    weight: 0.10,
  },
  {
    key: 'architecture_design',
    label: 'Architecture & Context (設計・長文把握)',
    shortLabel: '設計・長文理解',
    description: '大規模コンテキスト窓 (128K〜2M) と複数ファイルにまたがる設計・リファクタリング適性',
    primaryMetric: 'Context Window & Multi-file',
    weight: 0.15,
  },
];

/**
 * Notable Official Benchmark Sources
 */
export const DEFAULT_BENCHMARK_SOURCES: BenchmarkSourceMeta[] = [
  {
    id: 'swe-bench',
    name: 'SWE-bench Verified Leaderboard',
    description: '実世界GitHub課題を自律解決するソフトウェアエンジニアリング評価ベンチマーク (Verified)',
    url: 'https://www.swebench.com/',
    last_fetched_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'lmsys-arena',
    name: 'LMSYS Chatbot Arena (Coding)',
    description: '100万件以上の実世界ユーザー対戦によるブラインドコーディング能力レーティング',
    url: 'https://chat.lmsys.org/?leaderboard',
    last_fetched_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'artificial-analysis',
    name: 'Artificial Analysis AI Benchmark',
    description: '独立系機関による出力速度 (TPS)、初回トークン遅延 (TTFT)、価格性能比の実測データ',
    url: 'https://artificialanalysis.ai/',
    last_fetched_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'frontier-papers',
    name: 'Frontier AI Technical Reports (Anthropic/OpenAI/Google)',
    description: '各社公式テクニカルレポート公表ベンチマーク (AIME 2024, GPQA Diamond, HumanEval+)',
    url: 'https://github.com/features/copilot',
    last_fetched_at: '2026-09-01T00:00:00Z',
  },
];

/**
 * Clamp a number to [min, max]
 */
function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Compute normalized 6-axis radar scores (0 - 100) from raw metrics
 */
export function computeRadarScores(raw: BenchmarkRawMetrics): RadarScores {
  // 1. Coding & SWE: SWE-bench Verified (0-75% scale mapped to 0-95) + HumanEval+ (0-100)
  // SWE-bench Verified 70% is state-of-the-art in 2026
  const sweScore = (raw.swe_bench_verified / 75) * 85;
  const humanEvalScore = (raw.humaneval_plus / 100) * 15;
  const codingSwe = clamp(Math.round(sweScore + humanEvalScore), 20, 99);

  // 2. Reasoning & Logic: AIME 2024 (0-90% mapped) + GPQA Diamond (0-80% mapped)
  const aimeScore = (raw.aime_2024 / 90) * 65;
  const gpqaScore = (raw.gpqa_diamond / 80) * 35;
  const reasoningLogic = clamp(Math.round(aimeScore + gpqaScore), 20, 99);

  // 3. Community & Elo: LMSYS Arena Coding Elo (range 1200 - 1460 normalized to 20 - 99)
  const eloBase = 1220;
  const eloCeil = 1460;
  const eloNorm = ((raw.arena_coding_elo - eloBase) / (eloCeil - eloBase)) * 79 + 20;
  const arenaElo = clamp(Math.round(eloNorm), 20, 99);

  // 4. Speed & Latency: tokens/sec (20 tps = 30, 80 tps = 75, 180+ tps = 98)
  let speedNorm: number;
  if (raw.output_speed_tps <= 30) {
    speedNorm = (raw.output_speed_tps / 30) * 45;
  } else if (raw.output_speed_tps <= 100) {
    speedNorm = 45 + ((raw.output_speed_tps - 30) / 70) * 40;
  } else {
    speedNorm = 85 + Math.min(14, ((raw.output_speed_tps - 100) / 100) * 14);
  }
  const speedLatency = clamp(Math.round(speedNorm), 20, 99);

  // 5. Cost Efficiency: Inverted price score.
  // Blended cost = input_cost * 0.4 + output_cost * 0.6
  const blendedCost = raw.input_cost_per_m * 0.4 + raw.output_cost_per_m * 0.6;
  let costNorm: number;
  if (blendedCost <= 0.5) {
    // Ultra cheap (e.g. Gemini Flash: ~$0.20-0.40) -> 95-99
    costNorm = 95 + (0.5 - blendedCost) * 8;
  } else if (blendedCost <= 3.0) {
    // Affordable (e.g. GPT-4o-mini, o3-mini) -> 82-94
    costNorm = 82 + ((3.0 - blendedCost) / 2.5) * 12;
  } else if (blendedCost <= 10.0) {
    // Standard frontier (e.g. GPT-4o, Claude 3.5 Sonnet) -> 65-81
    costNorm = 65 + ((10.0 - blendedCost) / 7.0) * 16;
  } else if (blendedCost <= 25.0) {
    // Premium reasoning (e.g. o1, Claude 3.7) -> 45-64
    costNorm = 45 + ((25.0 - blendedCost) / 15.0) * 19;
  } else {
    // High cost premium -> 20-44
    costNorm = Math.max(20, 45 - ((blendedCost - 25.0) / 40.0) * 25);
  }
  const costEfficiency = clamp(Math.round(costNorm), 20, 99);

  // 6. Architecture & Refactoring: Context window capacity + SWE multi-file capability
  // 128k = base 70, 200k = base 78, 1000k (1M) = 92, 2000k (2M) = 98
  let contextPoints = 65;
  if (raw.context_window_k >= 2000) contextPoints = 96;
  else if (raw.context_window_k >= 1000) contextPoints = 92;
  else if (raw.context_window_k >= 200) contextPoints = 80;
  else if (raw.context_window_k >= 128) contextPoints = 73;

  const archScore = contextPoints * 0.45 + (raw.swe_bench_verified / 75) * 55;
  const architectureDesign = clamp(Math.round(archScore), 25, 99);

  return {
    coding_swe: codingSwe,
    reasoning_logic: reasoningLogic,
    arena_elo: arenaElo,
    speed_latency: speedLatency,
    cost_efficiency: costEfficiency,
    architecture_design: architectureDesign,
  };
}

/**
 * Evaluate and characterize an AI model based on its raw metrics and radar scores
 */
export function evaluateModel(
  modelId: string,
  raw: BenchmarkRawMetrics,
  radar: RadarScores
): ModelEvaluation {
  // 1. Calculate overall weighted score
  const overall = Math.round(
    radar.coding_swe * 0.25 +
      radar.reasoning_logic * 0.25 +
      radar.arena_elo * 0.15 +
      radar.architecture_design * 0.15 +
      radar.speed_latency * 0.10 +
      radar.cost_efficiency * 0.10
  );

  // 2. Grade
  let grade: 'S+' | 'S' | 'A+' | 'A' | 'B+';
  if (overall >= 90) grade = 'S+';
  else if (overall >= 84) grade = 'S';
  else if (overall >= 78) grade = 'A+';
  else if (overall >= 70) grade = 'A';
  else grade = 'B+';

  // 3. Determine suitability tags
  const tags: ModelSuitabilityTag[] = [];
  if (radar.architecture_design >= 85 || raw.swe_bench_verified >= 62) {
    tags.push('Complex Refactoring');
  }
  if (radar.reasoning_logic >= 85 || raw.aime_2024 >= 75) {
    tags.push('Algorithm Specialist');
  }
  if (radar.speed_latency >= 80 || raw.output_speed_tps >= 100) {
    tags.push('Fast Inline Suggestion');
  }
  if (radar.cost_efficiency >= 80) {
    tags.push('Cost Saver');
  }
  if (raw.context_window_k >= 1000) {
    tags.push('Ultra-Long Context');
  }
  if (radar.coding_swe >= 85) {
    tags.push('High-Precision Coding');
  }
  if (radar.arena_elo >= 85) {
    tags.push('Agent & Multi-Turn');
  }

  // Fallback if no tags met
  if (tags.length === 0) {
    tags.push('High-Precision Coding');
  }

  // 4. Determine strengths, weaknesses, recommended use cases & guidance
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommended_for: string[] = [];
  let summary_verdict = '';
  let copilot_usage_guidance = '';

  if (radar.coding_swe >= 88) {
    strengths.push(`SWE-bench Verified ${raw.swe_bench_verified}%の驚異的なコード解決力`);
  }
  if (radar.reasoning_logic >= 88) {
    strengths.push(`難関数学・論理推論ベンチマーク (AIME ${raw.aime_2024}%) におけるトップレベルの思考力`);
  }
  if (radar.speed_latency >= 80) {
    strengths.push(`約 ${raw.output_speed_tps} tokens/s の超高速レスポンスによる高い作業リズム維持`);
  }
  if (radar.cost_efficiency >= 80) {
    strengths.push('卓越したコストパフォーマンス（大量バッチ・日常利用に最適）');
  }
  if (raw.context_window_k >= 1000) {
    strengths.push(`${raw.context_window_k / 1000}M トークンの超長文コンテキストでリポジトリ全体を丸ごと把握`);
  }

  if (radar.speed_latency < 55) {
    weaknesses.push('思考チェーン展開・重厚推論のため、ストリーミング完了までに待ち時間が発生');
  }
  if (radar.cost_efficiency < 50) {
    weaknesses.push('プレミアムモデルのため、無制限な全社利用ではコスト増加に配慮が必要');
  }
  if (raw.context_window_k <= 128) {
    weaknesses.push('コンテキスト上限が128Kのため、巨大リポジトリ全体の一括プロンプト注入には分割が必要');
  }

  // Model-specific tailored guidance
  if (modelId.includes('claude-3-7') || modelId.includes('claude-3-5')) {
    recommended_for.push(
      'アーキテクチャ設計・大規模リファクタリング',
      '複数ファイルにまたがる複雑な依存関係の解消',
      'GitHub Pull Requestの精密コードレビュー'
    );
    summary_verdict =
      'コーディング精度・SWE-benchにおいて業界屈指の実績を誇る最上位開発アシスタント。ハイブリッド推論により難解な不具合原因を深掘り特定可能。';
    copilot_usage_guidance =
      '【推奨シーン】IDE Chatでの複雑な機能実装、Agentモードでの複数ファイル改修。単なる一行補完よりも設計相談・精密リファクタリングで最大の真価を発揮します。';
  } else if (modelId.includes('o1') || modelId.includes('o3-mini')) {
    recommended_for.push(
      '競技プログラミング・難関数学・アルゴリズム設計',
      '並行処理や排他制御、暗号処理などエッジケースの緻密な検証',
      '難読バグ・原因不明の例外スタックトレースの根本原因究明'
    );
    summary_verdict =
      'Reasoning（思考チェーン）に特化した超高精度推論モデル。アルゴリズムや数学的証明で圧倒的な強みを発揮。';
    copilot_usage_guidance =
      '【推奨シーン】難解なバグ調査、アルゴリズムの正当性検証。応答速度より正解率を極限まで追求したい場面で Copilot Chat モデルとして選択してください。';
  } else if (modelId.includes('gemini-2-0-flash') || modelId.includes('gemini-flash')) {
    recommended_for.push(
      '高速なインラインコード補完・関数実装',
      '巨大ドキュメントやリポジトリ全体の横断検索と要約',
      '日常的な定型タスク・テストコード大量自動生成'
    );
    summary_verdict =
      '圧倒的なレスポンス速度と1M超のコンテキスト長を両立したコスト効率最強モデル。作業フローを途切れさせない快適性が特徴。';
    copilot_usage_guidance =
      '【推奨シーン】タイピングと同期する高速コード補完、大量のテストケース作成、全社デフォルトとしての日常的利用。コスト抑制と開発効率向上を両立できます。';
  } else if (modelId.includes('gemini-2-5-pro') || modelId.includes('gemini-1-5-pro')) {
    recommended_for.push(
      'リポジトリ全体をまるごと読み込んだ巨大コードベース解析',
      'マルチモーダル設計書・UI仕様書からのコード書き起こし',
      '多言語マイグレーションと大規模リグレッション調査'
    );
    summary_verdict =
      '最大2Mトークンの極大コンテキストと卓越した推論力を兼ね備えるマルチモーダル特化フロンティアモデル。';
    copilot_usage_guidance =
      '【推奨シーン】プロジェクト全体のソースコードや設計書を一括で読み込ませて分析・マイグレーションを行うユースケース。';
  } else if (modelId.includes('deepseek-r1')) {
    recommended_for.push(
      '高度な論理推論・アルゴリズム検証（オープンウェイト最高峰）',
      'オンプレミス・プライベート環境での自己ホスト推論検討',
      '数学・競プロ・高難度ロジックの解法探索'
    );
    summary_verdict =
      'オープンアーキテクチャながら o1 に迫る数学・論理推論力を実証した最先端推論モデル。';
    copilot_usage_guidance =
      '【参考比較】プロプライエタリモデル（o1/Claude 3.7）との性能比較・ベンチマーク対照用。高難度ロジックでの推論性能が際立っています。';
  } else {
    // GPT-4o / General
    recommended_for.push(
      '日常的なアプリケーション開発・API実装',
      'MarkdownドキュメントやREADME、仕様書の自動作成',
      '日常的なペアプログラミングと一般的な質疑応答'
    );
    summary_verdict =
      '速度・品質・マルチモーダル対応のバランスが極めて優れた標準的フロンティアモデル。幅広いタスクで安定した性能を発揮。';
    copilot_usage_guidance =
      '【推奨シーン】IDEでの汎用コーディング支援、日常的なチャット相談。あらゆる開発言語に対して堅実で安定したサポートを提供します。';
  }

  return {
    overall_score: overall,
    grade,
    suitability_tags: tags,
    recommended_for,
    strengths,
    weaknesses,
    summary_verdict,
    copilot_usage_guidance,
  };
}

/**
 * Build full model profile from raw metrics
 */
export function createModelProfile(
  id: string,
  name: string,
  vendor: 'Anthropic' | 'OpenAI' | 'Google' | 'DeepSeek' | 'Other',
  model_family: string,
  color: string,
  is_copilot_native: boolean,
  release_date: string,
  raw: BenchmarkRawMetrics
): ModelBenchmarkProfile {
  const radar_scores = computeRadarScores(raw);
  const evaluation = evaluateModel(id, raw, radar_scores);

  return {
    id,
    name,
    vendor,
    model_family,
    color,
    is_copilot_native,
    release_date,
    raw_metrics: raw,
    radar_scores,
    evaluation,
  };
}
