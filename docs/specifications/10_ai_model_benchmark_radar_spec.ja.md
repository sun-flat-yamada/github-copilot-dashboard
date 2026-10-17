[English](10_ai_model_benchmark_radar_spec.md) | [日本語](10_ai_model_benchmark_radar_spec.ja.md)

---

# SDD-10: AIモデル特性レーダー & 著名ベンチマーク評価 仕様書 (AI Model Benchmark Radar Spec)

- **文書番号**: SPEC-COPILOT-010
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.10-LTS
- **作成日**: 2026-09-12
- **更新日**: 2026-10-13 (ベンチマーク出典の入れ替え、Issue #321)

---

## 1. 概要と目的

GitHub Copilot Analytics Dashboard の副機能（サブシステム）として、利用可能な各 AI モデルの技術的特性・強みを 6 軸レーダーチャートで視覚化し、実務における最適モデルの選定や使い分けを支援する「**AIモデル特性レーダー (AI Model Radar & Benchmark)**」を規定する。

GitHub Copilot 公式ドキュメントに準拠し、公式サポートモデル（OpenAI, Anthropic, Google, Microsoft, xAI, Moonshot AI）を完全網羅するとともに、各モデルの **コンテキスト長（通常窓・1M対応）** および **コスト単価（Input / Output / Prompt Caching / Long Context 単価）** を掲載する。さらに公式ドキュメント（[supported-models](https://docs.github.com/ja/copilot/reference/ai-models/supported-models) および [models-and-pricing](https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing)）への引用リンクを参考情報として常時掲載する。Long Context 単価の表示しきい値はモデルの `long_context_threshold_k` (未設定時は 200K) を使う。

現行の著名ベンチマーク指標（Terminal-Bench 4.0, Artificial Analysis Intelligence Index v4.3, Arena Code Arena | WebDev, Artificial Analysis の速度実測, 公式価格）を取り込み、自動的に 0〜100 の正規化スコアおよび特性タグ・推奨ユースケース・利用指針・リアルなエンジニアの声（※ SNSの噂注釈付き）を判定・提示する。

---

## 2. アーキテクチャと配置

### 2.1 ダッシュボード統合方式
- **分析ビュー (`AnalysisViewId`)**:
  - `model_radar`: **AIモデル特性レーダー & ベンチマーク評価ビュー**
- **ナビゲーション**:
  - ナビゲーションバーの `ViewNavigation` よりワンクリックで切り替え。
  - 「ユーザー別モデル推移 (UserTrendViewer)」の各モデル凡例や関連ウィジェットからもダイレクトジャンプ可能。

### 2.2 データフロー
```mermaid
flowchart TD
    subgraph Sources["著名ベンチマークソース"]
        TB["Terminal-Bench 4.0 (agent + model resolution rate)"]
        AAI["Artificial Analysis Intelligence Index v4.3"]
        Arena["Arena Code Arena | WebDev (Elo)"]
        AA["Artificial Analysis (TPS, TTFT)"]
    end

    subgraph Evaluator["判定エンジン (src/processor/benchmark-evaluator.ts)"]
        Norm["6軸正規化アルゴリズム (0 - 100)"]
        Tag["適正タグ導出 & 総合グレード判定"]
        Guide["Copilot 実務活用ガイド生成"]
    end

    subgraph Storage["データセット (dashboard/public/data/model-benchmarks.json)"]
        JSON["JSON データセット (v2026.10)"]
    end

    subgraph UI["フロントエンド (dashboard/src/components/ModelRadarView.tsx)"]
        Chart["Recharts レーダーチャート (最大4モデル重畳)"]
        Cards["モデル特性判定カード & ガイダンス"]
        Table["ベンチマーク生データ詳細テーブル (ソート対応)"]
        Preset["比較プリセット (Copilot 4大 / 実用高コスパ / 推論特化 / 高速等)"]
    end

    Sources --> Evaluator
    Evaluator --> Storage
    Storage --> UI
```

### 2.3 保持ナレッジモデル全件選択・未利用モデル0%表示仕様
- **ナレッジモデル一覧の永続保持**:
  - 分析対象データ（自動定期収集データや Monthly Usage Report CSV）内に特定の AI モデルの利用実績が存在しない場合であっても、システムがナレッジとして保持する全モデル（Copilot 公式提供モデル＋比較対照モデル）は **一切除外されることなく、モデル選択チップス・プリセット・詳細比較テーブルのすべてで常時選択・表示可能** とする。
- **未利用モデルの 0% 表示**:
  - 分析対象データ内に利用リクエストがないモデルは、社内利用シェアを **`0%`（0 req）** として表示する。
  - フォーカス中モデル詳細カードにおいて「社内利用なし (0%) / 導入・切替検討ナレッジ」のステータスバッジおよびガイダンスを提示し、組織内での採用検討やモデル切り替えのためのベンチマーク・特性評価ナレッジとして参照可能とする。
- **名寄せ正規化 (`normalizeModelId`)**:
  - ログやCSVデータ上の表記揺れ（例: `Claude 3.7 Sonnet`, `GPT-4o mini`, `o1 (推論)`, `Gemini 2.0 Flash` 等）を共通のナレッジモデルID（`claude-3-7-sonnet`, `gpt-4o-mini`, `o1`, `gemini-2-0-flash` 等）へ堅牢にマッピングする。
- **タグ/スコープ絞り込みとの連動 (`利用割合 (%)` 再集計)**:
  - Tag フィルターやスコープ（対象月・組織等）を変更した場合、各モデルの利用実績・利用割合 (%) は必ずその時点の「アクティブ選択されている分析対象データ」のみを基に再集計される（[SDD-01 FR-9](01_requirements_specification.ja.md) / [SDD-15 データセントリック・リアクティビティ設計仕様書](15_data_centric_reactivity_design_spec.ja.md) の適用例）。
  - **自動定期収集データ**: ユーザーごとのモデル別リクエスト数 (`model_usage_totals`) を保持するため、タグ AND フィルター適用後のユーザー集合から厳密に再集計する。
  - **Monthly Usage Report / アップロードデータ**: ユーザー明細には主要モデル (`primary_model`) のみが保持され、ユーザー単位のモデル別内訳は保持されないため、タグ絞り込み時は各ユーザーの総リクエスト数を `primary_model` へ全量按分計上する近似値として `model_breakdown` を再集計する。タグ未選択時（全ユーザー対象）はパース時点の厳密な集計値をそのまま使用する。

### 2.4 モデル詳細カードのクイック切り替えナビゲーション仕様
- **最上部 2 段構成配置 (全幅レイアウト)**:
  - 「詳細カード切り替え:」セレクタは、詳細カードウィジェット最上部（モデル名・総合グレードヘッダーの直上）に配置する。
  - 上段に「詳細カード切り替え:」ラベルおよび位置インデックスカウンター（例: `1 / 4`）を配し、下段にウィジェット全幅を活用したモデルセレクタ（左右移動ボタンと幅広プルダウン）を展開する 2 段改行レイアウトを採用。モデル名が長い場合でも意図しない折り返し（レイアウト崩れ）を防ぎ、全幅を活用した高い視認性を担保する。
- **左右移動ナビゲーション**:
  - 複数モデルが選択されている場合、前後のモデルへ手軽にステップ移動できる左右ボタン（`<` / `>`）を提供する。
  - 単一モデル選択時は無効化（disabled）され、不要な誤操作を防止する。
- **モデル名プルダウン選択**:
  - モデル名表示部をクリックすることで、現在選択中のモデル一覧をドロップダウン（プルダウン）で展開し、任意のモデルへワンクリックでジャンプ可能とする。
  - プルダウン内には各モデルのテーマカラー・モデル名・Tier・総合グレードおよび現在選択中のチェックマークを表示する。
- **未選択時の非表示・空状態制御**:
  - モデルが1件も選択されていない場合（`selectedModels.length === 0` または `!focusedModel`）、6軸多次元特性マップと同様に詳細カード領域全体をプレースホルダー空状態（パルスアイコン・ガイダンス案内・「Copilot公式モデルを選択」ボタン）へ切り替え、未選択モデルの誤表示を防止する。

### 2.5 比較プリセット仕様 (`PRESETS`)
多様なモデルの中から目的や関心に応じて素早く抽出・比較できるよう、標準プリセットを提供する。用途別推奨プリセット（コードレビュー、コードベース分析、設計）は最高水準の品質ゲートとコストバリエーションを両立し、新世代の `Claude Opus 5.5` も加えた強力な比較構成となっている。また、GPT系モデルについては標準比較用として安定したGPT-5系同等モデル（GPT-5.5 / GPT-5.4 / GPT-5 mini）を採用しつつ、卓越した低コスト性能を誇る `GPT-5.6 Luna` は高コスパ・低コストプリセットにて継続維持する。

#### 用途別推奨プリセット
- **🔍 コードレビュー利用に推奨 (`recommended-code-review`)**:
  - **選定根拠**: PR差分における潜在バグ・エッジケースの見落としを防ぐため、最高水準の推論・SWE性能モデルを選定。最上位推論として `Claude Opus 5.5` / `Claude Opus 5` を維持し、高いコード解析力を持つ `GPT-6 Sol` および `GPT-5.6 Terra` を追加。
  - **構成モデル (6選)**:
    1. **Next-Gen Frontier (最新最高峰レビュー)**: `Claude Opus 5.5` (In: $4.0, Out: $20.0 / TB4 64.85)
    2. **High-End (最上位深層レビュー)**: `Claude Opus 5` (In: $5.0, Out: $25.0 / TB4 53.94)
    3. **Powerful Sol (高推論・高速精密レビュー)**: `GPT-6 Sol` (In: $2.0, Out: $10.0 / TB4 49.39)
    4. **Balanced (実務標準・高精度バランス)**: `Claude Sonnet 5` (In: $2.0, Out: $10.0 / TB4 12.42)
    5. **Versatile Terra (実務バランス・堅牢差分解析)**: `GPT-5.6 Terra` (In: $2.0, Out: $12.0 / TB4 21.52)
    6. **High-Value (高コスパ即時レビュー)**: `Gemini 3.8 Flash` (In: $0.75, Out: $3.75 / TB4 19.09)
- **📂 コードベース分析に推奨 (`recommended-codebase-analysis`)**:
  - **選定根拠**: リポジトリ全体・複数ディレクトリの依存関係と設計を丸ごと把握するため、100万トークン対応かつ高SWE性能モデルを選定。最高峰の `Claude Opus 5.5` / `Claude Opus 5` に加え、長文100万トークン対応フラッグシップ `GPT-6 Astra` を追加。
  - **構成モデル (5選)**:
    1. **Premier Flagship (最上位極限推論・1M長文全体解析)**: `GPT-6 Astra` (In: $10.0, Out: $50.0 / 1M窓, TB4 58.18)
    2. **Next-Gen Frontier (最新1M超長文・最高峰解析)**: `Claude Opus 5.5` (In: $4.0, Out: $20.0 / 1M窓, TB4 64.85)
    3. **High-End (1M超長文・最高峰解析)**: `Claude Opus 5` (In: $5.0, Out: $25.0 / 1M窓, TB4 53.94)
    4. **Balanced (1M超長文・設計リファクタ標準)**: `Claude Sonnet 5` (In: $2.0, Out: $10.0 / 1M窓, TB4 12.42)
    5. **High-Value (1M超長文・大量コード低コスト一括解析)**: `Gemini 3.8 Flash` (In: $0.75, Out: $3.75 / 1M窓, TB4 19.09)
- **🏛️ 設計に推奨 (`recommended-architecture`)**:
  - **選定根拠**: 高度なシステム設計、アーキテクチャ選定、データモデル策定、トレードオフ分析のため、極限論理推論と設計性能を持つモデル群。新世代フラッグシップ `Claude Opus 5.5` および確立された実績を持つ `Claude Opus 5` を追加・維持。
  - **構成モデル (5選)**:
    1. **Premier Flagship (最上位極限推論・高難度アーキテクチャ)**: `GPT-6 Astra` (In: $10.0, Out: $50.0 / AA 53, TB4 58.18)
    2. **Next-Gen Frontier (最新最高峰推論・制御性向上)**: `Claude Opus 5.5` (In: $4.0, Out: $20.0 / AA 58, TB4 64.85)
    3. **High-End (確立された最高峰推論・大局的設計)**: `Claude Opus 5` (In: $5.0, Out: $25.0 / AA 51, TB4 53.94)
    4. **Balanced (実務アーキテクチャ・モジュール構造化)**: `Claude Sonnet 5` (In: $2.0, Out: $10.0 / AA 38, TB4 12.42)
    5. **High-Value (高コスパ・高速設計壁打ち＆比較)**: `Gemini 3.8 Flash` (In: $0.75, Out: $3.75 / AA 41, TB4 19.09)

#### カテゴリ・メーカー別標準プリセット
- **🌟 2026 旗艦選 (`flagship-2026`)**: 2026年各社最前線フラッグシップスナップショット（Claude Opus 5.5 / Claude Opus 5 / GPT-6 Astra / Gemini 4 Argon / Kimi K3）。
- **💡 実用性能で高コスパ (`practical-high-value`)**: 実用コーディング性能と抜群の費用対効果を両立（Claude Sonnet 5 / Gemini 3.8 Flash / GPT-6 Luna / GPT-5.6 Luna / Kimi K2.7 Code） ※高コスパ代表として GPT-6 Luna および GPT-5.6 Luna を維持・追加。
- **⚡ Powerful (最上位推論) (`tier-powerful`)**: 最高峰コーディング・推論群（GPT-6 Astra / Claude Opus 5.5 / Claude Opus 5 / GPT-6 Sol / Gemini 4 Argon / Kimi K3） ※GPT-6 Sol および Gemini 4 Argon を追加、GPT-5.5 を整理。
- **🛠️ Versatile (実務バランス) (`tier-versatile`)**: 標準実務・俊敏性重視（Claude Sonnet 5 / GPT-5.6 Terra / Gemini 3.8 Flash / Grok 4.6） ※GPT-5.6 Terra を追加し、GPT-5.4 を整理。
- **🚀 Lightweight (超高速・低コスト) (`tier-lightweight`)**: 日常インライン・超高速補完（GPT-6 Luna / GPT-5.6 Luna / Gemini 3.5 Flash / MAI-Code-1.1-Flash / GPT-5.4 mini） ※超高速・低コスト代表として GPT-6 Luna を追加、GPT-5.6 Luna を維持。
- **🟠 Anthropic 主力 (`vendor-anthropic`)**: Anthropic 2026最新（Claude Sonnet 5 / Claude Opus 5.5 / Claude Opus 5 / Claude Fable 5.1 / Claude Haiku 4.5） ※Opus 5.5 を追加。
- **🟢 OpenAI 主力 (`vendor-openai`)**: OpenAI 主力ラインナップ（GPT-6 Astra / GPT-6 Sol / GPT-5.6 Sol） ※GPT-6 Sol および GPT-5.6 Sol を追加し、旧世代（GPT-5.5 / GPT-5.4 / GPT-5 mini）を整理。
- **🔵 Google Gemini (`vendor-google`)**: Google 最新モデル（Gemini 4 Argon / Gemini 3.8 Flash / Gemini 3.7 Flash / Gemini 3.6 Flash / Gemini 3.5 Flash）

### 2.6 モデル比較チャート: レーダーチャート
6 軸の比較は**レーダーチャート**（recharts `RadarChart`、0〜100、選択モデルごとに 1 多角形）で描く。アクティブ（フォーカス中）モデルは最前面の太い実線（穏やかな点滅）、その他の選択モデルは低不透明度の点線。多角形または凡例ボタンのクリックで `focusedModelId` が切り替わり、詳細カードが連動する。P3-7 で導入したドットプロット（`ModelDotPlot`）は取り消した。生値はベンチマーク表とツールチップで引き続き読める。

### 2.7 6軸評価基準クイックリファレンスと他ウィジェット連携リンク仕様
- **目的・役割の明示**:
  - レーダーチャート下部に配置された「6軸評価基準 & 実測ベンチマーク対応」エリアは、各評価軸（`shortLabel`）と算出根拠となる実測メトリクス（`primaryMetric`）の対応関係および配分比重（`weight`）を示すクイックリファレンス。
  - 静的なラベルテキストではなく、他ウィジェットへのナビゲーションの起点となるインタラクティブ操作カードとして機能させる。
- **実測テーブル（#radar-table）とのソート連動**:
  - 各軸カードをクリック（または「実測テーブルソート ↓」をクリック）すると、ページ下部の「04 著名ベンチマーク最新実測データ詳細テーブル」へスムーズスクロールし、該当する評価指標（`terminal`, `intelligence`, `arena`, `speed`, `cost`, `context`）の降順ソートが自動適用される。
- **出典解説（#radar-sources）へのジャンプとハイライト発光**:
  - 各軸カード内の「出典解説 ↗」ボタンをクリックすると、「05 著名ベンチマーク出典の設計背景・現場での見え方」内の対応する出典カード（`#source-terminal-bench-4`, `#source-aa-intelligence-index`, `#source-arena-webdev`, `#source-artificial-analysis`）へスムーズスクロールし、対象カードをリング＆シャドウ（インジゴ発光）で3秒間強調表示する。

### 2.8 AIモデル選択の画面左側フレーム配置 & 3段階表示切り替え仕様
- **画面左側フレームへの配置 & 画面追従 (`sticky`)**:
  - 「AIモデル選択」コンポーネントを上部概要カード内から画面左側の独立フレーム（`ModelSelectorSidebar`）へ配置。
  - `sticky top-28` によるナビゲーションバー直下のスクロール追従およびフレーム内独立スクロール（`max-h-[calc(100vh-7.5rem)] overflow-y-auto`）を採用し、ユーザーが画面右側の各分析ウィジェット（6軸レーダーマップ、詳細カード、ベンチマーク実測テーブル、出典解説、公式リファレンス）を閲覧・スクロールしながら、その場でリアルタイムにモデル選択を切り替え可能とする。
- **画面レイアウトの排他的幅専有 (`flex-row`)**:
  - AIモデル選択ペインと右側メインエリア（各分析ウィジェット）は常に `flex-row items-start` で横並びに配置され、ペインが表示されている領域の幅（通常表示: 約320px、省幅表示: 約220px、非表示: アイコン幅）は本体表示側が使えないように排他制御。
  - 画面幅に関わらず本体コンテンツ（レーダーチャートやテーブル等）がペインの下に潜り込んだり重複して描画されることを構造上防止。
- **3段階の表示モード切り替え (`sidebarMode`)**:
  - **表示 (`expanded`)【デフォルト】**:
    - 通常幅（約 320px）。モデルのフル名称、モデルカラー、Copilotバッジ、組織内利用シェア%、選択チェックマークを完備。
    - メーカー別/Tier別グルーピング切り替え、メーカー絞り込み、Tier絞り込み、Copilot公式全選択、選択クリア、比較プリセットクイックメニューを提供。
  - **省幅表示 (`compact`)**:
    - 省幅（約 210px〜220px）。AIモデル略称（モデル派閥とバージョン番号を省略せず保持。例: `gpt-5.6-luna`, `gpt-6-astra`, `gpt-o1`, `gpt-o3-mini`, `opus-5`, `opus-4.8`, `sonnet-4.6`, `gemini-3.8-flash` 等、`getModelShortName` による標準略称形）でコンパクトに表示。
    - ヘッダー右端の表示モード切替ボタン群（表示・省幅）はテキストラベル（「表示」「省幅」）を非表示としてアイコン単独表示（`p-1`）に切り替え、幅狭コンテナによる「表」「示」「省」「幅」の1文字ずつ改行レイアウト崩れを完全に防止。通常表示時（`expanded`）も `whitespace-nowrap` により不要な改行を防止。
    - マウスホバー時にフル名称、ベンダー、Tier、総合スコア、組織内利用シェア%をツールチップ表示。
  - **非表示 (`collapsed`)**:
    - 左側フレームを折りたたみ、画面幅を最大限ウィジェット表示に開放。余分なテキストラベルやサブボタンを排除し、**AIモデルアイコン（Boxes）と展開ボタンアイコン（PanelLeftOpen）のみ**にコンパクト化された常駐ボタンから1クリックで直感的に復帰可能。選択モデル数が存在する場合はミニバッジで件数を表示。
- **選択状態・アクション仕様**:
  - **デフォルト初期選択**: 組織内・分析対象データで実際に利用実績（リクエスト数 > 0）のある上位Top 3モデル（`getTopUsageModelIds`）を降順で自動選択。
  - **利用データなし時のハンドリング**: 利用実績データが空または全モデル0件の場合は未選択（`selectedModelIds = []`）として起動し、レーダーチャート領域に分かりやすいガイダンスと「Copilot公式モデルを選択」ボタンを表示。
  - **クリア処理**: サイドバー最上部の「クリア」ボタン押下時は、全モデルの選択をクリア（`selectedModelIds = []`）。
  - **メーカー/カテゴリ別「全選択 / 全解除」**: 各メーカー（Anthropic, OpenAI, Google等）およびTier（Powerful, Versatile, Lightweight）の見出しにある「全選択 / 全解除」ボタンを押下した際、該当グループ内の全モデルを即座に一括追加または一括解除（`onBatchSelectModels`）。
- **設定の永続化**:
  - 選択した表示モード（`expanded` / `compact` / `collapsed`）はブラウザの `localStorage`（キー: `copilot_radar_sidebar_mode`）に自動保存され、ページ再読み込み時も維持される。

### 2.9 著名ベンチマーク最新実測データ詳細テーブルの左右スクロール操作性とモデル名列固定仕様
ユーザー明細 (`UserDetailTable`) と同等の左右スクロール操作性および列固定仕様を提供し、狭い画面や多数の列でもモデルと指標の対応関係を直感的に把握可能とする。

- **操作UIコンポーネント**:
  - **上部左右スクロールナビゲーションボタン**:
    - 表示件数バッジの右側に左右スクロールボタン（`ChevronLeft`, `ChevronRight`）を常設。
    - 端に到達している場合は自動的に disabled（薄暗表示）となり、クリック時はスムーズに水平スクロール（280px単位）が動作。
  - **画面下部追従型 水平スクロールコントローラー (Sticky Bottom Bar)**:
    - 水平スクロールが必要な場合（`scrollWidth > clientWidth`）のみ、テーブルカード最下部に追従（sticky）する半透明ブラーバーを表示。
    - 「横スクロール」パーセンテージ（0〜100%）、インタラクティブなレンジスライダー（ドラッグ・クリックで任意位置へ即時移動）、および左右スクロールボタンを配置。
    - z-index は `z-20` とし、メインエリア内部の行セル（`z-10`）より上、かつサイドバーより背面に収まるよう調整。
- **Stacking Context（重ね合わせコンテキスト）の分離 (`isolate`)**:
  - 右側メインエリア全体（およびテーブルカード）に `isolate`（CSS `isolation: isolate`）を適用。
  - テーブルヘッダー（`th`）や下部水平スクロールコントローラー（Sticky Bottom Bar）の z-index がメインエリア外部へ手前漏れしないようカプセル化し、スクロール時にも `AIモデル選択` ペイン（`z-30`）より手前側に突き抜けて表示される不具合を防止。
- **列固定 (Sticky Column)**:
  - **対象列**: 「モデル / 仕様・Tier」（モデル名）列。
  - **ヘッダーセル (`th`)**: `sticky top-0 left-0 z-30 bg-slate-950` で最前面に固定。右端に境界線とドロップシャドウ（`border-r border-slate-700/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.5)]`）を付与。
  - **データセル (`td`)**: `sticky left-0 z-10` で固定。背面のスクロール要素が透過しないよう不透明背景色（フォーカス時は `bg-indigo-950`、通常行は `bg-slate-900 group-hover:bg-slate-800/90`）を適用。
  - **固定幅リサイズ**:
    - モデル名列右端にリサイズハンドルを配置。ドラッグで幅（既定 220px、最小 120px、最大 500px）を自由に調整可能。
    - ダブルクリックで既定幅（220px）にリセット。キーボード操作（左右矢印キー、Home、End、Enter）に対応。
    - 設定幅はブラウザの `localStorage`（キー: `copilot-dashboard:radar-model-pinned-width`）に自動永続化。
- **垂直スクロール & ヘッダー固定**:
  - テーブルコンテナは `max-h-[600px] overflow-auto` とし、全ヘッダーセル（`th`）に `sticky top-0 bg-slate-950` を適用することで、行スクロール時もヘッダーが常時固定表示される。
- **データ列構成 & 単価の分離 (Token単価とTask単価)**:
  - **Token単価 ($/1M)**: APIカタログ料金（Input / Output / Cache）に基づく 100 万トークンあたりの入出力単価およびコスト効率インジケーター。
  - **Task単価 ($/Task)**: Terminal-Bench 4.0 および Artificial Analysis 等による、エージェントハーネスや思考トークン消費を含む標準実務タスク 1 試行あたりの平均実測コスト（USD）。ワンクリックで安い順（昇順）・高い順（降順）の双方向ソートに対応。
  - **動的ソートアイコン & ソート状態バッジ**: テーブルヘッダーの各列にアクティブソート方向を示す `ArrowUp` (昇順) / `ArrowDown` (降順) を動的に描画。未選択列には `ArrowUpDown` を透過表示。Task単価およびToken単価列には現在「安い順」「高い順」を示すバッジをヘッダー内および上部ソートバーに常時明示。未定義値を含むデータ列では常に末尾に配置される安全な比較を保証。
  - **引用リファレンスカードの整備**: 画面下部の公式ドキュメント・仕様リファレンス引用カードに、「GitHub Copilot サポートAIモデル一覧」「モデル別課金・単価表 (Models and Pricing)」に加えて「著名ベンチマーク実測タスクコスト (Task Cost / Cost per Task)」カードを既存同等に配置。

---

## 3. レーダーチャート 6 軸評価メトリクス定義

| 軸キー | 軸名 (表示ラベル) | 重み | 参照ベンチマーク | 算出ロジック・意図 |
| :--- | :--- | :--- | :--- | :--- |
| `coding_swe` | Coding & SWE (実務開発力) | 25% | Terminal-Bench 4.0 (`terminal_bench_4`, 100%) | ターミナル上の実務タスクをエージェント + モデルで自律的に完遂する力。データセット内のパーセンタイル順位。 |
| `reasoning_logic` | Reasoning & Logic (論理推論力) | 25% | Artificial Analysis Intelligence Index v4.3 (`aa_intelligence_index`, 100%) | 第三者が同一条件で実行した推論・知識・コーディング評価の統合指数による総合推論力。 |
| `arena_elo` | Community & Elo (総合・指示追従) | 15% | Arena Code Arena \| WebDev Elo (`arena_webdev_elo`) | 生成された Web アプリに対する実世界ユーザーのブラインド投票レーティング。データセット内のパーセンタイル順位。 |
| `speed_latency` | Speed & Latency (応答即時性) | 10% | Tokens / sec (TPS), TTFT | 出力トークン生成速度。データセット内のパーセンタイル順位。 |
| `cost_efficiency` | Cost Efficiency (費用対効果) | 10% | Pricing per 1M tokens (Input/Output) | 入力 40%・出力 60% の合算単価を逆順位で評価。安価なモデルほど高得点。 |
| `architecture_design` | Architecture & Context (設計・長文把握) | 15% | Context Window (128K〜2M) (45%), Terminal-Bench 4.0 (55%) | 大規模リポジトリの一括把握、長い手順のタスク遂行・リファクタリング適性。 |

---

### 3.1 正規化: パーセンタイル順位 (P3-7 / B-15)
- **理由**: 従来の固定アンカー（SWE-bench 75 / AIME 90 / Elo 1460）を現行モデルが超え、43 モデル中 11 / 12 / 7 が 99 で頭打ちになり、上位 GA モデル 10 件が coding で同点だった。固定アンカーは、全体がアンカーを超えるたびに飽和する。
- **方式（`percentile-rank-v1`）**: 各構成要素のスコアは、データセット内の全モデルの中でその生値が占めるパーセンタイル順位 `(below + 0.5 * equal) / n`（同値は中央順位）を 20〜99 に写し、小数 1 桁で保持する。軸スコアは上表の重みで構成要素を合成する（coding = Terminal-Bench 4.0、reasoning = AA Intelligence Index、Elo = Arena WebDev Elo、architecture = 0.45 コンテキスト + 0.55 Terminal-Bench 4.0）。総合スコアは 6 軸の加重平均（小数 1 桁）で、上位モデルを区別できる。
- **相対評価であること**: スコアは現在のデータセット内の位置を表し、絶対的な能力ではない。モデルを追加すると動く。**スコアの隣に生値を常に表示する**（ツールチップ、ベンチマーク表）。
- コンテキスト無し（単一モデル）の `computeRadarScores(raw)` は、後方互換のためアンカー式を使う。2026-10 以降のアンカーは Terminal-Bench 4.0 0% → 20 / 60% → 99、AA Intelligence Index 15 → 20 / 55 → 99、Arena WebDev Elo 1250 → 20 / 1800 → 99（architecture: コンテキスト点 × 0.45 + min(1, Terminal-Bench / 60) × 55）。定性評価（グレード・タグ・強み/弱み）は絶対しきい値のままで、アンカー式のスコアで判定する。
- テスト: `src/tests/benchmark-normalization.test.ts`（上位モデルが同点にならない、順位の境界、入力順序への非依存）。

### 3.1.1 ベンチマーク出典と raw metric (2026-10、Issue #321)
| raw metric | 出典 | 値の時点 | ルール |
| :--- | :--- | :--- | :--- |
| `terminal_bench_4` (%) | Terminal-Bench 4.0、https://www.tbench.ai/leaderboard/terminal-bench/4.0 | 2026-10-12 | tbench.ai はクライアント描画のため、公式リーダーボードの BenchLM スナップショット (https://benchlm.ai/benchmarks/terminal-bench-4) から読み取る |
| `aa_intelligence_index` (ポイント) | Artificial Analysis Intelligence Index v4.3、https://artificialanalysis.ai/leaderboards/models (モデル別 `https://artificialanalysis.ai/models/<slug>`) | 2026-10-13 | AA が "Estimated" と表示する値、および非 reasoning 変種しかないモデルは確認済みとして扱わない |
| `arena_webdev_elo` (Elo) | Arena (旧 LMArena / LMSYS) Code Arena \| WebDev、https://arena.ai/leaderboard/webdev | 2026-10-08 | - |
| `task_cost_usd` ($/task) | Terminal-Bench 4.0 Mean Rollout Cost & Artificial Analysis Task Cost | 2026-10-12 | 実務タスク1試行あたりの実測平均コスト（USD）。エージェントハーネスや思考トークン消費を含む |
| `output_speed_tps`、Token単価、コンテキスト | Artificial Analysis (速度)、GitHub Copilot 公式価格 | 変更なし | - |

- **変種**: 各モデルで掲載されている最上位の reasoning / harness 変種の値を採用する。
- **外した出典**: SWE-bench Verified（OpenAI が 2026-02-23 に汚染とテスト不備を理由に評価をやめると公表、https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/。公式リーダーボードも 2026-02-26 以降の掲載なし）、LMSYS Chatbot Arena Coding（Arena へ移行）、AIME 2024 / GPQA Diamond / HumanEval+（飽和。GPQA Diamond は最新モデルが 92.6-96.0% に密集、MathArena は最終解答型の競技を deprecated 扱い）。データセットはこの説明を `sources_note` として持ち、出典一覧の上に表示する。
- **検証記録**: `.devs/changes/2026-10-13_RadarBenchmarkSourcesRefresh/verified-benchmarks-2026-10.json`（`null` = 確認できず）。`src/tests/benchmark-sources-2026-10.test.ts` がレコードの値がこれと一致することを検証する。

### 3.1.2 推測値とその算出方法
確認済みの値がない raw metric は**推測値**とする。レコードの `estimated_metrics`（例: `["terminal_bench_4", "arena_webdev_elo"]`）に列挙し、UI ではその値の横に「推測値」マーカーを表示する（ベンチマーク表とモデル詳細カード）。推測値は一度だけ**分位写像 (quantile mapping)** で算出する:
1. 同じ軸に以前使っていた旧指標（2026-09 のレコードの値）で、全 45 モデル中のパーセンタイル順位 `(below + 0.5 * equal) / n` を求める。`terminal_bench_4` ← `swe_bench_verified`、`aa_intelligence_index` ← `aime_2024` と `gpqa_diamond` の順位の 0.65 / 0.35 ブレンド、`arena_webdev_elo` ← `arena_coding_elo`。
2. その順位を、新指標の確認済み値を昇順に並べた分布へ、分位点の線形補間（`p × (k − 1)`）で写す。
3. 丸め: Terminal-Bench は小数 1 桁、AA Intelligence Index と Arena Elo は整数。

一回限りのスクリプトはリポジトリ外で実行し、数値だけを `benchmark-records.json` に書き込む（モデルごとの順位と結果は `.devs/changes/2026-10-13_RadarBenchmarkSourcesRefresh/estimated-values-2026-10.json` に保存）。2026-10-13 時点で Terminal-Bench 26 / 45、AA Intelligence Index 17 / 45、Arena WebDev Elo 13 / 45 件が推測値。

- **モデル単位のフラグ**: `is_estimated` は「ベンチマーク指標（`BENCHMARK_SCORE_METRICS`: `terminal_bench_4`, `aa_intelligence_index`, `arena_webdev_elo`）がすべて推測値」として導出する。該当モデルはモデル名横の「推測値」バッジも表示する。旧形式の `is_estimated: true` だけを持つレコードは、ベンチマーク 3 指標すべてが推測値として扱う。
- `output_speed_tps` も列挙できる（GPT-6.1 Sol と Claude Sonnet 5.5: 速度は未計測）。
- 出典にモデルが掲載されたら、推測値を確認済みの値に置き換えて `estimated_metrics` から外す。

### 3.2 モデルカタログ: 別名の完全一致 (P3-7 / A-13)
`normalizeModelId` は、モデルカタログ（`src/processor/model-catalog.ts`: 正規 ID + 別名リスト）で判定する。判定は**正規化した別名の完全一致**（小文字・英数字のみ）。許容する揺れは、末尾の括弧書き（`Kimi K3 (Moonshot)`）と末尾のリリース日（`-20250219`）だけ。**部分一致は使わない**: 未知の名前は `unknown:<raw>` のまま保持し、未知の新モデル（例: `GPT-6 Nova`）が `gpt-6-astra` に数えられることはない。別名の衝突は例外にする。カタログとベンチマークレコードが同じモデルを列挙すること、全レコードの ID と名前が自分自身に解決されることをテストで検証する。

---

## 4. 自動判定タグと推奨ユースケース

### 4.1 判定タグ基準
- **`Complex Refactoring`**: `terminal_bench_4 >= 40%` または `architecture_design >= 85`
- **`Algorithm Specialist`**: `reasoning_logic >= 85` または `aa_intelligence_index >= 45`
- **`Fast Inline Suggestion`**: `speed_latency >= 80` または `output_speed_tps >= 100 tps`
- **`Cost Saver`**: `cost_efficiency >= 80`
- **`Ultra-Long Context`**: `context_window_k >= 1000K (1M tokens)`
- **`High-Precision Coding`**: `coding_swe >= 85`
- **`Agent & Multi-Turn`**: `arena_elo >= 85`

### 4.2 GitHub Copilot 公式サポートモデル体系 (2026年最新)

GitHub Copilot 公式ドキュメント（[Supported models](https://docs.github.com/ja/copilot/reference/ai-models/supported-models) および [Models and pricing](https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing)）に準拠した全モデル（36モデル＋クラシック/外部対照9モデル = 計45モデル）の仕様・単価体系を網羅。

#### 1. OpenAI (12モデル)
| モデルID | モデル名 | Tier | Status | Context | In単価 (/1M) | Out単価 (/1M) | キャッシュ単価 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `gpt-6-astra` | GPT-6 Astra | Powerful | GA | 272K (1M) | $10.00 | $50.00 | $2.50 | 2026最上位推論・極限思考フラッグシップ |
| `gpt-6-1-sol` | GPT-6.1 Sol | Powerful | GA | 1.05M | $2.00 | $10.00 | $0.10 | 最新 Sol。ベンチマーク値は 2026-10 に確認済み（出力速度は推測値、`estimated_metrics`）。単価 (キャッシュ書き込み $2.50、Long Context > 272K: In $4.00 / Out $15.00 を含む) は 2026-10-08 に公式価格表 (`github/docs` `data/tables/copilot/models-and-pricing.yml`、コミット `45a0f053ac67e8d1f56fc8f7ee38f0b2a58925c3` と `main`) と照合済み |
| `gpt-6-sol` | GPT-6 Sol | Powerful | GA | 272K (1M) | $2.00 | $10.00 | $0.20 | 高性能と手頃な単価を両立する新世代Powerful主力 |
| `gpt-6-luna` | GPT-6 Luna | Lightweight | GA | 272K (1M ※長文注意) | $0.10 | $0.50 | $0.01 | 超高速・超低コストインライン補完（※長文性能注意） |
| `gpt-5-6-sol` | GPT-5.6 Sol | Powerful | GA | 272K (1M) | $4.00 | $20.00 | $1.00 | GPT-5.6世代のPowerful主力 |
| `gpt-5-6-terra` | GPT-5.6 Terra | Versatile | GA | 272K (1M) | $2.00 | $12.00 | $0.50 | 高速万能モデル |
| `gpt-5-6-luna` | GPT-5.6 Luna | Lightweight | GA | 200K (1M ※長文注意) | $0.20 | $1.20 | $0.05 | 超高速インライン補完・低コスト（※長文性能注意） |
| `gpt-5-5` | GPT-5.5 | Powerful | GA | 272K (1M) | $5.00 | $30.00 | $1.25 | フロンティア推論モデル |
| `gpt-5-4` | GPT-5.4 | Versatile | GA | 272K (1M) | $2.50 | $15.00 | $0.62 | バランスモデル |
| `gpt-5-4-mini` | GPT-5.4 mini | Lightweight | GA | 128K | $0.75 | $4.50 | $0.18 | 高速・高コスパ |
| `gpt-5-4-nano` | GPT-5.4 nano | Lightweight | GA | 128K | $0.20 | $1.25 | $0.05 | 超軽量インライン |
| `gpt-5-3-codex` | GPT-5.3-Codex | Powerful | LTS | 1M | $1.75 | $14.00 | $0.43 | LTS長期安定提供コード特化 |
| `gpt-5-mini` | GPT-5 mini | Lightweight | GA | 128K | $0.25 | $2.00 | $0.06 | 定番高速モデル |

> [!WARNING] GPT系Lunaモデル（GPT-6 Luna / GPT-5.6 Luna）の長文コンテキスト性能に関する重要補足
> OpenAI公式（https://openai.com/ja-JP/index/gpt-5-6/）の「長文コンテキスト」比較データが示す通り、Lunaモデルは1Mコンテキスト窓に対応しているものの、長文コンテキストにおける探索・情報保持・指示想起性能がSolやTerraと比較して極端に低い特性があります。大規模リポジトリの一括読み込みや長大な複数ファイル解析にはSol/Terraの利用が強く推奨され、Lunaはインライン補完や即時サジェスト、単一ファイル・定型タスクに限定して活用することが推奨されます。

#### 2. Anthropic (11モデル)
| モデルID | モデル名 | Tier | Status | Context | In単価 (/1M) | Out単価 (/1M) | キャッシュ読取/書込 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `claude-sonnet-5-5` | Claude Sonnet 5.5 | Versatile | GA | 200K (1M) | $2.00 | $10.00 | $0.20 / $2.50 | 最新 Sonnet。ベンチマーク値は 2026-10 に確認済み（出力速度は推測値、`estimated_metrics`） |
| `claude-sonnet-5` | Claude Sonnet 5 | Powerful | GA | 200K (1M) | $2.00 | $10.00 | $0.20 / $2.50 | 全社標準の次世代絶対的主力 |
| `claude-opus-5-5` | Claude Opus 5.5 | Powerful | GA | 200K (1M) | $4.00 | $20.00 | $0.20 / $5.00 | 次世代最高峰推論・制御性向上フラッグシップ |
| `claude-opus-5` | Claude Opus 5 | Powerful | GA | 200K (1M) | $5.00 | $25.00 | $0.50 / $6.25 | 深層思考・極限アーキテクチャ設計 |
| `claude-fable-5-1` | Claude Fable 5.1 | Powerful | GA | 200K (1M) | $10.00 | $50.00 | $1.00 / $12.50 | EFS/ZDR対応最高峰安全性モデル |
| `claude-fable-5` | Claude Fable 5 | Powerful | GA | 200K (1M) | $10.00 | $50.00 | $1.00 / $12.50 | 超安全エンタープライズ推論 |
| `claude-opus-4-8` | Claude Opus 4.8 | Powerful | GA | 200K (1M) | $5.00 | $25.00 | $0.50 / $6.25 | 重厚推論モデル |
| `claude-opus-4-8-fast` | Claude Opus 4.8 Fast | Powerful | GA | 200K | $10.00 | $50.00 | $1.00 / $12.50 | Opus最高速版 |
| `claude-opus-4-7` | Claude Opus 4.7 | Powerful | GA | 200K (1M) | $5.00 | $25.00 | $0.50 / $6.25 | 高度推論 |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 | Versatile | GA | 200K (1M) | $3.00 | $15.00 | $0.30 / $3.75 | 実務バランスモデル |
| `claude-sonnet-4` | Claude Sonnet 4 | Versatile | GA | 200K | $3.00 | $15.00 | $0.30 / $3.75 | 安定コード補完 |
| `claude-haiku-4-5` | Claude Haiku 4.5 | Lightweight | GA | 200K | $1.00 | $5.00 | $0.10 / $1.25 | 超軽量・高速 |

#### 3. Google (5モデル)
| モデルID | モデル名 | Tier | Status | Context | In単価 (/1M) | Out単価 (/1M) | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `gemini-4-argon` | Gemini 4 Argon | Powerful | GA | 1M Tok | $2.00 | $10.00 | フロンティア推論旗艦・Terminal-Bench 57.27%・AA指数53 |
| `gemini-3-8-flash` | Gemini 3.8 Flash | Versatile | GA | 1M Tok | $0.75 | $3.75 | 最新Flash (プロモ価格中) / 100万トークン |
| `gemini-3-7-flash` | Gemini 3.7 Flash | Versatile | GA | 1M Tok | $0.75 | $3.75 | 思考CoT・高速コード生成 |
| `gemini-3-6-flash` | Gemini 3.6 Flash | Versatile | GA | 1M Tok | $0.75 | $3.75 | 1M長文コンテキスト万能 |
| `gemini-3-5-flash` | Gemini 3.5 Flash | Versatile | GA | 1M Tok | $1.50 | $9.00 | 定番Flash |

#### 4. Microsoft / xAI / Moonshot AI (6モデル)
| モデルID | モデル名 | 提供元 | Tier | Status | Context | In/Out 単価 (/1M) | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mai-code-1-1-flash` | MAI-Code-1.1-Flash | Microsoft | Lightweight | GA | 128K | $0.20 / $1.20 | Microsoft謹製超高速コード特化 |
| `grok-4-7` | Grok 4.7 | xAI | Versatile | GA | 200K (1M) | $2.00 / $6.00 | 思考CoT対応・最新フラッグシップGrok |
| `grok-4-6` | Grok 4.6 | xAI | Versatile | GA | 200K (1M) | $2.00 / $6.00 | 最新Grok・高精度実務補完 |
| `grok-4-5` | Grok 4.5 | xAI | Versatile | GA | 200K (1M) | $2.00 / $6.00 | 万能コード補完 |
| `kimi-k3` | Kimi K3 | Moonshot AI | Powerful | GA | 1M | $3.00 / $15.00 | 長文コンテキスト推論特化 |
| `kimi-k2-7-code` | Kimi K2.7 Code | Moonshot AI | Versatile | GA | 256K | $0.95 / $4.00 | 256Kコード特化・高コスパ |

#### 5. クラシック・過去世代モデル & 外部対照
Claude 3.7 Sonnet, Claude 3.5 Sonnet, GPT-4o, GPT-4o mini, o1, o3-mini, Gemini 2.0 Flash, Gemini 2.5 Pro, DeepSeek R1（過去分析データ対照用）。

### 4.3 公式ドキュメント引用と参考情報
ユーザー画面において、以下の公式ドキュメントへのリンクを参考情報として常時掲載する。
- 📘 **GitHub Copilot サポートAIモデル一覧**: `https://docs.github.com/ja/copilot/reference/ai-models/supported-models`
- 💳 **GitHub Copilot モデル別課金・単価表**: `https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing`

---

## 5. 出典メタデータとお題・現場での見え方・エンジニアの声 (※ SNSの噂)

### 5.1 著名ベンチマーク出典の多面解説 (`BenchmarkSourceMeta`)
1. **Terminal-Bench 4.0 Leaderboard** (`terminal-bench-4`):
   - **出題お題 (`target_problem`)**: ビルド・依存関係の解決・サーバー構築・データ処理など、ターミナルで完結する実務タスクをエージェント + モデルが自律的に完遂できるか。
   - **現場での見え方 (`performance_view`)**: 長い手順を試行錯誤しながらやり切る「自律エージェントとしての実行力」。Agent モード / CLI での適性。
   - **現場の声 (`community_rumor`)**: ※ SNSの噂: エージェント (ハーネス) の違いでスコアが大きく変わる、掲載モデルが限られる、など公開されている注意点。
2. **Artificial Analysis Intelligence Index v4.3** (`aa-intelligence-index`):
   - **出題お題 (`target_problem`)**: 推論・知識・指示追従・コーディング等の評価セットを第三者が同一条件で実行し、1 つの指数に統合。
   - **現場での見え方 (`performance_view`)**: 単一の難関テストが飽和したため、統合指数で推論・知識の総合力を比較する。
   - **現場の声 (`community_rumor`)**: ※ SNSの噂: 指数の構成がバージョンごとに変わる、AA 自身が推定値 (Estimated) と表示するモデルがある、など。
3. **Arena Code Arena | WebDev** (`arena-webdev`):
   - **出題お題 (`target_problem`)**: ユーザーが出した Web アプリ作成課題に対する 2 つの匿名モデルの成果物をブラインド比較投票 (Elo)。
   - **現場での見え方 (`performance_view`)**: 動く成果物の完成度・見た目・指示の汲み取りといった主観的満足度。
   - **現場の声 (`community_rumor`)**: ※ SNSの噂: 見た目が派手な成果物に票が集まりやすい、投票数が少ないモデルや Preliminary 表示のモデルは順位が動く、Web フロントエンド中心、など。
4. **Artificial Analysis** (`artificial-analysis`):
   - **出題お題 (`target_problem`)**: 各APIエンドポイントの出力速度 (TPS)、初回トークン遅延 (TTFT)、100万トークン単価の実測。
   - **現場での見え方 (`performance_view`)**: 思考を止めない即時性（DX）とAPI運用コストの現実的バランス。

`community_rumor` は必ず `※ SNSの噂` と明示し、公開されている注意点のみを書く（事実の捏造をしない）。

### 5.2 リアルなエンジニアの声・現場の評判 (`EngineerBuzz`)
モデル詳細カードに「エンジニアの生の声・コミュニティの噂」コンポーネントを統合。
- **注釈表記の義務 (`source_note`)**: 必ず「`※ SNS上のエンジニアの声・コミュニティの噂・所感`」または「`※ SNSの噂`」の統一注釈バッジを明示する（個別の記事メモ等は入れず統一する）。
- **引用元URLの列挙 (`sources`)**: 項目下部に引用元・参考となる記事やコミュニティURLを明記・リンク列挙する。個別の注記メモではなく、引用元URL一覧として整理する。

---

## 6. 個別バージョン管理仕様 (`yyyy-mm-dd-0001`)

AIモデル特性レーダーのデータセットおよび画面表示において、個別バージョンを日付および同日内のインクリメンタル連番で管理する。

### 6.1 フォーマット定義
$$\text{Version} = \text{yyyy-mm-dd-xxxx}$$
- `yyyy-mm-dd`: 作成日・更新日のカレンダー日付（例: `2026-09-13`）。
- `xxxx`: 同日付内での 4 桁ゼロパディングされたインクリメンタル連番（`0001`, `0002`, `0003`...）。
- **版は内容ハッシュで管理する (P3-7 / B-15)**: データセットは `content_hash`（ベンチマークレコード・軸定義・正規化方式の sha256 の先頭 16 桁）を持つ。`npm run benchmark:update`（`pretest` / `prebuild` でも実行）は、ハッシュが既存ファイルと同じなら `version` と `last_updated` を据え置き、**内容が変わったときだけ**連番を進める（同日は `+1`、別日は `0001`）。テストやビルドで版が繰り上がらない。`content_hash` の無い旧ファイルは 1 回だけ繰り上がる。

### 6.1.1 ベンチマーク値の外部化
ベンチマーク値はコードではなく JSON データ: `scripts/benchmark-data/benchmark-records.json`（`scripts/update-benchmarks.ts` の `loadBenchmarkRecords` が読む）。モデルの数値の更新はこのファイルの編集で行い、スクリプトがスコア・評価・ハッシュ・版を導出する。出力 `dashboard/public/data/model-benchmarks.json` は従来どおり生成物（コミットしない）。

### 6.1.2 二重同期（AGENTS.md rule 8）
モデルやベンチマークを変えるときは、`supported_models.md`（参照表）、`scripts/benchmark-data/benchmark-records.json`（と `scripts/update-benchmarks.ts`）、`src/processor/model-catalog.ts`（別名）、`dashboard/src/components/radar/radar-constants.ts` のプリセット（UI のモデル定義。旧ルール文の `dashboard/src/data/models.ts` は存在しない）を同時に更新する。カタログとレコードが食い違うと `src/tests/benchmark-normalization.test.ts` が失敗する。本変更はモデルの追加・削除・改名を行わないため、`supported_models.md` は変更しない。

### 6.2 UI表示とツールチップ
- タイトル右横のステータスバッジに `v2026-09-13-0001` の形式で個別バージョンを表示。
- ホバー時のツールチップに「個別バージョン (日付・連番管理): {version}」を表示。

---

## 7. 更新作業パイプライン Agent & Skills 分割構成

ベンチマーク情報の更新・比較用データ取り込み・SNS情報再収集・比較プリセット更新・個別バージョン採番の一連の作業は、起点となるマスターオーケストレーター Agent および 4 つの個別専門 Agent / Skills に分割して構成する。

```mermaid
flowchart TD
    Trigger(["🚀 更新指示"]) --> Master[".agents/model-radar-pipeline.agent.md<br>(統括オーケストレーター)"]
    Master --> Ingest["1. benchmark-ingestion-agent<br>(skills/benchmark-ingestion)"]
    Master --> Buzz["2. sns-buzz-agent<br>(skills/sns-buzz-harvester)"]
    Master --> Preset["3. preset-curator-agent<br>(skills/preset-curator)"]
    Master --> Version["4. radar-version-agent<br>(skills/radar-version-manager)"]
    Version --> Gate{"品質ゲート<br>(typecheck + test + secret-scan + build)"}
    Gate -- 合格 --> Done(["✅ リリース準備完了 (yyyy-mm-dd-xxxx)"])
```

### 7.1 分割エージェント & スキル一覧
1. **起点オーケストレーター (`.agents/model-radar-pipeline.agent.md`)**:
   - 一連の更新作業全体の進行管理、依存ステップ制御、最終整合性確認。
2. **ベンチマーク取り込み (`.agents/benchmark-ingestion.agent.md` / `skills/benchmark-ingestion`)**:
   - GitHub Copilot公式ドキュメント（supported-models, models-and-pricing）、Terminal-Bench 4.0、Artificial Analysis Intelligence Index、Arena WebDev、Artificial Analysis (速度) からの最新指標・単価仕様の取り込み。確認できない値は `estimated_metrics` に記録する。
3. **SNS評判再収集 (`.agents/sns-buzz.agent.md` / `skills/sns-buzz-harvester`)**:
   - 現場エンジニアの実感・SNS評判・注意点（※ SNSの噂）の収集・要約・反映。
4. **比較プリセット選定 (`.agents/preset-curator.agent.md` / `skills/preset-curator`)**:
   - 「最高水準レベル（品質ゲート）は譲らず、コストバリエーション上位3選」アルゴリズムに基づくプリセット更新。
5. **バージョン管理・検証 (`.agents/radar-version.agent.md` / `skills/radar-version-manager`)**:
   - `yyyy-mm-dd-0001` インクリメンタル採番、データセット生成、4重品質ゲート検証。

---

## 8. コマンドライン・運用仕様

- **ベンチマーク更新・個別バージョン採番**:
  ```bash
  npm run benchmark:update
  ```
- **品質ゲート**:
  ```bash
  npm run typecheck && npm test && npm run secret-scan && npm run build
  ```

> レコードの `estimated_metrics` に列挙された raw metric は検証可能な出典がない推測値（算出方法: §3.1.2）。レーダー画面ではその値の横に「推測値」マーカーを、ベンチマーク指標がすべて推測値のモデルにはモデル単位の「推測値」バッジを表示する。確認できたら値を差し替え、`estimated_metrics` から外す。
