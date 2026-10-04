# Walkthrough: 「監査・データ品質」ビュー (P4-1 / #197)

## 変更点
- `dashboard/src/views/audit/{manifest.ts,View.tsx}`: View Registry に manifest + コンポーネントで登録（`order: 100`、App.tsx / ナビは無変更）。
- `dashboard/src/components/AuditDataQualityPanel.tsx`: 純関数 `buildAuditModel` と表示。最終成功時刻・品質レベル・レベル変化時刻、ソース別状態表、実行履歴表（実行 ID・時刻・ソース別ステータス・欠損日・重複・範囲外・隔離・不正行）。取得不能は「—（理由）」。
- `dashboard/src/dataset/datasetLoader.ts`: `loadQualityHistoryDataset`（`quality/history.json`、失敗は `failed` + 理由）。
- `ViewNavigation.tsx`: `ShieldCheck` アイコン追加。
- 文書: SDD-07 §2.19、新規 SDD-17（日英）、README 索引（日英）。

## 判断
- Run Manifest 本体は `raw/landing/`（非公開）のため読まず、公開済みの `quality/history.json`（同じ `run_id`）と `index.json` を使う。`pages-staging` の許可リストは変更なし。
- デモはモック収集が履歴を記録しないため、履歴を捏造せず「—（デモデータには実行履歴がありません）」と表示する。

## 検証
- `src/tests/audit-data-quality.test.ts`（9 件）、`view-registry.test.ts` を既存 9 ビュー + audit に更新。
- Playwright スモークに監査ビューを追加（7 件成功）。
- 品質ゲート: `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` と `npm run lint`（結果は PR 本文）。
