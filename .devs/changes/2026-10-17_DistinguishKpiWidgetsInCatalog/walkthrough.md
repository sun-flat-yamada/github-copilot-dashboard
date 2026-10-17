# Walkthrough: Distinguish KPI Widgets vs Analysis Sections in Widget Catalog (#344)

## Summary of Changes

1. **Separated KPI Summary Widgets and Detailed Analysis Section Widgets in Widget Catalog (`dashboard/src/views/dashboard/View.tsx`)**:
   - Divided the flat `widgetCatalog` list in the Widget Catalog panel (`data-testid="widget-catalog-panel"`) into two dedicated category groups:
     - **KPI サマリーウィジェット** (`data-testid="widget-catalog-group-kpi"`): Contains all `size: 'kpi'` metric cards (`kpi_total_spend`, `kpi_active_rate`, `kpi_idle_waste`, `kpi_budget_utilization`, `kpi_acceptance_rate` in Live mode; `report_kpi_*` in Report mode). Styled with emerald theme accents (`border-l-4 border-l-emerald-500/80`, `Gauge` icon, `KPI カード (1/5幅)` badge, and `data-widget-category="kpi"`).
     - **詳細分析セクションウィジェット** (`data-testid="widget-catalog-group-section"`): Contains all `size: 'full'` accordion sections (`advisor`, `allocation`, `budget`, `yearly-trend`, `usage`, `users`, `budget-timeline`, `credits`, `agent-activity`, `maturity`, `audit-quality`). Styled with indigo theme accents (`border-l-4 border-l-indigo-500/80`, `Layers` icon, `分析セクション (全幅)` badge, and `data-widget-category="section"`).
   - Added active placement counters (`X / Y 配置中`) in each group header (`data-testid="widget-catalog-kpi-status"` and `data-testid="widget-catalog-section-status"`).
   - Added category filter tabs (`すべて` / `KPI カード` / `分析セクション` with `data-testid="widget-catalog-filter-all"`, `widget-catalog-filter-kpi`, `widget-catalog-filter-section`) in the catalog header for one-click category filtering.

2. **Unit Tests & Specifications**:
   - Extended `src/tests/ui/overview-widgets.test.tsx` to verify that both groups render with accurate placement counts, category attributes (`data-widget-category="kpi"` / `"section"`), and interactive category filter tabs.
   - Updated `docs/specifications/07_dashboard_ui_ux_spec.ja.md` and `docs/specifications/07_dashboard_ui_ux_spec.md` (§2.4) to document the grouped Widget Catalog panel and category filter controls.

## Verification Results

- `npm run fork:verify`: Passed
- `npm run typecheck`: Passed
- `npm run lint`: Passed
- `npx tsx --test src/tests/view-registry.test.ts src/tests/ui/overview-widgets.test.tsx src/tests/ui/app-behavior.test.tsx src/tests/yearly-trend.test.tsx`: Passed
- `npm run secret-scan`: Passed
- `npm run build`: Passed
