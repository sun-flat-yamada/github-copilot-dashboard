# モデル特性レーダーの採用ベンチマーク出典を 2026年10月時点の最新出典へ入れ替える 実装計画

Issue: [#321](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/321)

`モデル特性レーダー` が採用している出典のうち、陳腐化・飽和・汚染が指摘された SWE-bench Verified / HumanEval+ / AIME 2024 / GPQA Diamond / LMSYS Chatbot Arena (Coding) を、2026-10 時点の現行出典へ入れ替える。確認できなかった値はメトリクス単位で推測値として記録し、UI に「推測値」と表示する。

## ユーザー確認事項 (User Review Required)

> [!IMPORTANT]
> **raw metric の入れ替え (破壊的変更: `BenchmarkRawMetrics` のフィールド名が変わる)**
>
> | 軸 | 旧 raw metric | 新 raw metric | 新出典 |
> | :--- | :--- | :--- | :--- |
> | Coding & SWE | `swe_bench_verified` (85%) + `humaneval_plus` (15%) | `terminal_bench_4` (100%) | Terminal-Bench 4.0 (https://www.tbench.ai/leaderboard/terminal-bench/4.0, 2026-10-12 時点。tbench.ai はクライアント描画のため BenchLM スナップショット https://benchlm.ai/benchmarks/terminal-bench-4 から読み取り) |
> | Reasoning & Logic | `aime_2024` (65%) + `gpqa_diamond` (35%) | `aa_intelligence_index` (100%) | Artificial Analysis Intelligence Index v4.3 (https://artificialanalysis.ai/leaderboards/models, 2026-10-13 確認) |
> | Community & Elo | `arena_coding_elo` | `arena_webdev_elo` | Arena Code Arena WebDev (https://arena.ai/leaderboard/webdev, 2026-10-08 更新) |
> | Architecture & Context | context (45%) + `swe_bench_verified` (55%) | context (45%) + `terminal_bench_4` (55%) | - |
> | Speed / Cost / Context | 変更なし | 変更なし | Artificial Analysis / 公式価格 |
>
> - 変種 (reasoning / harness) は各モデルで掲載されている最上位の変種を採用する。
> - 確認済みの値は検証記録 `verified-benchmarks-2026-10.json` (本ディレクトリに証跡として保存) の値をそのまま使う。

> [!IMPORTANT]
> **推測値 (確認できなかった値) の算出方法: 分位写像 (quantile mapping)**
> 1. 欠損した新指標について、その軸に以前使っていた旧指標 (`terminal_bench_4` ← `swe_bench_verified`、`aa_intelligence_index` ← `aime_2024` 65% + `gpqa_diamond` 35% の順位ブレンド、`arena_webdev_elo` ← `arena_coding_elo`) での順位を全 45 モデル中のパーセンタイル順位 `(below + 0.5 * equal) / n` で求める。
> 2. 新指標の確認済み値を昇順に並べ、そのパーセンタイル位置を線形補間した値を推測値とする。
> 3. 丸め: Terminal-Bench 4.0 は小数 1 桁、AA Intelligence Index と Arena Elo は整数。
> 4. 一回限りのスクリプトはリポジトリ外 (作業用領域) で実行し、結果の数値だけを `benchmark-records.json` に書き込む。各レコードには推測したメトリクスを `estimated_metrics: ["terminal_bench_4", ...]` として記録する。

> [!WARNING]
> - `is_estimated` (モデル単位の推測値フラグ) は「ベンチマーク 3 指標がすべて推測値」の意味に整理し、`estimated_metrics` から導出する (レコードの `is_estimated: true` は後方互換で「全スコア指標が推測値」として扱う)。
> - これまで `is_estimated: true` だった `gpt-6-1-sol` / `claude-sonnet-5-5` は新 3 指標がすべて確認済みになるため、モデル単位のフラグは外れ、未検証の `output_speed_tps` だけが `estimated_metrics` に残る。
> - raw metric の変更でレーダースコアと総合スコアが全体に変わる。データセット版数 (`yyyy-mm-dd-xxxx`) は content hash の変化で自動的に進む。

## 変更概要 (Proposed Changes)

### 1. 型・データ
#### [MODIFY] [src/domain/entities/model-benchmark.ts](../../../src/domain/entities/model-benchmark.ts)
- `BenchmarkMetricKey` / `BenchmarkRawMetrics` を新指標へ改名。`ModelBenchmarkProfile.estimated_metrics?: BenchmarkMetricKey[]` を追加。
#### [MODIFY] [scripts/benchmark-data/benchmark-records.json](../../../scripts/benchmark-data/benchmark-records.json)
- 45 レコードの旧 5 指標を新 3 指標に置換 (確認済み値 + 分位写像の推測値)、`estimated_metrics` を付与。
#### [MODIFY] [scripts/update-benchmarks.ts](../../../scripts/update-benchmarks.ts)
- `estimated_metrics` をプロファイルへ伝播し、`is_estimated` を導出。

### 2. 評価・出典定義
#### [MODIFY] [src/processor/benchmark-evaluator.ts](../../../src/processor/benchmark-evaluator.ts)
- パーセンタイル成分を新指標へ。固定アンカー式 (単体利用時の後方互換) も新指標・新アンカーへ。
- 確認できない SWE-bench の数値を事実として引用する文言を最小限修正。
#### [MODIFY] [src/processor/benchmark-definitions.ts](../../../src/processor/benchmark-definitions.ts)
- `DEFAULT_BENCHMARK_SOURCES`: SWE-bench Verified / LMSYS / frontier-papers (arxiv.org) を削除し、Terminal-Bench 4.0 / Artificial Analysis Intelligence Index v4.3 / Arena WebDev を追加 (具体 URL と `last_fetched_at`)。Artificial Analysis (速度) は維持。旧出典を外した理由 (OpenAI 2026-02-23 公表) を記載。
- `RADAR_AXIS_DEFINITIONS` を新出典に更新。`getModelBuzz` の「SWE-bench xx%」を事実として引用する文言を修正。

### 3. UI
#### [MODIFY] [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx)
- 生データ表・ソート・ジャンプ先・説明文を新指標名へ。推測値メトリクスの値の横に「推測値」マーカーを表示。モデル単位の「推測値」バッジは維持。

### 4. 仕様・エージェント定義の同期
- [docs/specifications/10_ai_model_benchmark_radar_spec.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.md) / [.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md): 出典・軸定義・推測値の算出方法・旧出典の廃止理由。
- [.agents/benchmark-ingestion.agent.md](../../../.agents/benchmark-ingestion.agent.md)、[skills/benchmark-ingestion/SKILL.md](../../../skills/benchmark-ingestion/SKILL.md)、[skills/preset-curator/SKILL.md](../../../skills/preset-curator/SKILL.md): 指標名・出典。
- `supported_models.md` はベンチマーク出典を記載していないため変更なし。`radar-constants.ts` のプリセットは raw metric を参照していないため変更なし。

### 5. テスト
- [src/tests/benchmark-evaluator.test.ts](../../../src/tests/benchmark-evaluator.test.ts)、[src/tests/benchmark-normalization.test.ts](../../../src/tests/benchmark-normalization.test.ts)、[src/tests/estimated-models.test.ts](../../../src/tests/estimated-models.test.ts): 新指標へ更新。
- 新規: 出典が新しいものに置き換わり旧出典が残っていないこと、確認済み値が検証記録と一致すること、`estimated_metrics` と `is_estimated` の整合のテスト。

## 検証計画 (Verification Plan)
### 自動テスト
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`、`npm run lint`
### 手動確認
- Playwright でレーダー画面を LIVE / DEMO (`?demo=true`) で撮影し、出典一覧と「推測値」マーカーの表示を目視確認 (スクリーンショットはコミットしない)。
