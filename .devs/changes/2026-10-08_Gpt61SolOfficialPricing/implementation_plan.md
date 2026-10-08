# Implementation Plan: Register the official cache-write and long-context prices of GPT-6.1 Sol (Issue #297)

Issue #297 (parent #172, origin #212): `scripts/benchmark-data/benchmark-records.json` has the input, cached-input and output prices of GPT-6.1 Sol (`gpt-6-1-sol`) but lacks the cache-write and long-context prices that GitHub's official pricing table lists.

## Primary source
| Item | Value |
| :--- | :--- |
| File | `github/docs` `data/tables/copilot/models-and-pricing.yml` (rendered by `content/copilot/reference/copilot-billing/models-and-pricing.md`) |
| Commit cited by the Issue | `45a0f053ac67e8d1f56fc8f7ee38f0b2a58925c3` |
| Also checked | `github/docs` branch `main` on 2026-10-08 (same GPT-6.1 Sol rows) |
| Verification date | 2026-10-08 |

Official GPT-6.1 Sol rows:

| Tier | Threshold | Input | Cached input | Cache write | Output |
| :--- | :--- | ---: | ---: | ---: | ---: |
| Default | <= 272K | $2.00 | $0.10 | $2.50 | $10.00 |
| Long context | > 272K | $4.00 | $0.20 | $5.00 | $15.00 |

## User Review Required
> [!IMPORTANT]
> - Add `cache_write_cost_per_m: 2.5`, `long_context_threshold_k: 272`, `long_context_input_cost_per_m: 4`, `long_context_output_cost_per_m: 15` to the GPT-6.1 Sol record (same layout as GPT-6 Sol). The `BenchmarkRawMetrics` schema has no long-context cached-input / cache-write fields, so the official $0.20 / $5.00 long-context cache prices are not added (no schema change in this Issue).
> - The input/output/cached prices are unchanged, so radar scores do not move; the dataset `content_hash` changes and `version` advances when `scripts/update-benchmarks.ts` regenerates `dashboard/public/data/model-benchmarks.json` (generated at `prebuild` / `pretest`, git-ignored).
> - Benchmark scores of GPT-6.1 Sol stay estimates (`is_estimated`, shown as 推測値). Only the prices are verified.

> [!WARNING]
> - UI effect: the radar detail panel now shows "書込: $2.5" and the long-context price strip for GPT-6.1 Sol. The strip label is hard-coded as `> 200K`; it is changed to use `long_context_threshold_k` (fallback 200) so GPT-6.1 Sol shows `> 272K`. LIVE and DEMO share the same `model-benchmarks.json`, so DEMO reflects the change without separate data. A screenshot verifies the panel.
> - `docs/models_pricing.md`, `src/domain/pricing/pricing-catalog.ts` and SDD-06 are not touched (open PR #299 edits them). `docs/models_pricing.md` already lists the same official values.

## Proposed Changes
#### [MODIFY] [scripts/benchmark-data/benchmark-records.json](../../../scripts/benchmark-data/benchmark-records.json)
- GPT-6.1 Sol: four fields above.
#### [MODIFY] [src/tests/estimated-models.test.ts](../../../src/tests/estimated-models.test.ts)
- Assert the official GPT-6.1 Sol price fields.
#### [MODIFY] [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx)
- Long-context strip label uses `long_context_threshold_k`.
#### [MODIFY] [docs/specifications/10_ai_model_benchmark_radar_spec.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.md) / [.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md)
- GPT-6.1 Sol row: prices verified against the official table (date, commit); long-context label rule.

## Dual-sync check (model-benchmark-management.md)
- `supported_models.md`: GPT-6.1 Sol already listed (GA, clients, plans, IDE versions); no pricing in this file -> no change.
- `src/processor/model-catalog.ts`: alias exists -> no change.
- `dashboard/src/components/radar/radar-constants.ts`: in the OpenAI comparison group -> no change.
- `docs/models_pricing.md`: already matches the official rows -> no change.

## Verification Plan
- `npm run benchmark:update` (hash/version), `npm run change-dev:plan-check`.
- Full gate: `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`.
- Screenshot of the radar detail panel for GPT-6.1 Sol (DEMO).
