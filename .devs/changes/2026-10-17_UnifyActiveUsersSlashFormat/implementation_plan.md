# Implementation Plan - Unify Active Users Slash Format to (Active / Non-Active / Total) (#390)

## 1. Overview / 概要
月次レポート (Monthly Usage Report) の KPI サマリーカード「レポート内アクティブ人数」(`report_active_users`) において、カード冒頭に `(アクティブ / ノンアクティブ / 全数)` であることを明記し、1行目の全体表示もプラン内訳と同一の数値表示ルール（アクティブ (割合%) / ノンアクティブ / 全数）に統一します。

- 例 (ノンアクティブ 16 名、全数 32 名の場合):
  - 1行目: `16 (50.0%) / 16 / 32 名`
  - プラン内訳:
    - Enterprise: 5 / 5 / 10
    - Business: 11 / 11 / 22
- 例 (ノンアクティブ 0 名、全数 16 名の場合):
  - 1行目: `16 (100.0%) / 0 / 16 名`
  - プラン内訳:
    - Enterprise: 5 / 0 / 5
    - Business: 11 / 0 / 11

## 2. Changes / 変更点
1. `dashboard/src/components/monthly-report/MonthlyReportKpis.tsx`:
   - カード冒頭（タイトル部）に `(アクティブ / ノンアクティブ / 全数)` を明示。
   - `report_kpi_active_users` の 1 行目表示において:
     - `activeUsers`: アクティブ人数
     - `nonActiveUsers`: `enterprise.nonActive + business.nonActive` (または `Math.max(0, totalUsers - activeUsers)`)
     - `totalUsers`: `enterprise.total + business.total`
     - フォーマット: `<span data-testid="report-active-users-total">{activeUsers}</span><span data-testid="report-active-users-percent">({activeRate.toFixed(1)}%)</span> <span data-testid="report-active-users-ratio">/ {nonActiveUsers} / {totalUsers} 名</span>`
2. `src/tests/ui/monthly-report-kpis.test.tsx`:
   - 単体テストの期待値を新ルール（`アクティブ / ノンアクティブ / 全数`）に更新。

## 3. Verification / 検証手順
1. `npx tsx --test src/tests/ui/monthly-report-kpis.test.tsx`
2. `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
