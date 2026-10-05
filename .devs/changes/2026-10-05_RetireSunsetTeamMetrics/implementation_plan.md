# Implementation Plan: Retire the sunset team metrics endpoint & legacy metrics schemas (Issue #241)

The legacy Copilot Metrics API (`/copilot/metrics`) was sunset in April 2026. `fetchMetrics` already uses the Usage Metrics Reports API (`users-1-day`), but `GitHubApiCopilotDataSource.fetchTeamMetrics` still calls `GET /orgs/{org}/teams/{team}/copilot/metrics`, `fetchCostCenterBudgets` is an undocumented stub, and the schemas / normalizers of the retired response format remain.

## Findings (code as of `main`)
| Item | Current state |
| :--- | :--- |
| `fetchTeamMetrics(teamSlug)` | Calls the retired `/orgs/{org}/teams/{team}/copilot/metrics` (404 / 410 since 2026-04). No pipeline or UI caller today (the port method is optional); the mock returns a constant row with an invented `total_agent_sessions`. |
| `fetchCostCenterBudgets()` | Returns `[]` with the comment "fetch from env or Enterprise API". The live pipeline never calls it: budgets are computed from `COPILOT_COST_CENTER_BUDGETS` (SDD-06 §1.2, SDD-08) by `BillingCalculator.computeCostCenterBudgets`. |
| `schemas/metrics-schema.ts`, `normalizers/metrics-2026-03-10.ts` | Only referenced by `ZodSchemaValidation.test.ts`. |
| `schemas/teams-metrics-schema.ts`, `normalizers/teams-2026-03-10.ts` | Only referenced by `fetchTeamMetrics` and the same test. |

## User Review Required
> [!IMPORTANT]
> **Team metrics source: `users-1-day` rows x seat `assigning_team(s)` (chosen) instead of `user-teams-1-day`.**
> - Every input of the join is a field already recorded in SDD-03 and validated by the repository's schemas: the `users-1-day` row (SDD-03 §2.1 field list, `user-report-schema.ts`) and the seat `assigning_team` / `assigning_teams` (SDD-03 §3.2, `seats-schema.ts`).
> - The row schema of `user-teams-1-day` is **not** recorded in SDD-03 or in the repository (only its path is listed), and docs.github.com cannot be reached from this environment; implementing it would require guessing field names, which the Issue and the SDD forbid.
> - No extra API call: the rows (`fetchMetrics`) and the seats (`fetchSeats`) are already collected in the same run and de-duplicated per user; team figures use exactly the same per-user extraction (`userDayStats`) as the organization-wide metrics (surface isolation, SDD-03 §2.2).
> - Known limitation (documented): `assigning_team` is the team through which the seat was assigned, not full team membership; users with a directly assigned seat belong to no team. `user-teams-1-day` remains the candidate source once its row schema is verified against a real Enterprise.
>
> **`fetchCostCenterBudgets`: explicit "not provided by the API" contract.** The repository's specifications (SDD-03, SDD-06 §1.2, SDD-08, SDD-12) record that the public API does not return Cost Center spending limits / free tiers; budgets come only from the administrator declaration `COPILOT_COST_CENTER_BUDGETS`, evaluated by the pipeline against the seat cost. The adapter therefore returns `[]` by contract, makes **no** HTTP call and records no failure; the doc comment and SDD-03 say so. A GitHub billing budgets endpoint, if one exists, is listed as unverified (no fields are invented).

> [!WARNING]
> - `fetchTeamMetrics` now depends on `fetchMetrics` and `fetchSeats` having run earlier in the same run (same pattern as `fetchUserProfiles`). Without them it returns `[]` and calls no endpoint.
> - Fields the reports do not carry stay absent: `total_agent_sessions` is omitted (not 0); `ai_credits_used` is omitted when no member row carries it.

## Proposed Changes
### Adapter
#### [NEW] `src/adapters/github-api/usage-reports/team-metrics-mapper.ts`
- `buildTeamDailyMetrics(teamSlug, rowsByDay, seats)`: resolve team members from `assigning_teams` (fallback `assigning_team`), match rows by login (case-insensitive); per day: active = member rows, engaged / suggestions / acceptances / chat turns via `userDayStats`, credits summed when present.
#### [MODIFY] `src/adapters/github-api/GitHubApiCopilotDataSource.ts`
- `fetchSeats` keeps the last merged seat list; `fetchTeamMetrics` derives from cached rows + seats (no HTTP call); remove the teams normalizer registry; `fetchCostCenterBudgets` documented contract.
#### [MODIFY] `src/adapters/github-api/MockCopilotDataSource.ts`
- DEMO team metrics derived the same way (seat `assigning_team` x profile `daily_history`) instead of a constant row with invented agent sessions.
#### [DELETE] `schemas/metrics-schema.ts`, `schemas/teams-metrics-schema.ts`, `normalizers/metrics-2026-03-10.ts`, `normalizers/teams-2026-03-10.ts`
- Retired response format; no production caller.
#### [MODIFY] `src/domain/ports/ICopilotDataSource.ts`
- Doc comments for `fetchTeamMetrics` / `fetchCostCenterBudgets`.

### Tests
- [NEW] `src/tests/adapters/TeamMetrics.test.ts`: mapper (membership, case-insensitive login, multiple teams, surface isolation, credits absent vs 0); data source end-to-end with a mocked Reports API + seats server (never calls `/teams/{team}/copilot/metrics`, no call before metrics); `fetchCostCenterBudgets` makes no request.
- [MODIFY] `ZodSchemaValidation.test.ts`: drop the retired-schema cases.
- [MODIFY] `MockCopilotDataSource.test.ts`: derived DEMO team metrics.

### Specifications (EN + JA in sync)
- `docs/specifications/03_github_copilot_api_spec_2026{,.ja}.md`: new §2.4 "Team metrics (derived)", §4.3 "Cost Center budgets", legacy schema note, unverified items.

## Verification Plan
### Automated Tests
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` (+ `npm run lint`)
### Manual Verification (needs a live Enterprise; listed as unverified in SDD-03)
- Compare the derived team figures with the `user-teams-1-day` report of a real Enterprise.
- Confirm whether a GitHub billing budgets endpoint can replace `COPILOT_COST_CENTER_BUDGETS`.
