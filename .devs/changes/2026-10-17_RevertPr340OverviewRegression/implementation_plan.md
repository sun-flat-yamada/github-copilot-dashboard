# Implementation Plan - Revert PR #340 due to Overview View Regression (#383)

## 概要 / Overview
PR #340 (`feat(dashboard): show total user count and percentage in monthly report active users card (#336)`) のリベース・コンフリクト解消時に、`dashboard/src/views/overview/View.tsx` の先行機能（PR #331, #334 で導入されたウィジェットカスタマイズ機能やカード分割表示等）が古い固定レイアウトコードで上書きされてしまったため、コミット `b84efa1` および `bf1079a` を一度 Revert して元の正常な状態に戻します。

## 変更内容 / Proposed Changes
1. **コミットの Revert**:
   - `git revert --no-commit b84efa1`
   - `git revert --no-commit bf1079a`
   - これにより、`dashboard/src/views/overview/View.tsx`, `MonthlyReportKpis.tsx`, `AppShell.tsx`, `types.ts`, `monthly-report-kpis.test.tsx` を PR #340 以前の正常な状態に完全に戻します。
2. **検証**:
   - `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
3. **PR & マージ**:
   - PR を作成し `change-dev:finish` にて rebase-merge。
4. **調査の実施**:
   - 正常復旧後、改めて「レポート内アクティブ人数の総数・割合併記」を現行アーキテクチャ（ウィジェット構造）を壊さずに実装するための設計と差分調査を実施し、ユーザーへ報告する。
