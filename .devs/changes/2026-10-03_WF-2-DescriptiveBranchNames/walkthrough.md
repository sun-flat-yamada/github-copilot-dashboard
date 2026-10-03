# Walkthrough: Cloud セッションの change-dev ブランチを変更内容がわかる名前にする

## Summary

Cloud セッションが割り当てる `claude/<形容詞>-<人名>-<ID>` を、change-dev が最初の push の前に `<type>/<issue>-<slug>` へ改名するようにした。命名規則をルールに明文化し、生成・検証・改名のヘルパーを追加し、`change-dev:finish` と CI で強制する。本変更自体も割り当て `claude/quirky-cray-71fqmx` から `feat/242-change-dev-branch-naming` に改名して push した。

## Changes Made

- `scripts/change-dev-branch.ts`（新規）: `name` / `check` / `rename`。Cloud 既定名（`claude/<adj>-<name>-<id>`、`ccr-<hex>-<id>`）を個別に指摘。`rename` は push 済み作業のあるブランチ・既存名・`main` を拒否し、旧 upstream を外す。
- `scripts/change-dev-autopilot.ts`: `finish` がマージ前にヘッドブランチ名を検証。
- `.github/workflows/branch-name.yml`（新規）: 同一リポジトリの PR のヘッドブランチ名を検証（Dependabot・fork は対象外）。
- `src/tests/scripts/change-dev-branch.test.ts`（新規）: 11 テスト。
- ルール: `git-rules-commit.md` §2（形式の正本）、`development-workflow.md`、`instructions-rules-precedence.md`（オーナー承認済みの改名例外と競合表）、`AGENTS.md`、`CLAUDE.md`（`/branch`）。
- skill / agent: `.agents/skills/change-dev/SKILL.md`、`skills/change-dev/SKILL.md`、`.agents/change-dev.agent.md`。
- SDD-14 EN/JA、`CONTRIBUTING.md`、`.github/ISSUE_TEMPLATE/work_unit.yml`。

## Verification Results

| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Exit 0 |
| TypeScript Check | `npm run typecheck` | ✅ Exit 0 |
| Unit Tests | `npm test` | ✅ 849/849 |
| Secret / PII Scan | `npm run secret-scan` | ✅ 0 findings |
| Production Build | `npm run build` | ✅ within bundle budget |
| Lint | `npm run lint` | ✅ Exit 0 |
| Plan first | `npm run change-dev:plan-check` | ✅ plan commit precedes implementation |

Manual checks:

- `change-dev:branch -- name feat 42 "Add cost center export"` → `feat/42-add-cost-center-export`
- `change-dev:branch -- check claude/quirky-cray-71fqmx` → exit 1 with the rename hint
- `change-dev:branch -- name --issue 242` → reads the Issue title over REST → `feat/242-name-cloud-session-branches-after-change`
- `rename` in a scratch clone: `claude/test-dummy-abc123` → `fix/999-throwaway-rename-test`, upstream unset; renaming to the existing `feat/105-ea-pricing-exchange-rates` is refused.
- `node scripts/change-dev-branch.ts check ...` runs without `npm ci` (Node 22 type stripping), as the workflow does.
