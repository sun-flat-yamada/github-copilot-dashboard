# View Registry の実体化と App.tsx 条件分岐の撤去 (P2-4 / #184)

View Registry を描画の唯一の入口にし、`App.tsx` のビュー条件分岐を撤去する（C-01, D-06）。親: #173。前提 P2-2 / P2-3 はマージ済み。

## Proposed Changes
- [NEW] `dashboard/src/views/{types,viewRegistry,defaultRegistry,navigation}.ts`, `ViewHost.tsx`: manifest 型、Registry、`import.meta.glob` 自動収集、描画ホスト。
- [NEW] `dashboard/src/views/<id>/{manifest.ts,View.tsx}` × 9: 既存ビューを移設（JSX は App.tsx から移しただけ）。
- [MODIFY] `App.tsx`: 分岐を `<ViewHost>` に置換し `ViewContext` を組み立てる。`ViewNavigation.tsx`: Registry の項目を受け取る。
- [MODIFY] ビュー本体を読んでいた既存テスト 6 件の読み先を移設後のファイルへ。
- [NEW] `src/tests/view-registry.test.ts` + `fixtures/dummy-view/`（2 ファイル追加で完結することを示す）。
- [MODIFY] SDD-07 §2.14b / SDD-15 §7.4（日英）

## Scope
既存ビューの挙動は変えない。旧 `src/adapters/views/*` と AppV2 の撤去は Phase 2 の別 Issue。

## Verification Plan
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`、`npm run lint`
