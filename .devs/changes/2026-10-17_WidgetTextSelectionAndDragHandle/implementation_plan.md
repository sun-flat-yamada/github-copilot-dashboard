# Implementation Plan: Enable Text Selection Inside Widgets & Restrict Drag Reordering to Drag Handle (#350)

## Goal
Allow users to freely select text (KPI numbers, labels, titles, subtitles, table contents, etc.) inside any widget on the `Dashboard` tab, and ensure that dragging to reorder widgets occurs **only** when dragging the dedicated drag handle (`widget-drag-handle-<id>`).

## Root Cause
Previously, `draggable={true}` and `onDragStart` were attached directly to the root container `<div id="section-${id}" data-testid="overview-widget-${id}">` of both `WidgetCardFrame` and `CollapsibleSection`. In HTML5 browsers, setting `draggable="true"` on a parent container turns any mouse click-and-drag anywhere inside its descendants into an element drag operation (`dragstart`), completely preventing native text selection.

## Proposed Changes

1. **`dashboard/src/components/common/WidgetCardFrame.tsx`**:
   - Remove `draggable` and `onDragStart` from the outer card container (`data-testid="overview-widget-${id}"`) and add `select-text` on the card content wrapper so all KPI text and numbers can be selected normally.
   - Attach `draggable={draggable}`, `onDragStart`, and `onDragEnd` strictly to the dedicated drag handle element (`data-testid="widget-drag-handle-${id}"`) in the compact widget toolbar, using `e.dataTransfer.setDragImage(cardRef.current, 24, 16)` so the full card is used as the drag preview when dragging the handle.

2. **`dashboard/src/components/common/CollapsibleSection.tsx`**:
   - Remove `draggable` and `onDragStart` from the outer section container (`data-testid="overview-widget-${id}"`) and add `select-text` on the header and content body.
   - Attach `draggable={draggable}`, `onDragStart`, and `onDragEnd` strictly to the dedicated drag handle element (`data-testid="widget-drag-handle-${id}"`).
   - In the accordion header `<button>`, ignore `onClick` toggle when the user has just dragged to select text inside the header (`!window.getSelection()?.isCollapsed`).

3. **`dashboard/src/views/dashboard/View.tsx`**:
   - Update `handleDragStart`, `handleDragOver`, and `handleDrop` to use a dedicated widget drag state / MIME type (`application/x-copilot-widget-id`) so dragging selected text or links inside a widget never triggers `dragOver` or `drop` reordering.

4. **Tests & Specifications**:
   - Update `src/tests/ui/overview-widgets.test.tsx` to verify:
     - Outer widget containers (`overview-widget-<id>`) do NOT have `draggable="true"`, enabling text selection across widget contents.
     - Dedicated drag handles (`widget-drag-handle-<id>`) have `draggable="true"` and dragging a widget via its drag handle onto another widget reorders the widgets and persists to `localStorage`, while attempting to drag from inside widget content does not reorder widgets.
   - Update `docs/specifications/07_dashboard_ui_ux_spec.ja.md` and `docs/specifications/07_dashboard_ui_ux_spec.md` (§2.4).
