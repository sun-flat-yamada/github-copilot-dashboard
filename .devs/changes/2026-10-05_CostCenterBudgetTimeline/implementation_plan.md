# Implementation Plan: Cost Center budget time-series chart with limit-reach forecast

## Goal
In the Cost Center budget view, show a per-Cost-Center time-series chart for the selected period (e.g. a month, day 1 to month end):

- cumulative AI usage (gross USD),
- the point where the free tier is exceeded,
- the budget limit line (free tier + spending limit, i.e. where net billable spend reaches the limit),
- a projection of the date the limit is reached, drawn with a confidence band.

## Findings
- `CostCenterBudget` holds only totals (limit, free tier, current spend); no per-day data.
- The monthly report parser (`src/processor/report-parser.ts`) already sees `date` x `cost_center_name` x `gross_amount` per record but only emits `by_cost_center` totals and an all-company `daily_trends`.
- Budget evaluation: `net_billable = max(0, gross - free)`; limit applies to net, so the limit line on the gross axis is `free + limit` (`BudgetUtilizationRule`).
- Live scope has no per-Cost-Center daily spend, so the chart targets report sources (`monthly_report`, `user_upload`) in this change; live shows nothing new.

## Changes
1. `src/domain/entities/copilot.ts`: add optional `cost_center_daily?: Record<string, ReportCostCenterDailyEntry[]>` (`{ date, spend_usd }`, gross) to `MonthlyReportAggregatedData`. Optional, so existing stored reports stay valid.
2. `src/processor/report-parser.ts`: accumulate gross spend per Cost Center per date (same attribute resolution as `ccMap`) and emit it.
3. `dashboard/src/utils/budgetForecast.ts` (pure): build the cumulative series over the full period, find the free-tier crossing date, and project forward with a least-squares line through the cumulative series. Confidence band = prediction interval from the regression residuals (t-approximated 80%/95%); projected limit-reach date = first day the central line, and the optimistic/pessimistic band edges, cross the limit. No projection (and an explicit reason) when there are fewer than 5 observed days, no growth, or no limit set. Nothing is fabricated: unobserved days are never filled with zeros as actuals.
4. `dashboard/src/components/CostCenterBudgetTimeline.tsx` (recharts): per-Cost-Center selector, actual cumulative line, projection line, confidence band area, free-tier and limit reference lines, summary of the projected date. Added to `dashboard/src/views/budget/View.tsx` for report sources, following the existing dark-slate styling and `useCurrency`.
5. Tests: forecast util (crossing, band, edge cases), parser per-Cost-Center daily output.
6. Docs: SDD-07 (dashboard UI/UX) EN + JA.

## Defaults chosen
- Period = the report month, x axis from day 1 to the last day of the month.
- Forecast method = linear trend on cumulative spend, band 80%.
- Report sources only; live sources are a follow-up.

## Verification
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
