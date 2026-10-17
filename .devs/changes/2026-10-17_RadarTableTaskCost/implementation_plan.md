# feat(radar): モデル特性レーダー著名ベンチマーク詳細テーブルへのTask単価列追加と引用整備 (#355)

`モデル特性レーダー` の `著名ベンチマーク最新実測データ詳細テーブル` に、既存のToken単価（$/1M Tok: Input/Output/Cache）とは別に、エージェント・推論モデルが標準的な実務タスクを遂行・試行する際にかかる実測コスト指標である **「Task単価（$/Task）」** のデータ列を追加します。
また、Terminal-Bench 4.0 および Artificial Analysis によるタスクコスト計測の背景、GitHub Copilot 公式仕様・課金体系との関係を解説する引用カード・出典注記を既存同等に整備します。

## ユーザー確認事項 / User Review Required

> [!NOTE]
> - **Token単価とTask単価の役割分担**:
>   - **Token単価（$/1M Tok）**: APIカタログ記載の100万トークンあたり入出力価格（Rate Card）。
>   - **Task単価（$/Task）**: エージェントハーネス（Claude Code、Codex等）や思考トークン消費を含め、Terminal-Bench 4.0 / Artificial Analysis の標準実務タスクを1回試行・完遂する際にかかる平均実測コスト（USD）。
> - **ソート対応**:
>   - テーブルヘッダーおよび上部ソートバーに「Task単価」を追加し、安い順・高い順の双方向ソートを可能にします。
> - **推測値マーカーの継承**:
>   - 出典で直接確認できないモデルについては既存仕様に準拠し `<EstimatedMarker />`（推測値）を表示します。

## 変更内容 / Proposed Changes

### 1. ドメイン型定義 & データセット
#### [MODIFY] [src/domain/entities/model-benchmark.ts](../../../src/domain/entities/model-benchmark.ts)
- `BenchmarkMetricKey` に `'task_cost_usd'` を追加。
- `BenchmarkRawMetrics` に `task_cost_usd: number;`（実務タスクあたりの実測コスト USD / task）を追加。

#### [MODIFY] [scripts/benchmark-data/benchmark-records.json](../../../scripts/benchmark-data/benchmark-records.json)
- 全45モデルの `raw_metrics` に `task_cost_usd` を設定（Terminal-Bench 4.0 平均試行コストおよび Artificial Analysis Task Cost 実測値/推定値）。

#### [EXECUTE] `scripts/update-benchmarks.ts`
- `dashboard/public/data/model-benchmarks.json` を再生成。

### 2. UI コンポーネント
#### [MODIFY] [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx)
- `TableSortKey` に `'task_cost'` を追加し、昇順・降順ソートロジックを実装。
- テーブル上部クイックソートバーに「Task単価」ボタンを追加。
- テーブルヘッダーに「Task単価 ($/Task)」列を追加（既存の単価列は「Token単価 ($/1M)」と明確化）。
- テーブル各行（`tbody`）に Task単価データセルを追加（`$X.XX /task`、視認性の高いインジケーターバー、推測値マーカー）。
- テーブル説明文（サブタイトル）に「Task単価」を追記。
- モデル詳細カードのコスト表示領域にも「実測Task単価」を併記。
- 第5セクション「GitHub Copilot 公式ドキュメント・仕様リファレンス引用」に、Terminal-Bench 4.0 / Artificial Analysis による「実測タスク単価 (Task Cost) ガイド」引用カードを追加。

### 3. 仕様書同期
#### [MODIFY] [docs/specifications/10_ai_model_benchmark_radar_spec.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md) & [10_ai_model_benchmark_radar_spec.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.md)
- ベンチマーク詳細テーブルの列構成（Token単価とTask単価の分離）および引用カード整備について仕様を同期。

### 4. テスト
#### [NEW] [src/tests/radar-task-cost.test.ts](../../../src/tests/radar-task-cost.test.ts)
- `BenchmarkRawMetrics` への `task_cost_usd` 存在検証。
- 全45モデルに正当な `task_cost_usd` が入っていることの検証。
- `ModelRadarView.tsx` のヘッダー、ソートキー、データ行、引用カードの存在・整合性検証。

## 検証計画 / Verification Plan

### Automated Quality Gates
- `npm run fork:verify`
- `npm run typecheck`
- `npm test`
- `npm run secret-scan`
- `npm run build`
