# Implementation Plan: Recognise `Auto: <model>` and generic feature labels in the model catalog (Issue #302)

Real AI usage reports (Issue #170 / PR #300) contain `model` values that `src/processor/model-catalog.ts` resolves to `unknown:<raw>`: `Auto: <model>` (Copilot's Auto selection) and generic feature labels (`Code Review model`, `Coding Agent model`).

## Decisions
- **`Auto: <model>`**: strip the `Auto:` prefix (case-insensitive, optional spaces) and resolve the inner name by the existing exact-alias rules. No substring matching is introduced. An unknown inner name stays `unknown:<raw>` with the full raw label.
- **Generic feature labels**: option (b) of the Issue. They are **not** mapped to a model: the actual model behind a feature is not stated in the label, and a default-model mapping would present a guess as fact. They resolve to a separate `feature:<slug>` ID (`feature:code-review`, `feature:coding-agent`), distinguishable from `unknown:`. The list is explicit (exact match on the normalised label), never a "ends with model" pattern.
- No change to `ReportParser` (values are kept as written).

## Proposed Changes
- [MODIFY] `src/processor/model-catalog.ts`: `Auto:` prefix stripping in `resolveCatalogModelId`; `FEATURE_MODEL_PREFIX`, `resolveFeatureLabelId`, `isFeatureModelId`.
- [MODIFY] `src/processor/benchmark-evaluator.ts`: `normalizeModelId` returns the feature ID for feature labels.
- [MODIFY] `src/tests/model-catalog.test.ts` (or the existing normalization test): regression tests with fictitious data only.
- [MODIFY] SDD-09 §3.5 (EN/JA): record the handling.
- No model/benchmark data change (dual-sync rule not triggered).

## Verification Plan
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
