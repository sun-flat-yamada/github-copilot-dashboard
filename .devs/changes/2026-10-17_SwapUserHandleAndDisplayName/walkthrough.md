# Walkthrough: Swap User and Display Name Columns in User Detail Table (#335)

## 概要 / Summary
`ユーザー別 利用・活用明細` (`UserDetailTable`) において、2列目の `ユーザー` (`@login`) と 3列目の `表示名` (`display_name`) の並び順を入れ替え、`表示名` 列を左側固定列 (sticky pinned column) として左右スクロールできるよう改修しました。

## 変更内容 / Changes Made

### 1. テーブルコンポーネント (`UserDetailTable.tsx`)
- [dashboard/src/components/UserDetailTable.tsx](../../../dashboard/src/components/UserDetailTable.tsx)
  - `<thead>`:
    - 2列目を「表示名」(`display_name`) に変更し、`sticky top-0 left-12 z-30`、幅リサイズドラッグハンドル、右境界シャドウを設定。
    - 3列目を「ユーザー」(`user`) に変更し、`sticky top-0 z-20 min-w-[140px]`（横スクロール可能列）に設定。
  - `<tbody>`:
    - 2列目のセルを表示名に変更し、`sticky left-12 z-10`、右境界シャドウ、選択中バッジ（「分析中」）を表示。
    - 3列目のセルをユーザーに変更し、アバターアイコンと `@{u.login}` を表示。
  - CSV エクスポート:
    - ヘッダーおよびデータ行の `表示名` と `GitHub User` の出力順序をテーブル表示順と統一 (`#`, `表示名`, `GitHub User`, `ユーザー定義Gr (部署)`, ...)。

### 2. 単体・契約テスト (`user-detail-table-enhancements.test.ts`)
- [src/tests/user-detail-table-enhancements.test.ts](../../../src/tests/user-detail-table-enhancements.test.ts)
  - 表示名列が先頭固定列（left-12）、ユーザー列が非固定列（スクロール）となったことを検証するテストケースを更新・強化。
  - CSVエクスポートヘッダー順序のアサーションを更新。

### 3. 仕様書同期 (`07_dashboard_ui_ux_spec.*`)
- [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md), [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
  - §2.6 / §2.7 の固定表示列に関する記述を「先頭の2列（`#` 列および `表示名` 列）のみを固定表示」に同期。

## 検証結果 / Verification Results

### 自動品質ゲート
| ステージ | コマンド | 結果 | 詳細 |
| :--- | :--- | :--- | :--- |
| コード・データ分離検証 | `npm run fork:verify` | ✅ Clean (Exit 0) | データ漏洩ゼロ・デカップリング維持 |
| TypeScript 静的型チェック | `npm run typecheck` | ✅ Pass (Exit 0) | 型エラー 0 件 |
| 単体テスト | `npm test` | ✅ 56/56 Pass (関連全テスト) | 関連全テスト通過 |
| シークレット・PII スキャン | `npm run secret-scan` | ✅ 0 Leaks (Exit 0) | 秘匿情報・個人情報漏洩 0 件 |
| プロダクションビルド | `npm run build` | ✅ Pass (Exit 0) | 1.77s、メインバンドル 169.03 kB / 300 kB |
