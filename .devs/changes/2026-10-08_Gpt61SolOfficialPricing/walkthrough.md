# Walkthrough: GPT-6.1 Sol official cache-write and long-context prices (Issue #297)

## Source check (2026-10-08)
`github/docs` `data/tables/copilot/models-and-pricing.yml` was read at the commit cited by the Issue (`45a0f053ac67e8d1f56fc8f7ee38f0b2a58925c3`) and on `main`. Both list the same GPT-6.1 Sol rows:

| Tier | Threshold | Input | Cached input | Cache write | Output |
| :--- | :--- | ---: | ---: | ---: | ---: |
| Default | <= 272K | $2.00 | $0.10 | $2.50 | $10.00 |
| Long context | > 272K | $4.00 | $0.20 | $5.00 | $15.00 |

## Changes
| File | Change |
| :--- | :--- |
| [scripts/benchmark-data/benchmark-records.json](../../../scripts/benchmark-data/benchmark-records.json) | GPT-6.1 Sol: `cache_write_cost_per_m` 2.5, `long_context_threshold_k` 272, `long_context_input_cost_per_m` 4, `long_context_output_cost_per_m` 15 (same layout as GPT-6 Sol) |
| [src/tests/estimated-models.test.ts](../../../src/tests/estimated-models.test.ts) | Asserts the official GPT-6.1 Sol price fields |
| [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx) | Long-context strip label uses `long_context_threshold_k` (fallback 200K) instead of a fixed `> 200K` |
| [docs/specifications/10_ai_model_benchmark_radar_spec.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.md) / [.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md) | Verification date and source on the GPT-6.1 Sol row; label rule |

- Not added: the long-context cached-input ($0.20) and cache-write ($5.00) prices. `BenchmarkRawMetrics` has no fields for them.
- Benchmark scores of GPT-6.1 Sol stay estimates (`is_estimated`, 推測値); radar scores do not change (input/output prices unchanged).
- Dataset: `npm run benchmark:update` moved `content_hash` `1e96a82dbf97307d` -> `bb21f357b7f65ae0` and `version` `2026-10-08-0001` -> `2026-10-08-0002` (generated file, git-ignored; rebuilt at `prebuild` / `pretest`).

## Dual-sync check
| File | Result |
| :--- | :--- |
| `supported_models.md` | GPT-6.1 Sol already listed (GA, clients, plans, IDE versions); no prices in this file. No change |
| `src/processor/model-catalog.ts` | Alias present. No change |
| `dashboard/src/components/radar/radar-constants.ts` | In the OpenAI comparison group. No change |
| `docs/models_pricing.md` | Already matches the official rows. No change (also edited by open PR #299) |

## UI verification (DEMO, `?demo=true`)
LIVE and DEMO load the same `model-benchmarks.json`, so DEMO needs no separate data. In the radar view with GPT-6.1 Sol focused, the price card shows `Cache 読取 $0.1` with `書込: $2.5` and the strip `超長文 (Long Context > 272K) 課金: In: $4 / Out: $15 (/1M Tok)` (Playwright screenshot of the built app, `vite preview`).

## Quality gate
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`: exit 0. Tests 1154 pass / 0 fail; secret scan clean (648 files); build within the bundle budget.
