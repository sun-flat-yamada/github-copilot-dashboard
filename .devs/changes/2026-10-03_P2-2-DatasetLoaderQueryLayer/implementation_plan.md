# Plan: Dataset Loader / Query 層の導入 (P2-2)

Issue: #182（親 #173）。C-02 / C-03。判断結果 #4（DuckDB-WASM）。前提の P2-1（ADR-0001）はマージ済み。

## Proposed Changes
- [NEW] `dashboard/src/dataset/datasetLoader.ts`: index / スコープ / 月次レポートの取得。`resolveDataPath` と `getCandidateDataUrls` を使い、状態 (ok / partial / failed / demo) を返す。期間の切り出し (`sliceScopeDataByDateRange`) も移した
- [NEW] `dashboard/src/query/queryEngine.ts`, `index.ts`: `queryLiveScope` / `queryReport` / `queryPopulation` / `queryFilterOptions` / `queryCapabilities`
- [MOVE] `dashboard/src/utils/filterEngine.ts`, `reportModelBreakdown.ts` → `dashboard/src/query/`（フィルターの唯一の実装を Query 層に統合）
- [NEW] `dashboard/src/query/duckdb/duckdbLoader.ts`: DuckDB-WASM の遅延ローダー（`eh` ビルドのみ同梱）。静的 import 禁止
- [MODIFY] `useDashboardData`: 取得を Dataset Loader へ、フィルター・選択肢を Query 層へ委譲。データ状態を保持して返す
- [MODIFY] `ActiveDataSelector` / `DataSelectionModal`（移行対象の 2 ビュー）: 該当件数を `queryPopulation` から得る。`App.tsx` はフィルター適用前のデータを渡す
- [MODIFY] SDD-15 §7（日英）、SDD-02 §2.7、ADR-0001 §4
- [NEW] `src/tests/query-layer.test.ts`: 画面間の一貫性・ローダーの状態・遅延ロードの検査

## 判断
- 最初の移行ビューは、独自にユーザー数を数えていた 2 つ（セレクターはフィルター後のデータ、モーダルの母数は未フィルターのデータで、数値がずれ得た）。
- DuckDB-WASM は、最初に SQL 集計を必要とするビュー（ユーザー × 日ファクト）が入るまで、どのビューからも参照しない。参照が無い間は配信物にも含まれない。参照が入ると別チャンクになる（Chromium で、呼ぶまで取得されず、呼ぶと SQL が動くことを確認済み）。
- wasm は約 34 MB のため `eh` ビルドだけ同梱する（`mvp` は除く）。バンドル予算は P2-7。
- 既存 hook の経路は一括で置き換えず、取得とフィルターの委譲だけを行う（View の置換は P2-3 / P2-4）。

## 検証
- 品質ゲート: `fork:verify` / `typecheck` / `test` / `secret-scan` / `build`（+ `lint`）
