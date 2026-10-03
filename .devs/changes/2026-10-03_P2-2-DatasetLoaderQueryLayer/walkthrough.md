# Walkthrough: Dataset Loader / Query 層 (P2-2 / #182)

## Summary
データの取得を Dataset Loader、フィルター・集計を Query 層に集約し、`useDashboardData` をその上に載せた。独自にユーザー数を数えていた 2 ビューを Query 層へ移行し、画面間で同じ条件が同じ数値になることをテストで固定した。DuckDB-WASM は遅延ローダーとして用意し、初期バンドルに含めない。

## Changes Made
- `dashboard/src/dataset/datasetLoader.ts`: 取得と状態 (ok / partial / failed / demo)。失敗を空データや DEMO に置き換えない
- `dashboard/src/query/`: `filterEngine` を移して唯一の実装とし、`queryEngine`（`queryPopulation` ほか）を追加
- `dashboard/src/query/duckdb/duckdbLoader.ts`: DuckDB-WASM の遅延ローダー（`eh` ビルドのみ）
- `useDashboardData`: 取得とフィルターを委譲。データ状態を返す
- `ActiveDataSelector` / `DataSelectionModal`: 該当件数を `queryPopulation` から得る（以前は元データが異なり数値がずれ得た）
- SDD-15 §7、SDD-02 §2.7、ADR-0001 §4（日英）
- `src/tests/query-layer.test.ts`、既存の文字列検査テスト 3 件を新しい構造に合わせて更新

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Fork health | `npm run fork:verify` | ✅ Exit 0 |
| TypeScript | `npm run typecheck` | ✅ Pass |
| Lint | `npm run lint` | ✅ Pass |
| Tests | `npm test` | ✅ 801/801 |
| Secret scan | `npm run secret-scan` | ✅ 0 leaks |
| Build | `npm run build` | ✅ Built。`dist` は 12 MB で DuckDB を含まない |

- 遅延ロード: 別プロジェクトのビルドで dynamic import が別チャンクになることを確認。Chromium で、呼ぶまで DuckDB / wasm は取得されず、呼ぶと `GROUP BY` が動いた。
- 主チャンクは Phase 2 の P2-7（バンドル予算）で扱う。この変更で DuckDB は主チャンクに入らない。
