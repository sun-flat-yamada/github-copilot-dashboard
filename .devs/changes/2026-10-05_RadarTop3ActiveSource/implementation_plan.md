# Implementation Plan: AI radar default selection and sidebar share follow the active data source

## Problem
In the model radar, the default selection is not the Top 3 models of the data selected in the header, and the per-model `%` in the left pane does not reflect it.

## Root cause
`useDashboardData` always returns the live scope as `currentData` (non-null once loaded), even when the active source is `monthly_report` or `user_upload`. `views/model_radar/View.tsx` passes both `currentData` and `currentReportData` to `ModelRadarView`, and `computeModelUsage` prefers `aggregatedData` (live scope) whenever it has usage; the report data is only a fallback when the live total is 0. With a report/upload source selected, the Top 3 and the shares are computed from the wrong data set (or from none when the live scope has no usage).

## Fix
- `views/model_radar/View.tsx`: pass only the data of the active source (`isReportSource` ? report : live scope).
- Regression test in `src/tests/radar-active-scope-sync.test.ts`.
- Update SDD-10 note if it describes the source precedence.

## Verification
Quality gate: `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`.
