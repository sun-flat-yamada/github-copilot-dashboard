# Task Checklist: Distinguish KPI Widgets vs Analysis Sections in Widget Catalog (#344)

- [x] Create GitHub Issue (#344)
- [x] Provision sibling worktree `../proud-noether-worktrees/feat-344-distinguish-kpi-widgets-in-catalog` on branch `feat/344-distinguish-kpi-widgets-in-catalog`
- [x] Commit `implementation_plan.md` and `task.md` on their own before implementation (`npm run change-dev:plan-check`)
- [x] Update `dashboard/src/views/dashboard/View.tsx` to group KPI widgets and analysis section widgets into separate visual sections with category badges, color-coded left borders, active counts, and filter tabs
- [x] Update `src/tests/ui/overview-widgets.test.tsx` to verify catalog grouping, badges, and filter controls
- [x] Update `docs/specifications/07_dashboard_ui_ux_spec.ja.md` and `docs/specifications/07_dashboard_ui_ux_spec.md`
- [x] Run quality gate (`fork:verify`, `typecheck`, `test`, `secret-scan`, `build`)
- [ ] Commit, push, create PR, and run `change-dev:finish`
