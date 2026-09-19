[English](13_fork_restricted_environment_setup_guide.md) | [日本語](13_fork_restricted_environment_setup_guide.ja.md)

---

# SDD-13: Fork制限環境向けセットアップ手順書 (Fork-Restricted Environment Setup Guide)

- **文書番号**: SPEC-COPILOT-013
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-15

---

## 1. 目的 & 対象読者

企業によっては、GitHub標準の **Fork** ボタンを使って本リポジトリを自社のGitHub Organizationに取り込めない場合があります。最も多い原因は、GitHubアカウントが **Enterprise Managed Users (EMU)** として発行されていることですが、Organization/Enterpriseのポリシーによってフォークがブロックされているケースもあります。

本書は、GitHubのFork機能（Fork Network）に依存せず、本ダッシュボードの完全に独立した動作可能なコピーを取得するための代替手順を提供します。

以下のいずれかに該当する場合に本書を参照してください：
- 本リポジトリで **Fork** ボタンを押しても、対象Organizationがグレーアウト・エラー・無反応になる。
- GitHubのユーザー名が `<名前>_<エンタープライズ略称>` の形式である（EMUアカウントの標準命名規則）。
- 所属組織が Enterprise Managed Users を有効化した GitHub Enterprise Cloud プランに加入している。

---

## 2. 原因切り分けリファレンス

| 症状 | 想定原因 | 管理者による設定変更で解消可能か | 確認コマンド |
|---|---|---|---|
| **自組織の外部**（例：個人アカウント配下の本リポジトリ）に対してのみForkが失敗する | アカウントが **Enterprise Managed User (EMU)** である。EMUアカウントはエンタープライズ外のリポジトリに対して fork・star・watch・issue/PR作成のいずれもできない。これはポリシーではなく製品仕様上のハード制限。 | ❌ 不可 — 管理者・オーナー権限があっても解除不可 | `gh api user --jq .login` — EMUのユーザー名は `_<エンタープライズ略称>` で終わる |
| **自組織が所有する**プライベートリポジトリを外部にForkしようとして失敗する | Organizationの「Repository forking」ポリシー（Member privileges）が自組織のプライベートリポジトリのFork送出を禁止している | ✅ 可能 — Organizationオーナーが設定変更可能 | `gh api orgs/<org> --jq .members_can_fork_private_repositories` |
| 組織全体としてあらゆる取り込みがブロックされる | Organizationがリポジトリ作成自体を禁止している、または許可する公開範囲を制限している | ✅ 可能 — Organizationオーナーが設定変更可能 | `gh api orgs/<org> --jq .members_can_create_repositories` |

> [!NOTE]
> 出典: [Abilities and restrictions of managed user accounts](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/understanding-iam-for-enterprises/abilities-and-restrictions-of-managed-user-accounts) — *"Managed user accounts cannot fork repositories from outside of the enterprise."*（Managed userアカウントはエンタープライズ外のリポジトリをForkできない）

---

## 3. 代替手順: ミラー複製によるリポジトリ複製 (Fork不要)

本手順は、GitHub公式ドキュメントに記載された [Duplicating a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/duplicating-a-repository) のミラー複製手法を用い、Fork機能を一切使用しません。結果として作成されるリポジトリはFork Networkに属さない完全に独立したリポジトリですが、[SDD-05](05_data_storage_and_fork_isolation_spec.ja.md) の Fork非競合ストレージアーキテクチャとの互換性は保たれます — コンフリクト非発生の保証は「独立したリポジトリであること」に由来しており、ミラー複製されたリポジトリもこれを満たすためです。

以下のコマンドは PowerShell (`pwsh`) と、認証済み（`gh auth status`）の [GitHub CLI](https://cli.github.com/) (`gh`) を前提としています。

### 3.1 フェーズ1 — リポジトリの複製

```powershell
# 作業用の一時ディレクトリへ
cd $env:TEMP

# 1. 複製元を匿名ベアクローン (読み取りのみ・EMU/Fork制限の対象外)
git clone --bare https://github.com/sun-flat-yamada/github-copilot-dashboard.git

# 2. 自組織配下に空の複製先リポジトリを作成
gh repo create <YOUR-ORG>/github-copilot-dashboard --private

# 3. 全ブランチ・タグを丸ごとミラーpush (main・copilot-data を含む全履歴を保持)
cd github-copilot-dashboard.git
git push --mirror https://github.com/<YOUR-ORG>/github-copilot-dashboard.git

# 4. 一時ベアクローンを削除
cd ..
Remove-Item -Recurse -Force github-copilot-dashboard.git
```

> [!TIP]
> `copilot-data` ブランチはそのまま複製されます。複製元メンテナー自身のサンプル/デモデータが含まれている場合がありますが、評価目的であればそのまま利用して問題ありません。実データのみで運用したい場合は、自組織のスケジュール実行ワークフローが実データを追記した後に、任意のタイミングで削除・再初期化できます。

#### 3.1.1 通常の GitHub Fork (main のみ複製) における DEMO データの初期導入
GitHub UI の「Fork」ボタンから作成した場合、デフォルトで「Copy the main branch only」が有効となっているため、Fork 直後は `copilot-data` ブランチが存在しません。
この場合、Fork リポジトリをクローンした後に以下のコマンドを実行するだけで、本家から `data/demo/` を自動取得し、Fork 先の `copilot-data` ブランチをワンコマンドで初期化できます：

```bash
# 本家の DEMO データを取得し、自リポジトリの copilot-data ブランチへ初期化 push
npm run demo:setup -- --push
```
これにより、自組織の GitHub Actions / GitHub Pages 環境でも即座に DEMO データ（2026年最新仕様）でダッシュボードを起動・動作確認できるようになります。

### 3.2 フェーズ2 — ローカルクローンの参照先を切り替え

複製元リポジトリのローカルクローンを既にお持ちの場合、再クローンせずにリモートを付け替えるだけで再利用できます：

```powershell
cd <ローカルクローンのパス>

git remote rename origin upstream
git remote add origin https://github.com/<YOUR-ORG>/github-copilot-dashboard.git
git fetch origin
git branch --set-upstream-to=origin/main main

git remote -v
```

### 3.3 フェーズ3 — Actions / GitHub Pages の有効化

ミラー複製されたリポジトリは「新規リポジトリ」として扱われるため、以下は手動設定が必要です（真のForkであっても同様に必要な作業です）：

```powershell
$repo = "<YOUR-ORG>/github-copilot-dashboard"

# GITHUB_TOKEN に書き込み権限があるか確認 (copilot-dataブランチへのpushに必須)
gh api repos/$repo/actions/permissions/workflow
gh api --method PUT repos/$repo/actions/permissions/workflow `
  -f default_workflow_permissions=write `
  -F can_approve_pull_request_reviews=false

# Actionsが有効になっているか確認
gh api repos/$repo/actions/permissions

# GitHub Pages を "GitHub Actions" ビルドソースで有効化
gh api --method POST repos/$repo/pages `
  -f build_type=workflow
```

### 3.4 フェーズ4(任意) — 実データ接続

このフェーズを省略すれば、複製されたデモデータのまま運用できます。自組織の実データを取得したくなった時点で以下を設定してください（各項目の詳細は [SDD-08 §2](08_automation_workflow_spec.ja.md#2-必要な-github-actions-secrets--variables) を参照）：

```powershell
gh variable set COPILOT_ENTERPRISE   --repo $repo --body "<enterprise-slug>"
gh variable set COPILOT_ORGS         --repo $repo --body "<org1,org2>"
gh secret   set COPILOT_READ_TOKEN   --repo $repo --body "<PAT>"
gh variable set COPILOT_USER_MAPPING --repo $repo --body '[{"github_user":"...", "display_name":"...", "department":"..."}]'
```

> [!IMPORTANT]
> `COPILOT_READ_TOKEN` に必要な正確なスコープ/権限は、貴社GitHub Enterprise環境の最新のCopilot API仕様に基づいて確認してください。対応する2種類のトークン方式については [SDD-08 §2.1.1](08_automation_workflow_spec.ja.md#211-認証トークンの種別と付与権限-permissions) を参照。

### 3.5 フェーズ5 — 動作確認

```powershell
gh workflow run copilot-analysis-cron.yml --repo $repo -f mock_mode=true
gh run list --repo $repo --limit 3
gh api repos/$repo/pages --jq .html_url
```

---

## 4. 今後のUpstream同期 (「Sync Fork」ボタンなし)

Fork Networkに属さないリポジトリのため、GitHub UIのワンクリック **Sync Fork** ボタンは利用できません。代わりにフェーズ2で登録した `upstream` リモートを使用します：

```powershell
git fetch upstream
git merge upstream/main
git push origin main
```

[SDD-05](05_data_storage_and_fork_isolation_spec.ja.md) の設計により `main` ブランチには一切データファイルが含まれないため、同期をどれだけ後回しにしてもこのマージは常にコンフリクトなく完了します。

---

## 5. 既知の制約

| 制約 | 詳細 |
|---|---|
| ネイティブな「Sync Fork」UIが使えない | 第4章の手動 `fetch` + `merge` + `push` フローで代替 |
| Upstreamへのfork経由PRフローが使えない | EMUアカウントはForkの可否に関わらず、そもそもエンタープライズ外リポジトリへのissue/PR作成ができない。Upstreamへの貢献が必要な場合は私用の個人(非EMU)GitHubアカウントが別途必要 |
| `copilot-data` の内容を引き継ぐ | ミラー複製された `copilot-data` ブランチには、自組織のワークフローが上書き・追記するまでの間、複製元メンテナーの既存データパーティションがそのまま残る |
| Actions/Pagesの手動設定が必要 | 既に設定済みのリポジトリをForkする場合と異なり、新規ミラー複製では常にActions/Pages未設定の状態から開始する（第3.3節） |

---

## 6. 代替手段の比較

| 選択肢 | 履歴の保持 | EMU制限の回避 | 備考 |
|---|---|---|---|
| **ミラー複製 (第3章)** | ✅ 完全 | ✅ 可能 | 推奨。GitHub公式手順に準拠 |
| GitHub Importer (`github.com/new/import`) | ✅ 完全 | ✅ 可能（ミラー複製と同じ読み書き境界） | UI完結でローカルgit不要。ただし公式ドキュメントは主にGitHub以外のホスティングからの移行を想定 |
| 社内Enterprise/Organization管理者へのエスカレーション | N/A | ❌ 通常不可 | Organizationレベルのforkingポリシー(第2章2行目)が原因の場合のみ有効。EMU制限には効果なし |
| 私用の個人(非EMU)アカウントでFork後、Ownership Transfer | ✅ 完全 | ⚠️ 未確認 | EMU管理下のOrganizationが外部アカウントからの転送を受け付けるかは非公開情報であり、ミラー複製より再現性が低い |

---

## 7. ミラー複製とupstreamとの関係性を可視化する

ミラー複製によって作られたリポジトリは真に独立したリポジトリ（GitHub API上 `isFork: false`, `parent: null`）であるため、GitHubネイティブのFork UI ― リポジトリ名下の「forked from」リンク、fork networkグラフ、fork間の `compare` ビュー ― は一切表示されません。意図的な対応をしない限り、訪問者や将来のメンテナーはこのリポジトリがupstreamを追跡していることを知る手段がありません。これらの対応はいずれも `main`（[SDD-12 §2.2](12_fork_sync_and_customization_ops_spec.ja.md#22-例外-コード改修ui独自機能が必要な場合の2層ブランチ戦略)により、バイト単位でfast-forwardのみ可能なミラーとして維持する必要がある）には一切適用せず、`fork/custom`（本リポジトリのデフォルト/デプロイブランチ）またはリポジトリメタデータのみに適用してください:

1. **リポジトリのDescription・Topics**（gitリスクゼロ ― ファイルではなくサーバー側メタデータ）:
   ```powershell
   gh repo edit <owner>/<repo> --description "Downstream deployment of <upstream-owner>/<upstream-repo> (mirror-based fork; see docs/specifications/13_fork_restricted_environment_setup_guide.md)." --add-topic fork
   ```
2. **`fork/custom` 限定のREADMEバナー**: `README.md`/`README.ja.md` 冒頭の言語切り替え行の直後に、upstreamリポジトリのURL、デュアルブランチモデル（`main`=ミラー、`fork/custom`=カスタマイズ）、`isFork` が `false` になる理由を簡潔に記載したブロック引用を追加する。言語切り替え行とタイトル行という、めったに変更されない2つの基準行の間に自己完結したブロックとして配置することで、将来upstreamのREADME変更を `fork/custom` へ同期する際のマージコンフリクト発生範囲を最小化する。
3. **`main` には追加しない**: upstream自身が含んでいない内容を `main` に少しでも加えると、第4章の同期手順（および[SDD-12](12_fork_sync_and_customization_ops_spec.ja.md)）が前提とする `git merge upstream/main --ff-only` の成立条件が永久に崩れる。

これは純粋にドキュメント・発見性のための取り決めであり、git内部動作・Actions・Pagesの挙動には一切影響しない。
