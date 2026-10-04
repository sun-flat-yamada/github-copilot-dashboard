[English](08_automation_workflow_spec.md) | [日本語](08_automation_workflow_spec.ja.md)

---

# SDD-08: 自動化ワークフロー仕様書 (Automation & CI/CD)

- **文書番号**: SPEC-COPILOT-008
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-10 (2026-10-01 改訂: 公開範囲の事前検査、ステージング/検証ステップ、新しい Secrets/Variables、ソース別縮退。2026-10-04 改訂 (P4-7): 請求突合・レポート・保持期間のステップと変数、`issues: write`)

---

## 1. ワークフロー一覧

| ワークフロー名 | トリガー | 主な責務 |
|---|---|---|
| `copilot-analysis-cron.yml` | 定期実行 (毎日 UTC 00:00) / 手動実行 (`workflow_dispatch`) | 1. **公開範囲の事前検査** (`npm run fork:verify`、実データ運用時のみ): 公開リポジトリや公開 Pages が、実在の・仮名化されていないユーザー単位のデータを公開してしまう状態なら、何も収集する前に失敗させる<br>2. APIからソース別に最新データ収集 (認証情報が未設定/権限不足の場合もライブデータ0件として処理を継続し、ソースごとの状態を記録)<br>3. 属性リゾルバでマッピング注入 (`ANONYMIZE_USERS=true` なら仮名化)<br>4. 多次元集計・費用配賦<br>5. `MOCK_MODE` に応じて `copilot-data`(実データ、追記コミット) または `copilot-data-mock`(モックデータ、force-resetによる非蓄積) ブランチへ保存<br>6. 許可リストの processed データをステージ (`pages:stage`)、ダッシュボードビルド、**ビルド成果物の検証** (`pages:verify`)、GitHub Pagesデプロイ (実データ運用時のみ。モック実行はステップ5で終了) |
| `test-and-preview.yml` | `main` へのPull Request / Push | TypeScript型検査、ESLint (React Hooks ルール、SDD-15 §6)、単体テスト、モックデータによるビルド動作検証 |
| `schema-drift.yml` | 定期実行 (毎週月曜 UTC 01:17) / 手動 | 実 API の応答のスキーマ指紋 (キーパスと型のみ。値は保存しない) を、Reports `users-1-day`・Seats・Cost Centers について、`fixtures/api-contract/` の匿名化した録画フィクスチャと比較する (`npm run schema:drift`)。差分があれば `schema-drift` ラベルの Issue を起票する。Issue には差分の署名マーカーを埋め込み、同じ差分では open の Issue がある間は重複起票しない。`COPILOT_READ_TOKEN` と `COPILOT_ENTERPRISE` / `COPILOT_ORGS` が無い場合はスキップ (失敗にしない)。正本リポジトリのみで動く |

**Raw Landing と再処理 (P1-2)**: 毎日の実行は、API の生の応答を `data/raw/landing/` にも保存する (Run Manifest と内容ハッシュ名のオブジェクト。SDD-05 §2.3)。これらは `data/` の他のファイルと一緒に `copilot-data` へコミットされ、Pages には載せない。ロジックの修正後に、API を呼ばず保存済みの run から成果物を作り直すには、`copilot-data` をチェックアウトした環境で `npm run pipeline:reprocess [-- --run <run_id>]` を実行する (トークン不要)。`ANONYMIZE_USERS=true` のときは何も保存しない。

**契約テストとスキーマドリフト検知 (P1-4)**: `src/tests/adapters/ApiContract.test.ts` が、匿名化したフィクスチャ (`fixtures/api-contract/*.sample.json`。実名・メール・トークンを含まない) で API の既知の形を固定し、取込スキーマとコミット済みの基準 `fixtures/api-contract/fingerprints.json` に照らして検証する。GitHub が応答を変えたら、取込スキーマとフィクスチャを更新してから `npm run schema:drift -- --update-baseline` を実行する。`npm run schema:drift -- --dry-run` は通信なしで配線を確認する。「未検出」と報告されたパスは、サンプルの行にたまたま無かった任意項目の可能性があるため、削除と断定せず確認する。初回の実 API 実行には Enterprise の PAT が必要で、開発環境からは実行していない。

---

## 2. 必要な GitHub Actions Secrets / Variables

### 2.1 Secrets
- `COPILOT_READ_TOKEN`:
  - GitHub Enterprise または対象Orgの管理者権限を持つPersonal Access Token (PAT) または GitHub App。
  - ※ モックモード (`MOCK_MODE=true`) 実行時は未設定でも動作可能。実データ運用でも、`COPILOT_ENTERPRISE`/`COPILOT_ORGS` が未設定ならライブのソースは `skipped`、トークンが無い・権限(Enterprise Owner/Org Admin)不足なら `failed` として記録され、いずれの場合もパイプラインは中断しなくなった。詳細は[2.3節](#23-copilot-metricsseats-の認証情報が無い場合の動作)を参照。
- `ANONYMIZE_SECRET` (**`ANONYMIZE_USERS=true` のとき必須**):
  - 秘密鍵付き HMAC-SHA256 仮名化の秘密鍵 (ランダムな 16 文字以上。例: `openssl rand -hex 32`)。`ANONYMIZE_USERS=true` で鍵が無い (または短い) 場合、パイプラインは何も公開せずに停止する (fail closed)。鍵を変更するとすべての仮名が変わる。詳細は [SDD-04 第5章](04_user_attribute_mapping_spec.ja.md) を参照。
- `COPILOT_USER_MAPPING_PASSPHRASE` (オプション):
  - `COPILOT_USER_MAPPING` の48KBサイズ上限を超える大規模ユーザーマッピングを扱うための、GPG暗号化ワークアラウンド用パスフレーズ。
  - `copilot-data` ブランチの `data/config/copilot-user-mapping.json.gpg` を復号する際にのみ使用される。未設定、または対象ファイルが存在しない場合はこのステップ自体がスキップされ、通常どおり `COPILOT_USER_MAPPING`/`COPILOT_USER_MAPPING_BASE64` にフォールバックする。
  - 詳細は [SDD-04 第6章: GPG暗号化ワークアラウンド](04_user_attribute_mapping_spec.ja.md#6-48kb超マッピング向け-gpg暗号化ワークアラウンド-オプション) を参照。

#### 2.1.1 認証トークンの種別と付与権限 (Permissions)

> **決定 (2026-10-01、プロジェクトオーナー): 認証は PAT のみとし、GitHub App は採用しない。**
>
> **訂正 (2026-10-01)**: ここに最初に記録した根拠 (Enterprise の Copilot シート割り当て API は App のトークンに対応しない) は検索結果の要約に基づくもので、**GitHub 自身の REST API description と食い違う**。`ghec` の `2026-03-10` では、Enterprise のシート・Enterprise の請求 / Cost Center・メトリクスのレポートの各エンドポイントが `enabledForGitHubApps: true` とされている (エンドポイントの本文が記載しているのは PAT のスコープだけ)。App のインストールトークンが各エンドポイントで実際に最後まで動くかは**未検証**である (実際の Enterprise への呼び出しが必要)。決定はオーナーの判断として維持する。PAT の管理が負担になった場合は、実際の呼び出しで検証したうえで見直す。

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
> エンドポイント別のスコープ (REST API description による): Enterprise のメトリクスレポートと Enterprise のシート — `manage_billing:copilot` または `read:enterprise`、Organization のメトリクスレポート — `read:org`、Organization のシート — `manage_billing:copilot` または `read:org`、Enterprise の Cost Center / 請求 — Enterprise owner または billing manager。
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
   - 2026年仕様（Claude 3.7 Sonnet、GPT-4o、Gemini 2.0 Flash、43モデルレーダーチャート、FinOps按分など）の全機能が即座に動作し、専用の `copilot-data-mock` ブランチにシミュレーションデータが保存される。実データの `copilot-data` ブランチとは完全に分離されている（[SDD-05 1.3節](05_data_storage_and_fork_isolation_spec.ja.md#13-モック実データブランチ分離)を参照）。
   - **モック実行はGitHub Pagesへのビルド・デプロイを一切行わない。** これにより本番公開中のダッシュボードが常にシミュレーションデータで汚染されないことを保証する。モックモードはあくまでシミュレーションデータの生成・検証用途（例: `git checkout copilot-data-mock` によるローカルプレビュー）であり、本番公開を目的としない。

### 2.3 Copilot Metrics/Seats の認証情報が無い場合の動作

実データ運用 (`MOCK_MODE` 未設定または `false`) で `COPILOT_ENTERPRISE`/`COPILOT_ORGS` が未設定の場合、または設定された認証情報に Enterprise Owner/Org Admin 権限が無い場合でも、パイプラインは**中断しなくなった**。具体的には:
- ライブの各ソース (`metrics`・`seats`・`cost_centers`) は、自身の `SourceStatus` を `index.json` の `source_status[]` に記録する: `COPILOT_ENTERPRISE`/`COPILOT_ORGS` が未設定なら `skipped` と `warning` の issue、トークン (`COPILOT_READ_TOKEN`) が無い、または API 呼び出しが失敗したなら `failed` と原因を示す `error` の issue。無言で失敗したりモックデータへフォールバックしたりせず、失敗したソースは前回成功時の値を保持する (SDD-02 §2.6)。issue は `index.json` の `issues[]` と `error-log.json` に反映される。
- `index.json` は引き続き生成され、`available_months`・`available_days`・`available_reports` は実際に利用可能なデータのみを反映する（ライブメトリクス/レポートが存在しない場合は捏造したプレースホルダ値ではなく `[]` となる）。
- ライブの Copilot Metrics/Seats API アクセスに依存しない機能 ― 月次利用レポートCSVインポーター (`npm run import:report`)、AIモデルベンチマークレーダー、Cost Center予算宣言 ― は、Enterprise/Org認証情報の欠如や権限不足の影響を受けず正常に動作し続ける。
- ダッシュボードSPAはライブデータ不在の状態を検知し、固定のフォールバック月表示やクラッシュではなく、案内バナー（本来のフェッチエラーバナーとは別枠）を表示する。失敗したソースはデータ状態バナーに表示する (SDD-07 §2.12)。どちらの場合もデモデータへは切り替えない。

### 2.2 Variables
- `COPILOT_USER_MAPPING`:
  - ユーザー名、表示名、仕訳グループ、Cost Center上書き情報のJSON配列文字列。
  - 公開コミットには一切含めず、GitHubのリポジトリ設定（Settings > Secrets and variables > Actions > Variables）で登録。
  - **48KBサイズ上限**: 値が48KB (49,152バイト) を超える場合はGitHub側で設定できない。全社員規模など大規模マッピングが必要な場合は [SDD-04 第6章](04_user_attribute_mapping_spec.ja.md#6-48kb超マッピング向け-gpg暗号化ワークアラウンド-オプション) のGPG暗号化ワークアラウンド(`COPILOT_USER_MAPPING_PASSPHRASE` Secret + `copilot-data` ブランチ経由の暗号化ファイル配布)を利用すること。この場合、ワークフローが実行時に自動復号し `COPILOT_USER_MAPPING_FILE` (復号済みファイルへのローカルパス、`$RUNNER_TEMP` 配下)を内部的に設定するため、管理者がこの変数を直接登録する必要はない。
- `COPILOT_ENTERPRISE`: 対象のEnterpriseスラッグ（Enterprise一括集計時）。
- `COPILOT_ORGS`: 対象のOrganizationスラッグ（カンマ区切り、複数Org対応）。
- `COPILOT_COST_CENTER_BUDGETS`: `{ cost_center_id?, cost_center_name?, spending_limit_usd, free_tier_budget_usd }` のJSON配列。GitHub APIには予算上限を返すエンドポイントが存在しないため、実データ運用でCost Center別予算を表示するには管理者がこの値を宣言する必要がある。VariableまたはSecretのどちらでも設定可能。
- `ANONYMIZE_USERS`: 任意 (SDD-01 §1.1 の社内限定の前提では不要)。`true` にすると、実名のかわりに仮名化したログイン名・氏名・部署を公開する (上記 Secret `ANONYMIZE_SECRET` が必要)。
- `COPILOT_BILLING_CONFIG`: Enterprise の契約価格・為替・割引の JSON (`EnterpriseBillingConfig`、SDD-02 §4.3)。Variable または Secret。未設定なら価格カタログの既定値。不正な JSON は無視されず issue として記録される (ヘッダーの警告件数に反映)。
- `GITHUB_API_VERSION`: `X-GitHub-Api-Version` ヘッダーの値 (既定 `2026-03-10`、SDD-03 §1.1)。
- `COPILOT_ALLOW_PUBLIC_DATA` (オプション): `true` にすると、公開範囲の事前検査の失敗が警告に格下げされる。データを公開することが明示的に受け入れられた判断である場合のみ使用する。
- `COPILOT_PAGES_URL` (オプション): カスタムドメインで配信している場合のダッシュボードの公開 URL。公開範囲の検査が正しいアドレスを調べるために使う (既定 `https://<owner>.github.io/<repo>/`)。
- `COPILOT_BUSINESS_CALENDAR` (オプション): 月次締めの日付を決める JSON `{ "close_business_days": 5, "weekend_days": [0, 6], "holidays": [...] }`。未設定なら翌月の第 5 営業日・土日休み。不正な値は既定値で続行し、Issue として記録する (SDD-17 §3.1)
- `COPILOT_RECONCILIATION_TOLERANCE` (オプション): JSON `{"absolute_usd":1,"percent":1}`。省略したキーは既定 (1 USD かつ 1 %) のまま。両方を超える差で突合の Issue を起票する (SDD-17 §5.2)
- `COPILOT_ALLOW_IDENTIFIED_REPORTS` (オプション): `true` にすると、`identified` 階層のレポートを仮名化なしで生成できる。リポジトリと Pages が社内限定のときだけ使う。`COPILOT_ALLOW_PUBLIC_DATA` ではこのゲートは開かない (SDD-17 §7.3)
- `COPILOT_DATA_RETENTION_MONTHS` (オプション): 12〜600 の整数、既定 60。保持期間のドライラン (`retention:plan`) と運用者の `retention:apply` が使う。ワークフローは削除しない (SDD-17 §8.1)
- `MOCK_MODE`: 実APIトークンなしでデモ・テスト運用する場合は `true` を指定（または `workflow_dispatch` 実行時に `mock_mode: true` を指定）。シミュレーションデータは実データの `copilot-data` には一切保存されず、隔離された `copilot-data-mock` ブランチにのみ書き込まれる。またSPAビルド・GitHub Pagesデプロイの各ステップは完全にスキップされる。詳細は[2.1.2節](#212-個人契約freeプランgithubアカウント利用時の重要注意点)および[SDD-05 1.3節](05_data_storage_and_fork_isolation_spec.ja.md#13-モック実データブランチ分離)を参照。

---

## 3. 自動デプロイと権限設定 (GitHub Pages)

リポジトリ設定において、GitHub Pagesの Source を **「GitHub Actions」** に設定する。

```yaml
permissions:
  contents: write      # copilot-data ブランチへのデータコミット用
  pages: write         # GitHub Pages へのデプロイ用
  id-token: write      # GitHub Pages OIDCトークン用
  issues: write        # 請求突合の Issue を起票する用 (billing:issues、SDD-17 §5.5)
```

> [!NOTE]
> `analyze-and-deploy` ジョブには `github.repository == 'sun-flat-yamada/github-copilot-dashboard' || github.repository_id == '1364445722'` というガードが付与されている(数値のリポジトリIDは、本リポジトリが将来リネームまたは別オーナーへ移管された場合の保険として併記している。`github.repository` はリネーム/移管で値が変わるが、`github.repository_id` は不変であるため — 詳細は[Contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)を参照)。2層ブランチ戦略([SDD-12 第2.2節](12_fork_sync_and_customization_ops_spec.ja.md#22-例外-コード改修ui独自機能が必要な場合の2層ブランチ戦略))を採用し、`main` を恒久的にデプロイ非実行の純粋ミラーとして維持し、実運用パイプラインを自身のカスタマイズ用ブランチへ retarget しているダウンストリームフォークでは、このガードが無い場合、通常の upstream fast-forward 同期を含むあらゆる `main` へのpushのたびに、そのフォーク自身のリポジトリ上で本ジョブが起動を試み、`github-pages` 環境保護ルールに阻まれて失敗してしまう(詳細は[SDD-12 第2.3節](12_fork_sync_and_customization_ops_spec.ja.md#23-forkcustom-運用時の設定チェックリスト-operational-checklist)を参照)。本ガードにより、該当フォークではジョブが失敗ではなくクリーンにスキップされるようになり、本リポジトリ自身の実行には一切影響しない。

### ステップフロー:
1. チェックアウト (`main`)
2. Node.js 22 セットアップ & 依存関係インストール (`npm ci`)
3. 対象ブランチから既存データを復元(実データ運用時は `copilot-data`。モック実行はシミュレーションデータを毎回全量再生成するためスキップ)
4. *(オプション)* GPG暗号化ワークアラウンドによる大容量ユーザーマッピングの復号: `data/config/copilot-user-mapping.json.gpg` と `COPILOT_USER_MAPPING_PASSPHRASE` Secret が両方存在する場合のみ実行され、`$RUNNER_TEMP` 配下に復号後 `COPILOT_USER_MAPPING_FILE` を自動設定する(詳細は[SDD-04 第6章](04_user_attribute_mapping_spec.ja.md#6-48kb超マッピング向け-gpg暗号化ワークアラウンド-オプション)を参照)
5. *(実データ運用のみ)* **公開範囲の事前検査** (`npm run fork:verify`): リポジトリ API・`copilot-data` ブランチの生 index・Pages の index を匿名で調べ、実在の・仮名化されていないユーザー単位のデータが公開されている (または公開されようとしている) 場合は失敗させる (SDD-04 §5.3)。オフライン・レート制限で調べられない場合は警告のみ
6. データ収集・集計スクリプト実行 (`npm run pipeline:run`)。Copilot Metrics/Seats の認証情報が0件でも正常終了する(2.3節参照)
7. 為替カタログを更新する (`npm run catalog:fx`、ECB の月次平均。失敗しても既存カタログを保って続行する)
8. *(実データ運用のみ、`continue-on-error`)* **請求突合の Issue 起票** (`npm run billing:issues`): 計算額と Billing API (AI Credits) の差が許容差 (`COPILOT_RECONCILIATION_TOLERANCE`、既定 1 USD かつ 1 %) を超えた月を、月ごとに 1 件の Issue にする (重複しない)。請求額は Issue に書かない (SDD-17 §5)。`issues: write` が必要
9. *(実データ運用のみ、`continue-on-error`)* **定義駆動レポートの生成** (`npm run reports:generate -- --due`): `reports/*.yaml` の定義のうち期限が来たもの (締め済みの月、今週分) を `data/audit/report-outputs/` に出力し、Pages へは公開しない (SDD-17 §6)。`identified` 階層の定義は、仮名化 (`ANONYMIZE_USERS=true` と `ANONYMIZE_SECRET`) か、運用者による `COPILOT_ALLOW_IDENTIFIED_REPORTS=true` がなければ生成を拒否する (SDD-17 §7.3)。月次締め自体はパイプライン (ステップ 6) の中で `COPILOT_BUSINESS_CALENDAR` に従って実行する (SDD-17 §3.1)
10. *(実データ運用のみ、`continue-on-error`)* **保持期間のドライラン** (`npm run retention:plan`): `COPILOT_DATA_RETENTION_MONTHS` (既定 60) を過ぎたデータを一覧し、期限超過があれば `::warning::` を出す。**何も削除しない**。削除は運用者が `copilot-data` のチェックアウトで明示的に行う (`npm run retention:apply -- --execute --confirm <月>`、SDD-17 §8.3)
11. 新規データを対象ブランチへ保存: 実データ運用は `copilot-data` への追記コミット、モック運用は `copilot-data-mock` の force-pushによるオーファンブランチ再構築(履歴を蓄積しない)
12. *(実データ運用のみ)* AI モデルベンチマークデータセットを更新し、**processed データをステージ** (`npm run pages:stage`): 許可リストの `index.json`・`error-log.json`・全月の `processed/*`・index に載っている日次ファイルを `dashboard/public/data/` へコピーする。Raw データ・元 CSV・暗号化マッピングは決してコピーしない。DEMO パーティションは `data/demo/` から別途ステージする
13. *(実データ運用のみ)* SPAダッシュボードのビルド (`npm run build`)
14. *(実データ運用のみ)* **Pages 成果物の検証** (`npm run pages:verify`): ステージした全ファイル (過去月を含む) が `dist/data/` にあり、非公開のもの (raw・config・元 CSV) が含まれていないことを確認する (SDD-05 §2.2a)
15. *(実データ運用のみ)* `actions/upload-pages-artifact@v5` で静的アーティファクトをアップロード
16. *(実データ運用のみ)* `actions/deploy-pages@v5` でGitHub Pagesへ公開

> モック実行 (`MOCK_MODE=true`) はステップ11で意図的に終了する。ダッシュボードのビルド・デプロイは一切行われないため、本番のGitHub Pagesサイトがシミュレーションデータで上書きされることはない。
