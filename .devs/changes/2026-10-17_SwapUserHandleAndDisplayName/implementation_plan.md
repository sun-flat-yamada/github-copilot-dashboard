# ユーザー別 利用・活用明細テーブルの列順序入れ替え（ユーザー列と表示名列）および表示名列の固定化計画

`ユーザー別 利用・活用明細` ([dashboard/src/components/UserDetailTable.tsx](../../../dashboard/src/components/UserDetailTable.tsx)) において、2列目の `ユーザー` (`@login`) と 3列目の `表示名` (`display_name`) の並び順を入れ替え、`表示名` 列を左側固定列 (sticky pinned column) として左右スクロールできるよう改修します。

## 概要 / Overview
- **Issue**: [#335](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/335)
- **対象コンポーネント**: [dashboard/src/components/UserDetailTable.tsx](../../../dashboard/src/components/UserDetailTable.tsx)
- **対象テスト**: [src/tests/user-detail-table-enhancements.test.ts](../../../src/tests/user-detail-table-enhancements.test.ts)
- **対象仕様書**: [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md), [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)

## 変更理由 / Why
- テーブル閲覧時にユーザーの「表示名」が常に固定表示されている方が、どのユーザーの行を閲覧しているか把握しやすいため。
- 「ユーザー (@login)」列を固定解除してスクロール可能列側に移動させ、「表示名」列を左固定（# 列に続く2列目）とすることで視認性と利便性を向上させるため。

## 提案される変更 / Proposed Changes

### 1. `dashboard/src/components/UserDetailTable.tsx`
- **テーブルヘッダー (`<thead>`)**:
  - 2列目を「表示名」(`display_name`) に変更し、`sticky top-0 left-12 z-30`、幅リサイズハンドル、右境界シャドウを設定。
  - 3列目を「ユーザー」(`user`) に変更し、`sticky top-0 z-20 min-w-[140px]`（横スクロール可能列）に設定。
- **テーブル行 (`<tbody>`)**:
  - 2列目のセルを表示名に変更し、`sticky left-12 z-10`、右境界シャドウ、選択中バッジ（「分析中」）を表示。
  - 3列目のセルをユーザーに変更し、アバターアイコンと `@{u.login}` を表示。
- **CSV エクスポート (`handleExportCsv`)**:
  - ヘッダーおよびデータ行の `表示名` と `GitHub User` の出力順序をテーブル表示順と統一 (`#`, `表示名`, `GitHub User`, `ユーザー定義Gr (部署)`, ...)。

### 2. `src/tests/user-detail-table-enhancements.test.ts`
- `freezes only the first two primary columns (index, display_name) on horizontal scroll with draggable resizable width` テストケースを更新し、`表示名` が sticky left-12 であること、`ユーザー` が固定列でないこと、CSV 出力順序を検証。

### 3. 仕様書 (`docs/specifications/07_dashboard_ui_ux_spec.ja.md`, `docs/specifications/07_dashboard_ui_ux_spec.md`)
- §2.6 / §2.7 の固定表示列に関する記述を「先頭の2列（`#` 列および `表示名` 列）のみを固定表示」に同期。

## 検証計画 / Verification Plan
1. **単体テスト**:
   - `npx tsx --test "src/tests/user-detail-table-enhancements.test.ts" "src/tests/user-table-redesign.test.ts"`
2. **5段階品質ゲート**:
   - `npm run fork:verify`
   - `npm run typecheck`
   - `npm test`
   - `npm run secret-scan`
   - `npm run build`
