# Plan: データ品質レポートの履歴化 (P1-7)

Issue: #180（親 #172）。D-05 / E-01。

## Proposed Changes
- [NEW] `src/domain/entities/data-quality.ts`: レポート・履歴・要約・収集時の観測の型
- [NEW] `src/application/pipeline/data-quality.ts`: レポート生成、履歴の追記（同じ run_id は置換、上限 90）、悪化・回復の要約
- [MODIFY] `UsageReportsClient` / `GitHubApiCopilotDataSource`: 範囲外の行数を分けて数え、`getQualityObservations()` で観測を返す
- [MODIFY] `PipelineOrchestrator` / `fork-safe-storage` / `IStorageWriter`: 履歴の保存（`processed/quality/history.json`）と `index.json` の `data_quality`
- [MODIFY] `scripts/pages-staging.ts`: 許可リストに `quality` を追加
- [MODIFY] `dataStatus.ts` / `DataStatusBanner.tsx`: 品質の表示（悪化・回復・履歴リンク、情報なしは「—（理由）」）、`info` レベル
- [MODIFY] SDD-05 §2.5 / SDD-07 §2.13a（日英）

## 判断
- 実収集をしていない実行（モック・未設定・失敗）は記録しない。前回の履歴と要約を維持する。
- 重複（Enterprise と Org の重なり）は正常動作なので level に影響させない。
