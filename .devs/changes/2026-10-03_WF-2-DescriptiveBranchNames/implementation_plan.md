# Implementation Plan: Cloud セッションの change-dev ブランチを変更内容がわかる名前にする

- **目的**: Claude Code の Cloud セッションが割り当てる `claude/<形容詞>-<人名>-<ID>`（例 `claude/quirky-cray-71fqmx`）は対象が読み取れない。change-dev が作るブランチを `<type>/<issue>-<slug>` に統一する。
- **Issue**: [sun-flat-yamada/github-copilot-dashboard#242](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/242)
- **ブランチ**: `feat/242-change-dev-branch-naming`（割り当て `claude/quirky-cray-71fqmx` から最初の push 前に改名）

## User Review Required

> [!IMPORTANT]
> `instructions-rules-precedence.md` は「割り当てブランチ以外に push しない」を上書き不可の権限境界としていた。リポジトリオーナーがセッション内で承認した範囲だけ例外にする: change-dev が、最初の push より前に、割り当てブランチを規約名へ改名して push する。`main`・既存のリモートブランチ・他人のブランチは対象外。

> [!WARNING]
> `change-dev:finish` と CI は、規約に合わないヘッドブランチの PR を止める。既存の `claude/<ランダム>` の未マージ PR は改名（新ブランチで PR を作り直す）が必要になる。Dependabot と fork からの PR は対象外。

## 方針

| 論点 | 方針 |
| :--- | :--- |
| 形式 | `<type>/<issue>-<slug>`（Issue がない文書のみの変更は `<type>/<slug>` も可）。`type` は Conventional Commits の種別。`slug` は英小文字・数字・ハイフン、3〜6 語・40 文字以内。全体 60 文字以内 |
| 生成 | `npm run change-dev:branch -- name <type> <issue> "<title>"`。タイトルから slug を作る（ASCII 以外・記号を除去、ストップワードは残す） |
| 検証 | `npm run change-dev:branch -- check [branch]`。`claude/<adj>-<name>-<id>` を Cloud の既定名として個別に指摘 |
| 改名 | `npm run change-dev:branch -- rename <type> <issue> "<title>"`。現在のブランチがリモートに無い（未 push）こと、改名先がローカル・リモートに無いこと、`main` でないことを確認して `git branch -m` |
| 強制 | `change-dev:finish` がマージ前にヘッドブランチ名を検証。CI（`branch-name.yml`）が同リポジトリ PR のヘッドを検証 |
| リポジトリ設定 | ブランチ名パターンの ruleset（metadata restrictions）は GitHub Enterprise 向けのため使わず、CI で強制。SDD-14 に記載 |

## Proposed Changes

- [NEW] `scripts/change-dev-branch.ts`: 命名の純粋関数（`slugify` / `buildBranchName` / `validateBranchName` / `isCloudDefaultBranch`）と CLI。
- [NEW] `src/tests/scripts/change-dev-branch.test.ts`
- [NEW] `.github/workflows/branch-name.yml`
- [MODIFY] `package.json`: `change-dev:branch`
- [MODIFY] `scripts/change-dev-autopilot.ts`: finish でブランチ名を検証。
- [MODIFY] `.agents/rules/git-rules-commit.md`, `development-workflow.md`, `instructions-rules-precedence.md`, `AGENTS.md`, `CLAUDE.md`
- [MODIFY] `.agents/skills/change-dev/SKILL.md`, `skills/change-dev/SKILL.md`, `.agents/change-dev.agent.md`
- [MODIFY] `docs/specifications/14_development_workflow_and_git_ops_spec.md` / `.ja.md`, `CONTRIBUTING.md`
- [MODIFY] `.github/ISSUE_TEMPLATE/work_unit.yml`: How to start にブランチ名。

## Verification Plan

- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` (+ `npm run lint`)
- `npm run change-dev:branch -- name feat 42 "Add cost center export"` → `feat/42-add-cost-center-export`
- `npm run change-dev:branch -- check claude/quirky-cray-71fqmx` → 失敗
