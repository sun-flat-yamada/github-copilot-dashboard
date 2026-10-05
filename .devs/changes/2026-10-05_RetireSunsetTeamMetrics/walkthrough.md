# Walkthrough: Retire the sunset team metrics endpoint & legacy schemas (#241)

## Summary
`fetchTeamMetrics` no longer calls the sunset `GET /orgs/{org}/teams/{team}/copilot/metrics`. Team figures are derived from the `users-1-day` rows (Reports API) joined with the seat `assigning_teams` / `assigning_team`, using only fields recorded in SDD-03 and without any extra API call. `fetchCostCenterBudgets` now has an explicit, documented contract (budgets are not an API source; `COPILOT_COST_CENTER_BUDGETS` remains the only origin). The schemas and normalizers of the retired response format were removed. The DEMO source derives team metrics the same way.

## Changes Made
### Adapter
- `src/adapters/github-api/usage-reports/team-metrics-mapper.ts` (new): `seatTeams`, `resolveTeamMembers`, `buildTeamDailyMetrics` (per-user extraction shared with the org-wide metrics through `userDayStats`; no 0-filled days; no invented agent sessions; credits omitted when absent).
- `src/adapters/github-api/GitHubApiCopilotDataSource.ts`: keeps the last merged seat list; `fetchTeamMetrics` derives from cached rows + seats; teams normalizer registry removed; `fetchCostCenterBudgets` documented contract.
- `src/adapters/github-api/MockCopilotDataSource.ts`: DEMO team metrics derived from seat `assigning_team` x `daily_history`.
- `src/domain/ports/ICopilotDataSource.ts`: doc comments.
- Deleted: `schemas/metrics-schema.ts`, `schemas/teams-metrics-schema.ts`, `normalizers/metrics-2026-03-10.ts`, `normalizers/teams-2026-03-10.ts`.

### Tests
- `src/tests/adapters/TeamMetrics.test.ts` (new): membership resolution, aggregation and surface isolation, credits absent vs 0, unknown team; data source end-to-end with a mocked Reports API + seats server (no call before collection, no extra call, the `/teams/` endpoint is never requested, no issue); `fetchCostCenterBudgets` makes no request.
- `ZodSchemaValidation.test.ts`: retired-schema cases removed. `MockCopilotDataSource.test.ts`: derived DEMO team metrics.

### Specifications
- SDD-03 (EN + JA): §2.3 note on the removed schemas, new §2.4 "Team metrics (derived)" with the unverified items, new §4.3 "Cost Center budgets".

## Verification Results
### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | Pass (exit 0) |
| TypeScript Check | `npm run typecheck` | Pass (exit 0) |
| Unit & Integration Tests | `npm test` | 1129/1129 pass |
| Zero Secret / PII Scan | `npm run secret-scan` | 0 findings (exit 0) |
| Production Build | `npm run build` | Pass; main chunk 161.83 kB / 300 kB |
| Lint | `npm run lint` | Pass (exit 0) |

## Needs a live Enterprise (unverified, recorded in SDD-03)
- Row schema of `user-teams-1-day` and agreement with the derived figures.
- Whether the seat API returns `assigning_teams` for seats granted through several teams.
- Current status code of the retired team endpoint (404 / 410).
- Whether a GitHub billing budgets endpoint can replace `COPILOT_COST_CENTER_BUDGETS` (permissions, Cost Center scoping).
