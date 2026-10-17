# Walkthrough: モデル特性レーダー著名ベンチマーク詳細テーブルへのTask単価列追加と引用整備 (#355)

## 概要 / Summary
`モデル特性レーダー` の `著名ベンチマーク最新実測データ詳細テーブル` に対し、カタログ上の料金表である「Token単価（$/1M Tok: Input/Output/Cache）」とは独立した、エージェントハーネスや思考トークン消費を含む実務タスク実測指標である **「Task単価（$/Task）」** のデータ列を追加しました。
また、Terminal-Bench 4.0 および Artificial Analysis 等によるタスクコスト計測の背景、GitHub Copilot 公式ドキュメントとの関係性を明記した引用カード（`RadarDocReferences.tsx`）およびベンチマーク出典解説（`benchmark-definitions.ts`）を既存同等に整備しました。

---

## 変更内容 / Changes Made

### 1. ドメイン型定義と実測データ
- [src/domain/entities/model-benchmark.ts](../../../src/domain/entities/model-benchmark.ts):
  - `BenchmarkMetricKey` に `'task_cost_usd'` を追加。
  - `BenchmarkRawMetrics` に `task_cost_usd?: number;`（実務タスクあたりの実測コスト USD / task）を追加。
- [scripts/benchmark-data/benchmark-records.json](../../../scripts/benchmark-data/benchmark-records.json):
  - 全46モデルに Terminal-Bench 4.0 平均試行コストおよび Artificial Analysis Task Cost に基づく `task_cost_usd`（$0.10 〜 $8.50）を設定。
- [src/processor/benchmark-definitions.ts](../../../src/processor/benchmark-definitions.ts):
  - `terminal-bench-4` および `artificial-analysis` の出典定義に、タスク解決率に加えてタスク試行実測コスト（$/task）の計測意図と現場の見え方を追記。
- [scripts/update-benchmarks.ts](../../../scripts/update-benchmarks.ts):
  - `dashboard/public/data/model-benchmarks.json` を再生成。

### 2. UI コンポーネント
- [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx):
  - `sortKey` および `handleSort` に `'task_cost'` を追加。クリック時に安い順（昇順）・高い順（降順）の双方向ソートを直感的に実行可能。
  - 上部ソート基準バーに「Task単価」ボタンを追加し、既存のコストボタンを「Token単価」と明確化。
  - テーブル説明文（サブタイトル）に「Token単価、Task単価」を追記。
  - テーブルヘッダーを「Token単価 ($/1M)」と新設「Task単価 ($/Task)」に分離して配置。
  - テーブル各行（tbody）に Task単価データセルを追加（`$X.XX /task`、視認性の高いインジケーターバー、推測値マーカー `<EstimatedMarker />`）。
  - モデル詳細カードの価格グリッドを5列構成に拡張し、「実測 Task 単価」カードを追加。
- [dashboard/src/components/radar/RadarDocReferences.tsx](../../../dashboard/src/components/radar/RadarDocReferences.tsx):
  - 引用カードグリッドを拡張し、「著名ベンチマーク実測タスクコスト (Task Cost / Cost per Task)」カードを追加（公式リーダーボードへの外部リンク、エージェント試行コストの測定背景と意義を明記）。

### 3. 仕様書同期
- [docs/specifications/10_ai_model_benchmark_radar_spec.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md) & [docs/specifications/10_ai_model_benchmark_radar_spec.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.md):
  - テーブル列構成、Task単価ソート仕様、および引用カードの追加を仕様書に同期。

### 4. テスト
- [src/tests/radar-task-cost.test.ts](../../../src/tests/radar-task-cost.test.ts):
  - 全46モデルの `task_cost_usd` 正常値検証。
  - `ModelRadarView.tsx` のヘッダー、ソートキー、データセル、詳細カードの整合性検証。
  - `RadarDocReferences.tsx` の引用カードとリーダーボードURLの検証。
  - `benchmark-definitions.ts` のタスクコスト解説記述の検証。

---

## 検証結果 / Verification Results

| 検証項目 | 実行コマンド | 結果 |
| :--- | :--- | :--- |
| **Code-Data Decoupling** | `npm run fork:verify` | ✅ Pass (Exit code 0) |
| **TypeScript Check** | `npm run typecheck` | ✅ Pass (0 errors) |
| **Unit & Integration Tests** | `npm test` | ✅ 1,228 tests (1,227 passed, 1 skipped, 0 failed) |
| **Zero Secret / PII Scan** | `npm run secret-scan` | ✅ Pass (720 files scanned, 0 findings) |
| **Production Build** | `npm run build` | ✅ Pass (169.78 kB / 300 kB budget, built in 1.63s) |
