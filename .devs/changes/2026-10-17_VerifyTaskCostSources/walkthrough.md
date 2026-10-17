# Walkthrough: verify task cost sources, mark estimated metrics, and confirm benchmark source links (#379)

## 概要 / Summary
`モデル特性レーダー` における Task単価（$/task）の出典根拠を精査し、公表実測値が存在する20モデルと、同等Tierから算出した推測値26モデルを厳密に区別しました。
未設定だった26モデルの `estimated_metrics` に `'task_cost_usd'` を付与し、UIテーブルおよび詳細カード上で推測値マーカー（`<EstimatedMarker />`）が正しく表示されるように是正しました。
また、セクション `著名ベンチマーク出典の設計背景・現場での見え方・エンジニアの声`（`#radar-sources`）において、引用されている全4件の主要ベンチマークについて、詳細な出題意図・現場での見え方・エンジニアの声、および公式ダッシュボードへの直接外部リンクが完全に整備されていることを点検・検証しました。

---

## 1. Task単価の出典根拠と内訳 / Task Cost Sources & Breakdown

### A. 実測値（Verified: 20モデル）
- **出典リーダーボード**:
  1. **Terminal-Bench 4.0 Leaderboard**: `https://www.tbench.ai/leaderboard/terminal-bench/4.0`（スナップショット: `https://benchlm.ai/benchmarks/terminal-bench-4`）の **Mean Rollout Cost ($/task)**。
  2. **Artificial Analysis AI Benchmark**: `https://artificialanalysis.ai/` および `https://artificialanalysis.ai/leaderboards/models` の標準タスク実測コスト（Task Cost）。
- **該当モデル（20件）**:
  - `gpt-6-astra` ($6.80), `gpt-6-sol` ($1.85), `gpt-6-1-sol` ($1.95), `gpt-6-luna` ($0.12)
  - `gpt-5-6-sol` ($2.10), `gpt-5-6-terra` ($0.85), `gpt-5-6-luna` ($0.15)
  - `claude-sonnet-5` ($1.25), `claude-sonnet-5-5` ($2.40), `claude-opus-5-5` ($5.80), `claude-opus-5` ($6.20)
  - `claude-fable-5-1` ($4.80), `claude-fable-5` ($4.50), `claude-opus-4-8` ($6.50)
  - `gemini-4-argon` ($1.65), `gemini-3-8-flash` ($0.38), `gemini-3-7-flash` ($0.32)
  - `grok-4-7` ($1.60), `grok-4-6` ($1.40), `grok-4-5` ($1.10)

### B. 推測値（Estimated: 26モデル）
- **推測根拠**:
  - 公開リーダーボードに直接の公表実測値が存在せず、同一ファミリーのToken単価比率やタスク試行ステップ数（または Artificial Analysis 推計指標）から補間・推測された値。
- **該当モデル（26件）**:
  - OpenAI: `gpt-5-5` ($4.20), `gpt-5-4` ($1.60), `gpt-5-4-mini` ($0.35), `gpt-5-4-nano` ($0.10), `gpt-5-3-codex` ($1.80), `gpt-5-mini` ($0.30), `gpt-4o` ($2.50), `gpt-4o-mini` ($0.35), `o1` ($8.50), `o3-mini` ($0.90)
  - Anthropic: `claude-opus-4-8-fast` ($7.20), `claude-opus-4-7` ($6.80), `claude-opus-4-6` ($7.00), `claude-sonnet-4-6` ($1.80), `claude-sonnet-4` ($1.90), `claude-haiku-4-5` ($0.25), `claude-3-7-sonnet` ($2.10), `claude-3-5-sonnet` ($2.20)
  - Google: `gemini-3-6-flash` ($0.28), `gemini-3-5-flash` ($0.45), `gemini-2-0-flash` ($0.22), `gemini-2-5-pro` ($2.80)
  - その他: `mai-code-1-1-flash` ($0.20), `kimi-k3` ($1.80), `kimi-k2-7-code` ($0.40), `deepseek-r1` ($0.65)
- **UI表示**:
  - `estimated_metrics` に `'task_cost_usd'` が設定され、テーブルセル（`$X.XX /task ~`）およびモデル詳細カード（`$X.XX /task (推測値)`）に `<EstimatedMarker />` が表示されます。

---

## 2. 著名ベンチマーク出典セクション（`#radar-sources`）の整備状況

`src/processor/benchmark-definitions.ts` の `DEFAULT_BENCHMARK_SOURCES` および `ModelRadarView.tsx` の `#radar-sources` を点検し、以下の全4件の主要ベンチマークについて出題目・性能の見え方・エンジニアの声、および公式ダッシュボードへの直接リンクが完全に整備されていることを確認しました:

| 出典ID | ベンチマーク正式名称 | 公式ダッシュボードURL | 出題目・お題設計 | 現場での見え方・評価見所 | リアルな声・SNSの噂 |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `terminal-bench-4` | Terminal-Bench 4.0 Leaderboard | `https://www.tbench.ai/leaderboard/terminal-bench/4.0` (スナップショット: `https://benchlm.ai/benchmarks/terminal-bench-4`) | ✅ 記載済 | ✅ 記載済（Task単価実測を含む） | ✅ 記載済（ハーネス差の注意点） |
| `aa-intelligence-index` | Artificial Analysis Intelligence Index v4.3 | `https://artificialanalysis.ai/leaderboards/models` | ✅ 記載済 | ✅ 記載済（推論・知識総合力） | ✅ 記載済（バージョン比較注意） |
| `arena-webdev` | Arena Code Arena \| WebDev Leaderboard | `https://arena.ai/leaderboard/webdev` | ✅ 記載済 | ✅ 記載済（主観的満足度） | ✅ 記載済（見た目票・変動性） |
| `artificial-analysis` | Artificial Analysis AI Benchmark | `https://artificialanalysis.ai/` | ✅ 記載済 | ✅ 記載済（即時性と運用タスク実費） | ✅ 記載済（速度体感と思考待ち） |

さらに、第5セクション（`RadarDocReferences.tsx`）でも、公式ドキュメント3点に加えて「著名ベンチマーク実測タスクコスト (Task Cost / Cost per Task)」カードが配置され、公式リーダーボードへのリンクとエージェント試行コストの測定背景が整備されています。

---

## 3. 変更内容 / Changes Made

1. **データセット**:
   - `scripts/benchmark-data/benchmark-records.json`: 推測値26モデルの `estimated_metrics` に `'task_cost_usd'` を追加。
   - `dashboard/public/data/model-benchmarks.json`: 再生成し、26モデルに推測値フラグを反映。
2. **仕様書同期**:
   - `docs/specifications/10_ai_model_benchmark_radar_spec.ja.md` & `10_ai_model_benchmark_radar_spec.md`: Task単価の内訳（実測20件、推測26件）と推測値マーカーの付与、および `#radar-sources` の整備状況を同期。
3. **テスト拡充**:
   - `src/tests/radar-task-cost.test.ts`: 実測値20件と推測値26件の整合性検証、および `#radar-sources` の全4件のURL・解説記述・UI外部リンク配置の検証を追加。

---

## 4. 品質ゲート検証結果 / Verification Results

| 検査項目 | コマンド | 結果 |
| :--- | :--- | :---: |
| **Fork-Safe Storage Isolation** | `npm run fork:verify` | ✅ Clean (0 failures) |
| **TypeScript Compilation** | `npm run typecheck` | ✅ Clean (0 errors) |
| **Automated Test Suite** | `npm test` | ✅ 1,246 passed, 0 failed, 1 skipped |
| **Zero Secrets & Zero PII** | `npm run secret-scan` | ✅ Clean (751 files scanned, 0 secrets/PII/absolute paths) |
| **Production Bundle Build** | `npm run build` | ✅ Clean (169.78 kB / 300 kB budget, built in 1.55s) |
