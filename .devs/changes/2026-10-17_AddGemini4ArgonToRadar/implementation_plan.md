# モデル特性レーダーに Gemini 4 Argon を追加・仕様コード二重同期 実装計画 (#345)

2026年10月中旬に GitHub Copilot で一般提供（GA）が開始された Google DeepMind の最新フラッグシップ推論モデル `gemini-4-argon`（Gemini 4 Argon）を「モデル特性レーダー」および関連仕様・コードに反映する。

## User Review Required
> [!IMPORTANT]
> - 本変更は `.agents/rules/model-benchmark-management.md`（仕様・コード二重同期の原則）に完全準拠し、`supported_models.md`、`benchmark-records.json`、`model-catalog.ts`、`radar-constants.ts`、SDD-10 仕様書（日・英）を同時に更新します。
> - `gemini-4-argon` は 1M コンテキスト（100万トークン出力・思考継続）および構成可能推論（Reasoning）を備えた Powerful Tier モデルとして登録します。
> - 未検証メトリクス（Arena WebDev Elo, Output Speed TPS）は `estimated_metrics`（推測値）として明示し、検証記録 `verified-benchmarks-2026-10.json` との整合性を保ちます。

## Proposed Changes
### Specifications & Verification Record
#### [MODIFY] [supported_models.md](../../../supported_models.md)
- Copilotサポート表（Table 1）に `Gemini 4 Argon | Google | GA` を追加
- 拡張機能モデル表（Table 3）に 1M コンテキスト（Supported）および構成可能推論（Supported）を追加
- クライアント別サポート表（Table 4）に各クライアント（VS Code, Visual Studio, JetBrains, CLI, GitHub.com等）Supported を追加
- 最小IDEバージョン表（Table 5）に VS Code `v1.136.1`、Visual Studio `17.14.22`、JetBrains `TBD` を追加
- プラン別サポート表（Table 6）に Pro（Not included）、Pro+ / Max / Business / Enterprise（Included）を追加

#### [MODIFY] [.devs/changes/2026-10-13_RadarBenchmarkSourcesRefresh/verified-benchmarks-2026-10.json](../../../.devs/changes/2026-10-13_RadarBenchmarkSourcesRefresh/verified-benchmarks-2026-10.json)
- `gemini-4-argon`: `{"arena_webdev_elo": null, "terminal_bench_4": 57.27, "aa_intelligence_index": 53}` を追加

#### [MODIFY] [docs/specifications/10_ai_model_benchmark_radar_spec.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md)
- Google モデル一覧を 4モデルから 5モデルへ改定し、`gemini-4-argon`（Powerful / GA / 1M Tok / $2.00 / $10.00 / 思考継続・推論旗艦）を追加

#### [MODIFY] [docs/specifications/10_ai_model_benchmark_radar_spec.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.md)
- Google モデル一覧（英語仕様書）を 4 models から 5 models へ改定し、`gemini-4-argon` を追加

### Benchmark Data & Backend Logic
#### [MODIFY] [scripts/benchmark-data/benchmark-records.json](../../../scripts/benchmark-data/benchmark-records.json)
- `gemini-4-argon` レコードを追加（`id`: `gemini-4-argon`, `name`: `Gemini 4 Argon`, `vendor`: `Google`, `model_family`: `Gemini 4`, `color`: `#1d4ed8`, `tier`: `Powerful`, `raw_metrics`: TB4 57.27, AA 53, Elo 1782, TPS 58, In $2.00, Out $10.00, Cached In $0.10, Cache Write $2.50, Ctx 1000K）
- `estimated_metrics`: `["arena_webdev_elo", "output_speed_tps"]`

#### [MODIFY] [src/processor/model-catalog.ts](../../../src/processor/model-catalog.ts)
- `gemini-4-argon` の正規カタログエントリを追加（エイリアス: `gemini-4-argon`, `Gemini 4 Argon`, `Gemini 4`, `gemini-4`, `argon`）

#### [MODIFY] [src/processor/benchmark-definitions.ts](../../../src/processor/benchmark-definitions.ts)
- `getModelBuzz` に `gemini-4-argon` のエンジニア感情・コミュニティの噂・出典情報を追加

#### [MODIFY] [src/processor/benchmark-evaluator.ts](../../../src/processor/benchmark-evaluator.ts)
- `evaluateModel` に `gemini-4` / `argon` の推奨用途（大規模リファクタリング・エージェント完遂）、総評、利用ガイダンスを追加

### Frontend UI & Display Utilities
#### [MODIFY] [dashboard/src/components/radar/radar-constants.ts](../../../dashboard/src/components/radar/radar-constants.ts)
- `flagship-2026`（🌟 2026 旗艦選）の Google 代表を `gemini-4-argon` に更新
- `tier-powerful`（⚡ Powerful）に `gemini-4-argon` を追加
- `vendor-google`（🔵 Google 主力）の先頭に `gemini-4-argon` を追加

#### [MODIFY] [dashboard/src/components/ModelSelectorSidebar.tsx](../../../dashboard/src/components/ModelSelectorSidebar.tsx)
- `getModelShortName` に `if (id === 'gemini-4-argon') return 'gemini-4-argon';` を追加

#### [MODIFY] [dashboard/src/utils/modelDisplay.ts](../../../dashboard/src/utils/modelDisplay.ts)
- `MODEL_DISPLAY` に `'gemini-4-argon': { name: 'Gemini 4 Argon', color: GOOGLE[2] }` を追加

### Automated Tests
#### [MODIFY] [src/tests/radar-presets.test.ts](../../../src/tests/radar-presets.test.ts)
- `flagship-2026`, `tier-powerful`, `vendor-google` の更新に合わせてテストを同期

#### [MODIFY] [src/tests/model-display.test.ts](../../../src/tests/model-display.test.ts)
- 最新モデルの検証リストに `gemini-4-argon` を追加

## Verification Plan
### Automated Tests
- `npm run fork:verify`
- `npm run typecheck`
- `npm test`
- `npm run secret-scan`
- `npm run build`
- `npm run change-dev:plan-check`
