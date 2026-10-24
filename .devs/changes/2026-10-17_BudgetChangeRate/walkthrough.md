# Walkthrough: Budget change rate (#368)

## Summary
The budget summary in the Cost Overview card now shows the 前日比 / 前週比 change (in %) of usage relative to the limit line (free tier + limit). It is shown as 無効 when fewer than 2 (day) / 8 (week) observed days exist, or when no limit is set.

## Changes Made
- [dashboard/src/utils/budgetForecast.ts](../../../dashboard/src/utils/budgetForecast.ts): `dayChangePercent` / `weekChangePercent` in `summarizeBudgetForecast()`.
- [dashboard/src/components/monthly-report/CostOverviewBudgetSummary.tsx](../../../dashboard/src/components/monthly-report/CostOverviewBudgetSummary.tsx): display with disabled state.
- [src/tests/ui/monthly-report-kpis-budget.test.tsx](../../../src/tests/ui/monthly-report-kpis-budget.test.tsx): 4 new tests.

## Verification Results
Results of `npm run fork:verify`, `npm run typecheck`, `npm test`, `npm run secret-scan` and `npm run build` are recorded in the PR (all passing locally before the PR).
