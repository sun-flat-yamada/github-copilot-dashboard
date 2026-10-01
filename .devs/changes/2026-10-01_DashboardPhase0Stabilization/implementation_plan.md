# Implementation Plan: ダッシュボード改善 Phase 0（止血）

- **親計画**: [../2026-10-01_DashboardReviewAndImprovementPlan/implementation_plan.md](../2026-10-01_DashboardReviewAndImprovementPlan/implementation_plan.md) の「Phase 0: 止血」（P0-1〜P0-11）。
- **Issue**: [sun-flat-yamada/github-copilot-dashboard#160](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/160)
- **ブランチ**: `claude/exciting-goldberg-5xudi9`（ベース: `main` `bee5e8b`）

## スコープ

親計画の Phase 0 に定義した P0-1〜P0-11 の全項目と、それに伴う日英の SDD 同期。内容・完了条件（DoD）・指摘 ID の対応は親計画の「Proposed Changes > Phase 0」を正とし、本書では重複して記載しない。

Phase 1〜4 は、親計画の「User Review Required」の判断（フロントエンドの収束先、個人単位診断の扱い、データの公開範囲 など）に依存するため、本変更には含めない。Phase 0 は親計画に明記のとおり判断事項に依存しない止血だけで構成されている。

## 方針（実装時に確定した事項）

| 論点 | 方針 |
| :--- | :--- |
| 欠損・失敗の表現 | 欠損は `null`（0 や定数にしない）。ソース別に `ok` / `partial` / `failed` / `skipped` を記録し、失敗したソースは前回成功値を「前回値」と明示して引き継ぐ。失敗が「空」や「デモ」にならない |
| デモデータ | 明示操作・`/demo/` パス・`index.json` の `is_mock_mode: true` のときだけ。取得失敗のフォールバックにしない |
| 金額 | 価格は `src/domain/pricing/pricing-catalog.ts` の 1 か所（暫定値。Phase 1 で一次情報と照合して確定）。予算は `BudgetUtilizationRule.evaluateUsd`、スコープ別費用は `seatCostForScope` に一本化 |
| フィルター | 未割当センチネル・フィルター非対応セクションを定数化し、`filterEngine` を唯一の実装にする。再集計できないセクションは「全社値（フィルター非対応）」と明示する |
| 静的検査 | ESLint（`react-hooks/rules-of-hooks` と `exhaustive-deps` を error）。TypeScript 7 では typescript-eslint を使えないため Babel パーサーを採用。強制は `npm test`（`src/tests/lint-react-hooks.test.ts`）と CI ステップで行い、文書化済みの 5 段階の品質ゲートを変更しない |
| プライバシー | `ANONYMIZE_USERS=true` は `ANONYMIZE_SECRET`（16 文字以上）による HMAC-SHA256 仮名化で、鍵がなければ fail closed。`fork:verify` が公開範囲（リポジトリ API・生の `copilot-data` index・Pages index）を匿名で検査する。オフライン時は警告のみ |
| 配信 | `pages:stage`（許可リスト方式で `processed/*` 全量をステージ）と `pages:verify`（過去月の存在と、非公開物の不在をビルド成果物で検査） |

## 作業環境に関する注記

`AGENTS.md` rule 6 / `.agents/rules/development-workflow.md` は、複数エージェント並行作業時に兄弟 worktree（`../<repo>-worktrees/<branch>`）で作業することを求める。本変更は、単一エージェントが使い捨てのクラウドコンテナ（リポジトリを新規 clone 済み・指定ブランチ `claude/exciting-goldberg-5xudi9` のみで作業）で実施したため、並行編集の衝突が起こり得ず、プライマリ作業ツリーで直接作業した。Issue → 品質ゲート → PR → Rebase Merge のライフサイクルには従う。
