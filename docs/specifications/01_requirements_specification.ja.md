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

### FR-3: 多様な分析スコープの切り替え
ダッシュボードおよび集計エンジンは、以下の時間スコープを即座に切り替えて参照できなければならない：
- **日次スコープ (Daily)**: 任意の日付における利用状況、アクティブ率、日割り費用。
- **月次スコープ (Monthly)**: 暦月（YYYY-MM）における月間累計費用、MAU、遊休コスト。
- **指定期間スコープ (Custom Date Range)**: 任意の開始日〜終了日における推移トレンド、受諾率の推移、累積コスト。

### FR-4: コスト最適化・遊休シート検出 (Idle Seat Detection)
- 過去N日間（デフォルト: 14日/30日）アクティビティがないシートを「遊休シート（Idle Seat）」として検出し、無駄になっている月額コストおよび年間換算コストを可視化すること。
- シートの解約や再割り当ての推奨リストをエクスポートできること。

### FR-5: 自動更新 GitHub Pages ダッシュボード
- GitHub Actionsの定期実行（cron workflow: 毎日指定時刻 UTC 00:00 / JST 09:00等）により、最新データの取得・集計・ダッシュボードビルド・GitHub Pagesへの自動デプロイが完了すること。
- 手動トリガー（`workflow_dispatch`）による即時更新にも対応すること。
- クライアントサイド（ブラウザ）上で高速に動作するSPA（Single Page Application）として構築すること。

---

## 4. 非機能要件 (Non-Functional Requirements)

### NFR-1: Fork非競合データ永続化 (Fork Isolation & Append-Only)
- リポジトリがForkされた際、本家（Upstream）とのGit同期（Sync Fork）やPull Request作成時に**コミット競合が絶対に発生しない**設計とすること。
- ソースコードブランチ（`main`）にデータファイルをコミットしない。
- データ保存は専用ブランチ（`copilot-data`）への追記（Append-Only日付パーティショニング）とし、GitHub Pagesへのデプロイは公式のPages Artifactデプロイを使用すること。

### NFR-2: セキュリティ & 最小権限
- GitHub APIアクセスには GitHub Personal Access Token (Fine-grained PAT) または GitHub App を使用し、必要最小限の権限（`copilot:read`, `enterprise_billing:read`, `org:read`）のみを要求すること。
- 個人名や社内組織情報がパブリックなGitHub PagesやGitログに流出しないよう、環境変数で表示名のマスキング/ハッシュ化オプションを提供すること。

### NFR-3: オフライン・モック対応
- 実際のGitHub EnterpriseやCopilot契約がない開発・検証環境でも、2026年仕様に完全準拠したリアルなモックデータを瞬時に生成し、全機能をローカルおよびCI上でシミュレーション・検証可能とすること。

### NFR-4: 移植性と保守性
- Node.js 20+ / TypeScript を採用し、データパイプラインとダッシュボードの型安全性を100%保証すること。
- 外部データベース（PostgreSQL, RDS等）を一切不要とし、GitHub ActionsとGitHub Pagesのみで完結するゼロインフラ運用を実現すること。
