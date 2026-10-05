# Walkthrough: Graceful privilege fallback & org auto-discovery (#234)

## Summary
A token without Enterprise Owner permission no longer loses the data it can read. The enterprise scope is tried first; on 401 / 403 (seats: also 404; usage reports: 404 on every day) the collector falls back to the configured organizations or, when `COPILOT_ORGS` is unset, to the organizations discovered with `GET /user/orgs`. A denied scope is excluded with a warning while the other scopes are collected (`partial`). Cost Centers and AI credit usage answering 401 / 403 are `skipped` with one warning.

## Changes Made
### Adapter
- `src/adapters/github-api/GitHubApiCopilotDataSource.ts`: `COPILOT_ORGS=auto`; memoized `discoverOrgs()`; Level 1 → Level 2 fallback in `fetchMetrics`; per-target outcomes in `fetchSeats` (permission denial excluded, transient failure still fails the source); `skipForPermission()` for Cost Centers / AI credits; Run Manifest records the organizations actually collected.
- `src/adapters/github-api/MockCopilotDataSource.ts`: DEMO issues show the enterprise-scope fallback warning; the AI credit failure sample is a 502 (a 403 is now `skipped`).

### Tests
- `src/tests/adapters/PrivilegeFallback.test.ts`: 10 cases (enterprise 403 + discovery, configured orgs, one org 403, transient seat failure, all denied, discovery failure, `COPILOT_ORGS=auto`, Cost Centers 403, AI credits 403, Cost Centers 500).

### Specifications
- SDD-03 §1.2 (new), §2.1, §3.1, §4.2, §4a (ja + en).
- SDD-13 §3.4.1 (new), §5 (ja + en).
- SDD-08 §2 note (ja + en).

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Exit 0 |
| TypeScript Check | `npm run typecheck` | ✅ Exit 0 |
| Unit & Integration Tests | `npm test` | ✅ 1125/1125 Pass |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 Leaks |
| Production Build | `npm run build` | ✅ Built |
| Lint | `npm run lint` | ✅ Exit 0 |
