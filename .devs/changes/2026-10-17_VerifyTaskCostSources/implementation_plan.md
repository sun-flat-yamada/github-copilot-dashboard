# fix(radar): verify task cost sources, mark estimated metrics, and confirm benchmark source links (#379)

`モデル特性レーダー` における Task単価（$/task）の出典根拠を確認し、実測値が存在しないモデルに対する推測値マーカーの付与、および `著名ベンチマーク出典の設計背景・現場での見え方・エンジニアの声`（`#radar-sources`）セクションの網羅性とダッシュボードリンクの完全性を確認・是正します。

## ユーザー確認事項 / User Review Required

> [!NOTE]
> - **Task単価の出典根拠と内訳**:
>   - **実測値（Verified: 20モデル）**: Terminal-Bench 4.0 Leaderboard（Mean Rollout Cost $/task）および Artificial Analysis AI Benchmark の実測値に基づきます。
>   - **推測値（Estimated: 26モデル）**: 公開リーダーボードに直接の実測値がなく、同等TierのToken単価比率や試行ステップ数から補間された推測値です。
> - **推測値マーカー（`<EstimatedMarker />`）の付与**:
>   - これまで `benchmark-records.json` の推測値モデルで `estimated_metrics` に `'task_cost_usd'` が未設定だったため、UI上で実測値のように表示されていました。26モデルに `'task_cost_usd'` を追加し、UIテーブルおよび詳細カードで推測値マーク（`~` / `推測値`）が表示されるよう是正します。
> - **著名ベンチマーク出典セクション（`#radar-sources`）の点検**:
>   - 4つの主要ベンチマーク（Terminal-Bench 4.0, AA Intelligence Index, Arena WebDev, Artificial Analysis）の説明・出題設計・現場での見え方・エンジニアの声および公式ダッシュボードへの直接リンクが完備されていることを確認・保証します。

## 変更内容 / Proposed Changes

### 1. ベンチマークデータセットの更新
#### [MODIFY] [scripts/benchmark-data/benchmark-records.json](../../../scripts/benchmark-data/benchmark-records.json)
- `terminal_bench_4` が推定（`estimated_metrics` に含まれる）である26モデルに対し、`estimated_metrics` に `'task_cost_usd'` を追加。
- 対象モデル（26件）:
  - OpenAI: `gpt-5-5`, `gpt-5-4`, `gpt-5-4-mini`, `gpt-5-4-nano`, `gpt-5-3-codex`, `gpt-5-mini`, `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`
  - Anthropic: `claude-opus-4-8-fast`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-sonnet-4`, `claude-haiku-4-5`, `claude-3-7-sonnet`, `claude-3-5-sonnet`
  - Google: `gemini-3-6-flash`, `gemini-3-5-flash`, `gemini-2-0-flash`, `gemini-2-5-pro`
  - その他: `mai-code-1-1-flash`, `kimi-k3`, `kimi-k2-7-code`, `deepseek-r1`

#### [EXECUTE] `npm run update-benchmarks`
- `dashboard/public/data/model-benchmarks.json` を再生成。

### 2. 仕様書同期
#### [MODIFY] [docs/specifications/10_ai_model_benchmark_radar_spec.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md) & [10_ai_model_benchmark_radar_spec.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.md)
- Task単価の実測値モデル（20件）と推測値モデル（26件）の分類、および推測値マーカーの付与について仕様書を更新。
- `#radar-sources` の説明文およびダッシュボード直接リンクの整備状況を明記。

### 3. テスト拡充
#### [MODIFY] [src/tests/radar-task-cost.test.ts](../../../src/tests/radar-task-cost.test.ts)
- `task_cost_usd` の実測値（20件）と推測値（26件）の区別がデータセット上で正しく反映されていることの検証を追加。
- `DEFAULT_BENCHMARK_SOURCES` の全4件について、URL、`target_problem`、`performance_view`、`community_rumor` が存在し、ダッシュボードへの直接リンクが整備されていることのテストを追加。

## 検証計画 / Verification Plan

### Automated Quality Gates
- `npm run fork:verify`
- `npm run typecheck`
- `npm test`
- `npm run secret-scan`
- `npm run build`
