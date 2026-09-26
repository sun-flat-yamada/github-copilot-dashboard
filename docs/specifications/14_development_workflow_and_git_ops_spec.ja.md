# SDD-14: 開発運用ワークフロー & Git Ops 仕様書 (Development Workflow & Git Ops Specification)

## 1. 概要 (Overview)

本仕様書は、`github-copilot-dashboard` における新機能開発、バグ修正、リファクタリング、ドキュメント更新等の変更作業ライフサイクルを規定する。
本プロジェクトでは、人間のエンジニアに加え、**複数の自律AIエージェント（Antigravity, Gemini, Claude Code, Cursor 等）が並行して稼働する環境**を標準として想定している。

エージェント間や作業間のファイル競合・未コミット変更の巻き込み・マージ事故を防止し、常にクリーンで追跡性の高いリニアコミット履歴（Linear History）を維持するため、以下のコアサイクルを定義する。

```text
[Step 1: Issue作成]
   │ (要件・受け入れ基準の定義、gh issue create)
   ▼
[Step 2: Antigravity 実装計画 (Implementation Plan) & タスク策定]
   │ (implementation_plan.md / task.md アーティファクト生成、対話的Proceed承認)
   ▼
[Step 3: Worktree作業環境の作成]
   │ (リポジトリ同階層に独立ディレクトリを展開: ../<repo>-worktrees/<branch>)
   ▼
[Step 4: SDD策定 & 実装 & ローカル品質ゲート]
   │ (Atomic Commits, Conventional Commits, 5重検証)
   ▼
[Step 5: Walkthrough アーティファクト生成 & エビデンス封印]
   │ (walkthrough.md 生成、テストログ・差分の封印)
   ▼
[Step 6: 最新BaseへのRebase & PR作成]
   │ (git fetch && git rebase, Closes #<issue>, gh pr create)
   ▼
[Step 7: Rebaseマージ & Worktreeクリーンアップ]
   │ (Rebase and Merge, git worktree remove, ブランチ削除)
   ▼
[完了 / 履歴の直線性維持 & エビデンス保証]
```

---

## 2. コミット・プッシュ権限とリポジトリ種別の分離

リポジトリが「**オリジナル（Upstream）**」か「**下流フォーク（Downstream Fork）**」かにより、保護ルールを明確に区別する。

| 対象リポジトリ | `main` への直接コミット・Push | `fork/custom` への直接コミット・Push | 適用されるワークフロー |
| :--- | :--- | :--- | :--- |
| **オリジナル (Upstream: `sun-flat-yamada`)** | 🚫 **厳格に禁止** | 該当なし（ブランチ非存在） | **本ワークフロー（Issue -> Worktree -> PR -> Rebase Merge）を完全強制** |
| **下流フォーク (Downstream Fork)** | ⚠️ 運用上必要な場合は**許可**（非推奨） | ⚠️ 運用上必要な場合は**許可** | 複数エージェント作業や機能開発時は**Worktree+PRを強く推奨**。小規模な設定変更等は直接commit/pushも許容 |

---

## 3. ステップ別運用プロトコル

### 3.1. ステップ 1: Issue作成 (Issue-Driven Development)
すべての変更は原則として1つのGitHub Issueから開始する。

1. **目的と背景の明確化**:
   - なぜこの変更が必要か（Why）
   - 期待される振る舞い・成果物（What）
   - 完了条件（Acceptance Criteria）
2. **作成コマンド例 (`gh` CLI)**:
   ```bash
   gh issue create \
     --title "feat: Add CSV export capability for cost center summaries" \
     --body "## 概要... ## 受け入れ基準..." \
     --label "enhancement"
   ```
3. **発行されたIssue番号**（例: `#42`）を作業ブランチの識別子とする。

---

### 3.2. ステップ 2: Antigravity 実装計画 (Implementation Plan) & タスク策定 (Pre-Execution Gate)

コードの変更やWorktreeの作成に着手する前に、AIエージェントは必ずAntigravityのアーティファクト管理規約に基づき実装計画を策定する。

1. **`implementation_plan.md` の生成**:
   - 会話セッション固有のBrainディレクトリ（`<appDataDir>\brain\<conversation-id>\implementation_plan.md`）に `write_to_file` で書き込む。
   - `ArtifactMetadata` に `{ "UserFacing": true, "RequestFeedback": true, "Summary": "..." }` を指定する。
   - `RequestFeedback: true` によりAntigravity UIに対話型の **"Proceed"** ボタンを表示させ、ユーザーの承認（またはフィードバック）を得るまでコード変更を実行しない。
   - 計画書には、変更コンテキスト、ユーザー確認必須事項（`> [!IMPORTANT]` 等）、変更対象ファイル（`[NEW]`, `[MODIFY]`, `[DELETE]` と `file:///` リンク）、自動/手動検証計画を明記する。
2. **`task.md` の初期化**:
   - チェックリスト形式（`- [ ]`, `- [/]`, `- [x]`）で進捗を追跡するタスクファイルを初期化（`RequestFeedback: false`）。

---

### 3.3. ステップ 3: Worktree作業環境の作成 (並行エージェント分離)

複数エージェントが同一作業コピーで作業すると、ファイルの保存競合や未コミットファイルの混入、Gitインデックスのロック破損が発生する。
そのため、**メイン作業ツリーでの直接作業を禁止し、リポジトリと同階層にWorktreeを展開する**。

#### Worktreeディレクトリの配置規則
リポジトリ内部（`.worktrees/` など）に配置すると、親リポジトリのシークレットスキャン、ビルド対象、Gitトラッキングに影響を与えるリスクがあるため、**必ずリポジトリと同階層（親ディレクトリ直下）** に配置する。

```text
📁 /path/to/workspace/
  ├── 📁 github-copilot-dashboard/          <-- メインリポジトリ (origin/main)
  └── 📁 github-copilot-dashboard-worktrees/ <-- Worktree群格納ディレクトリ
        ├── 📁 feat-42-cost-center-export/   <-- Agent A の独立作業ディレクトリ
        └── 📁 fix-43-prorated-calc/         <-- Agent B の独立作業ディレクトリ
```

#### ブランチ命名規約 (Conventional Branch Naming)
- `feat/<issue-id>-<slug>` : 新機能追加
- `fix/<issue-id>-<slug>` : バグ修正
- `docs/<issue-id>-<slug>` : 仕様書・ドキュメント修正
- `refactor/<issue-id>-<slug>` : 振る舞いを変えないコード整理
- `test/<issue-id>-<slug>` : テストコードの追加・改善
- `chore/<issue-id>-<slug>` : ビルド設定・依存関係更新

#### Worktree作成コマンド
```bash
# 1. 最新のベースブランチ状態を取得
git fetch origin main

# 2. リポジトリ同階層にWorktreeと作業ブランチを同時に作成
git worktree add ../github-copilot-dashboard-worktrees/feat-42-cost-center-export -b feat/42-cost-center-export origin/main

# 3. 作成したWorktreeディレクトリへ移動
cd ../github-copilot-dashboard-worktrees/feat-42-cost-center-export

# 4. 依存関係のセットアップ（必要な場合）
npm ci
```
*(※ プロジェクト提供の `npm run worktree:add feat/42-cost-center-export` を実行すれば、上記ディレクトリ構造の作成と初期化を1コマンドで完了できる)*

---

### 3.4. ステップ 4: SDD策定・実装・ローカル品質ゲート

1. **仕様書先行更新 (SDD原則)**:
   - 設計判断や新機能は `docs/specifications/` を先に更新する。
2. **アトミックコミット (Atomic Commits)**:
   - コミットは単一の関心事ごとに細かく分割する。
   - コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/) に厳格に従う。
     - `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`
3. **タスク進捗更新**:
   - 作業完了に伴い、`task.md` のチェック項目を `- [/]` から `- [x]` へ更新する。
4. **ローカル品質ゲート (必須)**:
   コミットおよびPR作成前に、作業Worktree内で必ず全検証を通過させる。
   ```bash
   npm run fork:verify   # コード・データ分離(SDD-05)の確認
   npm run typecheck     # TypeScript型チェック
   npm test              # ユニットテスト
   npm run secret-scan   # シークレット/PIIゼロ漏洩の検証 (Exit Code 0 必須)
   npm run build         # SPA本番ビルド検証
   ```

---

### 3.5. ステップ 5: Walkthrough アーティファクト生成 & エビデンス封印

全品質ゲートが正常（Exit Code 0）に通過した後、変更内容の検証エビデンスを封印する。

1. **`walkthrough.md` の生成**:
   - 会話セッション固有のBrainディレクトリ（`<appDataDir>\brain\<conversation-id>\walkthrough.md`）に `write_to_file` で書き込む。
   - `ArtifactMetadata` に `{ "UserFacing": true, "RequestFeedback": false, "Summary": "..." }` を指定する。
   - 変更の概要、変更ファイル一覧と diff サマリ、5重品質ゲートの実行結果テーブルを記録する。

---

### 3.6. ステップ 6: 最新BaseへのRebase & PR作成

作業中にベースブランチ（`origin/main`）が進行している可能性があるため、必ず最新のBaseの上にRebaseして競合を解消する。

1. **Rebaseの実行**:
   ```bash
   git fetch origin main
   git rebase origin/main
   ```
   - コンフリクトが発生した場合は、対象ファイルを修正し、品質ゲートを再実行した上で `git add <file>` → `git rebase --continue` を実行する。
2. **リモートへのPush**:
   ```bash
   # 新規ブランチの初回Push
   git push -u origin feat/42-cost-center-export

   # Rebase後に既にリモートにPush済みだった場合（安全なforce push）
   git push --force-with-lease origin feat/42-cost-center-export
   ```
3. **Pull Requestの作成 (`gh` CLI)**:
   ```bash
   gh pr create \
     --base main \
     --head feat/42-cost-center-export \
     --title "feat: Add CSV export capability for cost center summaries (#42)" \
     --body "## 概要... Closes #42"
   ```
   - PR本文に必ず `Closes #42` または `Fixes #42` を明記し、マージ時にIssueが自動クローズされるようにする。

---

### 3.7. ステップ 7: Rebaseマージ & クリーンアップ

#### マージ方式の選定基準: なぜRebaseマージなのか？
本プロジェクトでは、**GitHub上のマージ方式として "Rebase and merge"（または fast-forward）を標準**とする。

- **理由 1: リニアコミット履歴 (Linear History)**:
  `Merge branch 'main' into ...` のような余計な合流コミットを作らず、コミットログが1本の直線になるため、履歴が極めて読みやすい。
- **理由 2: `git bisect` の高信頼性**:
  バグ混入時の二分探索において、マージコミットに起因する偽陰性・複雑性を排除できる。
- **理由 3: Fork同期の競合最小化**:
  下流フォークが `upstream/main` を高速同期（`--ff-only`）する際、マージコミットの乱立を防ぐことでコンフリクトを激減させる。

#### マージ実行コマンド (`gh` CLI)
```bash
# PRのCIがGreenであることを確認後、Rebaseマージを実行しリモートブランチを削除
gh pr merge 42 --rebase --delete-branch
```

#### Worktree & ローカルブランチのクリーンアップ
マージ完了後、役目を終えたWorktreeとローカルブランチを安全に削除する。

```bash
# 1. メインリポジトリに戻る
cd ../../github-copilot-dashboard

# 2. 最新のmainへ更新
git checkout main
git pull --ff-only origin main

# 3. Worktreeの削除
git worktree remove ../github-copilot-dashboard-worktrees/feat-42-cost-center-export

# 4. マージ済みローカルブランチの削除
git branch -d feat/42-cost-center-export
```
*(※ `npm run worktree:clean feat/42-cost-center-export` を使えば自動でWorktree削除とブランチ削除を実行可能)*

---

## 4. エージェント向けセーフガード

1. **メイン作業ツリーの保護**:
   AIエージェントは変更を行う際、メインリポジトリのワーキングツリーでファイルを直接編集してはならない。必ず専用Worktreeを作成してそちらで作業すること。
2. **データの分離 (SDD-05)**:
   Worktree内であっても `data/` や `dashboard/public/data/` を作成・コミットすることは固く禁止される（`copilot-data` orphan branchにのみ存在が許される）。
3. **シークレットスキャン (Exit 0 原則)**:
   いかなるPRも `npm run secret-scan` で1件でも警告が出ている状態での提出は認められない。
