# Implementation Plan: User header before 使用量と効率 (#266)

## Why
In the expanded user-detail row, `UsageInsightPanel` (使用量と効率) was rendered above `UserDrilldownPanel`, whose header carries the selected user's name. The user name therefore appeared below 使用量と効率, which reads in a counter-intuitive order.

## Approach
- `UserDrilldownPanel` gets an optional `insightSlot` node rendered between the user header and the tabs.
- `UserDetailTable` passes `<UsageInsightPanel>` through `insightSlot` instead of rendering it above the drilldown.
- `UsageInsightPanel` becomes a bordered card (it now sits inside the drilldown container).
- Update `user-drilldown-analysis.test.ts` and `usage-insight-ui` expectations; sync SDD-07 (EN/JA).

## Verification
Quality gate: fork:verify, typecheck, test, secret-scan, build.
