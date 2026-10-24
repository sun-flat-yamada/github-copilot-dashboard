# Walkthrough: KPI Summary Widgets 3x2 Grid Layout & Smartphone-Portrait Width Sizing (#364)

## Summary of Changes

1. **3-Column × 2-Row (3x2) KPI Widget Grid Layout (`dashboard/src/views/dashboard/View.tsx`)**:
   - Updated the `Dashboard` widget grid (`data-testid="overview-widget-list"`) for both Live Metrics and Report/Upload modes from `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full` to `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full`.
   - Updated the Widget Catalog's KPI Summary Widgets section (`data-testid="widget-catalog-group-kpi"`, `data-testid="widget-catalog-kpi-grid"`) to use `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3` and updated badges/labels to `3列×2行グリッド・1/3幅配置` / `KPI カード (1/3幅)`.

2. **Smartphone-Portrait Baseline Width & Fluid Expansion (`dashboard/src/components/common/WidgetCardFrame.tsx`)**:
   - Added `w-full min-w-[min(100%,21rem)]` (`336px`, matching the comfortable 1-column card width on a smartphone portrait screen) to each KPI widget frame and catalog KPI item, while removing `sm:grid-cols-2` so widgets never compress below smartphone portrait width on narrow screens and expand across `1fr` columns when additional viewport width is available.

3. **Tests & Specifications**:
   - Added unit test assertions in `src/tests/ui/overview-widgets.test.tsx` verifying the 3x2 grid classes (`grid-cols-1`, `md:grid-cols-2`, `lg:grid-cols-3`, absence of `xl:grid-cols-5` and `sm:grid-cols-2`) and KPI widget width classes (`w-full`, `min-w-[min(100%,21rem)]`).
   - Updated `docs/specifications/07_dashboard_ui_ux_spec.ja.md` and `docs/specifications/07_dashboard_ui_ux_spec.md` (§2.4).

## Verification Results

- `npm run fork:verify`: Passed
- `npm run typecheck`: Passed
- `npm run lint`: Passed
- `npx tsx --test src/tests/view-registry.test.ts src/tests/ui/overview-widgets.test.tsx src/tests/ui/app-behavior.test.tsx src/tests/yearly-trend.test.tsx`: Passed
- `npm run secret-scan`: Passed
- `npm run build`: Passed
