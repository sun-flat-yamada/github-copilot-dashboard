# Fix: Top3 models shown as a single model without share (#274)

## Root cause
`reportTopModels` (src/adapters/presenters/UserDetailRows.ts) falls back to `primary_model` with `share: null`
when `model_requests` and `model_spend_usd` are both empty. `report-parser.ts` leaves both empty for
credits/token-based reports (requests = 0, net spend = 0) and drops fractional request counts via `roundMap(.., 0)`.

## Changes
1. report-parser: add `model_gross_usd` per user; keep 2 decimals for `model_requests`.
2. copilot.ts: add optional `model_gross_usd` to `ReportUserDetail`.
3. UserDetailRows: ratio source order = requests -> net spend -> gross spend -> usage_insight.by_model (gross, tokens) -> primary only.
4. Tests + SDD note.

## Verification
Quality gate: fork:verify, typecheck, test, secret-scan, build.
