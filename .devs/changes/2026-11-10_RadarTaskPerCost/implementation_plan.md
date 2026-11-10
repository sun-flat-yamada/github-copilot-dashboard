# Radar cost efficiency axis: Task per Cost (Artificial Analysis)

Issue: [#411](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/411)

`モデル特性レーダー` の `cost_efficiency`（コスト効率）軸の根拠を、Token 単価（入力 40% / 出力 60% の合算単価）から **Task per Cost**（1 USD あたりに解けるタスク数 = 1 / Cost per Task）に変更する。Task 単価 `task_cost_usd` のデータは Artificial Analysis（https://artificialanalysis.ai/models）の **Cost per Task**（"Weighted average cost (USD) per Intelligence Index task"）に入れ替える。

## User Review Required

> [!IMPORTANT]
> - 軸キー `cost_efficiency` は維持する（エンティティ・タグ・UI ソートへの波及を避ける）。表示ラベルと算出根拠のみ変える。
> - Task per Cost = 1 / `task_cost_usd`。パーセンタイル順位は「安いほど高い」と同値なので、正規化は `-task_cost_usd` の順位で行う。
> - AA の値はモデルごとの**見出し variant**（AA のモデルページ既定 = 最上位 reasoning variant）を採用する。見出し variant に値が無く、より上位の effort（Xhigh / Max）に値がある場合はそれを採用する（Grok 4.6: 見出し High には値なし、Xhigh を採用）。下位 variant しか値が無いモデル（Kimi K3: Low のみ）は未確認扱い。

> [!WARNING]
> - AA が Cost per Task を公開しているのは現行世代の 15 / 46 モデルのみ（旧世代は AA 上で `deprecated` となり Intelligence Index 系の値が `null`）。残り 31 モデルは SDD-10 §3.1.2 と同じ**分位写像**で推測値を作り、`estimated_metrics` に `task_cost_usd` を記録する（旧 `task_cost_usd` の順位 → AA 確認値 15 件の分位へ線形補間）。
> - AA の Cost per Task は思考トークン・キャッシュ書き込みを含むため、Token 単価の順位とは大きく異なる（例: Gemini 3.8 Flash は $7.77/task で GPT-6 Astra の $6.25 より高い）。レーダー形状・総合スコア・Cost Saver タグが変わる。

## Proposed Changes

### Benchmark data
#### [MODIFY] [scripts/benchmark-data/benchmark-records.json](../../../scripts/benchmark-data/benchmark-records.json)
- 全 46 モデルの `task_cost_usd` を置き換え（AA 確認値 15、推測値 31）。`estimated_metrics` の `task_cost_usd` を確認値では外し、推測値では付ける。
#### [NEW] [.devs/changes/2026-11-10_RadarTaskPerCost/aa-cost-per-task-2026-11.json](aa-cost-per-task-2026-11.json)
- 取得記録（AA の生値・採用 variant・推測時の旧順位）。

### Scoring
#### [MODIFY] [src/processor/benchmark-evaluator.ts](../../../src/processor/benchmark-evaluator.ts)
- `cost_inverse` 成分を `-task_cost_usd`（Task per Cost の順位）に変更。`task_cost_usd` が無い場合は従来の合算 Token 単価にフォールバック。
- 単一モデル用アンカー式も Cost per Task 基準に変更。
- `NORMALIZATION_METHOD` を `percentile-rank-v2` に更新（データセットハッシュに反映）。
#### [MODIFY] [src/processor/benchmark-definitions.ts](../../../src/processor/benchmark-definitions.ts)
- `cost_efficiency` のラベル・説明・`primaryMetric` を Task per Cost に変更。AA 出典の説明・取得日を更新。

### UI
#### [MODIFY] [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx)
- 軸説明・ツールチップ・Task 単価列の出典表記を AA Cost per Task に更新。
#### [MODIFY] [dashboard/src/components/radar/RadarDocReferences.tsx](../../../dashboard/src/components/radar/RadarDocReferences.tsx)
- Task Cost 引用カードの出典を AA Cost per Task に更新。

### Specifications
#### [MODIFY] [docs/specifications/10_ai_model_benchmark_radar_spec.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.md) / [.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md)
- §3 の `cost_efficiency` 行、§3.1.1 の `task_cost_usd` 行、§3.1.2 の推測件数、§4.1 のタグ条件を更新。

### Tests
- `src/tests/benchmark-normalization.test.ts`: Task per Cost で順位付けされること、`task_cost_usd` 欠落時のフォールバック。
- `src/tests/radar-task-cost.test.ts`: AA 確認値（代表モデル）と推測フラグの整合。

## Verification Plan
### Automated Tests
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`

### Manual Verification
- `npm run benchmark:update` の出力で、コスト効率スコアが Task 単価の逆順になっていることを確認。
