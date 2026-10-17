# Walkthrough: Enable Text Selection Inside Widgets & Restrict Drag Reordering to Drag Handle (#350)

## Summary of Changes

1. **`dashboard/src/components/common/WidgetCardFrame.tsx`**:
   - Removed `draggable` and `onDragStart` from the outer card container (`data-testid="overview-widget-${id}"`) and added `select-text` on the KPI content wrapper (`data-testid="widget-content-${id}"`), enabling native browser text selection for all KPI values, labels, and notes.
   - Attached `draggable={true}`, `onDragStart`, and `onDragEnd` exclusively to the dedicated drag handle (`data-testid="widget-drag-handle-${id}"`) in the compact toolbar, with `e.dataTransfer.setDragImage(cardRef.current, 24, 16)` so the full card is rendered as the drag preview.

2. **`dashboard/src/components/common/CollapsibleSection.tsx`**:
   - Removed `draggable` and `onDragStart` from the outer section container (`data-testid="overview-widget-${id}"`) and added `select-text` on the header and expanded content body (`data-testid="widget-content-${id}"`).
   - Attached `draggable={true}`, `onDragStart`, and `onDragEnd` exclusively to the dedicated drag handle (`data-testid="widget-drag-handle-${id}"`).
   - Added a selection guard in `handleHeaderToggleClick` so selecting text inside an accordion header does not accidentally toggle the accordion on mouse release.

3. **`dashboard/src/views/dashboard/View.tsx`**:
   - Updated `handleDragStart`, `handleDragOver`, and `handleDrop` to use a dedicated widget MIME type (`application/x-copilot-widget-id`) and active drag state so dragging selected text inside widget content never triggers widget reordering.

4. **Tests & Specifications**:
   - Added tests in `src/tests/ui/overview-widgets.test.tsx` verifying that outer widget containers do not set `draggable="true"`, content wrappers have `select-text`, dragging text inside widget content does not reorder widgets, and dragging via `widget-drag-handle-<id>` reorders both KPI and section widgets.
   - Updated `docs/specifications/07_dashboard_ui_ux_spec.ja.md` and `docs/specifications/07_dashboard_ui_ux_spec.md` (§2.4).

## Verification Results

- `npm run fork:verify`: Passed
- `npm run typecheck`: Passed
- `npm run lint`: Passed
- `npx tsx --test src/tests/view-registry.test.ts src/tests/ui/overview-widgets.test.tsx src/tests/ui/app-behavior.test.tsx src/tests/yearly-trend.test.tsx`: Passed
- `npm run secret-scan`: Passed
- `npm run build`: Passed
