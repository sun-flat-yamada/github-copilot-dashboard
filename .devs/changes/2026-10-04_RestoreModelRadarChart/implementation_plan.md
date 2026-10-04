# Implementation Plan: Restore the radar chart in Model Radar (#262)

## Why
The 6-axis comparison in `モデル特性レーダー` was replaced by a dot plot in #195 (P3-7). The owner wants the earlier radar chart back.

## Approach
- Revert the view part of 63e8b73: `ModelRadarView.tsx` renders recharts `RadarChart` again (active model solid/pulsing, others dashed).
- Delete `ModelDotPlot.tsx`, `model-dot-plot-data.ts` and `model-dot-plot.test.ts`.
- Update `radar-table-sort.test.ts` to assert the radar chart.
- Sync SDD-07 / SDD-10 (EN/JA) section 2.6.

## Verification
Quality gate: fork:verify, typecheck, test, secret-scan, build.
