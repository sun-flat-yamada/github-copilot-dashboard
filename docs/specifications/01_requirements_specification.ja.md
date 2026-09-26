[English](01_requirements_specification.md) | [日本語](01_requirements_specification.ja.md)

---

# SDD-01: GitHub Copilot 使用量・利用料金分析基盤 要件定義書 (Requirements Specification)

- **文書番号**: SPEC-COPILOT-001
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-10

---

## 1. システムの背景と目的

GitHub Copilot（Copilot Business / Copilot Enterprise）の企業導入が進む中、以下の経営・組織課題が発生している：

1. **費用の正確な部門配賦（チャージバック / ショーバック）の困難さ**:
   GitHub EnterpriseではOrganizationやCost Centerといった単位で費用が計上されるが、人事上の部署、プロジェクトコード、開発チーム、あるいは協力会社などの「独自の仕訳グループ」単位での費用按分が困難。
2. **ライセンスの遊休化・投資対効果 (ROI) のブラックボックス化**:
   シートを割り当てているものの、数週間〜数ヶ月使われていない「遊休シート（Idle Seats）」が存在し、ライセンス費用の無駄が生じる。
3. **リポジトリのForkやオープンソース運用における競合**:
   自動集計リポジトリを社内でForkしたり、親組織と子組織でテンプレート共有する際に、分析データがmainブランチに直接コミットされているとGitコンフリクト（競合）が発生し、本家コードの取り込みやPRが阻害される。
4. **プライバシーとコンプライアンス（機密情報の漏洩リスク）**:
   従業員の氏名、社員番号、人事上の所属グループなどの対応表（マッピングテーブル）が公開リポジトリのコミットログに残ると、情報漏洩事故につながる。

本システムは、これらの課題を抜本的に解決するため、2026年9月時点の最新GitHub Copilot APIおよびGitHub Enterprise仕様に完全準拠し、**3軸のグループ仕訳（Org, Cost Center, 任意ユーザー属性）**、**Fork耐性を持つデータ永続化**、および**GitHub Pagesでの自動更新ダッシュボード**を提供する。

---

## 2. 対象システム・前提条件 (2026年9月時点)

### 2.1 GitHub Copilot プランと課金体系
- **Copilot Business**: 月額 \$19 / シート
- **Copilot Enterprise**: 月額 \$39 / シート
- **アドオン / プレミアムモデル・従量課金**:
  2026年時点のマルチモデルCopilot（Claude 3.7 Sonnet, GPT-4o, o1, Gemini 2.0 Flash 等）利用やCopilot Workspace、Pull Requestサマリー等の消費メトリクス。

### 2.2 対象APIエンドポイント
1. **Copilot Metrics API**:
   - `GET /enterprises/{enterprise}/copilot/metrics`
   - `GET /orgs/{org}/copilot/metrics`
   - 日次のアクティブユーザー数、受諾率、提示/受諾行数、IDEチャット、CLI、PRサマリー等の集計値。
2. **Copilot User Seats API**:
   - `GET /enterprises/{enterprise}/copilot/billing/seats`
   - `GET /orgs/{org}/copilot/billing/seats`
   - ユーザー別シート割当一覧、作成日時、最終アクティビティ日時(`last_activity_at`)、エディタ、プラン種別。
3. **GitHub Enterprise Cost Centers API**:
   - `GET /enterprises/{enterprise}/settings/billing/cost-centers`
   - Cost Center定義、および紐付けリソース（Organization, User, Repository）。

---

## 3. 機能要件 (Functional Requirements)

### FR-1: 3軸による柔軟なグループ集計
システムは、利用データおよび費用を以下の3軸で任意に切り替えて分析できなければならない：
1. **GitHub Organization 軸**: 複数のGitHub Organizationを跨ぐ比較・集計。
2. **GitHub Cost Center 軸**: GitHub Enterprise Billingで定義されたCost Center単位での集計。
3. **任意ユーザー属性グループ 軸**:
   社内人事システムやプロジェクト台帳に基づく「仕訳グループ」「部署」「雇用区分」等での集計。

### FR-2: 秘匿化ユーザー属性マッピング (GitHub Variables)
- ユーザー属性情報（`github_user`, `display_name`, `department / cost_group`, `notes`）は、**Gitコミットに一切含めない**こと。
- GitHub Actionsの **Repository / Organization Variable (`COPILOT_USER_MAPPING`)**、または **Secret (`COPILOT_USER_MAPPING`)** として注入すること。
- マッピングが存在しないユーザーは「未分類 (Unassigned)」またはGitHubのログインIDを用いて安全にフォールバックすること。

### FR-3: 多様なデータソース & 分析スコープの切り替え
ダッシュボードおよび集計エンジンは、以下のデータソースと時間スコープを即座に切り替えて参照できなければならない：
1. **アクティブデータソース切り替え (`ActiveDataSelector`)**:
   - **Live Metrics (API連携自動収集)**: 過去1年間（直近12カ月）および直近30日の継続蓄積データ。
   - **Monthly Usage Report**: 永続化された確定月次レポート（CSV由来）。
   - **User Upload File (On-demand)**: 手元のCSV/JSONファイルをブラウザ内メモリでのみ即時解析・可視化（Zero-Leakage）。
2. **時間スコープ切り替え**:
   - **日次スコープ (Daily)**: 直近30日以内の指定日における利用状況、アクティブ率、日割り費用。
   - **月次スコープ (Monthly)**: 過去1年間（直近12カ月）の暦月における月間累計費用、MAU、遊休コスト。
   - **指定期間スコープ (Custom Date Range)**: 直近30日間、または1年間の推移トレンド。

### FR-4: コスト最適化・遊休シート検出 (Idle Seat Detection)
- 過去N日間（デフォルト: 14日/30日）アクティビティがないシートを「遊休シート（Idle Seat）」として検出し、無駄になっている月額コストおよび年間換算コストを可視化すること。
- シートの解約や再割り当ての推奨リストをエクスポートできること。

### FR-5: 自動更新 GitHub Pages ダッシュボード
- GitHub Actionsの定期実行（cron workflow: 毎日指定時刻 UTC 00:00 / JST 09:00等）により、最新データの取得・集計・ダッシュボードビルド・GitHub Pagesへの自動デプロイが完了すること。
- 手動トリガー（`workflow_dispatch`）による即時更新にも対応すること。
- クライアントサイド（ブラウザ）上で高速に動作するSPA（Single Page Application）として構築すること。

### FR-6: 複数タグの AND フィルター (`TagFilterBar`)
- ユーザー属性定義の `tags` 属性（例: `["正社員", "リモート", "AI推進"]`）からユニークなタグ一覧を抽出し、複数タグの選択を可能とすること。
- フィルター条件は **AND 条件（選択した全タグに合致するユーザーのみ抽出）** とし、KPIカード、グループ配賦、ランキング、明細テーブル、ディープ分析の全集計母数を即座に再集計すること。

### FR-7: 1カラム垂直スタックレイアウト & アコーディオン逐次開示
- 画面レイアウトは原則 **1カラム垂直スタック (`flex flex-col space-y-6 w-full`)** を厳守し、カードやグラフの横並び分割（2〜3カラム）を原則禁止とすること。
- 各分析セクションはアコーディオン構造とし、Block 0（サマリー）のみ常時展開、以降のブロックは初期折りたたみ表示（タイトル、アイコン、サマリーチップ）とすること。
- グローバルな `[すべて展開]` / `[すべて折りたたむ]` コントロールを提供すること。

### FR-8: 9種の分析ビュー切り替え (`ViewNavigation`)
- モード切り替えから、分析目的に応じた 9 種の専用プラグインビューへの切り替え構成とすること：
  1. `overview` (コスト配賦 & 総合サマリー)
  2. `users` (ユーザー別利用明細 & 活用状況)
  3. `trend` (ユーザー別モデル推移・日次受諾率)
  4. `budget` (Cost Center 予算管理・FinOps)
  5. `deep_analysis` (ディープ分析・高度行動診断 9パターン)
  6. `model_radar` (AIモデル特性レーダー)
  7. `credits` (GitHub AI Credits & 従量課金分析)
  8. `agent` (AI Agent & MCP 活用動向分析)
  9. `adoption` (AI 採用成熟度コホート分析・Impact Dashboard)
- 選択されているアクティブデータソースの機能互換性および ViewPluginRegistry の宣言（`canRender`）に応じて、利用可能なビューを動的に自動制御すること。

### FR-9: GitHub AI Credits & 組織プール従量課金管理
- 2026年仕様の AI Credits プール消費量（月次 3,900 credits/seat 割当）、モデル別トークン換算費用（$0.01/credit）、および個人月次上限枠（`ai_credits_limit_monthly`）の超過ステータスを可視化すること。
- シート基本料金とクレジット超過費用の合算（Total Combined Cost）を自動計算し、Cost Center 予算への統合配賦を行うこと。

### FR-10: AI Agent, MCP ツール & PR ライフサイクル分析
- VS Code Agent、カスタムAgent、3rd-Party Agent、MCP (Model Context Protocol) ツール呼出回数、Skills / Slash Commands 利用状況を集計・可視化すること。
- Coding Agent が作成・自動マージした PR 件数およびマージ所要時間中央値（`outcome_indicators`）をトラッキングし、チーム別のアウトカム向上を定量化すること。

### FR-11: 採用成熟度コホート (GitHub Impact Dashboard 準拠)
- ユーザーの活用度合いを 4 つのコホートステージ（`no_cohort`: 未活用, `code_first`: コード補完中心, `agent_first`: 対話・Agent中心, `multi_agent`: 自律協調・マルチエージェント）に自動分類すること。
- 組織全体の成熟度ピラミッド・推移ポートフォリオおよびチーム別の人員配分比率を可視化し、組織的なAIリスキリング・定着推進を支援すること。

### FR-12: ビュー横断データセントリック・リアクティビティ (Cross-View Data-Centric Reactivity)
- 全ての分析View（FR-8）は、**「ユーザーが現在アクティブ選択している分析対象データ」**（= アクティブデータソース種別 [FR-3-1] × 時間・グループスコープ [FR-3-2] × タグANDフィルター [FR-6] の組み合わせ）に対する**純粋な写像**として、表示内容（KPI数値、デフォルト選択項目、グラフ、利用割合等の派生値）を常時算出すること。
- View が既にマウント済み・表示中の状態でユーザーがスコープやタグフィルターのみを変更した場合（Viewタブ自体を再訪問しない場合）であっても、当該Viewの表示内容・デフォルト選択・派生集計値は**再マウントを伴わずに即座に再計算・追従**しなければならない。「初回表示時にのみ計算し、以降は放置する」実装は本要件違反とする。
- ある集計値がデータソース間のフォールバック経路（例: Live Metricsが空の場合にMonthly Usage Reportの集計値を代替使用する等）を持つ場合、**フォールバック先の経路も含めて**アクティブフィルターを等しく反映すること。フォールバック経路であることを理由にフィルター非対応が許容されることはない。
- 本要件を実現するための詳細な設計方針・実装規約・既知のアンチパターンは [SDD-15 データセントリック・リアクティビティ設計仕様書](15_data_centric_reactivity_design_spec.ja.md) に定める。

### FR-13: FinOps 動的マルチ通貨換算 & EA 契約単価・ボリュームディスカウント
- USD（米ドル）を全9分析画面・KPI・チャート・テーブルにおいて常時基本通貨として表示し、オプションとして日本円（JPY）やユーロ（EUR）などのサブ表示通貨を併記（例: `$2,975.00 (¥461,125)`）できること。
- ヘッダーの通貨セレクターにより、閲覧者がリアルタイムにサブ表示通貨（USDのみ / USD+JPY / USD+EUR）を切り替え可能であり、設定がローカルストレージに保持されること。
- Enterprise Agreement (EA) 契約におけるボリュームディスカウント率（0-100%）の適用、およびクレジット直接契約単価（例: `1.273円 / AIC` 等の任意精度指定）やシート直接単価の上書き指定を可能とすること。直接単価指定時はそれを最優先適用すること。
- 設定は環境変数 `COPILOT_BILLING_CONFIG` または `data/config/billing.json` から安全に注入され、未指定時は標準 USD レートへ自動フォールバックすること。

---

## 4. 非機能要件 (Non-Functional Requirements)

### NFR-1: Fork非競合データ永続化 & 無期限蓄積・1年ローリング表示
- リポジトリがForkされた際、本家（Upstream）とのGit同期（Sync Fork）やPull Request作成時に**コミット競合が絶対に発生しない**設計とすること。
- ソースコードブランチ（`main`）にデータファイルを一切コミットしない。
- データ保存は専用ブランチ（`copilot-data`）への追記（Append-Only日付パーティショニング）とし、**データ蓄積は上限なく無期限に継続**すること。
- ダッシュボード表示およびインデックス（`index.json`）のスコープは**過去1年（直近12カ月＋直近30日）をローリング提供**し、集約トレンドファイル（`trends/rolling-1year.json`）および月次ディープアーカイブ（`deep-analysis/{YYYY-MM}.json`）によりSPAのダウンロード負荷と描画速度を最適化すること。
- GitHub Pagesへのデプロイは公式のPages Artifactデプロイを使用すること。

### NFR-2: セキュリティ & 最小権限
- GitHub APIアクセスには GitHub Personal Access Token (Fine-grained PAT) または GitHub App を使用し、必要最小限の権限（`copilot:read`, `enterprise_billing:read`, `org:read`）のみを要求すること。
- 個人名や社内組織情報がパブリックなGitHub PagesやGitログに流出しないよう、環境変数で表示名のマスキング/ハッシュ化オプションを提供すること。
- 48KB を超える大規模ユーザーマッピングには GPG (AES-256) 対称暗号化を適用し、暗号化ブロブを `copilot-data` に隔離し、実行時 `$RUNNER_TEMP` にのみ平文復号すること（詳細は [GPG鍵管理・運用標準ガイド](../security/01_gpg_key_management_and_user_mapping_guide.ja.md) を参照）。

### NFR-3: オフライン・モック対応
- 実際のGitHub EnterpriseやCopilot契約がない開発・検証環境でも、2026年仕様に完全準拠したリアルなモックデータを瞬時に生成し、全機能をローカルおよびCI上でシミュレーション・検証可能とすること。

### NFR-4: 移植性と保守性
- Node.js 20+ / TypeScript を採用し、データパイプラインとダッシュボードの型安全性を100%保証すること。
- 外部データベース（PostgreSQL, RDS等）を一切不要とし、GitHub ActionsとGitHub Pagesのみで完結するゼロインフラ運用を実現すること。

### NFR-5: フロントエンド Code Splitting & バンドル軽量化 (Bundle Splitting Performance)
- 初回ロード時のメイン JavaScript チャンクは **300 kB 以下 (gzip 80 kB 以下)** を維持すること。
- 各分析 View（Model Radar, Deep Analysis, Credits, Agent Activity, Adoption Maturity 等）は `React.lazy` および `<Suspense>` により動的オンデマンド分割読み込みを行い、初回ロード性能を最大化すること。
- 遅延読み込み時のレイアウトシフトやチラつきを抑止するため、統一スケルトンプレースホルダー（`ViewSkeleton`）を提供すること。

### NFR-6: Repository 物理分離による純粋ブラウザバンドル保証 (Strict Browser/Node Repository Isolation)
- フロントエンド SPA で使用するリポジトリ（`HttpJsonMetricsRepository`）はブラウザ標準の `fetch` API のみで実装し、Node.js 固有の `fs` や `path` モジュールへの参照を一切含まないこと。
- Vite ビルド時に `Module "fs" has been externalized for browser compatibility` 等の互換性警告が 0 件であることを保証すること。

