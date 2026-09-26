[English](README.md) | [日本語](README.ja.md)

---

# github-copilot-dashboard (2026.09 LTS)

[![CI Verification](https://img.shields.io/badge/CI-Passing-success?style=flat-square&logo=github-actions)](https://github.com/sun-flat-yamada/github-copilot-dashboard/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![SDD: 13 Specs](https://img.shields.io/badge/SDD-13%20Specifications-blueviolet?style=flat-square)](docs/specifications/)
[![GitHub API](https://img.shields.io/badge/GitHub%20API-2026.09%20LTS-blue?style=flat-square)](https://docs.github.com)
[![Zero Infra](https://img.shields.io/badge/Infrastructure-Zero%20(Pages%20%2B%20Actions)-emerald?style=flat-square)](https://pages.github.com)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sun.flat.yamada)

2026年9月時点の最新GitHub仕様（Copilot Metrics, Seats, Cost Centers, Multi-Model Usage, Billing）に完全準拠した、エンタープライズ品質の **GitHub Copilot 使用量・利用料金分析基盤** です。

**GitHub Organization**、**GitHub Cost Center**、および **任意ユーザー属性情報（表示名・仕訳グループ対応表）** の3軸で多次元集計・コスト按分を行い、自動更新される **GitHub Pages** ダッシュボードとして美しく可視化します。

---

## 🌟 主な特徴 (Key Features)

### 1. 3軸による柔軟な多次元集計 & コスト按分
- **GitHub Organization 軸**: 複数Orgを横断した導入規模・利用率の比較。
- **GitHub Cost Center 軸**: GitHub Enterprise Billing の Cost Center 機能を直接連動。
- **任意仕訳グループ 軸**: 社内の事業部、プロジェクトコード、雇用区分等の独自マッピングに対応。

### 2. 予算管理 & Cost Center Budget モニタリング
- 各 Cost Center の **上限予算額 (Budget Limit)**、**無料枠 (Free Budget)**、**当月実使用額 (Current Usage)** をリアルタイム追跡。
- 予算消化率プログレスバー表示と、80%警告・100%超過アラート機能。

### 3. マルチモデル対応のユーザー別日次トレンド
- 2026年の最新AIモデル（**Claude 3.7 Sonnet**, **GPT-4o**, **o1**, **Gemini 2.0 Flash** 等）ごとの日次利用量（サジェスト数・チャットターン数）を積み上げ棒グラフで可視化。
- 合計推移ライン（Line）との複合チャート（ComposedChart）により、モデル別シフトや利用急増を直感的に把握可能。

### 4. 3軸グループ内使用量ランキング
- 選択した集計軸（Cost Center / Organization / 任意仕訳グループ）の内部で、利用量上位ユーザーを自動ランク付け。
- 日次・月次・指定期間の全スコープと完全連動し、主要な推進者や偏りを特定。

### 5. 堅牢な異常検出 & エラーログ管理
- APIレートリミットや権限不足、データ取得欠損を検知し、Headerに警告/エラーアイコンを即座に表示。
- **80%×80% モーダルウィンドウ**: 1件あたり3行のスマート省略表示（ワンクリックで全文展開）。
- **ErrorLog JSONエクスポート**: 障害調査用ログをワンクリックでダウンロード可能。
- 取得できなかったデータ項目には `データ取得不可` バッジを表示し、ダッシュボード全体がクラッシュせず安全にフォールバック。

### 6. 多層防御 (Defense-in-Depth) シークレット & PII 流出防止機構
- **OWASP / GitGuardian 準拠の `.gitignore`**: 秘密鍵（`*.pem`, `id_rsa`）、証明書、クラウド認証、`.env*` を徹底除外。
- **AI Agent ガードレール (`.agents/rules/`, `GEMINI.md`, `AGENTS.md`)**: エージェントによるトークン・個人情報のハードコードを常時抑止。
- **エージェント監査スキル (`skills/secret-guard/`) & ローカルスキャナー (`npm run secret-scan`)**: コミット前の自律セルフチェック。
- **CI/CD 自動検査 (`.github/workflows/secret-scan.yml`)**: Gitleaks と独自スキャナーによる PR/Push 時の二重遮断ゲート。
- **完全秘匿化**: 氏名や部署情報の対応テーブルは **GitHub Actions Variables / Secrets (`COPILOT_USER_MAPPING`)** に完全隔離。公開コミット履歴に個人情報（PII）や社内組織図が一切混入しません。

### 7. Fork非競合ストレージアーキテクチャ & 運用保守基盤 (Fork-Safe Storage & Ops)
- メインブランチ（`main`）にデータファイルをコミットせず、**独立データブランチ（`copilot-data`）分離モデル** を採用。
- 日付パーティショニング（`data/raw/YYYY/MM/...`）による追記型（Append-only）保存。
- 本リポジトリが社内で多数Forkされた際にも、Upstreamとの `Sync Fork` や Pull Request でマージ競合が100%発生しません。
- **Fork健全性診断ツール (`npm run fork:verify`)** および本家同期専用スキル（`skills/fork-sync-ops/`）、詳細運用仕様（[SDD-12](docs/specifications/12_fork_sync_and_customization_ops_spec.ja.md)）を完備。

### 8. 遊休シート（Idle Seats）最適化アドバイザー
- 過去30日以上未利用のシートを自動検出し、無駄になっているライセンス費用と削減可能額を算出。
- 該当ユーザー一覧のCSVエクスポートに対応。

### 9. USD 常時基本表示 & サブ通貨（JPY/EUR）併記対応 (Dual Currency FinOps)
- 全9画面、KPI、チャート、テーブルにおいて **USD（`$`）が常時基本通貨として表示** され、グローバル基準のFinOpsコスト管理を徹底。
- オプション設定により、円（`¥`）やユーロ（`€`）などのサブ通貨をカッコ書きで併記（例: `$2,975.00 (¥461,125)`）。
- Enterprise Agreement (EA) ボリュームディスカウントや AI Credits 個別契約単価（`COPILOT_BILLING_CONFIG`）に完全連動。ヘッダーの通貨セレクターから閲覧者がリアルタイムに切替可能。

---

## 🏛️ システムアーキテクチャ

```mermaid
flowchart TD
    subgraph GitHub_Cloud["GitHub Enterprise / Cloud"]
        API["Copilot API (2026.09 LTS)\n- Metrics / Seats / Cost Centers / Multi-Model"]
        Vars["GitHub Variables / Secrets\n- COPILOT_USER_MAPPING (非公開・完全秘匿)"]
        Cron["GitHub Actions Workflow\n(cron: 毎日 00:00 UTC)"]
    end

    subgraph Storage["Fork-Safe Storage (copilot-data orphan branch)"]
        Raw["Raw Partitions\n(data/raw/YYYY/MM/DD/*.json)"]
        Processed["Processed Scopes\n(data/processed/{daily,monthly,custom,error-log}/*.json)"]
    end

    subgraph Hosting["GitHub Pages (Zero Infrastructure)"]
        SPA["分析ダッシュボード (React 18 + Vite + Tailwind + Recharts)\n- 3軸切替 (Org / Cost Center / 任意仕訳)\n- スコープ切替 (日 / 月 / 指定期間)\n- マルチモデルトレンド & ランキング & 予算表示\n- 異常検出モーダル & エラーログExport"]
    end

    API -->|REST API 取得| Cron
    Vars -->|環境変数注入| Cron
    Cron -->|追記コミット & プッシュ| Storage
    Storage -.->|ビルド時インポート| SPA
    Cron -->|actions/deploy-pages| Hosting
```

---

## 📁 ディレクトリ構成

```text
github-copilot-dashboard/
├── .github/
│   ├── ISSUE_TEMPLATE/        # GitHub Issue Forms (バグレポート・機能要望・案内)
│   ├── workflows/             # CI/CD & 定周期バッチ (cron実行, Pages自動デプロイ)
│   ├── dependabot.yml         # 依存関係自動更新設定 (npm & GitHub Actions)
│   └── PULL_REQUEST_TEMPLATE.md
├── dashboard/                 # フロントエンド SPA (React + TypeScript + Tailwind)
│   ├── index.html             # エントリHTML
│   └── src/
│       ├── components/        # 分析カード・チャート・モーダルUIコンポーネント群
│       ├── types/             # ダッシュボード用型定義
│       └── App.tsx            # メインアプリケーション
├── data/                      # ローカル実行 / ビルド時データ領域 (.gitignore対象)
│   ├── mock/                  # 2026年仕様シミュレーションモックデータ
│   ├── processed/             # 集計済みスコープデータ (daily, monthly, custom)
│   └── raw/                   # パーティション別Rawデータ
├── docs/                      # 総合ドキュメントポータル
│   ├── README.ja.md           # ドキュメントポータル総合案内
│   ├── setup_guide.ja.md      # 完全セットアップ & 暗号化運用ガイド
│   ├── models_pricing.md      # Copilot 対応AIモデル & トークン価格一覧
│   └── specifications/        # SDD (仕様駆動開発) 正式設計仕様書 (01〜13)
├── src/                       # データパイプライン & バックエンドコア
│   ├── cli/                   # パイプライン実行CLI (run-pipeline.ts)
│   ├── collector/             # API/モックデータ収集 & 異常検出ハンドラ
│   ├── processor/             # 3軸集計・按分・マルチモデル・ランキング集計
│   ├── storage/               # 追記型Fork非競合ストレージ
│   └── types/                 # Copilot & ドメイン型定義
├── .editorconfig              # エディタ共通フォーマット設定
├── .gitattributes             # Git LF改行コード正規化設定
├── CONTRIBUTING.md            # コントリビューションガイド
├── CODE_OF_CONDUCT.md        # 行動規範 (Contributor Covenant v2.1)
├── SECURITY.md                # セキュリティポリシー & 脆弱性報告手順
├── SUPPORT.md                 # サポート窓口 & FAQ
└── LICENSE                    # MIT License
```

---

## 📖 SDD (仕様駆動開発) 仕様書一覧

本プロジェクトの全機能・データパイプライン・セキュリティ規約は、**仕様駆動開発 (Specification-Driven Development: SDD)** に基づき以下の6つのコア設計領域で定義されています：

1. **要件定義 & コアアーキテクチャ**: [SDD-01](docs/specifications/01_requirements_specification.ja.md)（システム要件定義書） & [SDD-02](docs/specifications/02_system_architecture.ja.md)（システムアーキテクチャ設計書）
2. **Copilot API & データ収集**: [SDD-03](docs/specifications/03_github_copilot_api_spec_2026.ja.md)（GitHub API仕様書 2026.09） & [SDD-09](docs/specifications/09_monthly_usage_report_mode_spec.ja.md)（Monthly Usage Report 分析モード仕様書）
3. **プライバシー & データ完全分離**: [SDD-04](docs/specifications/04_user_attribute_mapping_spec.ja.md)（ユーザー属性情報仕様書・PII秘匿 & GPG暗号化） & [SDD-05](docs/specifications/05_data_storage_and_fork_isolation_spec.ja.md)（orphanブランチ分離ストレージ）
4. **集計エンジン & フロンティアAI評価**: [SDD-06](docs/specifications/06_aggregation_and_billing_logic_spec.ja.md)（3軸コスト按分・予算管理）、[SDD-10](docs/specifications/10_ai_model_benchmark_radar_spec.ja.md)（38モデルベンチマークレーダー評価）、& [SDD-11](docs/specifications/11_deep_analysis_view_spec.ja.md)（AEDP自律駆動深度診断）
5. **ダッシュボード UI/UX**: [SDD-07](docs/specifications/07_dashboard_ui_ux_spec.ja.md)（デザインシステム、異常検出モーダル & 複合チャート）
6. **自動化ワークフロー & Fork運用保守**: [SDD-08](docs/specifications/08_automation_workflow_spec.ja.md)（Actions CI/CD & cron）、[SDD-12](docs/specifications/12_fork_sync_and_customization_ops_spec.ja.md)（Fork先変更反映 & 2層ブランチ運用）、& [SDD-13](docs/specifications/13_fork_restricted_environment_setup_guide.ja.md)（Fork制限環境向けミラー複製手順）

> [!TIP]
> 全13件の仕様書一覧、言語別リンク、およびロール別推奨リーディングパスについては、**[📖 SDD設計仕様書一覧 (docs/specifications/README.ja.md)](docs/specifications/README.ja.md)** または総合案内 **[📚 ドキュメントポータル (docs/README.ja.md)](docs/README.ja.md)** をご覧ください。

---

## 🤖 対応モデル & トークン単価リファレンス

最新のフロンティアAIモデル（GPT-6 Astra, GPT-5.6 Sol/Terra, Claude 5 Opus/Sonnet, Gemini 3.8 Flash 等）38種以上の日次利用量を追跡・可視化します：
- **トークン単価リファレンス**: 入力・キャッシュ・キャッシュ書き込み・出力の100万トークンあたりの最新料金体系は **[docs/models_pricing.md](docs/models_pricing.md)** に整理されています。
- **ベンチマークレーダー評価**: コーディング、推論、数学、エージェント自律度等の6軸レーダー評価は **[SDD-10](docs/specifications/10_ai_model_benchmark_radar_spec.ja.md)** を参照してください。

---

## 🚀 クイックスタート & セットアップ

わずか4ステップで GitHub Pages への自動デプロイが完了します：

### ステップ 1: リポジトリの Fork またはミラー複製
- **通常環境**: 右上の **「Fork」** ボタンをクリックし、社内 Organization にリポジトリを作成します。
- **EMU・制限環境**: 外部Forkが禁止されている組織では、[SDD-13: Fork制限環境向けセットアップ手順書](docs/specifications/13_fork_restricted_environment_setup_guide.ja.md) のミラー複製手順を実施してください。

### ステップ 2: GitHub Pages の設定
1. リポジトリの **Settings** > **Pages** に移動します。
2. **Build and deployment** > **Source** を **「GitHub Actions」** に選択します。

### ステップ 3: Actions 権限の付与
1. **Settings** > **Actions** > **General** に移動します。
2. **Workflow permissions** で **「Read and write permissions」** を選択し、**「Allow GitHub Actions to create and approve pull requests」** にチェックを入れます。

### ステップ 4: 認証トークン & 属性マッピングの設定
**Settings** > **Secrets and variables** > **Actions** で以下を登録します：
- **Secrets**:
  - `COPILOT_READ_TOKEN`: CopilotおよびBillingの読み取り権限（Fine-grained PAT または `manage_billing:copilot`, `read:org`）を持つPAT。
- **Variables**:
  - `COPILOT_ENTERPRISE`: Enterpriseスラッグ（例: `my-enterprise`）、または `COPILOT_ORGS`: カンマ区切りOrg一覧。
  - `COPILOT_USER_MAPPING`: GitHubアカウントと社内部署の対応JSON配列：
    ```json
    [
      { "github_user": "octocat-lead", "display_name": "田中 太郎", "department": "プラットフォーム基盤部", "cost_center_override": "FinTech-Division" }
    ]
    ```
  - `COPILOT_BILLING_CONFIG`: *(任意)* サブ表示通貨（円・ユーロなど）やEA契約ディスカウント率、個別AI Credits単価の設定：
    ```json
    { "subCurrency": { "code": "JPY", "symbol": "¥", "exchangeRateFromUSD": 155.0, "displayDecimals": 0 }, "discountPercent": 15 }
    ```
  - *(テスト運用時)* `MOCK_MODE`: `true` を指定すると、実際のトークンがなくても2026年仕様のシミュレーションデータで即座にダッシュボードが立ち上がります。

> [!NOTE]
> **通貨表示 & 契約課金（EA契約 / AI Credits）設定**、**CSV形式でのマッピング登録**、**48KB超過時のGPG暗号化運用手順**、**認証トークン欠損時のフォールバック機能**、および **本家（Upstream）との定期同期手順** など、詳細な運用設定は **[🚀 完全セットアップ & 環境構築ガイド (docs/setup_guide.ja.md)](docs/setup_guide.ja.md)** を参照してください。

---

## 💻 ローカル開発 & テスト実行

本リポジトリは、GitHub APIトークンがないローカル環境でもフル機能の検証・開発が可能です。

```bash
# 1. 依存ライブラリのインストール
npm install

# 2. Fork環境の診断・同期前健全性チェック
npm run fork:verify

# 3. TypeScript 型チェック
npm run typecheck

# 4. 単体テスト & パイプラインテストの実行
npm test

# 5. シークレット & 個人情報（PII）流出防止スキャンの実行
npm run secret-scan

# 6. 2026年仕様モックデータによる集計パイプライン実行
npm run pipeline:mock

# 7. ローカル開発サーバー起動 (HMR対応)
npm run dev
# -> http://localhost:3000 でインタラクティブダッシュボードが開きます

# 8. プロダクション用ビルド検証
npm run build
```

---

## 🤝 コントリビューション & サポート

コントリビューションやフィードバックを歓迎します！もしこのツールが役に立ちましたら、継続的な開発支援をご検討いただけますと幸いです。

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sun.flat.yamada)

プルリクエストや Issue の起票を歓迎します！
コントリビューションの前に以下のガイドラインをご一読ください：

- [コントリビューションガイド (CONTRIBUTING.md)](CONTRIBUTING.md)
- [行動規範 (CODE_OF_CONDUCT.md)](CODE_OF_CONDUCT.md)
- [セキュリティポリシー (SECURITY.md)](SECURITY.md)
- [サポートガイド (SUPPORT.md)](SUPPORT.md)

---

## 📄 ライセンス

本プロジェクトは [MIT License](LICENSE) の下で公開されています。
Copyright (c) 2026 sun-flat-yamada (Youhei Yamada)
