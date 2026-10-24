# Walkthrough: Cost Overview budget forecast summary (#366)

## Summary
The monthly report "費用サマリー (Cost Overview)" card now shows a compact version of "Cost Center 予算の推移と上限到達予測": the Cost Center closest to its limit, with 現在利用料 / 無料枠 / 上限 as numbers, a progress bar toward the limit line (free tier + limit) and the forecast text. Nothing is shown when budgets or daily data are missing.

## Changes Made
### Dashboard
- [dashboard/src/utils/budgetForecast.ts](../../../dashboard/src/utils/budgetForecast.ts): added `summarizeBudgetForecast()`.
- [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx): new optional `budgets` prop and summary block.
- [dashboard/src/views/overview/View.tsx](../../../dashboard/src/views/overview/View.tsx): passes `reportBudgets`.
- [src/tests/ui/monthly-report-kpis-budget.test.tsx](../../../src/tests/ui/monthly-report-kpis-budget.test.tsx): 3 new tests.

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Exit 0 |
| TypeScript Check | `npm run typecheck` | ✅ Pass |
| Unit & Integration Tests | `npm test` | ✅ 1195/1196 pass, 0 fail |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 leaks |
| Production Build | `npm run build` | ✅ Built in 1.92s |
