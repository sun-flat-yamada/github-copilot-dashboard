# Implementation Plan: テスト刷新 (P2-6 / #186)

## 目的
UI のテストがソース文字列の正規表現検査中心で、画面の挙動が保護されていない (C-04)。主要フローを挙動テストで保護する。

## 方針
- ESLint: typescript-eslint は TypeScript 7 に未対応 (peer `<6.1.0`) のため導入せず、型情報を要しない代替規則を追加し SDD-15 §6 に文書化する。
- RTL: `import.meta.glob` が Vite 専用のため `App` を `AppShell` (Registry を受け取る) と薄い `App` に分け、jsdom + fetch スタブで描画する。
- Playwright: 事前インストール済み Chromium を使い、デモデータで スモーク 3 件。CI (`test-and-preview.yml`) に組み込む。
- 置き換えたソース正規表現テストは削除し、一覧を PR に記載する。

## 検証
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`、`npm run lint`、`npm run e2e`。
