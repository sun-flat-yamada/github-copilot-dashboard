# Implementation Plan: Cost center timeline for auto-collected data, following the selected period (Issue #284)

## Problem
`CostCenterBudgetTimeline` is rendered only for report sources (`monthly_report`, `user_upload`), because only the report has `cost_center_daily`. The auto-collected (`live_metrics`) source shows no timeline, and the chart is hard-wired to one calendar month.

## Data for the live source
Live has no per-cost-center usage ledger. Cost is seat based, and each seat carries `prorated_daily_cost_usd` (the same value behind `daily_trends[].daily_cost_usd`). The daily series of a cost center is the sum of `prorated_daily_cost_usd` of its seats for every date in `daily_trends` (observed days). Days without data stay unobserved; nothing is estimated. The series is therefore the seat-cost accrual, which is labelled as such in the chart note.

## Period model
`buildBudgetTimeline` takes either `month` (unchanged) or `start`/`end` and builds the axis over the period; x is the day index within the period. Live period: monthly scope = the whole month of `scope_key` (so the forecast can reach month end), daily / custom / last-30-days = `date_range`.
Limit and free tier are monthly frames: drawn in every period, forecast only for a monthly period (`forecastEnabled`), with a reason otherwise.

## Proposed Changes
- [MODIFY] `dashboard/src/utils/budgetForecast.ts`: period (start/end) support, `forecastEnabled`, exported `dayIndex`; `liveCostCenterDaily(scope)` helper.
- [MODIFY] `dashboard/src/components/CostCenterBudgetTimeline.tsx`: props become `{ budgets, costCenterDaily, period, forecastEnabled, note }`; x-axis labels follow the period.
- [MODIFY] `dashboard/src/views/budget/View.tsx`: render for the live source as well, build props for both sources.
- [MODIFY] `src/tests/cost-center-budget-timeline.test.ts`: period axis, forecast disabled, live daily series.

## Verification
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`; screenshots for monthly / daily / 30 days with the demo data.
