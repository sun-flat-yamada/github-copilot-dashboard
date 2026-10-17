# 予算サマリーに上限比の前日・前週変化率を表示 (#368)

費用サマリーの予算サマリーに、上限ライン (無料枠 + 上限) に対する利用料の増加分を、前1日・前1週間について % で表示する。必要な観測期間に満たない場合は「無効」表示にする。

## 定義
- 変化率(%) = (最終観測日の累積利用額 − N 日前の累積利用額) ÷ 上限ライン × 100
- 前1日: 最終観測日が 2 日目以降、前1週: 最終観測日が 8 日目以降で有効。それ未満、または上限未設定のときは無効 (値を作らない)。

## Proposed Changes
#### [MODIFY] [dashboard/src/utils/budgetForecast.ts](../../../dashboard/src/utils/budgetForecast.ts)
- `BudgetForecastSummary` に `dayChangePercent` / `weekChangePercent` (無効は null) を追加。

#### [MODIFY] [dashboard/src/components/monthly-report/CostOverviewBudgetSummary.tsx](../../../dashboard/src/components/monthly-report/CostOverviewBudgetSummary.tsx)
- 前日比・前週比を表示。無効時は「無効」。

#### [MODIFY] [src/tests/ui/monthly-report-kpis-budget.test.tsx](../../../src/tests/ui/monthly-report-kpis-budget.test.tsx)
- 有効・無効のテストを追加。

## Verification Plan
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
