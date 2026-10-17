# Task Checklist: Enable Text Selection Inside Widgets & Restrict Drag Reordering to Drag Handle (#350)

- [x] Create GitHub Issue (#350)
- [x] Provision sibling worktree `../proud-noether-worktrees/fix-350-widget-text-selection-and-drag-handle` on branch `fix/350-widget-text-selection-and-drag-handle`
- [x] Commit `implementation_plan.md` and `task.md` on their own before implementation (`npm run change-dev:plan-check`)
- [ ] Update `dashboard/src/components/common/WidgetCardFrame.tsx` so only `widget-drag-handle-<id>` is draggable and widget content is text-selectable
- [ ] Update `dashboard/src/components/common/CollapsibleSection.tsx` so only `widget-drag-handle-<id>` is draggable and header/body text is selectable without accidental accordion toggle
- [ ] Update `dashboard/src/views/dashboard/View.tsx` drag handlers to ignore text-selection drags and only reorder on valid widget handle drags
- [ ] Add unit/integration tests in `src/tests/ui/overview-widgets.test.tsx` for text selection compatibility and drag-handle-only reordering
- [ ] Update `docs/specifications/07_dashboard_ui_ux_spec.ja.md` and `docs/specifications/07_dashboard_ui_ux_spec.md`
- [ ] Run quality gate (`fork:verify`, `typecheck`, `test`, `secret-scan`, `build`)
- [ ] Commit, push, create PR, and run `change-dev:finish`
