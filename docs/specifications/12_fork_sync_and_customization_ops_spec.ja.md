[English](12_fork_sync_and_customization_ops_spec.md) | [日本語](12_fork_sync_and_customization_ops_spec.ja.md)

---

# SDD-12: Fork先変更反映 & 運用保守仕様書 (Fork Synchronization & Operations Specification)

- **文書番号**: SPEC-COPILOT-012
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-16
- **関連文書**: [SDD-05 (データ永続化 & Fork非競合ストレージ仕様書)](05_data_storage_and_fork_isolation_spec.ja.md), [SDD-08 (自動化ワークフロー仕様書)](08_automation_workflow_spec.ja.md), [SDD-13 (制限環境向けFork運用セットアップガイド)](13_fork_restricted_environment_setup_guide.ja.md)

---

## 1. 概要と基本原則 (Overview & Core Principles)

### 1.1 背景
`github-copilot-dashboard` は、多くの企業や組織の GitHub Enterprise / Organization で Fork され、各組織独自の Copilot 利用分析・FinOps コスト按分基盤として運用されます。
本家リポジトリ（Upstream: `sun-flat-yamada/github-copilot-dashboard`）では、新規AIモデル（Claude Sonnet 5、GPT-6、Gemini 3.x 等）への追従、ベンチマーク更新、FinOps 分析ロジックの改善、UI/UX の向上、セキュリティパッチが継続的にリリースされます。

Fork 先運用者がこれらの最新更新を安全かつ迅速に取り込み、日々の自動集計や蓄積済みデータに影響を与えることなく運用を継続するための標準仕様および運用手順を本仕様書で規定します。

### 1.2 4大運用原則 (Four Core Principles)

```mermaid
flowchart TD
    subgraph Principles["Fork運用 4大原則"]
        P1["1. コードとデータの完全分離\n(mainはコードのみ / copilot-dataにデータ隔離)"]
        P2["2. Zero-Code Customization\n(設定はすべてVariables/Secretsに逃がす)"]
        P3["3. Fast-Forward 同期優先\n(mainブランチの履歴をクリーンに保つ)"]
        P4["4. 継続的健全性検証\n(同期前後の自動診断 & 品質ゲート通過)"]
    end
```

1. **コードとデータの完全分離 (Code-Data Decoupling)**:
   - `main` ブランチはコードファイルのみを保持し、データファイル（`data/`）は一切コミットしません（SDD-05準拠）。
   - 蓄積データはすべて独立した orphan ブランチ（`copilot-data`）に追記型で保存されるため、コード同期時にデータ競合が発生する余地を物理的に排除します。
2. **Zero-Code Customization (設定とコードの分離)**:
   - 組織名、Enterpriseスラッグ、ユーザー属性マッピング、認証トークンなどは、すべて GitHub Actions の Variables および Secrets に注入します。
   - Git で管理されるソースコードを書き換えない運用を徹底することで、本家更新を 100% 無競合（Conflict-Free）で同期可能とします。
3. **Fast-Forward 同期優先 (Fast-Forward First)**:
   - Fork 先の `main` ブランチは本家の `main` と完全に同一のコミット履歴を維持することを原則とします。
4. **継続的健全性検証 (Continuous Verification)**:
   - 同期実行の前後に診断ツール（`npm run fork:verify`）を実行し、Git 設定、リモート構成、データ隔離状態、秘密情報の有無を自動検証します。

---

## 2. Fork先での設定・独自カスタマイズ運用方式 (Configuration & Customization)

### 2.1 原則: Zero-Code Customization (推奨・標準)
社内固有の情報は、Git コミットではなく以下の GitHub Actions Variables / Secrets に登録します：

| 設定種別 | 項目名 | 格納場所 | 内容・目的 |
|---|---|---|---|
| **Secret** | `COPILOT_READ_TOKEN` | Settings > Secrets > Actions | API読み取り用 Fine-grained PAT または GitHub App トークン |
| **Variable** | `COPILOT_USER_MAPPING` | Settings > Variables > Actions | 氏名・社内部署・Cost Center上書きのJSON配列（機密性が極めて高い場合はSecret可） |
| **Variable** | `COPILOT_ORGS` | Settings > Variables > Actions | 分析対象のOrganization名（カンマ区切り） |
| **Variable** | `COPILOT_ENTERPRISE` | Settings > Variables > Actions | 分析対象のEnterpriseスラッグ（Enterprise一括集計時） |
| **Variable** | `COPILOT_COST_CENTER_BUDGETS` | Settings > Variables > Actions | `{ cost_center_id?, cost_center_name?, spending_limit_usd, free_tier_budget_usd }` のJSON配列。GitHub APIには予算上限を返すエンドポイントが存在しないため、実データ運用でCost Center別のFinOps予算対比表示を有効化するには管理者がこの値を宣言する必要がある |
| **Variable** | `MOCK_MODE` | Settings > Variables > Actions | 実APIトークンなしで動作検証する場合は `true` |

この方式を採る限り、Fork 先の `main` ブランチ上のファイル差分はゼロとなり、本家からの更新をボタン 1 つで適用できます。

---

### 2.2 例外: コード改修（UI/独自機能）が必要な場合の2層ブランチ戦略
社内ポータルへの埋め込み対応、独自ロゴ/ヘッダーの変更、追加分析ロジックの実装など、ソースコード改修が不可避な場合は、以下の **「クリーン `main` ＋ 独自改修ブランチ」** の 2 層構成を採用します。

```text
[Upstream: sun-flat-yamada/github-copilot-dashboard]
  main ───●───●───● (新機能・バグ修正)
          │   │   │ (Fast-Forward 同期)
          ▼   ▼   ▼
[Fork: my-org/github-copilot-dashboard]
  main ───●───●───● (常に Upstream と 100% 同一)
          │       │
          │       └────────┐ (merge main)
          ▼                ▼
  fork/custom ───■───■────▲ (社内独自UI・拡張機能)
                 (独自改修)
```

- **`main` ブランチ**: 独自コミットを一切打たず、常に Upstream のミラーとして運用。
- **`fork/custom` ブランチ**: `main` から分岐し、社内独自の改修コミットを蓄積。
- **同期運用**:
  1. まず `main` を Upstream と Fast-Forward 同期。
  2. `fork/custom` ブランチに切り替え、`git merge main` を実行。
  3. GitHub Pages のビルド対象ブランチを `fork/custom` に設定（必要に応じてワークフロー内のトリガーブランチを調整）。

---

### 2.3 `fork/custom` 運用時の設定チェックリスト (Operational Checklist)
`fork/custom` に独自コミットが存在するようになったら、定期実行/CIワークフロー側も
明示的にそのブランチを参照するよう変更しないと、日次cronやPagesデプロイは
黙って `main`（Upstream）のコードのまま動き続け、Fork独自の修正や機能が
本番に反映されません。実運用では、以下の4つの設定を**同時に**変更する必要があり、
どれか一つでも欠けると「一部だけ反映された」不可解な状態に陥ります。

1. **ワークフローのトリガー参照先を変更する**: 独自コードを実行したい各ワークフローで、
   `push:`/`pull_request:` のブランチフィルタと `actions/checkout` の `ref:` を
   `main` から `fork/custom` へ変更する。
2. **リポジトリの Default Branch を `fork/custom` に設定する**
   (**Settings** > **General** > **Default branch**)。`schedule:` トリガーは
   ジョブ内の `ref:` に関わらず、常に Default Branch 上の workflow *定義* を
   読み込むため、checkoutステップの変更だけでは不十分であり、
   「ワークフローを直しても旧コードのまま動く」混乱の典型的な原因となる。
3. **デプロイ先環境のブランチポリシーを更新する**(例: **Settings** >
   **Environments** > `github-pages` > **Deployment branches and tags**)。
   `fork/custom` を明示的に許可する。これは前述の Default Branch 設定とは独立しており、
   未設定だとデプロイジョブが「Branch is not allowed to deploy to github-pages due
   to environment protection rules.」で失敗する。
4. **独自コードが追加した新しい環境変数を、retarget後のワークフローにも配線する**
   (例: fork独自コードが参照する新しい `COPILOT_*` 系変数)。アプリケーションコード側に
   宣言があるだけでワークフローの `env:` に渡していない変数は、CI上では黙って
   無効なまま残る。

> [!TIP]
> `test-and-preview.yml` の `push` トリガーは（`pull_request` のretargetに加えて）
> `main` と `fork/custom` の**両方**に設定しておくと、別ワークフローを追加しなくても
> Upstream からの fast-forward 同期直後と通常のFork側開発の両方でCIシグナルが得られる。

GitHub EMU / ポリシー制限のある組織における同種のチェックリスト（一部設定が
管理者により制限されており、例外申請が必要となる場合の対応）は
[SDD-13](13_fork_restricted_environment_setup_guide.ja.md) を参照してください。

---

## 3. Upstream 更新の同期手順 (Upstream Synchronization Procedures)

### 3.1 アプローチ A: GitHub Web UI による同期 (1-Click Sync Fork)
コード無改修（Zero-Code Customization）で運用している場合に最も手軽な方法です。

1. Fork 先リポジトリのトップページ（`https://github.com/<your-org>/github-copilot-dashboard`）を開きます。
2. ブランチが `main` になっていることを確認します。
3. リポジトリ上部に表示される **「Sync fork」** ドロップダウンをクリックします。
4. **「Update branch」** をクリックします。
   - コンフリクトがない場合、自動的に Fast-Forward またはマージコミットが生成され同期が完了します。
5. **Actions** タブを開き、同期トリガーによる CI 検査（`test-and-preview.yml` 等）が通過したことを確認します。

---

### 3.2 アプローチ B: Git CLI による標準同期手順 (Recommended Operator Runbook)
CLI 環境や AI エージェント（`fork-sync-agent`）が同期を行う場合の標準運用手順です。

#### ステップ 1: リモートリポジトリの設定確認
```bash
git remote -v
```
`upstream` が未登録の場合は追加します：
```bash
git remote add upstream https://github.com/sun-flat-yamada/github-copilot-dashboard.git
```

#### ステップ 2: 同期前の健全性診断 (Pre-flight Check)
作業ツリーのクリーン度およびリポジトリ状態を検査します：
```bash
npm run fork:verify
```
未コミットの変更がある場合や、`main` にデータファイルが混入している場合は、後述のトラブルシューティングに従って解消します。

#### ステップ 3: Upstream の最新情報を取得 & 差分確認
```bash
git fetch upstream main

# コミットログ差分の確認
git log HEAD..upstream/main --oneline

# 変更ファイル概要の確認
git diff HEAD..upstream/main --stat
```

#### ステップ 4: Fast-Forward マージの実行
```bash
git checkout main
git merge upstream/main --ff-only
```
> [!NOTE]
> `--ff-only` を指定することで、Fork 側で予期せぬローカルコミットが存在した場合に意図しないマージコミットの発生を防ぎます。

#### ステップ 5: 依存関係更新 & 品質ゲート検証
```bash
# 依存関係の最新化
npm ci

# プロジェクト全体の品質ゲート検証
npm run typecheck
npm test
npm run secret-scan
npm run build
```

#### ステップ 6: Fork 先リモート（origin）へのプッシュ
```bash
git push origin main
```

#### ステップ 7: デプロイパイプラインの動作確認
GitHub Actions の最新実行ステータスを確認するか、手動トリガーで動作検証します：
```bash
# GitHub CLI を使用する場合
gh workflow run copilot-analysis-cron.yml
gh run watch
```

---

### 3.3 アプローチ C: GitHub Actions 自動同期ワークフロー (Scheduled Sync)
本家更新の検知と同期を自動化したい場合は、定期実行ワークフローを導入できます。

```yaml
name: Scheduled Upstream Sync

on:
  schedule:
    # 毎週月曜 UTC 01:00 (JST 10:00) に同期チェック
    - cron: '0 1 * * 1'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout main
        uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git remote add upstream https://github.com/sun-flat-yamada/github-copilot-dashboard.git

      - name: Sync and Fast-Forward
        run: |
          git fetch upstream main
          if git merge-base --is-ancestor upstream/main HEAD; then
            echo "✅ Already up-to-date with upstream."
            exit 0
          fi
          git merge upstream/main --ff-only
          git push origin main
          echo "✅ Successfully synced and pushed upstream updates."
```

---

### 3.4 DEMO データの初期導入・同期手順 (Fork DEMO Dataset Provisioning & Sync)
GitHub UI から Fork を作成した場合、デフォルトで「Copy the main branch only」が有効となっているため、Fork 直後は `copilot-data` ブランチ（およびデータファイル全般）が存在しません。
Fork 先でダッシュボードの表示確認や開発・テストを即座に行うため、本家リポジトリから Live Metrics DEMO データ（2026年最新仕様）を取り込むターンキーコマンドが提供されています。

#### 3.4.1 ワンコマンド導入 (`npm run demo:setup`)
```bash
# 本家の copilot-data から data/demo/ を取得し、自リポジトリの copilot-data へ push
npm run demo:setup -- --push
```

このスクリプトは以下の処理を自動実行します：
1. 本家リポジトリ（`sun-flat-yamada/github-copilot-dashboard`）の `copilot-data` から `data/demo/` パーティションを取得
2. ネットワーク遮断環境や本家到達不能時は、ローカル合成ジェネレータ（`scripts/generate-demo-data.ts`）にフォールバックして高忠実度デモデータを自動生成
3. 一時作業ツリー経由で Fork 先の `copilot-data` ブランチを作成/更新し、`--push` が指定されていればリモート（`origin/copilot-data`）へプッシュ
4. ローカル開発用公開ディレクトリ（`dashboard/public/data/demo/`）へ即時配置

#### 3.4.2 主なコマンドオプション
- `npm run demo:setup -- --push`: リモート `origin/copilot-data` への反映まで一括完了（推奨）
- `npm run demo:setup -- --local`: ローカル開発・プレビュー専用（リモートにはコミット/プッシュしない）
- `npm run demo:setup -- --upstream <git-url>`: 独自の本家/中間リポジトリからデモデータを取得する場合に指定
- `npm run demo:import`: `demo:setup` のエイリアス

#### 3.4.3 導入後の確認
導入が完了したら、健全性診断を実行して `data/demo/` パーティションが正しく認識されていることを確認します：
```bash
npm run fork:verify
```
診断項目に `✅ DEMO Dataset Partition (data/demo/): Present` が表示されれば準備完了です。ローカルで `npm run preview` を起動し、ヘッダーの「DEMO (Mock)」バッジをクリックすることで即座にデモデータを閲覧できます。

---

## 4. 同期後健全性検証チェックリスト (Post-Sync Health Check)

同期が完了した後、運用者は以下の 5 項目を必ず確認します：

```text
[同期後検証チェックリスト]
☐ 1. データ保全性チェック: copilot-data ブランチの履歴と最新パーティションが存在すること
☐ 2. セキュリティ & PII 監査: npm run secret-scan が 0 件で合格すること
☐ 3. 型安全性 & 自動テスト: npm run typecheck && npm test が全件合格すること
☐ 4. パイプライン実行確認: copilot-analysis-cron.yml が正常完了（緑アイコン）であること
☐ 5. GitHub Pages 表示確認: 公開URLにアクセスし、ダッシュボードの新機能や集計結果が正しく描画されること
```

上記チェックは、診断スクリプトによって自動一括実行が可能です：
```bash
npm run fork:verify
```

---

## 5. トラブルシューティング & 障害復旧 (Troubleshooting & Remediation)

### ケース 1: Fork 先の `main` ブランチに誤ってデータ（`data/`）をコミットしてしまった
- **事象**: `main` ブランチに `data/` や `dashboard/public/data/` が追跡され、Upstream との同期時にコンフリクトが発生する。
- **原因**: ローカルでパイプラインを手動実行した際、`.gitignore` の指定漏れや強制追加（`git add -f`）でコミットしてしまった。
- **復旧手順**:
  ```bash
  # 1. 作業ディレクトリ内のデータを保持したまま、Git追跡のみを解除
  git rm -r --cached data/ dashboard/public/data/ 2>/dev/null || true

  # 2. .gitignore が最新であることを確認
  git checkout upstream/main -- .gitignore

  # 3. 追跡解除をコミット
  git commit -m "fix: untrack data files from main branch (restore fork isolation)"

  # 4. copilot-data ブランチのデータは独立しているため影響なし
  ```

---

### ケース 2: Fork 側で不要なローカルコミットが存在し `--ff-only` が失敗する
- **事象**: `fatal: Not possible to fast-forward, aborting.` が発生する。
- **原因**: Fork 先の `main` ブランチで直接ファイルの変更・コミットを行ってしまった。
- **復旧手順**:
  1. 独自変更を残す必要がない場合（Upstreamと完全に一致させる場合）:
     ```bash
     git fetch upstream
     git reset --hard upstream/main
     git push origin main --force-with-lease
     ```
  2. 独自変更を保持したい場合:
     ```bash
     # 1. 独自変更を別ブランチへ退避
     git branch fork/custom-backup
     
     # 2. main を Upstream にリセット
     git reset --hard upstream/main
     git push origin main --force-with-lease
     
     # 3. 退避した独自変更を fork/custom ブランチで再構成
     git checkout -b fork/custom fork/custom-backup
     ```

---

### ケース 3: GitHub Actions のプッシュ権限エラー (403: Resource not accessible)
- **事象**: `copilot-analysis-cron.yml` の「Commit and Push to data branch (Fork-Safe Storage)」ステップで `403 Forbidden` となる。
- **原因**: Fork リポジトリでは、初期状態で GitHub Actions の書き込み権限が無効化されている場合がある。
- **解決手順**:
  1. Fork リポジトリの **Settings** > **Actions** > **General** を開く。
  2. **Workflow permissions** セクションで **「Read and write permissions」** を選択する。
  3. **「Allow GitHub Actions to create and approve pull requests」** にチェックを入れる。
  4. **Save** をクリックする。

---

### ケース 4: GitHub Pages が 404 になる、または更新されない
- **事象**: `https://<org>.github.io/github-copilot-dashboard/` にアクセスしても 404 が返る。
- **解決手順**:
  1. **Settings** > **Pages** を開く。
  2. **Build and deployment** > **Source** を **「GitHub Actions」** に切り替える（`Deploy from a branch` ではなく `GitHub Actions` を選択）。
  3. **Actions** タブから `copilot-analysis-cron.yml` を手動実行（Run workflow）する。

---

## 6. Fork先から Upstream への機能還元 (Contributing Back to Upstream)

Fork 先で開発した汎用的なバグ修正、新しいモデルのベンチマーク定義、UI 改善などを本家に還元する（Pull Request を作成する）際の手順：

1. **トピックブランチの作成**:
   Upstream の最新 `main` から分岐したクリーンなブランチを作成します：
   ```bash
   git checkout -b feature/my-improvement upstream/main
   ```
2. **社内情報・PII・実データの完全排除**(必須。両方とも exit 0 であること):
   - `COPILOT_USER_MAPPING` に含まれる実際の氏名・部署・社員番号、または組織固有のCopilot利用実績・請求データが、コード・テストフィクスチャ・ドキュメントのいずれにも混入していないことを確認。
   - `npm run secret-scan` を実行(作業ツリー全体を対象にした汎用シークレット/PIIパターンスキャン)。
   - `npm run upstream:audit -- upstream/main feature/my-improvement` を実行([6.1節](#61-upstream-データ流出防止機構-npm-run-upstreamaudit)参照)。候補ブランチと `upstream/main` との差分を専用にチェックし、実データ保護パターン(`AIUsageReport*.csv`・`*<yyyymm>.csv`・`data/`・ユーザーマッピング/組織図ダンプ等)に一致するファイルが1つでもあれば失敗する。secret-scanの再実行も含む。
3. **PR 作成**:
   - 本リポジトリが upstream のネイティブGitHub forkである場合は、`origin` にブランチをpushし、通常通りGitHub UI上でPRを作成する。
   - 本リポジトリが([SDD-13](13_fork_restricted_environment_setup_guide.ja.md)のミラー複製手順で作成されており)upstreamとfork network上で連結していない場合、通常のリポジトリ間PR(`head: <このリポジトリ>:branch` → `base: <upstreamリポジトリ>:main`)は利用できない。代わりに、upstream側で書き込み権限を持つ私用の個人(非EMU)GitHubアカウント([SDD-13 §5](13_fork_restricted_environment_setup_guide.ja.md#5-既知の制約)参照)で監査済みブランチを直接pushし、同一リポジトリ内PRを作成する:
     ```bash
     gh auth switch --user <個人のupstreamアカウント>
     git push <書き込み権限のあるupstreamリモート> feature/my-improvement
     gh pr create --repo sun-flat-yamada/github-copilot-dashboard \
       --base main --head feature/my-improvement \
       --title "..." --body "..."
     gh auth switch --user <通常のfork側アカウント>
     ```
     PR作成後は直ちに通常のEMU/fork側アカウントへ切り戻し、以降のコマンドが誤って別リポジトリのコンテキストで実行されることを防ぐ。
   （※ `data/` ディレクトリは追跡されていないため、PR の差分にデータファイルが含まれる心配はありません）

### 6.1 Upstream データ流出防止機構 (`npm run upstream:audit`)

`scripts/audit-upstream-contribution.ts` は、組織固有データがupstreamへの貢献に紛れ込むことを防ぐ専用のガードであり、汎用的な `npm run secret-scan` を補完する、貢献差分に特化したより厳格なチェックです:

- `git diff <base>...<candidate>` (デフォルトは `upstream/main` 対 `HEAD`) の変更ファイル一覧を計算する ― すなわち `candidate` から作られるPRが実際に持ち込むファイルそのもの。
- 変更された各ファイルパスを、`.gitignore` が強制する実データパターン(`AIUsageReport*.csv`、`YYYYMM`・`YYYY-MM` 両形式の `*<yyyymm>.csv`、`data/`、`dashboard/public/data/`)、および PII・シークレットのファイル名パターン(`user_mapping.*`、`copilot_user_mapping*`、`internal_org_chart.*`、`secrets.*`、`credentials.json` 等)と照合する。
- 併せて `runSecretScan()` を再実行し、ファイル内容ベースのシークレット検知も行う。
- 何か検出された場合は非ゼロで終了し、違反ファイルとマッチしたルールを全て出力する。候補差分に実データファイルもハードコードされたシークレットも一切無いと確認できた場合のみ exit 0。

```bash
npm run upstream:audit                              # HEAD vs upstream/main (デフォルト)
npm run upstream:audit -- upstream/main my-branch    # base/candidateを明示指定
```

非ゼロ終了は必ずハードブロッカーとして扱うこと ― これに合格するまでupstreamへのpushやPR作成を行ってはならない。
