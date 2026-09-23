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
| `copilot-analysis-cron.yml` | 定期実行 (毎日 UTC 00:00) / 手動実行 (`workflow_dispatch`) | 1. APIから最新データ収集 (認証情報が未設定/権限不足の場合もライブデータ0件として処理を継続)<br>2. 属性リゾルバでマッピング注入<br>3. 多次元集計・費用配賦<br>4. `MOCK_MODE` に応じて `copilot-data`(実データ、追記コミット) または `copilot-data-mock`(モックデータ、force-resetによる非蓄積) ブランチへ保存<br>5. ダッシュボードビルド & GitHub Pagesデプロイ (実データ運用時のみ。モック実行はステップ4で終了) |
| `test-and-preview.yml` | `main` へのPull Request / Push | TypeScript型検査、単体テスト、モックデータによるビルド動作検証 |

---

## 2. 必要な GitHub Actions Secrets / Variables

### 2.1 Secrets
- `COPILOT_READ_TOKEN`:
  - GitHub Enterprise または対象Orgの管理者権限を持つPersonal Access Token (PAT) または GitHub App。
  - ※ モックモード (`MOCK_MODE=true`) 実行時は未設定でも動作可能。実データ運用でも、`COPILOT_READ_TOKEN`/`COPILOT_ENTERPRISE`/`COPILOT_ORGS` が未設定、または権限(Enterprise Owner/Org Admin)不足の場合でもパイプラインは中断しなくなった。詳細は[2.3節](#23-copilot-metricsseats-の認証情報が無い場合の動作)を参照。
- `COPILOT_USER_MAPPING_PASSPHRASE` (オプション):
  - `COPILOT_USER_MAPPING` の48KBサイズ上限を超える大規模ユーザーマッピングを扱うための、GPG暗号化ワークアラウンド用パスフレーズ。
  - `copilot-data` ブランチの `data/config/copilot-user-mapping.json.gpg` を復号する際にのみ使用される。未設定、または対象ファイルが存在しない場合はこのステップ自体がスキップされ、通常どおり `COPILOT_USER_MAPPING`/`COPILOT_USER_MAPPING_BASE64` にフォールバックする。
  - 詳細は [SDD-04 第6章: GPG暗号化ワークアラウンド](04_user_attribute_mapping_spec.ja.md#6-48kb超マッピング向け-gpg暗号化ワークアラウンド-オプション) を参照。

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
   - トークンなしで、GitHub Actions Variables に `MOCK_MODE=true` を設定する（または `workflow_dispatch` の `mock_mode` チェックボックスを有効にする）。
   - 2026年仕様（Claude 3.7 Sonnet、GPT-4o、Gemini 2.0 Flash、38モデルレーダーチャート、FinOps按分など）の全機能が即座に動作し、専用の `copilot-data-mock` ブランチにシミュレーションデータが保存される。実データの `copilot-data` ブランチとは完全に分離されている（[SDD-05 1.3節](05_data_storage_and_fork_isolation_spec.ja.md#13-モック実データブランチ分離)を参照）。
   - **モック実行はGitHub Pagesへのビルド・デプロイを一切行わない。** これにより本番公開中のダッシュボードが常にシミュレーションデータで汚染されないことを保証する。モックモードはあくまでシミュレーションデータの生成・検証用途（例: `git checkout copilot-data-mock` によるローカルプレビュー）であり、本番公開を目的としない。

### 2.3 Copilot Metrics/Seats の認証情報が無い場合の動作

実データ運用 (`MOCK_MODE` 未設定または `false`) で `COPILOT_ENTERPRISE`/`COPILOT_ORGS` が未設定の場合、または設定された認証情報に Enterprise Owner/Org Admin 権限が無い場合でも、パイプラインは**中断しなくなった**。具体的には:
- `fetchMetrics()`/`fetchSeats()` は、無言で失敗したりモックデータへフォールバックしたりせず、`warning`レベルの説明的な issue を記録する（`index.json` の `issues[]` に反映）。
- `index.json` は引き続き生成され、`available_months`・`available_days`・`available_reports` は実際に利用可能なデータのみを反映する（ライブメトリクス/レポートが存在しない場合は捏造したプレースホルダ値ではなく `[]` となる）。
- ライブの Copilot Metrics/Seats API アクセスに依存しない機能 ― 月次利用レポートCSVインポーター (`npm run import:report`)、AIモデルベンチマークレーダー、Cost Center予算宣言 ― は、Enterprise/Org認証情報の欠如や権限不足の影響を受けず正常に動作し続ける。
- ダッシュボードSPAはライブデータ不在の状態を検知し、固定のフォールバック月表示やクラッシュではなく、案内バナー（本来のフェッチエラーバナーとは別枠）を表示する。

### 2.2 Variables
- `COPILOT_USER_MAPPING`:
  - ユーザー名、表示名、仕訳グループ、Cost Center上書き情報のJSON配列文字列。
  - 公開コミットには一切含めず、GitHubのリポジトリ設定（Settings > Secrets and variables > Actions > Variables）で登録。
  - **48KBサイズ上限**: 値が48KB (49,152バイト) を超える場合はGitHub側で設定できない。全社員規模など大規模マッピングが必要な場合は [SDD-04 第6章](04_user_attribute_mapping_spec.ja.md#6-48kb超マッピング向け-gpg暗号化ワークアラウンド-オプション) のGPG暗号化ワークアラウンド(`COPILOT_USER_MAPPING_PASSPHRASE` Secret + `copilot-data` ブランチ経由の暗号化ファイル配布)を利用すること。この場合、ワークフローが実行時に自動復号し `COPILOT_USER_MAPPING_FILE` (復号済みファイルへのローカルパス、`$RUNNER_TEMP` 配下)を内部的に設定するため、管理者がこの変数を直接登録する必要はない。
- `COPILOT_ENTERPRISE`: 対象のEnterpriseスラッグ（Enterprise一括集計時）。
- `COPILOT_ORGS`: 対象のOrganizationスラッグ（カンマ区切り、複数Org対応）。
- `COPILOT_COST_CENTER_BUDGETS`: `{ cost_center_id?, cost_center_name?, spending_limit_usd, free_tier_budget_usd }` のJSON配列。GitHub APIには予算上限を返すエンドポイントが存在しないため、実データ運用でCost Center別予算を表示するには管理者がこの値を宣言する必要がある。VariableまたはSecretのどちらでも設定可能。
- `MOCK_MODE`: 実APIトークンなしでデモ・テスト運用する場合は `true` を指定（または `workflow_dispatch` 実行時に `mock_mode: true` を指定）。シミュレーションデータは実データの `copilot-data` には一切保存されず、隔離された `copilot-data-mock` ブランチにのみ書き込まれる。またSPAビルド・GitHub Pagesデプロイの各ステップは完全にスキップされる。詳細は[2.1.2節](#212-個人契約freeプランgithubアカウント利用時の重要注意点)および[SDD-05 1.3節](05_data_storage_and_fork_isolation_spec.ja.md#13-モック実データブランチ分離)を参照。

---

## 3. 自動デプロイと権限設定 (GitHub Pages)

リポジトリ設定において、GitHub Pagesの Source を **「GitHub Actions」** に設定する。

```yaml
permissions:
  contents: write      # copilot-data ブランチへのデータコミット用
  pages: write         # GitHub Pages へのデプロイ用
  id-token: write      # GitHub Pages OIDCトークン用
```

> [!NOTE]
> `analyze-and-deploy` ジョブには `github.repository == 'sun-flat-yamada/github-copilot-dashboard'` というガードが付与されている。2層ブランチ戦略([SDD-12 第2.2節](12_fork_sync_and_customization_ops_spec.ja.md#22-例外-コード改修ui独自機能が必要な場合の2層ブランチ戦略))を採用し、`main` を恒久的にデプロイ非実行の純粋ミラーとして維持し、実運用パイプラインを自身のカスタマイズ用ブランチへ retarget しているダウンストリームフォークでは、このガードが無い場合、通常の upstream fast-forward 同期を含むあらゆる `main` へのpushのたびに、そのフォーク自身のリポジトリ上で本ジョブが起動を試み、`github-pages` 環境保護ルールに阻まれて失敗してしまう(詳細は[SDD-12 第2.3節](12_fork_sync_and_customization_ops_spec.ja.md#23-forkcustom-運用時の設定チェックリスト-operational-checklist)を参照)。本ガードにより、該当フォークではジョブが失敗ではなくクリーンにスキップされるようになり、本リポジトリ自身の実行には一切影響しない。

### ステップフロー:
1. チェックアウト (`main`)
2. Node.js 22 セットアップ & 依存関係インストール (`npm ci`)
3. 対象ブランチから既存データを復元(実データ運用時は `copilot-data`。モック実行はシミュレーションデータを毎回全量再生成するためスキップ)
4. *(オプション)* GPG暗号化ワークアラウンドによる大容量ユーザーマッピングの復号: `data/config/copilot-user-mapping.json.gpg` と `COPILOT_USER_MAPPING_PASSPHRASE` Secret が両方存在する場合のみ実行され、`$RUNNER_TEMP` 配下に復号後 `COPILOT_USER_MAPPING_FILE` を自動設定する(詳細は[SDD-04 第6章](04_user_attribute_mapping_spec.ja.md#6-48kb超マッピング向け-gpg暗号化ワークアラウンド-オプション)を参照)
5. データ収集・集計スクリプト実行 (`npm run pipeline:run`)。Copilot Metrics/Seats の認証情報が0件でも正常終了する(2.3節参照)
6. 新規データを対象ブランチへ保存: 実データ運用は `copilot-data` への追記コミット、モック運用は `copilot-data-mock` の force-pushによるオーファンブランチ再構築(履歴を蓄積しない)
7. *(実データ運用のみ)* SPAダッシュボードのビルド (`npm run build`)
8. *(実データ運用のみ)* `actions/upload-pages-artifact@v5` で静的アーティファクトをアップロード
9. *(実データ運用のみ)* `actions/deploy-pages@v5` でGitHub Pagesへ公開

> モック実行 (`MOCK_MODE=true`) はステップ6で意図的に終了する。ダッシュボードのビルド・デプロイは一切行われないため、本番のGitHub Pagesサイトがシミュレーションデータで上書きされることはない。
