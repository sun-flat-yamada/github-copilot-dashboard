# Walkthrough: モデル特性レーダーの採用ベンチマーク出典の入れ替え (#321)

## Summary
モデル特性レーダーの採用出典を 2026-10 時点の現行出典へ入れ替えた。旧 raw metric 5 種 (`swe_bench_verified` / `humaneval_plus` / `aime_2024` / `gpqa_diamond` / `arena_coding_elo`) を新 3 種 (`terminal_bench_4` / `aa_intelligence_index` / `arena_webdev_elo`) に置き換え、確認済みの値は検証記録どおりに、確認できなかった値は分位写像による推測値としてメトリクス単位で `estimated_metrics` に記録し、UI の値の横に「推測値」と表示する。

| 新 raw metric | 出典 | 確認済み | 推測値 |
| :--- | :--- | :--- | :--- |
| `terminal_bench_4` | Terminal-Bench 4.0 (2026-10-12) | 19 / 45 | 26 / 45 |
| `aa_intelligence_index` | Artificial Analysis Intelligence Index v4.3 (2026-10-13) | 28 / 45 | 17 / 45 |
| `arena_webdev_elo` | Arena Code Arena \| WebDev (2026-10-08) | 32 / 45 | 13 / 45 |

- ベンチマーク 3 指標がすべて推測値のモデル (モデル単位の「推測値」バッジ): 11 モデル。
- `gpt-6-1-sol` / `claude-sonnet-5-5` は新 3 指標が確認済みになり、モデル単位のフラグが外れた (未計測の `output_speed_tps` のみ推測値)。
- 証跡: [verified-benchmarks-2026-10.json](verified-benchmarks-2026-10.json) (確認済み値、`null` = 確認できず)、[estimated-values-2026-10.json](estimated-values-2026-10.json) (推測値ごとの旧指標パーセンタイルと結果)。推測スクリプトはリポジトリ外で一度だけ実行した。

## Changes Made
### Types & data
- [src/domain/entities/model-benchmark.ts](../../../src/domain/entities/model-benchmark.ts): raw metric の改名、`BENCHMARK_SCORE_METRICS`、`ModelBenchmarkProfile.estimated_metrics`、`BenchmarkDataset.sources_note`。
- [scripts/benchmark-data/benchmark-records.json](../../../scripts/benchmark-data/benchmark-records.json): 45 レコードを新指標へ。
- [scripts/update-benchmarks.ts](../../../scripts/update-benchmarks.ts): `resolveEstimates` (旧 `is_estimated: true` は「ベンチマーク 3 指標すべて推測値」として後方互換)、`sources_note` の出力。

### Evaluation & sources
- [src/processor/benchmark-evaluator.ts](../../../src/processor/benchmark-evaluator.ts): パーセンタイル成分を新指標へ (coding = TB4、reasoning = AA、Elo = Arena WebDev、architecture = 0.45 context + 0.55 TB4)。固定アンカー式も新指標へ (TB4 60% / AA 15-55 / Elo 1250-1800)。SWE-bench を事実として引用する文言を修正。
- [src/processor/benchmark-definitions.ts](../../../src/processor/benchmark-definitions.ts): 出典を Terminal-Bench 4.0 / AA Intelligence Index v4.3 / Arena WebDev / Artificial Analysis (速度) に。`DEPRECATED_BENCHMARK_SOURCES_NOTE` (OpenAI 2026-02-23 公表を引用)。軸定義の更新。buzz の「SWE-bench xx%」を削除。

### UI
- [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx): 表・ソート・軸カード・説明文を新指標名へ。各値の横に「推測値」マーカー、モデル詳細カードにベンチマーク 4 指標 (TB4 / AA / Arena / TPS) を追加、出典一覧の上に出典の変更履歴を表示。
- [dashboard/src/components/radar/EstimatedMarker.tsx](../../../dashboard/src/components/radar/EstimatedMarker.tsx) (新規)、[dashboard/src/components/radar/radar-utils.ts](../../../dashboard/src/components/radar/radar-utils.ts) (`isEstimatedMetric`)、[dashboard/src/components/RadarTableOfContents.tsx](../../../dashboard/src/components/RadarTableOfContents.tsx)。

### Specs & agents
- [SDD-10 EN](../../../docs/specifications/10_ai_model_benchmark_radar_spec.md) / [JA](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md): §3.1.1 出典と raw metric、§3.1.2 推測値の算出方法、軸表・アンカー・出典説明・プリセット記述を同期。
- [.agents/benchmark-ingestion.agent.md](../../../.agents/benchmark-ingestion.agent.md)、[.agents/model-radar-pipeline.agent.md](../../../.agents/model-radar-pipeline.agent.md)、[skills/benchmark-ingestion/SKILL.md](../../../skills/benchmark-ingestion/SKILL.md)、[skills/preset-curator/SKILL.md](../../../skills/preset-curator/SKILL.md)。
- `supported_models.md` はベンチマーク出典を載せていないため変更なし。`radar-constants.ts` のプリセットは raw metric を参照しないため変更なし。

### Tests
- [src/tests/benchmark-sources-2026-10.test.ts](../../../src/tests/benchmark-sources-2026-10.test.ts) (新規): 旧出典の除去、新出典の URL と確認日、レコードの値が検証記録と一致すること、確認できなかった値が必ず `estimated_metrics` にあること、`is_estimated` の導出、後方互換、buzz に SWE-bench の数値が残っていないこと。
- [benchmark-evaluator.test.ts](../../../src/tests/benchmark-evaluator.test.ts)、[benchmark-normalization.test.ts](../../../src/tests/benchmark-normalization.test.ts)、[estimated-models.test.ts](../../../src/tests/estimated-models.test.ts)、[table-sorting-and-cost-columns.test.ts](../../../src/tests/table-sorting-and-cost-columns.test.ts) を新指標へ更新。

## Verification Results
### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Exit 0 (warnings only: feature branch, uncommitted changes before commit, public demo reports notice) |
| TypeScript Check | `npm run typecheck` | ✅ Pass |
| Unit & Integration Tests | `npm test` | ✅ 1174/1174 Pass |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 663 files, 0 findings |
| Production Build | `npm run build` | ✅ Built, bundle within budget |
| Lint | `npm run lint` | ✅ 0 errors |

### Manual Verification (Playwright, Chromium)
- `vite preview` で LIVE (`/`) と DEMO (`/?demo=true`) のモデル特性レーダーを撮影 (スクリーンショットはコミットしない)。両モードとも同じデータセット (v2026-10-13-0001) が表示され、出典一覧に新 4 出典と変更履歴、表とモデル詳細カードに「推測値」マーカー (62 個: 表 58 + 凡例 1 + 詳細カード 3) が出ることを確認した。
- 速度列の「推測値」マーカーで `tps` が折り返す問題と、モデル単位の「推測値」が縦書きに折り返す問題を見つけて修正した。
