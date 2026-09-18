import {
  BenchmarkRawMetrics,
  ModelBenchmarkProfile,
  ModelEvaluation,
  ModelExtendedCapabilities,
  ModelReleaseStatus,
  ModelSuitabilityTag,
  ModelVendor,
  RadarScores,
} from '../types/model-benchmark.js';

import {
  RADAR_AXIS_DEFINITIONS,
  DEFAULT_BENCHMARK_SOURCES,
  getModelBuzz,
} from './benchmark-definitions.js';

// Re-export definitions for backward compatibility
export { RADAR_AXIS_DEFINITIONS, DEFAULT_BENCHMARK_SOURCES, getModelBuzz };

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

/**
 * Evaluate and characterize an AI model based on its raw metrics and radar scores
 */
export function evaluateModel(
  modelId: string,
  raw: BenchmarkRawMetrics,
  radar: RadarScores,
  vendor?: ModelVendor
): ModelEvaluation {
  const mId = modelId.toLowerCase();
  const effectiveVendor: ModelVendor =
    vendor ||
    (mId.includes('claude')
      ? 'Anthropic'
      : mId.includes('gemini')
      ? 'Google'
      : mId.includes('deepseek')
      ? 'DeepSeek'
      : mId.includes('grok')
      ? 'xAI'
      : mId.includes('kimi')
      ? 'Moonshot AI'
      : mId.includes('mai')
      ? 'Microsoft'
      : mId.includes('gpt') || mId === 'o1' || mId.includes('o3')
      ? 'OpenAI'
      : 'Other');

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
  if (radar.coding_swe >= 88) tags.push('High-Precision Coding');
  if (radar.reasoning_logic >= 88) tags.push('Algorithm Specialist');
  if (radar.architecture_design >= 85) tags.push('Complex Refactoring');
  if (radar.architecture_design >= 90) tags.push('Agent & Multi-Turn');
  if (radar.speed_latency >= 85) tags.push('Fast Inline Suggestion');
  if (radar.cost_efficiency >= 85) tags.push('Cost Saver');
  if (raw.context_window_k >= 1000) tags.push('Ultra-Long Context');

  // Ensure at least 2 tags
  if (tags.length < 2) {
    if (radar.speed_latency > radar.cost_efficiency) {
      tags.push('Fast Inline Suggestion');
    } else {
      tags.push('Cost Saver');
    }
  }

  // 4. Recommendations, Strengths & Weaknesses
  const recommended_for: string[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let summary_verdict = '';
  let copilot_usage_guidance = '';

  // Strengths derived from axes >= 80
  if (radar.coding_swe >= 85) strengths.push('業界最高峰のSWE-benchスコア（高難度OSSバグ自律解決）');
  if (radar.reasoning_logic >= 85) strengths.push('卓越した数学・競技プログラミング推論能力');
  if (radar.architecture_design >= 85) strengths.push('複数ファイル横断のリファクタリングとアーキテクチャ設計');
  if (radar.arena_elo >= 85) strengths.push('現役プログラマーによるブラインド評価（Arena）で圧倒的支持');
  if (radar.speed_latency >= 80) strengths.push('極めて高速なトークン出力による軽快な開発テンポ');
  if (radar.cost_efficiency >= 80) strengths.push('抜群のコストパフォーマンスによる全社規模での日常利用適性');
  if (raw.context_window_k >= 1000) strengths.push('100万トークン超の極大コンテキストによる巨大モノレポ丸ごと解析');

  // Fallback strengths if none scored >= threshold
  if (strengths.length === 0) {
    strengths.push('標準的なコーディングタスクでの堅実な動作実績', '軽量なAPIエンドポイントと安定した稼働率');
  }

  // Weaknesses derived from axes < 60
  if (radar.cost_efficiency < 50) weaknesses.push('API利用料が高価なため、日常的な些細な質問での乱用にはコスト管理が必要');
  if (radar.speed_latency < 50) weaknesses.push('推論待機時間（思考チェーン）が長めで、インライン補完としてはテンポを要確認');
  if (radar.coding_swe < 60) weaknesses.push('大規模な自律コード修正タスクでは上位モデルへのエスカレーションが望ましい');
  if (raw.context_window_k < 200) weaknesses.push('コンテキスト長が200K未満のため、巨大リポジトリ全体の一括読み込みには非推奨');

  if (weaknesses.length === 0) {
    weaknesses.push('極端な弱点のないバランス型（タスク難易度に応じた適切なモデル切り替えが推奨）');
  }

  // Context-aware recommendations and verdict by model/family
  if (mId.includes('gpt-6') || mId.includes('astra')) {
    recommended_for.push(
      '超難関アルゴリズム・未知のアーキテクチャ設計・自動定理証明',
      '全社規模の大規模モノレポ横断リファクタリング',
      '人間のシニアエンジニアでも難解な極限バグの根本原因究明'
    );
    summary_verdict =
      'OpenAIの次世代最高峰フロンティアモデル。極限の推論チェーンとSWE-bench新記録を誇り、最重要タスクで比類なき威力を発揮。';
    copilot_usage_guidance =
      '【推奨シーン】難関プロジェクトのアーキテクチャ設計、極めて複雑なデッドロックやメモリ破壊の究明。コストが高いため、通常の日常補完ではなく高難度勝負どころで投入するのがベストです。';
  } else if (mId.includes('claude-sonnet-5') || mId.includes('claude-5-sonnet')) {
    recommended_for.push(
      '全社標準の次世代IDEペアプログラミング・Agent自律改修',
      '複数ファイルにまたがるTypeScript/Pythonの設計整合性レビュー',
      'テスト駆動開発（TDD）での精密テストコード・実装一括生成'
    );
    summary_verdict =
      '驚異的なSWE-benchスコアと$2.00/$10.00という圧倒的低価格を両立した次世代の絶対的主力モデル。1Mトークン窓と構成可能推論に完全対応。';
    copilot_usage_guidance =
      '【推奨シーン】日常のIDE ChatからAgentモードでの大規模改修まで、全社デフォルトとして最も費用対効果が高い推奨フラッグシップです。';
  } else if (mId.includes('claude-opus-4-6') || mId.includes('opus-4-6')) {
    recommended_for.push(
      '指示に忠実な実装・余計な変更を避けたい保守改修',
      'Enterprise環境での安定したコード生成・リファクタリング',
      '過剰な自律最適化を制御したいミッションクリティカルな開発'
    );
    summary_verdict =
      'Opus 4世代の堅実な銘機。2026年9月に一般提供は終了（Retired）したものの、Enterprise向けプラン等で継続提供されており、指示への実直さから現場で根強い支持を誇ります。';
    copilot_usage_guidance =
      '【推奨シーン】Enterprise環境での基幹システム改修、保守開発。Opus 5のような過剰な自律介入がなく、指示通りのシンプルな変更を求める現場に最適です。';
  } else if (mId.includes('claude-opus') || mId.includes('claude-fable')) {
    recommended_for.push(
      'エンタープライズ領域の厳格なセキュリティ・コンプライアンス検証',
      'クリティカルなインフラ・金融・基幹システムのコード設計',
      '長大な仕様書・要件定義からのフルスタック自動実装'
    );
    summary_verdict =
      'Anthropicが誇る超重厚推論モデル群。安全性基準と深層コンテキスト理解において業界最高水準の堅牢性を実現。';
    copilot_usage_guidance =
      '【推奨シーン】セキュリティ監査、ミッションクリティカルな基幹システム改修。Opus 4.8は安定した実直さで現場の信頼を集め、FableはEnterprise Frontier Safeguards（EFS）対応の最高位モデルです。';
  } else if (mId.includes('gpt-5-6-sol') || mId === 'sol') {
    recommended_for.push(
      'OpenAIエコシステムにおける最上位コーディング＆推論タスク',
      '並行処理・非同期イベント駆動アーキテクチャの厳密な型付け',
      '複数ステップに及ぶ自律エージェントのゴール遂行'
    );
    summary_verdict =
      'OpenAI GPT-5.6世代のPowerful主力。深い思考力と高速なコード生成スピードを高度に融合。';
    copilot_usage_guidance =
      '【推奨シーン】VS Code Copilotでの複雑な機能実装、CLIでの自律タスク実行。長文コンテキスト（>272K）にもシームレスに対応。';
  } else if (mId.includes('gpt-5-6-terra') || mId === 'terra') {
    recommended_for.push(
      '日々のWebアプリ・API・データベース処理の総合的開発',
      'リファクタリングとプルリクエスト差分の自動要約・解説',
      '手軽な仕様相談とペアプログラミング'
    );
    summary_verdict =
      'GPT-5.6世代のVersatileバランス型。高品質なコード生成と親切な解説をリーズナブルな単価で両立。';
    copilot_usage_guidance =
      '【推奨シーン】開発チーム全体の常用モデルとして最適。スピードと精度のバランスに優れます。';
  } else if (mId.includes('gpt-5-6-luna') || mId === 'luna' || mId.includes('gpt-5-4-nano')) {
    recommended_for.push(
      'インラインの爆速コード提案（Next Edit Suggestion）',
      '定型関数の生成、コメント・JSDoc・型アノテーションの自動補正',
      '大量ドキュメントの即時校正・軽量要約'
    );
    summary_verdict =
      '$0.20/$1.20という極限の低コストと超高速レスポンスを誇る超軽量モデル。日常的なタイピングを邪魔しません。';
    copilot_usage_guidance =
      '【推奨シーン】インライン補完や即時サジェスト、バックグラウンド処理。コストを全く気にせず常時稼働させられます。';
  } else if (mId.includes('gpt-5-3-codex') || mId.includes('codex')) {
    recommended_for.push(
      'GitHub Copilotの長期サポート（LTS）基準での安定運用',
      '既存コードベースの破壊的変更を避けた安全なバグ修正',
      'ポリシー統括されたエンタープライズ開発環境'
    );
    summary_verdict =
      'GitHub Copilotのフォールバック・LTSモデルとして認定された確固たる実績を持つコーディング特化モデル。';
    copilot_usage_guidance =
      '【推奨シーン】他モデルが利用制限された際のフォールバック先、および長期間変更されない安定した動作が要求されるCI/CDエージェント。';
  } else if (mId.includes('gpt-5')) {
    recommended_for.push(
      '高度な自律エージェントタスク・複数ファイル改修',
      '高精度なコードレビューとバグ修正',
      '日常のチーム開発における主力プログラミング相談'
    );
    summary_verdict =
      'OpenAIのGPT-5世代モデル。高い自律推論と安定したコード生成能力を誇り、幅広い開発タスクをサポート。';
    copilot_usage_guidance =
      '【推奨シーン】IDEでの複雑な機能実装、Agentモードでの複数ファイル改修に安定して対応します。';
  } else if (mId.includes('gemini')) {
    recommended_for.push(
      '100万〜200万トークンを活かしたリポジトリ全体・ドキュメント全体の丸ごと分析',
      '超高速レスポンスによるリアルタイム・ペアプログラミング',
      'プロモーション価格や低単価を活かした大量バッチ・全社日常利用'
    );
    summary_verdict =
      '極大コンテキスト（1M〜2M）と電光石火のTPSを兼ね備えた、Google DeepMindの高性能モデル群。';
    copilot_usage_guidance =
      '【推奨シーン】巨大なプロジェクト全体のソースコードを一網打尽にしてマイグレーションやリグレッション調査を行う場面で最強の威力を発揮します。';
  } else if (mId.includes('deepseek')) {
    recommended_for.push(
      'オープン推論モデルを活用した難関アルゴリズム・数学的思考',
      'API利用コストを極限まで抑えた大規模コード生成・バッチ処理',
      '透明性の高い思考ステップ（CoT）の検証・学習'
    );
    summary_verdict =
      'オープンウェイト推論モデルの金字塔。低単価ながら商用最上位モデルに迫る強力な思考力を発揮。';
    copilot_usage_guidance =
      '【推奨シーン】難解なロジック検証や推論タスクを極めて低いAPIコストで実行したい場面に最適です。';
  } else if (mId.includes('mai-code') || mId.includes('mai')) {
    recommended_for.push(
      'Microsoft Azure・C#・.NET・TypeScriptエコシステムの開発',
      '軽量・高速なインライン提案と定型コード補正',
      '低コストでの日常的なコードスニペット生成'
    );
    summary_verdict =
      'マイクロソフトが開発した軽量・高効率なコーディング特化Flashモデル。';
    copilot_usage_guidance =
      '【推奨シーン】Microsoftスタックを中心とする開発チームでの日常的なインラインコードサジェストに最適です。';
  } else if (mId.includes('grok')) {
    recommended_for.push(
      '率直で歯切れの良い技術的アドバイスとペアプロ',
      '最新トレンドやエッジケースに対する率直な意見交換',
      'Python/Rust等のスクリプト実装と最適化'
    );
    summary_verdict =
      'xAIによる高知能モデル。最新知識の取り込みと論理的で飾らない回答スタイルが特徴。';
    copilot_usage_guidance =
      '【推奨シーン】技術選定のブレインストーミングや、回りくどい解説を省いて要点だけ即座に知りたい場合に向いています。';
  } else if (mId.includes('kimi')) {
    recommended_for.push(
      '長文プログラミングコンテキストの把握と複数ファイル探索',
      '数学的アルゴリズム・競技プログラミングの難問解法',
      '多言語（特にアジア圏言語・英語）の混在コードベース解析'
    );
    summary_verdict =
      'Moonshot AIによる高推論・長文対応モデル。K3は1Mコンテキストと高難度推論を両立。';
    copilot_usage_guidance =
      '【推奨シーン】推論能力と長文コンテキストの両方が求められる複合タスクに有効です。';
  } else if (mId.includes('claude-3-7') || mId.includes('claude-3-5') || mId.includes('claude-sonnet') || mId.includes('claude-haiku')) {
    recommended_for.push(
      'アーキテクチャ設計・大規模リファクタリング',
      '複数ファイルにまたがる複雑な依存関係の解消',
      'GitHub Pull Requestの精密コードレビュー'
    );
    summary_verdict =
      'コーディング精度・SWE-benchにおいて業界屈指の実績を誇る定番開発アシスタント。安定感抜群の実績機。';
    copilot_usage_guidance =
      '【推奨シーン】IDE Chatでの複雑な機能実装、Agentモードでの複数ファイル改修。';
  } else if (mId.includes('o1') || mId.includes('o3-mini')) {
    recommended_for.push(
      '競技プログラミング・難関数学・アルゴリズム設計',
      '並行処理や排他制御、暗号処理などエッジケースの緻密な検証',
      '難読バグ・原因不明の例外スタックトレースの根本原因究明'
    );
    summary_verdict =
      'Reasoning（思考チェーン）に特化した超高精度推論モデル。アルゴリズムや数学的証明で圧倒的な強みを発揮。';
    copilot_usage_guidance =
      '【推奨シーン】難解なバグ調査、アルゴリズムの正当性検証。応答速度より正解率を極限まで追求したい場面で選択してください。';
  } else if (mId.includes('gpt-4o-mini')) {
    recommended_for.push(
      '手軽なスクリプト作成・定型関数の実装',
      'ドキュメントやREADME、コミットメッセージの整形',
      '低コストでの日常的な質疑応答'
    );
    summary_verdict =
      '格安・高速な汎用軽量モデル。日常的な補助タスクを経済的にこなします。';
    copilot_usage_guidance =
      '【推奨シーン】コストを抑えたい日常の開発支援や、軽微なスクリプト作成に最適です。';
  } else {
    // General fallback
    recommended_for.push(
      '日常的なアプリケーション開発・API実装',
      'MarkdownドキュメントやREADME、仕様書の自動作成',
      '日常的なペアプログラミングと一般的な質疑応答'
    );
    summary_verdict =
      '速度・品質・マルチモーダル対応のバランスが優れた標準的モデル。幅広いタスクで安定した性能を発揮。';
    copilot_usage_guidance =
      '【推奨シーン】IDEでの汎用コーディング支援、日常的なチャット相談。あらゆる開発言語に対して堅実なサポートを提供します。';
  }

  // 5. エンジニアコミュニティでの生の声・SNSの噂
  const buzz = getModelBuzz(modelId, effectiveVendor);

  return {
    overall_score: overall,
    grade,
    suitability_tags: tags,
    recommended_for,
    strengths,
    weaknesses,
    summary_verdict,
    copilot_usage_guidance,
    buzz,
  };
}

/**
 * Build full model profile from raw metrics
 */
export function createModelProfile(
  id: string,
  name: string,
  vendor: ModelVendor,
  model_family: string,
  color: string,
  is_copilot_native: boolean,
  release_date: string,
  raw: BenchmarkRawMetrics,
  release_status_or_capabilities: ModelReleaseStatus | ModelBenchmarkProfile['extended_capabilities'] = 'GA',
  capabilities?: ModelExtendedCapabilities,
  extended_capabilities?: ModelBenchmarkProfile['extended_capabilities']
): ModelBenchmarkProfile {
  const radar_scores = computeRadarScores(raw);
  const evaluation = evaluateModel(id, raw, radar_scores, vendor);

  let release_status: ModelReleaseStatus = 'GA';
  let ext: ModelBenchmarkProfile['extended_capabilities'];

  if (typeof release_status_or_capabilities === 'object' && release_status_or_capabilities !== null) {
    ext = release_status_or_capabilities;
    release_status = (ext.release_status?.toUpperCase() as ModelReleaseStatus) || 'GA';
  } else {
    release_status = release_status_or_capabilities || 'GA';
    ext = extended_capabilities || {
      tier: (capabilities?.tier?.toLowerCase() || 'versatile') as any,
      release_status: (release_status?.toLowerCase() || 'ga') as any,
      supports_1m_context: capabilities?.has_1m_context ?? (raw.context_window_k >= 1000),
      supports_cache: raw.cached_input_cost_per_m !== undefined,
      supports_long_context: raw.long_context_input_cost_per_m !== undefined,
      max_context_window: raw.context_window_k * 1024,
    };
  }

  return {
    id,
    name,
    vendor,
    model_family,
    color,
    is_copilot_native,
    release_date,
    release_status,
    capabilities,
    extended_capabilities: ext,
    raw_metrics: raw,
    radar_scores,
    evaluation,
  };
}

/**
 * 外部データやログのモデル名表記揺れをナレッジモデルIDに正規化
 */
export function normalizeModelId(rawName: string): string {
  const s = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 2026 最新 OpenAI
  if (s.includes('gpt6') || s.includes('astra')) return 'gpt-6-astra';
  if (s.includes('gpt56sol') || (s.includes('gpt56') && s.includes('sol'))) return 'gpt-5-6-sol';
  if (s.includes('gpt56terra') || (s.includes('gpt56') && s.includes('terra'))) return 'gpt-5-6-terra';
  if (s.includes('gpt56luna') || (s.includes('gpt56') && s.includes('luna'))) return 'gpt-5-6-luna';
  if (s.includes('gpt55')) return 'gpt-5-5';
  if (s.includes('gpt54nano')) return 'gpt-5-4-nano';
  if (s.includes('gpt54mini')) return 'gpt-5-4-mini';
  if (s.includes('gpt54')) return 'gpt-5-4';
  if (s.includes('gpt53codex') || (s.includes('gpt53') && s.includes('codex'))) return 'gpt-5-3-codex';
  if (s.includes('gpt5mini')) return 'gpt-5-mini';

  // 2026 最新 Anthropic
  if (s.includes('claudefable51') || s.includes('fable51') || s.includes('claude51fable')) return 'claude-fable-5-1';
  if (s.includes('claudefable5') || s.includes('fable5') || s.includes('claude5fable')) return 'claude-fable-5';
  if (s.includes('claudeopus5') || s.includes('claude5opus') || (s.includes('opus5') && !s.includes('sonnet'))) return 'claude-opus-5';
  if (s.includes('claudesonnet5') || s.includes('claude5sonnet') || s.includes('sonnet5') || s.includes('claude5')) return 'claude-sonnet-5';
  if (s.includes('claudeopus48fast')) return 'claude-opus-4-8-fast';
  if (s.includes('claudeopus48') || s.includes('opus48')) return 'claude-opus-4-8';
  if (s.includes('claudeopus47') || s.includes('opus47')) return 'claude-opus-4-7';
  if (s.includes('claudeopus46') || s.includes('opus46')) return 'claude-opus-4-6';
  if (s.includes('claudesonnet46') || s.includes('sonnet46')) return 'claude-sonnet-4-6';
  if (s.includes('claudesonnet4') || s.includes('claude4sonnet') || s.includes('sonnet4')) return 'claude-sonnet-4';
  if (s.includes('claudehaiku45') || s.includes('claude45haiku') || s.includes('haiku45')) return 'claude-haiku-4-5';

  // 2026 最新 Google
  if (s.includes('gemini38') || s.includes('gemini38flash')) return 'gemini-3-8-flash';
  if (s.includes('gemini37') || s.includes('gemini37flash')) return 'gemini-3-7-flash';
  if (s.includes('gemini36') || s.includes('gemini36flash')) return 'gemini-3-6-flash';
  if (s.includes('gemini35') || s.includes('gemini35flash')) return 'gemini-3-5-flash';

  // Microsoft / xAI / Moonshot
  if (s.includes('maicode11') || s.includes('maicode')) return 'mai-code-1-1-flash';
  if (s.includes('grok46')) return 'grok-4-6';
  if (s.includes('grok45') || s.includes('grok')) return 'grok-4-5';
  if (s.includes('kimik3') || (s.includes('kimi') && s.includes('k3'))) return 'kimi-k3';
  if (s.includes('kimik27') || s.includes('kimicode')) return 'kimi-k2-7-code';

  // クラシック / 過去世代
  if (s.includes('claude37') || s.includes('claude37sonnet')) return 'claude-3-7-sonnet';
  if (s.includes('claude35') || s.includes('claude35sonnet')) return 'claude-3-5-sonnet';
  if (s.includes('gpt4omini') || s.includes('4omini')) return 'gpt-4o-mini';
  if (s.includes('gpt4o') || s.includes('gpt4omni') || s.includes('4o')) return 'gpt-4o';
  if (s.includes('o3mini') || s.includes('o3')) return 'o3-mini';
  if (s.includes('o1') || s.includes('openaio1')) return 'o1';
  if (s.includes('gemini25') || s.includes('gemini25pro')) return 'gemini-2-5-pro';
  if (s.includes('gemini20') || s.includes('gemini20flash') || s.includes('geminiflash')) return 'gemini-2-0-flash';
  if (s.includes('deepseek') || s.includes('r1')) return 'deepseek-r1';

  return rawName.toLowerCase().trim();
}
