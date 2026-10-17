# Walkthrough — Dashboard タブ新設・コスト内訳タブとの分離および全 KPI 項目の Widget 化 (#334)

## 実装内容

1. **専用 `Dashboard` タブ (`id: 'dashboard'`) の新設と `コスト内訳` (`overview`) タブとの分離**
   - `dashboard/src/views/dashboard/manifest.ts` (`order: 5`, `label: 'Dashboard'`, `iconName: 'LayoutDashboard'`) および `dashboard/src/views/dashboard/View.tsx` を新設。
   - `dashboard/src/AppShell.tsx` の初期表示タブ (`activeView`) を `'dashboard'` に変更し、サイトアクセス時に `Dashboard` タブが最初に開くように設定。
   - 従来の `コスト内訳` (`dashboard/src/views/overview/View.tsx`) タブは固定構成のコスト内訳・詳細分析ビューとして独立維持。

2. **全 KPI 項目の個別 Widget 化**
   - `dashboard/src/hooks/useOverviewWidgets.ts` にて、Live Metrics 用の 5 つの KPI カード（`kpi_total_spend`: `当月 月額費用 (シート費)`、`kpi_active_rate`: `シート稼働率`、`kpi_idle_waste`: `遊休シート推定無駄コスト`、`kpi_budget_utilization`: `予算消化率`、`kpi_acceptance_rate`: `Inline補完受諾率`）および Report 用の 5 つの KPI カード（`report_kpi_cost`、`report_kpi_requests`、`report_kpi_active_users`、`report_kpi_top_model`、`report_kpi_top_sku`）を個別 Widget として定義し、デフォルトプリセットに組み込み。
   - `dashboard/src/components/KpiSummaryCards.tsx` から `SingleKpiSummaryCard`、`dashboard/src/components/monthly-report/MonthlyReportKpis.tsx` から `SingleMonthlyReportKpiCard` をエクスポートし、`dashboard/src/components/common/WidgetCardFrame.tsx` により各 KPI カードにドラッグハンドル・順序移動ボタン (`↑`/`↓`)・削除ボタン (`×`) を付与。
   - 各 KPI Widget と大型分析セクション Widget を同一の Widget リストで管理し、追加・削除・表示順序変更・デフォルトプリセットへのリセット・`localStorage` による次回アクセス時の設定復元を実現。

## 検証結果
- `npm run fork:verify`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npx tsx --test src/tests/view-registry.test.ts src/tests/ui/overview-widgets.test.tsx src/tests/ui/app-behavior.test.tsx src/tests/yearly-trend.test.tsx`: 36 tests PASS
- `npm run secret-scan`: PASS (0 secrets)
- `npm run build`: PASS (main chunk 169.03 kB / 300 kB budget)
- `npm run change-dev:plan-check`: PASS
