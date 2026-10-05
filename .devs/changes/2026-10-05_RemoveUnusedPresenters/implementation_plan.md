# Implementation Plan: Remove presenters that no production path uses (Issue #226)

After #185 / PR #224 removed `src/adapters/views/**`, six presenters are referenced only by tests. This change decides, per presenter, whether to delete it or wire it into a View Registry view.

## Findings (`grep` over `dashboard/`, `src/` and `scripts/`, tests excluded)
| Presenter | Production references | View that renders the same screen | What the view uses instead |
| :--- | :--- | :--- | :--- |
| `TrendPresenter` | 0 | `views/trend` | `UserTrendViewer` computes its series from `UserUsageProfile` |
| `OverviewPresenter` | 0 | `views/overview` | `KpiSummaryCards`, `IdleSeatAdvisor`, domain rules (`ScopeCostRule`, `SeatClassificationRule`) |
| `BudgetPresenter` | 0 | `views/budget` | `CostCenterBudgetCards` / `CostCenterBudgetTimeline` |
| `ModelRadarPresenter` | 0 | `views/model_radar` | `ModelRadarView` with `radar-constants.ts` (the model registry) |
| `UsersPresenter` | 0 | `views/users` | `UserDetailTable` with `UserDetailRows` (the single row model, SDD-07) |
| `DeepAnalysisPresenter` | 0 | `views/deep_analysis` | `DeepAnalysisView` |

`CreditsPresenter`, `AgentPresenter`, `AdoptionPresenter` and `UserDetailRows` are used by views and stay.

## User Review Required
> [!IMPORTANT]
> - **Decision: delete all six** with their dedicated tests. Each view already builds its view model in the component (or in a shared module such as `UserDetailRows`); the presenter is a second, unused implementation of the same view model, which is the duplication the Issue asks to remove. Wiring would mean rewriting the components onto a different view model, which changes rendered output and is not needed to reach "no presenter outside the production path".
> - `MoneyDualCurrency.test.ts`: the `BudgetPresenter` case is replaced by the equivalent `Money.formatDualAmount` assertions (USD only and with a sub-currency); the `CreditsPresenter` case stays (that presenter is live).

> [!WARNING]
> - ADR-0001 §4 says presenters are kept. It records the decision at P2 time and is not rewritten; SDD-02 records the as-built state. Issue #225's PR also edits SDD-02 §3.1; this change touches only §2.7, the §3 diagram node and the §5 directory tree to avoid conflicts.

## Proposed Changes
#### [DELETE] `src/adapters/presenters/{Trend,Overview,Budget,ModelRadar,Users,DeepAnalysis}Presenter.ts`
#### [DELETE] `src/tests/adapters/presenters/{Trend,Overview,Budget,ModelRadar,Users,DeepAnalysis}Presenter.test.ts`
#### [MODIFY] `src/tests/domain/MoneyDualCurrency.test.ts`
#### [MODIFY] `src/tests/layer-boundaries.test.ts` — the deleted presenters stay deleted.
#### [MODIFY] `docs/specifications/02_system_architecture{,.ja}.md` — §2.7 Presenter row, diagram node, directory tree.

## Verification Plan
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build && npm run lint`
- `grep -rn "TrendPresenter\|OverviewPresenter\|BudgetPresenter\|ModelRadarPresenter\|UsersPresenter\|DeepAnalysisPresenter" src dashboard/src scripts docs/specifications` returns nothing.
