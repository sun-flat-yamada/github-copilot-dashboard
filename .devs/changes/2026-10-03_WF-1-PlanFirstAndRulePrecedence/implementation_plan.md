# WF-1 リポジトリ定義の優先と、計画書の先行作成の強制 (Issue #230)

## 背景
PR #229 で (1) `change-dev:finish` を実行せずクラウド既定の「PR 後は待機」に従った、(2) `implementation_plan.md` を実装後に作った。どちらも「定義はあるが、強制・優先順位が明文化されていない」ことが原因。

## 変更内容
1. **優先規則** `.agents/rules/instructions-rules-precedence.md` (新規。命名は `<category>-rules-<scope>.md`)
   - 優先順: ユーザーの直接指示 > リポジトリ定義 (Agent / skills / rules / `AGENTS.md` / `CLAUDE.md`) > Cloud Session の既定指示。
   - 競合は、リポジトリ定義に従い、作業を止めず確認もせず、**実施結果の報告でのみ**伝える (報告形式を定める)。
   - 上書きしない境界: 権限・セキュリティ (指定ブランチ以外へ push しない、秘密情報、Zero PII)、実行環境の物理的な制約 (GraphQL 拒否、ブランチ削除拒否)。後者は定義に従えないので、代替を使い結果で報告する。
   - `CLAUDE.md` / `GEMINI.md` から import し、`AGENTS.md` に要約 (#10)、skill / agent / `development-workflow.md` から参照する。
2. **計画先行の強制**
   - `scripts/plan-first-check.ts` (`npm run change-dev:plan-check`): ベースとの差分に実装ファイル (`src/` `dashboard/` `scripts/` `e2e/` `.github/` `package.json` 等) があるとき、`.devs/changes/*/implementation_plan.md` を追加したコミットが、最初の実装コミットより厳密に前になければ失敗する。計画書が無い場合も失敗。文書のみ・計画のみの変更は対象外。
   - `change-dev:finish` はマージ前にこの検査を実行し、失敗したら止まる (`--skip-plan-check` は設けない)。
   - skill / agent / `development-workflow.md` / SDD-14 に「計画書だけを先にコミットする」を明記する。`task.md` の最終項目は「マージ」にする。
3. SDD-14 (EN / JA) を同期する。

## 確認
- 新規テスト: 計画が先 (成功) / 計画が後 (失敗) / 計画が無い (失敗) / 文書のみ (対象外)。
- 品質ゲート + `npm run lint`。
