# Implementation Plan: Cost Center spend timeline with free tier, limit and exhaustion forecast (Issue #280)

## Problem
The Budget view (`views/budget`) shows only snapshot cards per Cost Center. It does not show how spend moved through the selected month, where it crossed the free tier, where the spending limit is, or when the limit will be reached.

## Data
Per-Cost-Center daily spend does not exist in any aggregate (`daily_trends` is organisation-wide). It is aggregated from the real report records; nothing is estimated or generated.

- `MonthlyReportAggregatedData.cost_center_daily?: Record<string, ReportCostCenterDaily[]>` (`date`, `gross_usd`, `net_usd`). Filled in `report-parser.ts` from dated records only.
- The series uses gross spend (`current_spend_usd` = gross), the same basis as the budget cards. Free tier / limit are the existing `CostCenterBudget` values; the limit line is `free + limit` on the gross axis because the limit applies to the net billable amount (`BudgetUtilizationRule`).
- Live metrics scope has no per-Cost-Center daily data: the chart shows an explicit "no daily data" state instead of a fabricated line.
- `cost_center_daily` is added to `REPORT_UNFILTERABLE_SECTIONS` (same treatment as `daily_trends`).

## Forecast (pure function, unit tested)
`src/domain/rules/BudgetForecastRule.ts`: cumulative series -> daily rate from the trailing window (last 7 observed days, fewer if short). Band: low rate = lowest of window-mean and whole-month mean, high rate = highest, expected = window-mean. Reach date = last observed date + remaining / rate for each rate (earliest = high rate, latest = low rate). Returns `null` when: no limit, no observed spend, fewer than 3 observed days, or rate is 0. Already exceeded -> reports the crossing date instead of a forecast. Dates beyond the month end are reported as "month end not reached".

## Proposed Changes
- [MODIFY] `src/domain/entities/copilot.ts`, `src/processor/report-parser.ts`, `src/domain/constants/filter-scope.ts`
- [NEW] `src/domain/rules/BudgetForecastRule.ts`
- [NEW] `dashboard/src/components/CostCenterSpendTimeline.tsx` (Recharts: cumulative area/line, free-tier line, limit line, forecast line + shaded forecast range, reach-date band annotation)
- [MODIFY] `dashboard/src/views/budget/View.tsx` (render timeline in the report source)
- [NEW] tests `src/tests/budget-forecast-rule.test.ts`, extend `report-parser.test.ts`
- [MODIFY] SDD-06 note on the budget timeline and forecast

## Verification Plan
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
