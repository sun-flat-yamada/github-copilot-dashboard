# Implementation Plan: Add Claude Sonnet 5.5 and GPT-6.1 Sol (#272)

## Why
`supported_models.md` already lists Claude Sonnet 5.5 and GPT-6.1 Sol (GA), but the model catalog, benchmark records and radar presets do not (dual-sync rule).

## Approach
- `model-catalog.ts`: add `claude-sonnet-5-5` and `gpt-6-1-sol` with aliases.
- `benchmark-records.json`: add both records. Price ($2 / $10 per 1M), context window and release dates come from public announcements. Scores have no verified source, so they are estimates anchored on the sibling models (Sonnet 5 / GPT-6 Sol) and flagged `is_estimated: true`.
- Add optional `is_estimated` to `ModelBenchmarkProfile`, pass it through `update-benchmarks.ts`, and show an "estimated" badge in `ModelRadarView`.
- `radar-constants.ts`: add the models to the vendor presets; update `radar-presets.test.ts`.
- Add tests for the catalog aliases and the estimated flag.

## Verification
Quality gate: fork:verify, typecheck, test, secret-scan, build.
