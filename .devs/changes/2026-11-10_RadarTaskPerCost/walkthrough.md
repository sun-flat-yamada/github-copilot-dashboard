# Walkthrough: Radar cost efficiency axis = Task per Cost (#411)

## Summary
`モデル特性レーダー` の `cost_efficiency`（コスト効率）軸の算出基準を、従来の Token per Cost（入出力トークン合算単価）から **Task per Cost**（1 USD あたりに完遂できるタスク数 = `1 / task_cost_usd`）へ変更し、Artificial Analysis (`https://artificialanalysis.ai/models`) の **Cost per Task**（Intelligence Index タスクあたりの加重平均コスト USD）データに入れ替えました。軸説明・出典解説・引用カードに「Token per Cost ではなく Task per Cost であること」を明示しています。

## Changes Made
### Benchmark Data & Ingestion Record
- [scripts/benchmark-data/benchmark-records.json](../../../scripts/benchmark-data/benchmark-records.json): 全 46 モデルの `task_cost_usd` を Artificial Analysis の Cost per Task（2026-11-10 取得: 見出し/最上位 effort 変種 14 件を確認済み実測値、残り 32 件を分位写像による推測値）に更新し、`estimated_metrics` の `task_cost_usd` フラグを同期。
- [.devs/changes/2026-11-10_RadarTaskPerCost/aa-cost-per-task-2026-11.json](aa-cost-per-task-2026-11.json): Artificial Analysis モデル別ページからの取得結果（生値・変種一覧・分位写像の旧順位）を記録。

### Radar Evaluator & Definitions
- [src/processor/benchmark-evaluator.ts](../../../src/processor/benchmark-evaluator.ts): `costPerTask` / `tasksPerCost` を追加し、`cost_inverse` 構成要素を `-task_cost_usd`（Task per Cost の順位）に変更。単一モデル用アンカー式も Cost per Task 基準に更新し、`NORMALIZATION_METHOD` を `percentile-rank-v2` に更新。
- [src/processor/benchmark-definitions.ts](../../../src/processor/benchmark-definitions.ts): `cost_efficiency` 軸の `primaryMetric` を `Task per Cost (AA Cost per Task)` に変更し、説明文・Artificial Analysis 出典解説に Token per Cost ではなく Task per Cost で評価する旨を明記。

### Dashboard UI & Specifications
- [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx): `cost_efficiency` 軸カードのジャンプ先を `task_cost` 列に変更し、詳細カードおよびテーブルの Task 単価セルに Task per Cost (`task/$`) と AA 出典表記を表示。
- [dashboard/src/components/radar/RadarDocReferences.tsx](../../../dashboard/src/components/radar/RadarDocReferences.tsx): 第 3 引用カードを Artificial Analysis Models (`https://artificialanalysis.ai/models`) の Task per Cost / Cost per Task 解説に更新。
- [docs/specifications/10_ai_model_benchmark_radar_spec.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.md) / [docs/specifications/10_ai_model_benchmark_radar_spec.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md): SDD-10 §3 / §3.1.1 / §3.1.2 を `percentile-rank-v2` および Artificial Analysis Cost per Task (14 確認 / 32 推測) に同期。
- [src/tests/benchmark-normalization.test.ts](../../../src/tests/benchmark-normalization.test.ts) / [src/tests/radar-task-cost.test.ts](../../../src/tests/radar-task-cost.test.ts): Task per Cost 優先順位付け、Token per Cost ではなく Task per Cost であることの明示、AA 確認値 14 件・推測値 32 件の検証を追加。

## Verification Results
### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Clean (Exit 0) |
| TypeScript Check | `npm run typecheck` | ✅ Pass (Exit 0) |
| Unit & Integration Tests | `npm test` | ✅ Pass (Exit 0) |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 Leaks (Exit 0) |
| Production Build | `npm run build` | ✅ Built in 10.19s (169.97 kB / 300 kB budget) |
