[English](15_data_centric_reactivity_design_spec.md) | [日本語](15_data_centric_reactivity_design_spec.ja.md)

---

# SDD-15: Data-Centric Reactivity Design Specification

- **Document ID**: SPEC-COPILOT-015
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-22 (revised 2026-10-03: §7 Dataset Loader / Query layer added; 2026-10-01: Case Studies C / D, §3.6 and §6)
- **Related Requirement**: [SDD-01 FR-9 (Cross-View Data-Centric Reactivity)](01_requirements_specification.md)

---

## 1. Purpose & Background

This dashboard keeps the **Active Data Source selector (`ActiveDataSelector`)** (consolidating scope selection and AND filter criteria) permanently mounted as shared, global controls, beneath which 6 dedicated analysis Views (`ViewNavigation`, SDD-01 FR-8) are switched in and out.

This structure carries a subtle, easy-to-miss structural trap:

> **The global controls (data source / scope / filters) are rendered as elements OUTSIDE each View component. Changing a filter or scope normally does NOT unmount/remount the currently displayed View.**

In other words, if a View's implementation only "computes once on initial mount and never again," then when the user changes only the tag filter or scope — without switching away from and back to the View tab — that View will **keep displaying stale computed results**. This surfaces as an apparent "filter isn't working" bug, but the actual root cause is a missing design principle: the View is not tracking changes to the active selected data.

This specification codifies **Data-Centric Reactivity** as a system-wide design principle and defines the concrete design policy, implementation conventions, and review checklist required to permanently prevent recurrence.

### 1.1 Real Bugs Encountered (Case Studies)

The following representative bugs actually occurred — and were fixed — because this principle had not yet been codified. They are recorded here as concrete cautionary examples for future implementation and review.

#### Case Study A: Default-selected models did not track the active selected data (`model_radar` View)
- **Symptom**: When opening the "Model Characteristics Radar" View, the models that should default-select (the Top-3 usage models of the currently active analysis target data) were instead always a hardcoded model ID (`claude-3-7-sonnet`). The default selection also never recomputed after changing tags/scope.
- **Root Cause 1**: `App.tsx` hardcoded the initial state of `focusedRadarModelId` to a valid model ID, which meant the "Top-3 auto-selection" branch was effectively unreachable — the "explicit single model specified" branch was always taken instead.
- **Root Cause 2**: Inside `ModelRadarView.tsx`, a `hasInitializedRef` ref was unconditionally set to `true` on the very first effect run, permanently disabling the safety-net effect responsible for recomputing the Top-3 selection later. Because the View is never remounted when tags/scope change, this one-time initialization guard also blocked all future *legitimate* recomputation.
- **Fix**: Introduced two separate refs with distinct intent — `isManualSelectionRef` (true only once the user has explicitly interacted) and `appliedInitialModelIdRef` (tracks the last-applied explicit model ID). Only manual interaction sets `isManualSelectionRef.current = true`; otherwise, the Top-3 selection recomputes every time `aggregatedData` / `monthlyReportData` changes (see [SDD-10 §2.3](10_ai_model_benchmark_radar_spec.md) for details).

#### Case Study B: Model usage percentage (%) did not track the Tag filter (`model_radar` View, Monthly Usage Report path)
- **Symptom**: Changing the Tag filter had no effect whatsoever on each AI model's displayed "Usage Share (%)".
- **Root Cause**: In `useDashboardData.ts`, `filteredActiveReportData` (the memoized hook producing tag-filtered monthly report data) correctly recomputed aggregate fields such as `overview`, `user_details`, and `by_department` from the filtered user subset — but **`model_breakdown` (the per-model breakdown) alone was passed through unchanged** from the org-wide value computed at parse time. Since the usage-percentage calculation (`computeModelUsage`) falls back to this `model_breakdown` whenever Live Metrics data is empty, users analyzing Monthly Report / uploaded data saw zero effect from tag selection.
- **Lesson**: **When a single aggregated data type has multiple derived fields, a filter-recomputation memo is prone to a "partial recomputation gap" — updating only some fields while silently passing others through unfiltered.** Whenever a new field is added to such a data type, every memo function that recomputes that type must be cross-checked and updated in lockstep.
- **Fix**: Extracted the `model_breakdown` recomputation logic out of the inline hook body into an independent pure function, `buildFilteredModelBreakdown` (`dashboard/src/query/reportModelBreakdown.ts`), called from `filteredActiveReportData`. Being a pure function, it became directly unit-testable with real input/output assertions.

#### Case Study C: Changing only the Cost Center / Organization / Department / User condition did not change the monthly report KPIs (P0-6)
- **Symptom**: With a Monthly Usage Report (CSV) or an uploaded file active, changing the Cost Center, Organization, Department or User condition left the KPIs unchanged; only changing a tag did anything. Filtering for "Unassigned" matched nothing, and with a filter on a daily or custom-period scope the cost silently turned into the *monthly* amount.
- **Root Cause 1 (dependencies)**: the `useMemo` that produces `filteredActiveReportData` listed `[activeReportData, selectedTags]` as its dependencies, so a change to any other filter criterion did not recompute it. The code path *used* the criteria but the dependency array did not say so.
- **Root Cause 2 (several definitions of one thing)**: the pipeline emits a different "unassigned" label per path (`Default-CostCenter`, `Unassigned-CC`, `未分類 (Unassigned)`, `Default-Org`) while the filter only recognised `''`, `'Unassigned'` and `'未設定'`, so the "Unassigned" filter always matched zero records. Cost was recomputed with the monthly price whatever the scope. Budget utilisation was computed in three places with different rules.
- **Root Cause 3 (partial recomputation gap again — the same type as Case B)**: usage metrics, `daily_trends`, language shares and the SKU breakdown cannot be re-aggregated per user, yet they were shown next to the filtered seat count as if they belonged to the same population.
- **Fix**: the effect of every criterion is covered by the dependency array and enforced by ESLint (§6); one sentinel (`UNASSIGNED_FILTER_SENTINEL`) and one predicate (`isUnassignedValue`) in `src/domain/constants/unassigned.ts`; cost per scope type through `seatCostForScope`; budgets through `BudgetUtilizationRule.evaluateUsd`; sections that cannot be re-aggregated are listed in `src/domain/constants/filter-scope.ts` and labelled "全社値 (フィルター非対応)" via `filter_notice` (§3.6).

#### Case Study D: Hooks after an early `return` (P0-6, found by the new lint)
- **Symptom (latent)**: `CreditsView`, `AgentActivityView`, `AdoptionMaturityView`, `UserTrendViewer` and `CostCenterBudgetCards` called `useState` / `useMemo` *after* an `if (!data) return …` branch. When the data arrived (or went away) between two renders the number of hooks changed, and React aborts the render ("Rendered more hooks than during the previous render" / "Rendered fewer hooks than expected") — the whole screen goes blank.
- **Root Cause**: nothing detected it. Many tests inspect source text rather than behaviour, and no lint rule was installed.
- **Fix**: hooks moved above every early return; `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` are enforced as errors (§6).

The structural lessons common to these cases are generalized in Sections 2, 3 and 6 below.

---

## 2. Terminology

| Term | Definition |
| :--- | :--- |
| **Active Selected Data** | The combination the user currently has selected: **(a) the active data source type** (Live Metrics / Monthly Usage Report / User Upload, SDD-01 FR-3-1), **(b) the time/group scope** (daily/monthly/custom × selected key, SDD-01 FR-3-2), and **(c) the Tag AND filter** (`selectedTags`, SDD-01 FR-6). |
| **Data-Centric Reactivity** | The property that a View's displayed content (KPI figures, default selections, charts, derived aggregates) is always computed as a pure function of "the currently Active Selected Data" — independent of mount timing, and must immediately track every change to the Active Selected Data. |
| **Derived Data** | Filter-applied, second-order data computed by the `useDashboardData` hook from raw data (raw scope data such as `currentData`, raw report data such as `activeReportData`) — e.g. `filteredCurrentData` / `filteredActiveReportData`. View components must only consume this derived data, never the raw data directly. |
| **Fallback Path** | A logic branch that substitutes an alternate data source's value when the primary data path is empty or unavailable (e.g., the Monthly Report branch in `computeModelUsage` when the Live Metrics branch is empty). |

---

## 3. Design Policy

### 3.1 Single Source of Truth via Hooks
- `useDashboardData` must expose **only filter/scope-applied derived data** (`currentData` = `filteredCurrentData`, `currentReportData` = `filteredActiveReportData`, etc.) as its return values.
- View components (rendered under `App.tsx`) must consume this derived data purely via props and must never read pre-filter raw data or `selectedTags` directly to re-implement their own filtering (which would risk logic drift between duplicate implementations).

### 3.2 Completeness of Derived Aggregates
- When an aggregated data type (e.g. `MonthlyReportAggregatedData`) has multiple aggregate fields (`overview`, `user_details`, `by_department`, `model_breakdown`, `sku_breakdown`, etc.), the memo function that produces its filtered version (e.g. `filteredActiveReportData`) **must recompute every aggregate field belonging to that type, without exception**. Recomputing only some fields while passing the rest through via an `...unfiltered` spread is prohibited.
- **Implementation convention**: Whenever a new aggregate field is added to a data type, search across every memo function that produces/recomputes that type (`filteredCurrentData`, `filteredActiveReportData`, etc.) and add the corresponding recomputation logic under the same filter conditions.

### 3.3 React Hook Implementation Conventions
- **Dependency arrays must include the derived data reference**: `useMemo` / `useEffect` dependency arrays must include the filter-applied derived data objects (`aggregatedData`, `monthlyReportData`, etc.) so that recomputation is triggered whenever their reference changes.
- **Do not casually introduce a "one-time initialization flag"**: A flag such as `hasInitializedRef.current = true` that, once set, never reverts to `false`, permanently blocks recomputation for the lifetime of the component instance — and since the View is never remounted on filter/scope change, this permanently blocks legitimate future data-tracking too. When a default auto-selection needs to coexist with manual user selection, split this into **two refs with distinct intent**:
  - `isManualSelectionRef`: `true` only once the user has explicitly interacted. While `true`, suppress system auto-recomputation.
  - (If needed) `appliedXxxRef`: records the last-applied explicit value, used solely to prevent infinite loops from reapplying the same value.
- **Design around the fact that Views are not unmounted**: Since `ActiveDataSelector` / `DataSelectionModal` are rendered outside each View, changes to them do not remount the View. Views must clearly separate "effects that run once on mount" from "effects that must run every time the Active Selected Data changes."

### 3.4 Fallback Path Parity
- When a value can be computed via multiple data-source paths (e.g., Live Metrics preferred, falling back to Monthly Report when empty), **the fallback path must reference derived data filtered under the exact same conditions as the primary path**. A path being a "fallback" is never a valid excuse for skipping filter support.
- When the paths differ in data granularity (e.g., Live Metrics retains a per-user, per-model breakdown, while Monthly Report retains only a single primary model per user), the fallback path must reflect the filter condition using **the best available approximation**, and that approximation must be explicitly documented in the relevant spec or implementation comment (see the `primary_model`-attribution approximation in SDD-10 §2.3).

### 3.5 Testing Convention
- Filtering/aggregation logic must not be written inline inside React hooks or components; extract it into **independent pure functions with explicit inputs/outputs** (e.g., under `dashboard/src/utils/`). This enables real input/output-based regression testing (`node:test`).
- Whenever a "value doesn't update on tag/scope change" bug is fixed, add a regression test that verifies:
  1. The target aggregate value actually changes before vs. after the filter is applied (it is not frozen at a constant value).
  2. No exceptions occur (e.g., division by zero) when the filter narrows the target set to zero records.
  3. When no filter is applied, the original value computed at parse time is preserved unchanged (regression guard).

### 3.6 One Filter Engine, One Definition per Concept (P0-5 / P0-6)
Behaviour that several modules need must be defined once and imported; copies drift (Case Study C).
- **Filter engine**: filtering and the recomputation of every derived field live in `dashboard/src/query/filterEngine.ts` (`applyFilterCriteriaToLiveScope`, the report counterpart, `isFilterCriteriaActive`). Components and hooks never re-implement a filter.
- **Unassigned**: `UNASSIGNED_FILTER_SENTINEL` and `isUnassignedValue` (`src/domain/constants/unassigned.ts`) are the only definition of "no cost center / organization / group".
- **Money**: seat cost for a scope is `seatCostForScope` (daily = pro-rated, monthly = full month, custom = pro-rated × days); budget utilisation is `BudgetUtilizationRule.evaluateUsd`; prices come from `src/domain/pricing/pricing-catalog.ts` (SDD-03 pricing table, SDD-06 §1.1 / §1.4 / §1.5). A filter that changes the population must recompute cost **in the unit of the active scope**.
- **Sections that cannot follow a filter**: a section without per-user measurements is not recomputed and not silently shown as filtered. It is listed in `LIVE_UNFILTERABLE_SECTIONS` / `REPORT_UNFILTERABLE_SECTIONS` (`src/domain/constants/filter-scope.ts`), keeps its organisation-wide value, and the result carries `filter_notice.unfiltered_sections` so the View renders the "全社値 (フィルター非対応)" badge (SDD-07 §2.14). When a new section is added to the aggregated type, it is either recomputed or added to that list — the checklist in §4 covers this.

---

## 4. Review Checklist

When reviewing or implementing code changes touching Tag filters, scope, or data source switching (View / `useDashboardData` / aggregation utilities), confirm:

- [ ] Does the affected View recompute **solely in response to changes in derived data** (`aggregatedData` / `monthlyReportData`, etc.), rather than independently re-reading raw data or `selectedTags`?
- [ ] Is **every field** of the target aggregated data type recomputed inside the filter-applying memo function (no field is passed through unfiltered)?
- [ ] Is any "one-time initialization flag" blocking legitimate future recomputation (i.e., is intent properly separated, e.g. via `isManualSelectionRef`)?
- [ ] If a fallback path exists, does it also honor the same filter conditions?
- [ ] Has a regression test been added verifying the value actually changes before vs. after applying the filter?
- [ ] Is every filter criterion that the memo/effect *reads* also in its dependency array (`npm run lint` is clean — no `eslint-disable` without a written reason)?
- [ ] Are all hooks called before any early `return` / conditional in the component?
- [ ] Does the change reuse the single definitions of §3.6 (sentinel, `seatCostForScope`, `BudgetUtilizationRule`, pricing catalog) instead of adding a copy?
- [ ] A section that cannot be re-aggregated under a filter: is it recomputed, or listed in `filter-scope.ts` and labelled?

---

## 5. Related Specifications

- [SDD-01 §3 FR-9: Cross-View Data-Centric Reactivity](01_requirements_specification.md) — The requirement text this design policy fulfills.
- [SDD-07 §1: Overall UI Layout (Data-Centric & Single-Column Vertical Stack)](07_dashboard_ui_ux_spec.md) — The layout structure of the global control bar and Views.
- [SDD-10 §2.3: Tag/Scope Filter Reactivity](10_ai_model_benchmark_radar_spec.md) — A concrete applied example of this principle (AI Model Characteristics Radar).

---

## 6. Static Enforcement: ESLint (React Hooks)

Review checklists did not catch Case Studies C and D; a machine does.

- **Rules** (`eslint.config.js`, flat config, applied to `dashboard/src/**/*.{ts,tsx}`): `react-hooks/rules-of-hooks: error` and `react-hooks/exhaustive-deps: error`.
- **Where it runs**: `npm run lint` locally, the dedicated step "Run ESLint (React Hooks rules)" in `.github/workflows/test-and-preview.yml`, and `src/tests/lint-react-hooks.test.ts` inside `npm test` (so the documented 5-stage quality gate `fork:verify → typecheck → test → secret-scan → build` already enforces it without a sixth stage).
- **Suppressions**: an intentional omission is written as `// eslint-disable-next-line react-hooks/exhaustive-deps` **with a comment stating why** (for example the report-loading effect in `useDashboardData`, which must run only when the selected report month changes — adding `currentReportData` to its dependencies would loop). A suppression without a reason is a review finding.
- **Parser**: TypeScript is parsed by Babel (`@babel/eslint-parser` + `@babel/preset-typescript`). The repository uses TypeScript 7 (native) whose JavaScript API `typescript-eslint` needs is not provided. Introducing type-aware rules (e.g. `no-floating-promises`) requires choosing a parser first and is deferred to the Phase 2 decision recorded in the improvement plan (`.devs/changes/2026-10-01_DashboardReviewAndImprovementPlan`, P2-6).

---

## 7. Dataset Loader and Query Layer (P2-2 / ADR-0001)

Several views used to fetch, join and filter data on their own, which let the same condition show different numbers on different screens (improvement plan C-02 / C-03). Every view now reads one data contract: **Dataset (Loader) + Query**.

```text
index.json / scope JSON / report JSON
   └─ Dataset Loader  (dashboard/src/dataset/datasetLoader.ts)   fetch + state, no filtering
        └─ Query layer (dashboard/src/query/)                    the only filtering / aggregation
             └─ hooks / views                                    consume results, never re-implement
```

### 7.1 Dataset Loader

- Loads `index.json`, a scope (`daily` / `monthly` / `custom`) or a monthly report. URLs are built with `resolveDataPath` and the multi-tier fallback `getCandidateDataUrls` (direct path, then `processed/`; SDD-05 §2.2). It never switches to demo data on its own.
- Returns `DatasetResult<T>` with a **state**:

| State | Meaning |
|:--|:--|
| `ok` | Loaded; no known gap. |
| `partial` | Loaded, but part of the data is missing: `index.json` has a `failed` / `partial` source, or the scope carries an `error` issue. |
| `failed` | Could not be loaded. `data` is `null` and `error` says why. A failure is never shown as an empty or demo dataset. |
| `demo` | Demo data: served from a `/demo/` path or declared by `is_mock_mode: true`. `demo` takes precedence over `partial` / `ok` so that demo numbers are never read as real. |

- `custom:<start>_<end>` scopes are cut to the period after loading (`sliceScopeDataByDateRange`).
- `useDashboardData` keeps the state per source (`scopeDatasetState`, `reportDatasetState`) and no longer builds URLs or detects demo sources itself.

### 7.2 Query layer

- `filterEngine` (the single filter implementation of §3.6) lives in `dashboard/src/query/` together with `queryEngine`. Views and hooks import from `dashboard/src/query` only.
- API: `queryLiveScope` / `queryReport` (filtered and fully recomputed data), `queryPopulation` (matched / total users), `queryFilterOptions` (selectable values), `queryCapabilities` (sections that do not follow filters, §3.6).
- `queryPopulation` uses the same predicate as the recomputation (`matchUserWithCriteria`), so the count shown by a selector always equals the user count of the recomputed KPIs and tables. **Pass unfiltered data** to it.
- Metrics that cannot follow a filter are declared in `queryCapabilities(source).unfilterableSections` (the lists of §3.6) and labelled in the view; they are never silently treated as filtered.

### 7.3 DuckDB-WASM (lazy)

- DuckDB-WASM is the Query layer's SQL engine (improvement plan decision #4). Only `dashboard/src/query/duckdb/duckdbLoader.ts` imports it, and callers must `import()` it dynamically; nothing imports it statically and the Query index does not re-export it (`src/tests/query-layer.test.ts` enforces this). It therefore never enters the initial bundle: the build emits it as a separate chunk plus the wasm / worker files, fetched only on first use. The bundle budget is P2-7.
- Only the exception-handling (`eh`) build (about 34 MB wasm) is shipped; every current major browser supports it.
- Until the first view needs SQL aggregation (user x day facts, P1-3), no view references the loader, and the build output does not contain it.

### 7.4 Migration status

| Step | Status |
|:--|:--|
| Dataset Loader behind `useDashboardData` (index, scope, report) | Done (P2-2) |
| Hook filtering / filter options through the Query layer | Done (P2-2) |
| Views on Query results: `ActiveDataSelector` (match count), `DataSelectionModal` (preview count) | Done (P2-2). Both used to count users on their own, from different data (the selector from filtered data, the modal's total from the raw data). |
| Remaining views read the hook's recomputed data | Migrated step by step. Metric Registry + quality attributes: overview KPI cards done (P2-3, SDD-07 §2.14a); View Registry is the only rendering entry, `App.tsx` branches removed (P2-4, SDD-07 §2.14b) |
| Dead code and layer violations | Done (P2-5): the DataStore path and the unreferenced Appendix C modules are deleted; `src/tests/layer-boundaries.test.ts` fails if `src/**` imports `dashboard/` (SDD-02 §3.1) |
