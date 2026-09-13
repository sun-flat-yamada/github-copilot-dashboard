[English](08_automation_workflow_spec.md) | [日本語](08_automation_workflow_spec.ja.md)

---

# SDD-08: 自動化ワークフロー仕様書 (Automation & CI/CD)

- **文書番号**: SPEC-COPILOT-008
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-10

---

## 1. ワークフロー一覧

| ワークフロー名 | トリガー | 主な責務 |
|---|---|---|
| `copilot-analysis-cron.yml` | 定期実行 (毎日 UTC 00:00) / 手動実行 (`workflow_dispatch`) | 1. APIから最新データ収集<br>2. 属性リゾルバでマッピング注入<br>3. 多次元集計・費用配賦<br>4. `copilot-data` ブランチへ追記コミット<br>5. ダッシュボードビルド & GitHub Pagesデプロイ |
| `test-and-preview.yml` | Pull Request / `main` へのPush | TypeScript型検査、単体テスト、モックデータによるビルド動作検証 |

---

## 2. 必要な GitHub Actions Secrets / Variables

### 2.1 Secrets
- `COPILOT_READ_TOKEN`:
  - GitHub Enterprise または対象Orgの管理者権限を持つPersonal Access Token (PAT) または GitHub App。
  - ※ モックモード (`MOCK_MODE=true`) 実行時は未設定でも動作可能。

#### 2.1.1 認証トークンの種別と付与権限 (Permissions)

GitHubの最新仕様に基づき、**Fine-grained Personal Access Token (推奨)** または **Personal Access Token (classic)** を利用できます。

##### A. Fine-grained Personal Access Token (推奨・最小権限)
最小権限（Least Privilege）を適用でき、セキュリティ上最も推奨される方式です。

1. **設定場所**: `Settings` > `Developer settings` > `Personal access tokens` > `Fine-grained tokens` > **Generate new token**
2. **Resource owner**: ⚠️ **必ず個人アカウントではなく、対象の「Organization」を選択**（個人アカウントを選択すると、Organization Permissions が指定できません）。
3. **Repository access**: `Only select repositories`（または `Public Repositories (read-only)` など最小限で可）。
4. **Organization permissions（付与項目）**:
   | 権限項目 (Permission) | 付与レベル | 目的 |
   | :--- | :--- | :--- |
   | **Copilot metrics** | **Read-only** | 日次のコード補完・チャット・モデル別利用メトリクス取得 |
   | **Members** | **Read-only** | シート割当メンバー一覧（`seats`）とアクティビティ日時取得 |
   | **Organization administration** | **Read-only** | Organizationメタデータ・ステータス参照（オプション） |

##### B. Personal Access Token (classic)
1. **設定場所**: `Settings` > `Developer settings` > `Personal access tokens` > `Tokens (classic)` > **Generate new token (classic)**
2. **Select scopes（付与項目）**:
   | スコープ (Scope) | 目的 |
   | :--- | :--- |
   | **`manage_billing:copilot`** | Copilotの利用状況・シート割り当て・課金関連データの読み取り |
   | **`read:org`** | Organizationに所属するメンバー情報およびプロファイルの読み取り |
   | **`read:enterprise`** | Enterprise環境の場合のみ：Enterpriseメタデータ・課金センター参照 |

---

#### 2.1.2 個人契約（Freeプラン）GitHubアカウント利用時の重要注意点

個人アカウントで本ダッシュボードのセットアップ・分析を行う場合は、以下のGitHub API仕様上の制約に留意してください：

> [!WARNING]
> **個人アカウント単体（Copilot Individual / Copilot Free）向けのメトリクスAPIは存在しません**  
> GitHub公式の Copilot Metrics API (`/copilot/metrics`) および Seats API (`/copilot/billing/seats`) は、**GitHub Organization（Copilot Business）** または **GitHub Enterprise（Copilot Enterprise）** 専用のAPIです。個人ユーザー単体の利用メトリクス（`/user/copilot/metrics`）はGitHub仕様上提供されていません。

個人契約（Free）の利用者が本システムをセットアップする際は、以下のいずれかのアプローチを取ります：

1. **無償の GitHub Organization 作成による連携（実データ検証）**:
   - 個人アカウント配下に**無料の GitHub Organization（GitHub Free）** を作成し、そこに Copilot を紐付けます。
   - 上記「2.1.1 A」の手順に従い、**Resource owner に作成したOrganizationを指定**して Fine-grained PAT を発行し、Secrets に `COPILOT_READ_TOKEN`、Variables に `COPILOT_ORGS=<作成したOrg名>` を設定します。
2. **モックモードによる全機能検証（完全無料・トークン不要）**:
   - トークンなしで、GitHub Actions Variables に `MOCK_MODE=true` を設定します。
   - 2026年仕様（Claude 3.7 Sonnet、GPT-4o、Gemini 2.0 Flash、38モデルレーダーチャート、FinOps按分など）の全機能が即座に動作し、GitHub Pages に自動デプロイされます。

### 2.2 Variables
- `COPILOT_USER_MAPPING`:
  - ユーザー名、表示名、仕訳グループ、Cost Center上書き情報のJSON配列文字列。
  - 公開コミットには一切含めず、GitHubのリポジトリ設定（Settings > Secrets and variables > Actions > Variables）で登録。
- `COPILOT_ENTERPRISE`: 対象のEnterpriseスラッグ（Enterprise一括集計時）。
- `COPILOT_ORGS`: 対象のOrganizationスラッグ（カンマ区切り、複数Org対応）。
- `MOCK_MODE`: 実APIトークンなしでデモ・テスト運用する場合は `true` を指定。

---

## 3. 自動デプロイと権限設定 (GitHub Pages)

リポジトリ設定において、GitHub Pagesの Source を **「GitHub Actions」** に設定する。

```yaml
permissions:
  contents: write      # copilot-data ブランチへのデータコミット用
  pages: write         # GitHub Pages へのデプロイ用
  id-token: write      # GitHub Pages OIDCトークン用
```

### ステップフロー:
1. チェックアウト (`main`)
2. Node.js 20 セットアップ & 依存関係インストール (`npm ci`)
3. `copilot-data` ブランチの履歴取得
4. データ収集・集計スクリプト実行 (`npm run pipeline:run`)
5. 新規データファイルを `copilot-data` ブランチへPush
6. SPAダッシュボードのビルド (`npm run build`)
7. `actions/upload-pages-artifact@v3` で静的アーティファクトをアップロード
8. `actions/deploy-pages@v4` でGitHub Pagesへ公開
