# ADR-0001: Single Front-End Architecture (Dataset + Registry)

[English](0001-single-frontend-architecture.md) | [日本語](0001-single-frontend-architecture.ja.md)

- **Status**: Accepted (2026-10-03)
- **Deciders**: Repository owner (improvement plan decision #1, 2026-10-01)
- **Findings**: C-01 (also C-02, C-03, C-08)
- **Tracking**: Issue #181 (P2-1), parent #173 (Phase 2)

## 1. Context

The front end currently has two architectures side by side.

| Path | Entry | State / filtering | Rendering | Status |
|:--|:--|:--|:--|:--|
| **Hook path** | `dashboard/src/App.tsx` (762 lines) | `useDashboardData` (673 lines) + `dashboard/src/utils/filterEngine.ts` | Conditionals in `App.tsx` | **Production.** `main.tsx` always renders `App`. |
| **DataStore path** | `dashboard/src/AppV2.tsx` (145 lines) | `DataStore` + `DerivedDataGraph` (`src/application/store/**`) | `ViewPlugin`s (`src/adapters/views/**`) via `ViewOrchestrator` | **Not mounted.** `VITE_USE_NEW_STORE=true` only wraps `App` in a `DashboardProvider`; it does not change what is rendered. |

Consequences observed in the review (C-01):

- A `ViewPlugin` is a copy of the matching JSX in `App.tsx`, not the thing that renders it. The two drift apart.
- Adding a view touches up to seven places (`AnalysisViewId`, `ANALYSIS_VIEW_REGISTRY`, the ViewPlugin, `adapters/views/index.ts`, the `App.tsx` conditional, `ICON_MAP`, and the navigation metadata).
- The SDD-02 target architecture describes the DataStore path, while the live path is the hook path (SDD-02 §2.7).
- Both paths consume the pre-aggregated `ScopeAggregatedData`, so converging on one of them alone does not fix C-02 / C-03 (see Decision).

## 2. Options

| Option | Summary | Evaluation |
|:--|:--|:--|
| **A. Promote the DataStore path** | Finish `AppV2`, switch production to it, delete the hooks. | The store was written against the old aggregated-JSON shape and is a mirror of the hook logic (`StoreEquivalence.test.ts` exists only to prove that). Promoting it keeps the C-02 / C-03 data-contract problems and adds an event-sourced store the product does not need. Rejected. |
| **B. Keep the hook path as is** | Delete the DataStore path and stop. | Lowest cost, but leaves the 7-place view change, the conditional rendering, and the duplicated per-source components (C-02). Rejected as a final state; it is an acceptable *intermediate* state. |
| **C. Migrate the hook path to Dataset + Registry, remove the DataStore path (chosen)** | Keep what runs in production, move it step by step onto a Dataset Loader / Query layer, a Metric Registry and a View Registry, then delete the DataStore code. | Production never breaks (each step is a normal PR). Resolves C-01–C-03 together. Reuses the parts of the DataStore path that are worth keeping (below). |

## 3. Decision

Adopt **Option C**.

1. **The hook path is the baseline.** It is the only path with real usage and behavioral coverage, and it stays live during the whole migration.
2. **Target shape** (improvement plan A.7.4):
   - **Dataset Loader**: reads `index.json` and lazily loads partitions. Display components do not know the data source.
   - **Query layer**: the only place where filtering, grouping and aggregation happen (DuckDB-WASM, decision #4). It makes `key={datasetVersionKey}` remounting unnecessary.
   - **Metric Registry**: executable metric catalog; values carry a quality attribute (measured / estimated / missing / demo).
   - **View Registry**: the only entry point for rendering; the `App.tsx` conditionals are removed. Adding a view takes a manifest plus a component.
3. **The DataStore path is removed**, not promoted (see §5).
4. **`VITE_USE_NEW_STORE` is removed in P2-5**, not earlier (see §6). It never selected a different UI, so removing it changes no behavior.
5. SDD-02 / SDD-15 are updated when the corresponding step lands (P2-2 to P2-4), so the specification and the production path do not diverge again.

## 4. Reused and Replaced Parts

| Part | Fate |
|:--|:--|
| `src/application/views/ViewPluginRegistry.ts`, `ViewOrchestrator.ts` | Evolve into the View Registry (P2-4). |
| `src/adapters/presenters/*` (pure data → view model) | Kept; moved under the Query layer's outputs. The Credits / Agent / Adoption presenters are already used by `App.tsx`. |
| `src/adapters/views/*ViewPlugin.tsx` | Replaced by View manifests that point at the real components; the JSX copies are deleted (P2-4, P2-5). |
| `dashboard/src/utils/filterEngine.ts`, `useDashboardData` | P2-2: `filterEngine` moved to `dashboard/src/query/` and is now the Query layer's implementation; `useDashboardData` delegates loading to the Dataset Loader and is retired when P2-4 lands. |

## 5. Removal Targets

Deleted in P2-5 (C-08), after the Registry no longer depends on them:

- `dashboard/src/AppV2.tsx`
- `src/application/store/**` (`DataStore`, `DataStoreReducer`, `DataStoreState`, `derived/DerivedDataGraph`, `derived/nodes/*`)
- `src/frameworks/react/**` (`DashboardProvider`, `useStoreSelector`, `useStoreDispatch`, `useViewPlugin`) and `src/frameworks/composition-root.ts` (`createDashboardApp`)
- Tests that only exist for the DataStore path: `src/tests/application/DerivedDataGraph.test.ts`, `src/tests/application/StoreEquivalence.test.ts`

The other unreferenced modules in Appendix C of the improvement plan are handled by P2-5 as well; they are not part of this decision.

## 6. Treatment of `VITE_USE_NEW_STORE`

| When | Action |
|:--|:--|
| Now (P2-1) | No code change. SDD-02 §2.7 already states the flag does not change `App`. |
| P2-2 to P2-4 | The flag stays a no-op. New code must not read it. |
| **P2-5** | Remove the branch in `dashboard/src/main.tsx` (render `App` directly) and the `createDashboardApp` import, together with the targets in §5. |

## 7. Consequences

- **Positive**: one rendering path; new view = manifest + component; the data contract (C-02 / C-03) and the architecture are fixed in the same sequence; production stays shippable at every step.
- **Negative**: the hook path's size (`App.tsx`, `useDashboardData`) remains until P2-4. DataStore-path tests are discarded, so coverage of the migrated behavior must come from P2-6 (behavior tests).
- **Reversibility**: low-risk until P2-5. After P2-5 the DataStore code can only be restored from Git history.

## 8. Migration Steps

| Step | Task | Result |
|:--|:--|:--|
| P2-1 | This ADR | Decision recorded |
| P2-2 | Dataset Loader / Query layer (#182) | All views use one data contract |
| P2-3 | Metric Registry (#183) | Estimated / missing / demo shown in one style |
| P2-4 | View Registry; remove `App.tsx` conditionals (#184) | New view = 2 files |
| P2-5 | Dead code and layer violations (#185) | §5 targets and `VITE_USE_NEW_STORE` removed |
| P2-6 | Test overhaul (#186) | Core flows protected by behavior tests |
| P2-7 | Bundle budget (#187) | Main chunk ≤ 300 kB enforced in CI |

## 9. References

- Improvement plan: `.devs/changes/2026-10-01_DashboardReviewAndImprovementPlan/implementation_plan.md` (decision #1, C-01 to C-03, C-08, A.7.4, Appendix C)
- SDD-02 §2.7 (as-built wiring), SDD-15 (data-centric reactivity)
