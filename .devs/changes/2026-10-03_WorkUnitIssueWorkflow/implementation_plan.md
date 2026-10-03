# Implementation Plan: 作業単位 Issue での進め方を change-dev に定義する

- **目的**: 計画書のタスクを 1 件 = 1 Issue として登録し、新しい Claude セッションが Issue 番号だけで作業を開始できるようにする。
- **Issue**: [sun-flat-yamada/github-copilot-dashboard#204](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/204)。

## 方針

| 論点 | 方針 |
| :--- | :--- |
| 単位 | 計画書のタスク（例 `P1-2`）1 件 = Issue 1 件 = PR 1 件。フェーズごとに親（追跡）Issue を置き、子をサブ Issue にする |
| 開始 | 「Issue #N を対応せよ」。Issue と親、参照文書を読み、前提のマージを確認し、change ディレクトリを作る |
| 引き継ぎ | Issue 本文が引き継ぎ資料。判断・未検証の事項は Issue / 計画書に書く |
| 範囲外 | Issue の範囲外の発見は新しい Issue にする |

## Proposed Changes

- `.agents/skills/change-dev/SKILL.md` と `skills/change-dev/SKILL.md`: 「Work-Unit Issue」節を追加。
- `.agents/change-dev.agent.md`、`.agents/rules/development-workflow.md`: 同方針を追記。
- `docs/specifications/14_development_workflow_and_git_ops_spec.md` / `.ja.md`: §3.1.1 を追加。
- `.github/ISSUE_TEMPLATE/work_unit.yml`: 作業単位 Issue のテンプレート。
- 改善計画の `task.md` に、作成済みの Issue（親 #172〜#175、子 27 件）の索引を追記。

## Verification Plan

- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
