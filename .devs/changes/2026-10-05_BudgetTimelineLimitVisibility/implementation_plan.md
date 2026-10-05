# Implementation Plan: Make the limit line and the limit-reach range visible in the cost center timeline (Issue #282)

## Context
The timeline from 1d14c01 (`CostCenterBudgetTimeline`, `budgetForecast.ts`) is kept as is. A parallel implementation (PR #281 / Issue #280) was closed in favour of it. Review against the requirement found display gaps only.

## Gaps
1. The limit `ReferenceLine` lies above the auto Y domain when spend is far below the limit; Recharts discards out-of-domain reference lines, so the limit is not drawn.
2. Free-tier and limit labels both sit at `insideTopLeft` and overlap.
3. The reach-date range (earliest / expected / latest) is text only, not drawn on the X axis.
4. A reached limit has no chart marker.

## Proposed Changes
- [MODIFY] `dashboard/src/utils/budgetForecast.ts`: add pure `forecastReachSpan(timeline)` returning `{ fromDay, toDay, expectedDay, clamped }` clamped to the month, or null.
- [MODIFY] `dashboard/src/components/CostCenterBudgetTimeline.tsx`: `ifOverflow="extendDomain"` on the limit line, non-overlapping labels, `ReferenceArea` for the reach span plus a marker at the expected day, marker for the reached day, note when the date falls in the next month.
- [MODIFY/NEW] tests in `src/tests/cost-center-budget-timeline.test.ts` for `forecastReachSpan`.

## Out of scope
Showing all cost centers at once, live-metrics scope (no per-cost-center daily data).

## Verification
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`; screenshot of the demo budget view.
