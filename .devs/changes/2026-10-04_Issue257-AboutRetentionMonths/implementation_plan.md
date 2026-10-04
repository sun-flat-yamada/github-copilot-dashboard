# Issue #257: About modal retention display vs 60-month policy

Closes #257. `index.json` carries a fixed `data_retention_days: 365`, which the About modal shows as the retention period; the real policy is 60 months (`COPILOT_DATA_RETENTION_MONTHS`, SDD-17 §8.1).

## Decision
Add `data_retention_months` to `IndexMetadata`, written by `PipelineOrchestrator` from `parseRetentionMonths(process.env.COPILOT_DATA_RETENTION_MONTHS)`. `data_retention_days` is no longer written and becomes an optional, deprecated field (older indexes and fixtures still carry it, so no fixture rewrite is needed). The modal shows months (and years when divisible by 12); when the field is absent (old index) it shows the default 60 months, never the legacy 365 days.

## Proposed Changes
- [MODIFY] `src/domain/entities/copilot.ts`: add `data_retention_months?: number`; mark `data_retention_days?` deprecated.
- [MODIFY] `src/application/pipeline/PipelineOrchestrator.ts`: write `data_retention_months`.
- [MODIFY] `dashboard/src/components/AboutModal.tsx`: display months.
- [MODIFY] tests: pipeline output assertion, About modal display.
- [MODIFY] SDD-05 §3, SDD-07, SDD-17 §8.1 / §9.2 (EN and JA).

## Verification Plan
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
