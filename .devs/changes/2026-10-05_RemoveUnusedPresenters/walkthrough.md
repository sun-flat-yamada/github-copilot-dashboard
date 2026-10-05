# Walkthrough: Remove unused presenters (#226)

## Summary
The six presenters that no production path referenced (Trend, Overview, Budget, ModelRadar, Users, DeepAnalysis) were deleted together with their dedicated tests. Every one of them duplicated a view model that the corresponding View Registry view already builds in its component (or, for users, in the shared `UserDetailRows` row model). The remaining presenters (Credits, Agent, Adoption) and `UserDetailRows` are all used by views. Rendered output is unchanged.

## Per-presenter decision
| Presenter | Decision | Rationale |
| :--- | :--- | :--- |
| `TrendPresenter` | Delete | `views/trend` renders `UserTrendViewer`, which derives its series from `UserUsageProfile` itself. |
| `OverviewPresenter` | Delete | `views/overview` uses `KpiSummaryCards` / `IdleSeatAdvisor` and the domain rules (`ScopeCostRule`, `SeatClassificationRule`) directly. |
| `BudgetPresenter` | Delete | `views/budget` uses `CostCenterBudgetCards` / `CostCenterBudgetTimeline`; the dual-currency formatting it exercised is `Money.formatDualAmount`, now asserted directly. |
| `ModelRadarPresenter` | Delete | `views/model_radar` uses `ModelRadarView` with the UI model registry `radar-constants.ts`. |
| `UsersPresenter` | Delete | `views/users` uses `UserDetailTable` with `UserDetailRows`, the single row model of SDD-07; the presenter was a second row model. |
| `DeepAnalysisPresenter` | Delete | `views/deep_analysis` uses `DeepAnalysisView`. |

Wiring was not chosen: it would replace the view model of large live components (thousands of lines) and change rendered output, while deleting reaches the done condition with no behaviour change.

## Changes Made
- Deleted `src/adapters/presenters/{Trend,Overview,Budget,ModelRadar,Users,DeepAnalysis}Presenter.ts` and `src/tests/adapters/presenters/*` for them.
- `src/tests/domain/MoneyDualCurrency.test.ts`: the `BudgetPresenter` case became `Money.formatDualAmount` cases (USD only / with a JPY sub-currency); the `CreditsPresenter` case stays.
- `src/tests/layer-boundaries.test.ts`: the deleted presenters must not come back.
- SDD-02 (EN + JA): §2.7 Presenter row, §3 diagram node, §5 directory tree.

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ 6 passed, 3 warnings (branch is not `main`, uncommitted files at run time, public repository notice), 0 failures |
| TypeScript Check | `npm run typecheck` | ✅ Pass |
| Unit & Integration Tests | `npm test` | ✅ 1117 / 1117 pass |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 findings |
| Production Build | `npm run build` | ✅ Built; bundle within budget |
| Lint | `npm run lint` | ✅ Exit 0 |
