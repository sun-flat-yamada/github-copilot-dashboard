# Cost Overview カードに予算推移・上限到達予測のサマリーを表示 (#366)

月次レポートの「費用サマリー (Cost Overview)」カードに、「Cost Center 予算の推移と上限到達予測」のサマリー版を追加する。上限・無料枠・現在利用料は数値で明示する。

## Proposed Changes

### Dashboard

#### [MODIFY] [dashboard/src/utils/budgetForecast.ts](../../../dashboard/src/utils/budgetForecast.ts)
- `summarizeBudgetForecast()` を追加 (純関数)。各 Cost Center の `buildBudgetTimeline` 結果から、上限ライン (無料枠 + Limit) に対する現在利用料の比率が最大の Cost Center を選び、現在利用料・無料枠・上限・予測状態を返す。日次データの無い Cost Center は対象外 (値を作らない)。

#### [MODIFY] [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
- 任意の `budgets` prop を追加し、費用サマリーカード内にサマリー (Cost Center 名・現在利用料・無料枠・上限・進捗バー・到達予測テキスト) を表示。

#### [MODIFY] [dashboard/src/views/overview/View.tsx](../../../dashboard/src/views/overview/View.tsx)
- `MonthlyReportKpis` へ `reportBudgets` を渡す。

#### [NEW] [src/tests/ui/monthly-report-kpis-budget.test.tsx](../../../src/tests/ui/monthly-report-kpis-budget.test.tsx)
- 数値表示・予測表示・データ無し時の非表示のテスト。

## Verification Plan
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
