# Implementation Plan - Calculate Active Users Percentage Against Overall Total Population (#387)

## 1. Overview / 概要
月次レポート (Monthly Usage Report) の KPI サマリーカード「レポート内アクティブ人数」(`report_active_users`) において、アクティブ人数の割合(%)の計算で分母が選択中データ総数 (`selectedTotal`) になっていたため、全体総数 (`overallTotal`) に対するアクティブ率が正しく反映されず `(100.0%)` と誤表示される問題を修正します。

- 例 (全体 32 名、アクティブ 16 名、選択中 16 名の場合):
  - 修正前: `16 (100.0%) / 16 / 32 名` (分母が選択中総数 16 になっているため 100% と誤計算)
  - 修正後: `16 (50.0%) / 16 / 32 名` (分母を全体総数 32 とし、アクティブ率 16 / 32 = 50.0% を正しく算出)

## 2. Changes / 変更点
1. `dashboard/src/components/monthly-report/MonthlyReportKpis.tsx`:
   - `case 'report_kpi_active_users':` 内で、`activeRate` の算出分母を `overallTotal`（フォールバック: `selectedTotal`）に変更。
   - `const denominator = overallTotal > 0 ? overallTotal : selectedTotal;`
   - `const activeRate = denominator > 0 ? (activeUsers / denominator) * 100 : 0;`
2. `src/tests/ui/monthly-report-kpis.test.tsx`:
   - 単体テストのアサーションを更新 (`16 (50.0%) / 16 / 32 名` 等)。

## 3. Verification / 検証手順
1. `npx tsx --test src/tests/ui/monthly-report-kpis.test.tsx`
2. `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
