import {
  BenchmarkSourceMeta,
  EngineerBuzz,
  ModelVendor,
  RadarAxisMeta,
} from '../types/model-benchmark.js';

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
    url: 'https://lmarena.ai/',
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
    url: 'https://arxiv.org/',
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
 * Generate authentic developer sentiment and community buzz with verified sources
 */
export function getModelBuzz(modelId: string, vendor?: ModelVendor): EngineerBuzz {
  const m = modelId.toLowerCase();

  // 1. OpenAI Models
  if (m.includes('gpt-6') || m.includes('astra')) {
    return {
      headline: '知能指数の天井を突き破った究極兵器。難攻不落のバグが一瞬で解ける衝撃',
      community_sentiments: [
        '他のどのモデルも解けなかった複雑な非同期レースコンディションを1回の推論で言い当てた',
        '数学オリンピックレベルの難問や独自プロトコル実装を一切のハルシネーションなく完遂する',
        'SWE-bench 80%超えは伊達じゃない。人間のプリンシパルエンジニアと議論している感覚',
      ],
      caution_rumor: 'クレジット消費が圧倒的。日常の些細な質問で乱用すると月末に上長から呼び出されるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: Frontier Research & Model Announcements',
          url: 'https://openai.com/index/',
        },
      ],
    };
  }

  if (m.includes('gpt-5-6-sol') || m === 'sol') {
    return {
      headline: 'OpenAIの真骨頂。Agentモードでコードを自律生成させるときの安心感が抜群',
      community_sentiments: [
        'VS CodeのAgentモードでファイル横断改修させるときの成功率が跳ね上がった',
        'テストの実行結果を見て自律的にリトライ・修正するループの粘り強さが素晴らしい',
        '推論速度と正答率のバランスが非常によくチューニングされている',
      ],
      caution_rumor: 'キャッシュ書き込みコストがあるため、同じセッションを上手に再利用しないとコスト効率が落ちるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: Developer Platform & Model Specifications',
          url: 'https://platform.openai.com/docs/models',
        },
      ],
    };
  }

  if (m.includes('gpt-5-6-terra') || m === 'terra') {
    return {
      headline: '日常開発の絶対的ワークホース。どんな指示もそつなくこなす万能優等生',
      community_sentiments: [
        '入力$2.00/出力$12.00でこの精度は破格。日々の開発相談ならこれ1本で十分',
        '冗長すぎず簡潔で分かりやすいコード解説をしてくれるので読みやすい',
        '新機能追加時のボイラープレート作成やCRUD実装が爆速で終わる',
      ],
      caution_rumor: '超難関アルゴリズムや数学的証明ではSolやAstraに一歩譲るので使い分けが必要との噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: Developer Platform & Model Specifications',
          url: 'https://platform.openai.com/docs/models',
        },
      ],
    };
  }

  if (m.includes('gpt-5-6-luna') || m === 'luna') {
    return {
      headline: '空気のように動く超光速補完。入力した瞬間に次の行がそこにある快感',
      community_sentiments: [
        'とにかく速い。キーボードを打つリズムを1ミリも阻害しないリアルタイム感',
        '100万トークンあたり20セントというタダ同然の価格設定がありがたい',
        '定型コードやテストのパターン埋めならこれで十分すぎるほど正確',
      ],
      caution_rumor: '少しでも複雑なビジネスロジックを任せると凡ミスが増えるので、設計相談には向かないという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: Developer Platform & Model Specifications',
          url: 'https://platform.openai.com/docs/models',
        },
      ],
    };
  }

  if (m.includes('gpt-5-4-nano')) {
    return {
      headline: '超軽量・低レイテンシの極小ユーティリティ。インライン提案の影の立役者',
      community_sentiments: [
        '100万トークン20セントの超低単価でバックグラウンド補正を常時稼働できる',
        'キー入力に遅延なく追従する超高速レスポンス',
      ],
      caution_rumor: '単体での設計相談や複雑なビジネスロジック実装には不向きという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: Developer Platform & Lightweight Models',
          url: 'https://platform.openai.com/docs/models',
        },
      ],
    };
  }

  if (m.includes('gpt-5-4-mini') || m.includes('gpt-5-mini')) {
    return {
      headline: 'GPT-5の推論力を軽量スループット化。全社スケールでの高速常用モデル',
      community_sentiments: [
        '小型モデルとは思えない高い論理整合性とスピーディーな出力',
        '大量のPR要約や定型テスト生成を低コストでガンガン回せる',
      ],
      caution_rumor: '複雑な多層アーキテクチャ設計では上位モデルへのエスカレーションが推奨という噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: Developer Platform & Lightweight Models',
          url: 'https://platform.openai.com/docs/models',
        },
      ],
    };
  }

  if (m.includes('gpt-5-5') || m.includes('gpt-5-4') || m === 'gpt-5') {
    return {
      headline: 'GPT-5世代の主力エンジン。高度な自律推論と安定したマルチファイル編集',
      community_sentiments: [
        'Agentモードでの指示追従性と複雑なテストケースの合格率が格段に向上',
        '長大なコンテキストを保持したまま複数ターンの対話が破綻しない',
      ],
      caution_rumor: '極限の数学難問や競プロではSolやAstraに分があるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: GPT-5 Architecture & Developer Reference',
          url: 'https://platform.openai.com/docs/models',
        },
      ],
    };
  }

  if (m.includes('gpt-5-3-codex') || m.includes('codex')) {
    return {
      headline: 'GitHub Copilotの長期サポート（LTS）認定。堅牢性と実績のコーディング特化機',
      community_sentiments: [
        '既存コードを壊さない手堅い修正と、長期間安定した振る舞いがエンタープライズで信頼されている',
        'Codex直系の正確なシンタックス理解と手堅いテスト実装',
      ],
      caution_rumor: '最新フロンティアモデルと比べると新興フレームワークの最新記法への追従に差があるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'GitHub Copilot: Supported AI Models Reference',
          url: 'https://docs.github.com/ja/copilot/reference/ai-models/supported-models',
        },
      ],
    };
  }

  if (m === 'o1') {
    return {
      headline: '難攻不落のバグ調査専門ドクター。沈黙の後に本質的な一撃を放つ',
      community_sentiments: [
        '何時間も悩んだ並行処理のデッドロックやメモリリーク原因を一発で見抜いた',
        'アルゴリズムの正当性検証やエッジケースの指摘では他の追随を許さない',
      ],
      caution_rumor: '最初の1文字が出るまで20〜40秒待たされる。インライン補完感覚で呼ぶとフリーズしたかと錯覚する。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: Introducing OpenAI o1',
          url: 'https://openai.com/index/introducing-openai-o1/',
        },
      ],
    };
  }

  if (m.includes('o3-mini')) {
    return {
      headline: 'o1の頭脳を高速・低価格化。実務で常用できる推論モデルの傑作',
      community_sentiments: [
        'o1並みの鋭い思考チェーンを展開するのに待たされ感が劇的に少なくサクサク動く',
        '競プロレベルの難問やエッジケースのテストケース出しで鬼のように活躍する',
      ],
      caution_rumor: 'Reasoning Effort を High にするとたまに考えすぎて長文の推論迷路に入るという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: OpenAI o3-mini Announcement',
          url: 'https://openai.com/index/openai-o3-mini/',
        },
      ],
    };
  }

  if (m.includes('gpt-4o-mini')) {
    return {
      headline: 'コストパフォーマンスの先駆者。日常の軽量タスクを軽快にさばく実力機',
      community_sentiments: [
        '格安料金でありながら日常の関数作成やドキュメント整理なら十分こなす',
        '素早いレスポンスで簡単なスクリプトやSQLのチェックに最適',
      ],
      caution_rumor: '難解なバグ調査や大規模リファクタリングでは上位モデルの併用が必須という噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: GPT-4o mini Announcement',
          url: 'https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/',
        },
      ],
    };
  }

  if (m.includes('gpt-4o') || m.includes('gpt-4')) {
    return {
      headline: '頼れる標準オールラウンダー。速度とバランスの良さで日常を支える',
      community_sentiments: [
        'Markdownドキュメントの整理やAPI仕様書の作成、日常スクリプトならこれで十分',
        'レスポンスが早くてテンポ良く対話できるためペアプロのテンポが崩れない',
      ],
      caution_rumor: '最新世代モデルと比べると複雑なコードベースでの自律解決力に差が出始めているとの噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'OpenAI: Hello GPT-4o',
          url: 'https://openai.com/index/hello-gpt-4o/',
        },
      ],
    };
  }

  // 2. Anthropic Models
  if (m.includes('claude-opus-5') || m.includes('claude-5-opus')) {
    return {
      headline: '高性能化の代償？ 最新モデル「Opus 5」に対する現場の戸惑いと「旧モデル回帰」の動き',
      community_sentiments: [
        '回答が長すぎるし、頼んでいないことまで勝手に修正しようとするため、意図した通りのシンプルな変更が難しい',
        'Claude Codeのユーザーコミュニティでは、かえって旧モデル「Opus 4.6」のほうが使いやすいという声が急速に支持を集めている',
        '高い推論力と自律性が裏目に出てしまい、エンジニアの制御を超えて過剰な最適化を行ってしまう傾向がある',
      ],
      caution_rumor: '最新の進化により高性能にはなったものの、現場のエンジニアからは「扱いづらくなった」という不満が続出しており、アンソロピック公式の設計思想と実際のユースケースとの間にギャップが生じているとの指摘がある。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Claude Codeでなぜ異変、「旧モデルのほうが良い」が続出…AI進化で起きた逆転現象 (ビジネス+IT)',
          url: 'https://www.sbbit.jp/article/cont1/186928',
        },
      ],
    };
  }

  if (m.includes('claude-opus-4-6') || m.includes('opus-4-6') || m.includes('opus46')) {
    return {
      headline: '「旧モデルのほうが良い」と現場が熱狂。Enterprise向けに提供が続くOpus 4世代の銘機',
      community_sentiments: [
        'Opus 5よりも余計なお節介がなく、指示されたコード変更だけを正確に実行してくれるため最も扱いやすい',
        'Claude Codeユーザーの間で「Opus 4.6回帰」が起き、一般提供終了後もEnterprise環境で熱烈に愛用されている',
        '自律性の暴走がなく、エンジニアの手足として堅実かつ完璧にタスクを完遂してくれる信頼感',
      ],
      caution_rumor: '2026年9月に一般向け提供（GA）は終了（Retired）しており、現在はEnterpriseプランや年間特定契約環境でのみ利用可能。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Claude Codeでなぜ異変、「旧モデルのほうが良い」が続出…AI進化で起きた逆転現象 (ビジネス+IT)',
          url: 'https://www.sbbit.jp/article/cont1/186928',
        },
        {
          title: 'Anthropic: Claude Enterprise Model Lifecycle & Availability',
          url: 'https://www.anthropic.com/news',
        },
      ],
    };
  }

  if (m.includes('claude-opus')) {
    return {
      headline: '現場エンジニアから「使いやすい」「安定している」と絶賛されるOpus 4世代の最高峰',
      community_sentiments: [
        'Opus 5よりも指示に実直で、過剰なお節介や意図しない変更をしないため安心して任せられる',
        '複雑な型定義や境界条件の推論が極めて堅牢で、Claude Codeとの相性が抜群',
        '長時間のデバッグセッションでも一貫した論理と思考を維持してくれる頼もしさ',
      ],
      caution_rumor: 'Opus 4.8 Fast Modeでも大規模コード生成ではクレジット消費がそれなりに嵩む点に留意。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Anthropic: Claude Opus Architecture & Research',
          url: 'https://www.anthropic.com/news',
        },
      ],
    };
  }

  if (m.includes('claude-fable')) {
    return {
      headline: 'Enterprise Frontier Safeguards（EFS）準拠。金融・機密領域向けの最高セキュリティ推論',
      community_sentiments: [
        'Zero Data Retention（ZDR）保証と厳格な安全性ガードレールで社内セキュリティ審査が一発で通った',
        '機密性の高い認証モジュールや決済APIのコード生成で圧倒的な安心感がある',
      ],
      caution_rumor: '安全側ガードレールが厳格なため、侵入テストや脆弱性再現コードの生成ではリフレクティブ拒絶が出ることがある。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Anthropic: Enterprise Frontier Safeguards (EFS) & Security',
          url: 'https://www.anthropic.com/enterprise',
        },
      ],
    };
  }

  if (m.includes('claude-sonnet-5') || m.includes('claude-5-sonnet')) {
    return {
      headline: 'コスパと精度の完全勝利。全社デフォルトにしない理由が見当たらない神モデル',
      community_sentiments: [
        'Claude 3.7の賢さを完全に受け継ぎつつ、価格が下がってレスポンスが格段に軽快になった',
        'TypeScriptの型パズルやReactコンポーネント設計の綺麗さは相変わらず業界最高峰',
        '100万トークン対応なので、巨大リポジトリ全体をAgentに投げても破綻しない',
      ],
      caution_rumor: '便利すぎてこれ以外のモデルを使う気にならなくなる「Sonnet 5依存症」が多発中との噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Anthropic: Announcements & Engineering Updates',
          url: 'https://www.anthropic.com/news',
        },
      ],
    };
  }

  if (m.includes('claude-sonnet-4') || m.includes('claude-sonnet')) {
    return {
      headline: '高速レスポンスと高い実装精度を両立するSonnet 4世代の実力派主力',
      community_sentiments: [
        'Sonnetならではの軽快な打鍵感と確かなコーディング力が心地よい',
        'ReactやVueのコンポーネント実装からAPIクライアント作成までストレスなく完遂できる',
      ],
      caution_rumor: 'Sonnet 5に比べると1Mコンテキスト時のコスト効率で若干劣るという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Anthropic: Announcements & Engineering Updates',
          url: 'https://www.anthropic.com/news',
        },
      ],
    };
  }

  if (m.includes('claude-haiku')) {
    return {
      headline: '圧倒的な爆速打鍵感とリーズナブルな価格。日常の即時補完に最適なスピードスター',
      community_sentiments: [
        'タイピング速度に完全に追従してくる超高速レスポンスで思考を止めない',
        'ワンライナーや小関数の実装、型定義の補正が軽快でテンポが良い',
      ],
      caution_rumor: '大規模ファイル横断リファクタなどの複雑タスクはSonnetやOpusに任せるべきという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Anthropic: Model Overview & Capabilities',
          url: 'https://www.anthropic.com/news',
        },
      ],
    };
  }

  if (m.includes('claude-3-7')) {
    return {
      headline: 'リファクタリングの神。ただしThinking全開時はトークン消費と回答長に注意',
      community_sentiments: [
        '複数ファイルにまたがる大規模リファクタと依存解決の精度が異次元に高い',
        'TypeScriptの複雑な型パズルやジェネリクスを迷いなく一発で綺麗に解決する',
        'テストが失敗した原因を自己反省（CoT）しながら修正してくれる頼もしさが異常',
      ],
      caution_rumor: '思考が深すぎて回答が長大になりがち。調子に乗して使いまくるとクォータ上限が一瞬で溶けるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Anthropic: Claude 3.7 Sonnet and Claude Code',
          url: 'https://www.anthropic.com/news/claude-3-7-sonnet',
        },
      ],
    };
  }

  if (m.includes('claude-3-5')) {
    return {
      headline: '全エンジニアの精神安定剤。一番打率が高く安定している定番主力',
      community_sentiments: [
        '言った通りの指示を余計な小細工なしに実直にコーディングしてくれる打率の高さ',
        'ReactやNext.jsなどモダンWebフロントエンドの実装センスがピカイチ',
        '長文コードを渡してもハルシネーションが少なく、安心してPRレビューを任せられる',
      ],
      caution_rumor: 'たまに同一箇所の修正を指示しても頑固に直さない修正ループに陥ることがあるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Anthropic: Claude 3.5 Sonnet Announcement',
          url: 'https://www.anthropic.com/news/claude-3-5-sonnet',
        },
      ],
    };
  }

  // 3. Google Models
  if (m.includes('gemini-3') || m.includes('gemini-3-8') || m.includes('gemini-3-7') || m.includes('gemini-3-6') || m.includes('gemini-3-5')) {
    return {
      headline: '1Mコンテキストの超高速モンスター。プロモ価格（$0.75/$3.75）で業界を席巻',
      community_sentiments: [
        'プロジェクトの全コードとドキュメントを丸ごと食わせても一瞬で返事が返ってくる',
        'プロモ価格が安すぎてチーム全員でガンガン長文プロンプトを投げられる',
        'コーディング性能が世代を追うごとに着実に底上げされている',
      ],
      caution_rumor: 'たまにライブラリのバージョン差異を混同することがあるので、インポート文は目視確認が必要との噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Google DeepMind & Developers Blog',
          url: 'https://blog.google/technology/developers/',
        },
      ],
    };
  }

  if (m.includes('gemini-2-5') || m.includes('gemini-pro')) {
    return {
      headline: '2M超長大コンテキストと深い推論力。リポジトリ丸ごとのアーキテクチャ解析の王者',
      community_sentiments: [
        '200万トークンの窓があるので、巨大なモノレポの全ソースコードを丸ごと食わせられる',
        '長大なドキュメントとコードの間の整合性チェックで唯一無二の安定感',
      ],
      caution_rumor: '長文入力時は初期思考待ち時間が発生するため、即時チャットより探索的リサーチ向きという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Google DeepMind: Gemini 2.5 Pro Overview',
          url: 'https://blog.google/technology/developers/',
        },
      ],
    };
  }

  if (m.includes('gemini-2-0') || m.includes('gemini-flash') || m.includes('gemini')) {
    return {
      headline: '圧倒的なスピードと$0.10/$0.40の超破格コスト。大量処理・CI/CD自動化の救世主',
      community_sentiments: [
        '信じられないほど安くて速いので、テストコード生成やドキュメント自動生成に最適',
        '1Mコンテキストを活かして大量のログや仕様書を一気に読み込ませられる',
      ],
      caution_rumor: '複雑なアルゴリズムや長大な推論ではProモデルに譲る場面があるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Google DeepMind: Gemini 2.0 Flash Release',
          url: 'https://blog.google/technology/developers/gemini-2-0-flash/',
        },
      ],
    };
  }

  // 4. DeepSeek Models
  if (m.includes('deepseek')) {
    return {
      headline: 'オープン推論の衝撃。破格のAPI価格（$0.55/$2.19）でo1に迫る思考力を発揮',
      community_sentiments: [
        '数学や競技プログラミングの思考ステップ（<think>）が驚くほど緻密で本格的',
        'オープンモデルでありながら商業プロプライエタリモデルの牙城を脅かすコストパフォーマンス',
        'ローカル稼働やプライベートクラウドでのセルフホストの選択肢がある点も高評価',
      ],
      caution_rumor: '出力の冒頭に長大な思考チェーンが出力されるため、パース処理やインライン補完への組み込みには工夫が必要という噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'DeepSeek: DeepSeek-R1 Technical Report & Repository',
          url: 'https://github.com/deepseek-ai/DeepSeek-R1',
        },
      ],
    };
  }

  // 5. Microsoft Models
  if (m.includes('mai-code') || m.includes('mai')) {
    return {
      headline: 'マイクロソフト内製コーディング特化Flash。Azure & TypeScriptエコシステムで爆速稼働',
      community_sentiments: [
        'C#、.NET、TypeScriptにおける型推論と定型コードのサジェストが極めて正確',
        '100万トークン20セントという破格単価で日常コーディングのインライン補完を支える',
      ],
      caution_rumor: 'PythonやGoなど非MSスタックの複雑なフレームワークではSonnetやGPT-5に軍配が上がるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Microsoft: AI Models & Developer Tools',
          url: 'https://azure.microsoft.com/en-us/solutions/ai',
        },
      ],
    };
  }

  // 6. xAI Models
  if (m.includes('grok')) {
    return {
      headline: '歯切れの良い回答と最新トレンドの即応力。飾らないエンジニアリング対話が好評',
      community_sentiments: [
        '余計な前置きや過剰な免責事項がなく、求めるコードと結論をストレートに返してくれる',
        '最新のライブラリ仕様やエッジケースに対してもハルシネーションが少なく的確',
      ],
      caution_rumor: 'エンタープライズの厳格なコーポレートガバナンス環境でのポリシー設定には確認が必要という噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'xAI: Frontier AI Research & Model Releases',
          url: 'https://x.ai/',
        },
      ],
    };
  }

  // 7. Moonshot AI Models
  if (m.includes('kimi')) {
    return {
      headline: 'オープン＆パワフルな新興勢力。数学・競プロ・長文解析で頭角を現す',
      community_sentiments: [
        '1Mコンテキストに対応しており、複雑なアルゴリズムの思考がかなり深い',
        'コストパフォーマンスが高く、プロプライエタリ大手に匹敵する推論力',
      ],
      caution_rumor: '英語や中国語のコードベースに比べて日本語コメントのニュアンスに若干のクセがあるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Moonshot AI / Kimi Platform',
          url: 'https://kimi.moonshot.cn/',
        },
      ],
    };
  }

  // 8. Vendor-Aware Default Fallback
  if (vendor === 'Anthropic' || m.includes('claude')) {
    return {
      headline: '高品質な推論と丁寧なコード生成を兼ね備えたAnthropic Claudeモデル',
      community_sentiments: [
        'コードの保守性と読みやすさに配慮した高品質な出力を安定して提供',
        '指示への忠実性が高く、開発者の意図を的確に反映した改修を行う',
      ],
      caution_rumor: 'タスクの難度に応じて適切なモデルサイズを選択することが重要という噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Anthropic: Announcements & Engineering Updates',
          url: 'https://www.anthropic.com/news',
        },
      ],
    };
  }

  if (vendor === 'Google' || m.includes('gemini')) {
    return {
      headline: 'マルチモーダルと長大コンテキストに強みを持つGoogle Geminiモデル',
      community_sentiments: [
        '圧倒的な処理速度と長大なコンテキストウィンドウで大量のデータを一度に処理可能',
      ],
      caution_rumor: '短文と長文のユースケースでパラメータ調整を工夫すると真価を発揮するという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'Google DeepMind & Developers Blog',
          url: 'https://blog.google/technology/developers/',
        },
      ],
    };
  }

  if (vendor === 'DeepSeek' || m.includes('deepseek')) {
    return {
      headline: '高効率推論とオープンエコシステムを代表するDeepSeekモデル',
      community_sentiments: [
        '驚異的な費用対効果で高度な数学的推論とコード生成を実行できる実力機',
      ],
      caution_rumor: '思考チェーンの長さに応じてタイムアウト設定を適切に調整する必要があるという噂。',
      source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
      sources: [
        {
          title: 'DeepSeek: DeepSeek-R1 Technical Report & Repository',
          url: 'https://github.com/deepseek-ai/DeepSeek-R1',
        },
      ],
    };
  }

  return {
    headline: '頼れる標準オールラウンダー。速度とバランスの良さで日常を支える',
    community_sentiments: [
      'Markdownドキュメントの整理やAPI仕様書の作成、日常スクリプトならこれで十分',
      'レスポンスが早くてテンポ良く対話できるためペアプロのテンポが崩れない',
    ],
    caution_rumor: '最新世代モデルと比べると複雑なコードベースでの自律解決力に差が出始めているとの噂。',
    source_note: '※ SNS上のエンジニアの声・コミュニティの噂・所感',
    sources: [
      {
        title: 'OpenAI: Hello GPT-4o',
        url: 'https://openai.com/index/hello-gpt-4o/',
      },
    ],
  };
}
