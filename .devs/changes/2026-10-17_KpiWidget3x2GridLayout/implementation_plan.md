# Implementation Plan: KPI Summary Widgets 3x2 Grid Layout & Smartphone-Portrait Width Sizing (#364)

## Goal
Arrange the `KPI サマリーウィジェット` in a **3-column × 2-row (3x2)** grid layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) instead of the cramped 5-column layout (`xl:grid-cols-5`), and size each widget so its width matches or exceeds the comfortable 1-column width on a smartphone in portrait orientation (`w-full min-w-[min(100%,21rem)]`), expanding further when screen space permits.

## Proposed Changes

1. **`dashboard/src/views/dashboard/View.tsx`**:
   - Change the `overview-widget-list` grid container (for both Live and Report modes) from `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full` to `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full`.
   - In the Widget Catalog panel (`widget-catalog-group-kpi`), ensure the KPI Summary Widgets grid (`data-testid="widget-catalog-kpi-grid"`) uses `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3` with `w-full min-w-[min(100%,20rem)]` on each item, and update the labels/badges from `5列グリッド・1/5幅配置` / `KPI カード (1/5幅)` to `3列×2行グリッド・1/3幅配置` / `KPI カード (1/3幅)`.

2. **`dashboard/src/components/common/WidgetCardFrame.tsx`**:
   - Add `w-full min-w-[min(100%,21rem)]` (`336px`, matching smartphone portrait 1-column content width) to the root KPI widget card container so each KPI widget maintains smartphone-portrait single-column readability as its baseline and expands smoothly across the 3x2 grid when additional viewport width is available.

3. **Tests & Specifications**:
   - Update `src/tests/ui/overview-widgets.test.tsx` to verify that `overview-widget-list` and `widget-catalog-kpi-grid` use the 3x2 grid layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, without `xl:grid-cols-5` or `sm:grid-cols-2`) and that each KPI widget frame carries the smartphone-portrait baseline width class (`min-w-[min(100%,21rem)]`).
   - Update `docs/specifications/07_dashboard_ui_ux_spec.ja.md` and `docs/specifications/07_dashboard_ui_ux_spec.md` (§2.4).
