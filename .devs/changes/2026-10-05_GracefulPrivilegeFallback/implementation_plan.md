# Implementation Plan: Graceful privilege fallback & organization auto-discovery (Issue #234)

Without Enterprise Owner permission the `/enterprises/{ent}/...` endpoints return 403. The collector must then keep working with what the token can read.

## Findings (code as of `main`)
| Acceptance criterion | Current state |
| :--- | :--- |
| Enterprise 403 → org-scope metrics / seats still collected | Metrics: continues per scope only when `COPILOT_ORGS` is set; enterprise-only config fails. Seats: `fetchSeats` fails the whole source when any target fails (enterprise 403 discards every org's seats). |
| `/user/orgs` auto-discovery when `COPILOT_ORGS` is unset | Not implemented. |
| One org 403 does not drop the other orgs | Metrics: yes (partial). Seats: no (whole source failed). |
| Cost Centers / AI Credits 403 → `skipped` with a warning | Not implemented: both become `failed` with an `error` issue. |

## User Review Required
> [!IMPORTANT]
> - **Permission denial vs transient failure (seats)**: a target answering 401 / 403 / 404 is a deterministic permission / visibility result, so it is excluded and recorded as a `warning`, and the remaining targets are used (`partial`). A transient failure (5xx, 429, network) still fails the whole seats source so the last-known-good headcount is kept (unchanged rule: no partial headcount posing as current).
> - **Discovery trigger**: `GET /user/orgs` runs only when `COPILOT_ORGS` is unset **and** the enterprise scope is denied (401 / 403, or 404 for every report day / seats), or when `COPILOT_ORGS=auto` is set explicitly. With neither `COPILOT_ENTERPRISE` nor `COPILOT_ORGS` the sources stay `skipped` (no-credentials mode is unchanged).
> - **Cost Centers / AI Credits**: 401 / 403 → `skipped` + one `warning` (`api_auth`, `http_status: 403`) stating that cost allocation continues with the `cost_center` attribute of `COPILOT_USER_MAPPING`. Other errors stay `failed`.

> [!WARNING]
> - GitHub App installation tokens cannot call `/user/orgs`; discovery failure is recorded as a warning and never fails a source by itself.
> - Reprocess: `getCollectionConfig().orgs` records the organizations actually used (configured or discovered) so that a replay requests the same endpoints.

## Proposed Changes
### Adapter
#### [MODIFY] `src/adapters/github-api/GitHubApiCopilotDataSource.ts`
- `COPILOT_ORGS=auto` opt-in; memoized `discoverOrgs()` (`GET /user/orgs`, paginated, one call shared by metrics and seats).
- `fetchMetrics`: enterprise-only config probes the enterprise scope first, falls back to discovered orgs when it is denied; denied scopes become warnings when another scope succeeded.
- `fetchSeats`: per-target outcome; denied targets excluded (warning), transient failures keep the whole-source failure; count check and merge use the successful targets.
- `fetchCostCenters` / `fetchAiCreditUsage`: 401 / 403 → `skipped` with a warning.
- `getCollectionConfig`: effective orgs.
#### [MODIFY] `src/adapters/github-api/MockCopilotDataSource.ts`
- DEMO issues follow the new behaviour: an enterprise-scope 403 fallback warning; the AI-credit failure sample becomes a 502 (a 403 would now be `skipped`).

### Tests
#### [NEW] `src/tests/adapters/PrivilegeFallback.test.ts`
- Enterprise 403 → org metrics + seats (discovered via `/user/orgs`), one org 403 among several, `COPILOT_ORGS=auto`, discovery failure, Cost Centers / AI Credits 403 → skipped, transient seat failure still fails.

### Specifications (ja + en in sync)
- `docs/specifications/03_github_copilot_api_spec_2026{.ja,}.md`: new section "Permission fallback".
- `docs/specifications/13_fork_restricted_environment_setup_guide{.ja,}.md`: Phase 4 notes for tokens without Enterprise Owner.

## Verification Plan
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` (+ `npm run lint`).
- `npm test -- src/tests/adapters/PrivilegeFallback.test.ts`.
