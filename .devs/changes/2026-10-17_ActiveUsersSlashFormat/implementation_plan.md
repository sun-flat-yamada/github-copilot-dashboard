# Implementation Plan - Active Users Slash Separated Format (#385)

## 概要 / Overview
月次レポート (Monthly Usage Report) の KPI サマリーカード「レポート内アクティブ人数」(`report_active_users`) において、下部のプラン内訳と共通のスラッシュ区切りフォーマット（`アクティブ (割合%) / 選択中データ総数 / 全体総数`）で併記表示するよう改善します。

例:
```text
16 (100.0%) / 16 / 32
  Enterprise: 5 / 0 / 5
  Business:  11 / 0 / 11
```

## 変更内容 / Proposed Changes
1. **配線（Props バケツリレーの最小限かつ完全な配線）**:
   - `dashboard/src/views/types.ts`: `ViewContext` に `rawCurrentReportData?: MonthlyReportAggregatedData | null;` を追加。
   - `dashboard/src/AppShell.tsx`: `viewContext` に `rawCurrentReportData` を渡す。
   - `dashboard/src/views/dashboard/View.tsx`: `SingleMonthlyReportKpiCard` に `rawReportData={rawCurrentReportData}` を渡す。
   - `dashboard/src/views/overview/View.tsx`: `MonthlyReportKpis` に `rawReportData={rawCurrentReportData}` を渡す。
2. **カード表示の実装 (`MonthlyReportKpis.tsx`)**:
   - `MonthlyReportKpisProps` および `SingleMonthlyReportKpiCardProps` に `rawReportData?: MonthlyReportAggregatedData | null;` を追加。
   - `MonthlyReportKpis` から `SingleMonthlyReportKpiCard` へ `rawReportData` を渡す。
   - `case 'report_kpi_active_users':` 内で、
     - `selectedTotal = enterprise.total + business.total` （選択中データの総数）
     - `overallTotal` （未フィルター全体データの総数）
     - `activeRate = selectedTotal > 0 ? (activeUsers / selectedTotal) * 100 : 0`
     - スラッシュ区切りフォーマット:
       `{activeUsers} ({activeRate.toFixed(1)}%) / {selectedTotal} / {overallTotal} 名`
     として表示。
   - 他の KPI カード（費用サマリー、PR #377 で導入された水平ミニ箱ひげ図 RequestsBoxPlot、最多利用モデル）には一切手を加えない。
3. **テスト検証 (`src/tests/ui/monthly-report-kpis.test.tsx`)**:
   - スラッシュ区切り表示の正確性を検証するテストを追加。
   - フル品質ゲート（`fork:verify`, `typecheck`, `npm test`, `secret-scan`, `build`）をすべてパスさせる。
