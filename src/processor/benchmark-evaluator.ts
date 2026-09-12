import {
  BenchmarkRawMetrics,
  BenchmarkSourceMeta,
  EngineerBuzz,
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
    description: '実世界GitHubリポジトリのIssueを自律解決するソフトウェアエンジニアリング評価ベンチマーク (Verified)',
    url: 'https://www.swebench.com/',
    last_fetched_at: '2026-09-01T00:00:00Z',
    target_problem:
      '実世界の代表的Pythonオープンソース（Django, SymPy, scikit-learn, matplotlib等）で実際に過去に起票・マージされた本物のGitHub IssueとPull Request。問題記述のみからコードベース全体を探索し、既存テストを破壊せずに新規テストを通す実用パッチ（diff）を自律生成できるかを厳密判定します。',
    performance_view:
      '単一の関数実装ではなく、複数ファイルにまたがる参照関係の把握・エッジケース処理・環境再現が問われるため、「自律型コーディングエージェントとしての実務即戦力度」が最もダイレクトに現れます。部分点なし（全テスト合格のみパス）という極めてシビアな採点のため、スコアが60%〜70%を超えるモデルは現場で人間シニア並みの修正力を発揮します。',
    community_rumor:
      '※ SNSの噂: 「SWE-bench特化のプロンプトエンジニアリングや検索戦略でスコアを盛っている疑惑」や「解けたと報告されても、人間の曖昧な日本語指示だと意図を汲み違えることがある」「Verifiedになって悪問が排除され、トップモデルの実力差が誤魔化せなくなった」など、期待と警戒が入り混じった声が多数囁かれています。',
  },
  {
    id: 'lmsys-arena',
    name: 'LMSYS Chatbot Arena (Coding)',
    description: '100万件以上の実世界ユーザー対戦によるブラインドコーディング能力レーティング (Elo)',
    url: 'https://chat.lmsys.org/?leaderboard',
    last_fetched_at: '2026-09-01T00:00:00Z',
    target_problem:
      '世界中のエンジニアが日々の業務や学習で実際に遭遇した自由形式のプログラミング課題。2つの匿名AIモデルが生成したコードと解説を提示し、人間がどちらの回答が優れているかをブラインドで比較判定するクラウドソーシング対戦方式です。',
    performance_view:
      '静的な正解一致テストでは測れない「人間のプログラマーが読んだときの納得感・コードの綺麗さ・モダンな構文の採用・丁寧な説明・ニュアンスの汲み取り」といった主観的満足度が浮き彫りになります。Eloレーティングによる統計的有意差で順位付けされます。',
    community_rumor:
      '※ SNSの噂: 「思考過程（CoT）が長くて見た目が豪華なモデルに人間がバイアスで投票しやすい」「サクッと1行修正だけ欲しい現場派と、懇切丁寧なチュートリアルを好む初学者で評価が分かれる」「新しいモデルがリリースされるたびにArenaの首位争いでエンジニア界隈のタイムラインが沸く」と言われています。',
  },
  {
    id: 'artificial-analysis',
    name: 'Artificial Analysis AI Benchmark',
    description: '独立系第三者機関による生成速度 (TPS)、初回応答遅延 (TTFT)、価格性能比の実測データ',
    url: 'https://artificialanalysis.ai/',
    last_fetched_at: '2026-09-01T00:00:00Z',
    target_problem:
      '各AIプロバイダーの公式APIエンドポイントを24時間連続でベンチマークし、同一プロンプトに対する1秒あたりの出力トークン数（TPS）、最初の1文字が返ってくるまでの遅延時間（TTFT: Time To First Token）、および入力/出力トークン価格の費用対効果を計測。',
    performance_view:
      'いくら知能指数が高くても、1文字出るのに30秒待たされたりストリーミングが遅いモデルはIDEのインライン補完やペアプロで使い物になりません。「開発者の思考フローを止めない即時性（DX）」と「チーム導入時のAPI運用コスト」の現実的バランスがはっきり見えます。',
    community_rumor:
      '※ SNSの噂: 「公式発表の爆速アピールと実測値のギャップを暴いてくれる唯一の良心」「推論モデル（o1等）の思考待ちはベンチマーク数値以上に現場で体感フリーズに感じる」「Flash系モデルの異常な速さは一度慣れると通常モデルに戻れなくなる」という現場のリアルな実感で支持されています。',
  },
  {
    id: 'frontier-papers',
    name: 'Frontier AI Technical Reports (Anthropic/OpenAI/Google)',
    description: 'フロンティアAI各社公式テクニカルレポート公表ベンチマーク (AIME 2024, GPQA, HumanEval+)',
    url: 'https://github.com/features/copilot',
    last_fetched_at: '2026-09-01T00:00:00Z',
    target_problem:
      '全米数学招待試験 (AIME 2024)、大学院生・博士レベルの超難関科学多肢選択問 (GPQA Diamond)、および関数の正確な入出力一致 (HumanEval+) など、AIの極限の思考力・論理推論・型推論・抽象化能力を極限まで試すアカデミック難関テスト群。',
    performance_view:
      '並行処理のデッドロック検出、複雑なビット演算、高度な型パズル、暗号理論など、普通の人間エンジニアでも頭を抱える「超難関バグの根本原因の特定」においてどこまで正確な推論チェーンを組み立てられるかの天井（極限性能）を示します。',
    community_rumor:
      '※ SNSの噂: 「テストデータが事前学習コーパスに漏洩（リーク）しているのではないかと常に議論が紛糾する」「AIMEで90%取るモデルでも、CSSの微妙な崩れや正規表現の初歩的ミスをポロッとやるギャップが面白い」「スコアが人間平均を軽々超えていてインフレ気味」と語られています。',
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
  } else if (modelId.includes('gpt-4o-mini')) {
    recommended_for.push(
      '軽量・高速なインライン補完・単体テスト生成',
      'シンプルな関数実装や定型コードの自動補正',
      '低コスト・大量バッチ処理や日常的なサジェスト'
    );
    summary_verdict =
      'GPT-4o の基本精度を維持しながら超低価格・高スループットを実現した軽量高速モデル。';
    copilot_usage_guidance =
      '【推奨シーン】頻繁なインライン提案や手軽なコード説明、トークン消費を抑えたい社内定常業務に最適。';
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

  // エンジニアコミュニティでの生の声・SNSの噂
  let buzz: EngineerBuzz;

  if (modelId.includes('claude-3-7')) {
    buzz = {
      headline: 'リファクタリングの神。ただしThinking全開時はトークン消費と回答長に注意',
      community_sentiments: [
        '複数ファイルにまたがる大規模リファクタと依存解決の精度が異次元に高い',
        'TypeScriptの複雑な型パズルやジェネリクスを迷いなく一発で綺麗に解決する',
        'テストが失敗した原因を自己反省（CoT）しながら修正してくれる頼もしさが異常',
      ],
      caution_rumor: '思考が深すぎて回答が長大になりがち。調子に乗って使いまくるとCopilotのクォータ上限が一瞬で溶けるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
    };
  } else if (modelId.includes('claude-3-5')) {
    buzz = {
      headline: '全エンジニアの精神安定剤。一番打率が高く安定している定番主力',
      community_sentiments: [
        '言った通りの指示を余計な小細工なしに実直にコーディングしてくれる打率の高さ',
        'ReactやNext.jsなどモダンWebフロントエンドの実装センスがピカイチ',
        '長文コードを渡してもハルシネーションが少なく、安心してPRレビューを任せられる',
      ],
      caution_rumor: 'たまに同一箇所の修正を指示しても頑固に直さない修正ループに陥ることがあるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
    };
  } else if (modelId === 'o1') {
    buzz = {
      headline: '難攻不落のバグ調査専門ドクター。沈黙の後に本質的な一撃を放つ',
      community_sentiments: [
        '何時間も悩んだ並行処理のデッドロックやメモリリーク原因を一発で見抜いた',
        'アルゴリズムの正当性検証やエッジケースの指摘では他の追随を許さない',
        'アーキテクチャの境界線やドメイン設計の壁打ち相手として最も頼れる',
      ],
      caution_rumor: '最初の1文字が出るまで20〜40秒平気で待たされる。インライン補完感覚で呼び出すとフリーズしたかと錯覚する。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
    };
  } else if (modelId.includes('o3-mini')) {
    buzz = {
      headline: 'o1の頭脳を高速・低価格化。実務で常用できる推論モデルの最高傑作',
      community_sentiments: [
        'o1並みの鋭い思考チェーンを展開するのに待たされ感が劇的に少なくサクサク動く',
        '単価が安いため、チーム内で推論機能を気軽にガンガン使わせやすい',
        '競プロレベルの難問やエッジケースのテストケース出しで鬼のように活躍する',
      ],
      caution_rumor: 'Reasoning Effort を High にするとたまに考えすぎて長文の推論迷路に入るという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
    };
  } else if (modelId.includes('gemini-2-0-flash')) {
    buzz = {
      headline: '光速のレスポンスと1M窓。開発者のタイプ速度を置き去りにする爆速補完',
      community_sentiments: [
        'とにかくレスポンスが速すぎて脳の思考速度と同じスピードでコードが出てくる',
        '1Mトークンのコンテキストが使えるので、設計書とログファイルを丸ごと放り込める',
        '大量のユニットテストを一気に自動生成させるときのスピード感が快感',
      ],
      caution_rumor: 'たまに実在しないメソッドや非推奨APIを平然とした顔で書いてくるので確認必須という噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
    };
  } else if (modelId.includes('gemini-2-5-pro')) {
    buzz = {
      headline: '2Mコンテキストの超巨大胃袋。プロジェクト全体の過去ログも丸ごと記憶',
      community_sentiments: [
        '200万トークンはもはや異次元。リポジトリの全コードと過去のIssue履歴を全部読んで回答してくれる',
        '手書きのシステム構成図やFigmaからコードを起こすマルチモーダル精度が高い',
        'SWE-benchスコアも急上昇しており、長文解析とコーディングがハイレベルで融合',
      ],
      caution_rumor: '巨大プロンプトを投げるとコンテキスト処理にやや時間がかかるため、短文タスクにはFlashの方が快適。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
    };
  } else if (modelId.includes('deepseek-r1')) {
    buzz = {
      headline: 'オープンウェイト界の革命児。o1級の推論力を自前ホストできる衝撃',
      community_sentiments: [
        'オープンウェイトなのに数学・推論が本当にo1とタメを張るレベルで強い',
        '思考プロセス（<think>タグ）が丸見えなので、AIがどう悩んで結論を出したか観察できる',
        '推論コストの常識を破壊し、各社の価格競争の引き金を引いた立役者',
      ],
      caution_rumor: '思考の途中で中国語が混ざったり、エージェント的なツール呼び出し（Function calling）がたまに不安定という噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
    };
  } else if (modelId.includes('gpt-4o-mini')) {
    buzz = {
      headline: '爆安・爆速の超軽量ギア。単純作業やインライン提案をノーコスト感覚で回す',
      community_sentiments: [
        '単価が圧倒的に安く、大量の定型ファイル生成やログ解析スクリプト作成に最適',
        'インラインサジェストの反応が機敏で引っかかりがない',
        '軽い質問やタイポ修正ならこれで一瞬で片付く',
      ],
      caution_rumor: '複雑なロジックを頼むと途端に雑な実装になったり知らんライブラリを hallucinate しがちという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
    };
  } else {
    // GPT-4o / General
    buzz = {
      headline: '頼れる社内標準オールラウンダー。速度とバランスの良さで日常を支える',
      community_sentiments: [
        'Markdownドキュメントの整理やAPI仕様書の作成、日常スクリプトならこれで十分',
        'レスポンスが早くてテンポ良く対話できるためペアプロのテンポが崩れない',
        '画像（UIモックやエラー画面のスクショ）を貼り付けての質問に対する理解力が高い',
      ],
      caution_rumor: '最近の超難関コーディングタスクではClaude 3.7やo1と比べるとややあっさりした実装になりがちとの噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
    };
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
    buzz,
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

/**
 * 外部データやログのモデル名表記揺れをナレッジモデルIDに正規化
 */
export function normalizeModelId(rawName: string): string {
  const s = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
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
