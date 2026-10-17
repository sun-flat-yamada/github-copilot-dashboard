# Task Checklist: KPI Summary Widgets 3x2 Grid Layout & Smartphone-Portrait Width Sizing (#364)

- [x] Create GitHub Issue (#364)
- [x] Provision sibling worktree `../proud-noether-worktrees/feat-364-kpi-widget-3x2-grid` on branch `feat/364-kpi-widget-3x2-grid`
- [x] Commit `implementation_plan.md` and `task.md` on their own before implementation (`npm run change-dev:plan-check`)
- [ ] Update `dashboard/src/views/dashboard/View.tsx` to use 3x2 grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5`) for `overview-widget-list` and `widget-catalog-group-kpi`
- [ ] Update `dashboard/src/components/common/WidgetCardFrame.tsx` with smartphone-portrait baseline width (`w-full min-w-[min(100%,21rem)]`)
- [ ] Add unit tests in `src/tests/ui/overview-widgets.test.tsx` verifying the 3x2 grid classes and KPI widget sizing
- [ ] Update `docs/specifications/07_dashboard_ui_ux_spec.ja.md` and `docs/specifications/07_dashboard_ui_ux_spec.md`
- [ ] Run quality gate (`fork:verify`, `typecheck`, `test`, `secret-scan`, `build`)
- [ ] Commit, push, create PR, and run `change-dev:finish`
