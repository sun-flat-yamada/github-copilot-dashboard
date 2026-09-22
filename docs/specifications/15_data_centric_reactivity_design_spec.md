[English](15_data_centric_reactivity_design_spec.md) | [日本語](15_data_centric_reactivity_design_spec.ja.md)

---

# SDD-15: Data-Centric Reactivity Design Specification

- **Document ID**: SPEC-COPILOT-015
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-22
- **Related Requirement**: [SDD-01 FR-9 (Cross-View Data-Centric Reactivity)](01_requirements_specification.md)

---

## 1. Purpose & Background

This dashboard keeps the **Active Data Source selector (`ActiveDataSelector`)**, **Scope selector (`ScopeSelector`)**, and **Tag AND filter bar (`TagFilterBar`)** permanently mounted as a shared, global control bar, beneath which 6 dedicated analysis Views (`ViewNavigation`, SDD-01 FR-8) are switched in and out.

This structure carries a subtle, easy-to-miss structural trap:

> **The global control bar (data source / scope / tags) is rendered as a sibling element OUTSIDE each View component. Changing a filter or scope normally does NOT unmount/remount the currently displayed View.**

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
- **Fix**: Extracted the `model_breakdown` recomputation logic out of the inline hook body into an independent pure function, `buildFilteredModelBreakdown` (`dashboard/src/utils/reportModelBreakdown.ts`), called from `filteredActiveReportData`. Being a pure function, it became directly unit-testable with real input/output assertions.

The structural lessons common to both cases are generalized in Sections 2 and 3 below.

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
- **Design around the fact that Views are not unmounted**: Since `TagFilterBar` / `ScopeSelector` / `ActiveDataSelector` are rendered as siblings outside each View, changes to them do not remount the View. Views must clearly separate "effects that run once on mount" from "effects that must run every time the Active Selected Data changes."

### 3.4 Fallback Path Parity
- When a value can be computed via multiple data-source paths (e.g., Live Metrics preferred, falling back to Monthly Report when empty), **the fallback path must reference derived data filtered under the exact same conditions as the primary path**. A path being a "fallback" is never a valid excuse for skipping filter support.
- When the paths differ in data granularity (e.g., Live Metrics retains a per-user, per-model breakdown, while Monthly Report retains only a single primary model per user), the fallback path must reflect the filter condition using **the best available approximation**, and that approximation must be explicitly documented in the relevant spec or implementation comment (see the `primary_model`-attribution approximation in SDD-10 §2.3).

### 3.5 Testing Convention
- Filtering/aggregation logic must not be written inline inside React hooks or components; extract it into **independent pure functions with explicit inputs/outputs** (e.g., under `dashboard/src/utils/`). This enables real input/output-based regression testing (`node:test`).
- Whenever a "value doesn't update on tag/scope change" bug is fixed, add a regression test that verifies:
  1. The target aggregate value actually changes before vs. after the filter is applied (it is not frozen at a constant value).
  2. No exceptions occur (e.g., division by zero) when the filter narrows the target set to zero records.
  3. When no filter is applied, the original value computed at parse time is preserved unchanged (regression guard).

---

## 4. Review Checklist

When reviewing or implementing code changes touching Tag filters, scope, or data source switching (View / `useDashboardData` / aggregation utilities), confirm:

- [ ] Does the affected View recompute **solely in response to changes in derived data** (`aggregatedData` / `monthlyReportData`, etc.), rather than independently re-reading raw data or `selectedTags`?
- [ ] Is **every field** of the target aggregated data type recomputed inside the filter-applying memo function (no field is passed through unfiltered)?
- [ ] Is any "one-time initialization flag" blocking legitimate future recomputation (i.e., is intent properly separated, e.g. via `isManualSelectionRef`)?
- [ ] If a fallback path exists, does it also honor the same filter conditions?
- [ ] Has a regression test been added verifying the value actually changes before vs. after applying the filter?

---

## 5. Related Specifications

- [SDD-01 §3 FR-9: Cross-View Data-Centric Reactivity](01_requirements_specification.md) — The requirement text this design policy fulfills.
- [SDD-07 §1: Overall UI Layout (Data-Centric & Single-Column Vertical Stack)](07_dashboard_ui_ux_spec.md) — The layout structure of the global control bar and Views.
- [SDD-10 §2.3: Tag/Scope Filter Reactivity](10_ai_model_benchmark_radar_spec.md) — A concrete applied example of this principle (AI Model Characteristics Radar).
