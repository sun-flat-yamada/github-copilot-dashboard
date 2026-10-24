# Walkthrough: pin the month-close clock (Issue #305)

## Summary
The month close was evaluated with the real clock, so two tests started failing on 2026-10-07 (the close day of 2026-09).
`PipelineOrchestrator` now takes an injectable clock (default: the real clock), the DEMO evaluates its month close at the DEMO base date, and the tests use fixed clocks on both sides of the close day. Real-data behavior is unchanged.

## Changes Made
### Pipeline
- [src/application/pipeline/PipelineOrchestrator.ts](../../../src/application/pipeline/PipelineOrchestrator.ts): `clock?: () => Date`; `MonthCloseService.now` is the run time for real data and `demoMonthCloseAt()` for DEMO.
- [src/application/pipeline/demo-history.ts](../../../src/application/pipeline/demo-history.ts): `demoMonthCloseAt()`; `closeNow` for the seeded revised close.
- [src/collector/mock-generator.ts](../../../src/collector/mock-generator.ts): `DEMO_BASE_DATE`.
- [src/adapters/composition-root.ts](../../../src/adapters/composition-root.ts): `clock` passed through (`createPipelineApp`, `createReprocessApp`).

### Tests
- [src/tests/adapters/RawLanding.test.ts](../../../src/tests/adapters/RawLanding.test.ts): the replay test runs with fixed clocks 2026-10-06 / 2026-10-07 / the current date and checks that 2026-09 is closed only on or after its close day (real-data close rule).
- [src/tests/application/demo-month-close-clock.test.ts](../../../src/tests/application/demo-month-close-clock.test.ts): DEMO pipeline with clocks 2026-10-06 / 2026-10-07 / 2027-03-15: `2026-09` provisional, `2026-08` closed, `2026-01` missing, identical close records. Fails without the fix.

### Specifications
- SDD-05 §2.1 (EN/JA): DEMO month close at the base date.
- SDD-17 §3 (EN/JA): evaluation time and the injectable clock.

## Verification Results
Before the change (real clock 2026-10-08, DEMO regenerated): `RawLanding.test.ts` + `demo-data.test.ts` = 43 pass / 2 fail. After: 47 pass / 0 fail; the DEMO trend ends with `2026-09=provisional`.

| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | Exit 0 (6 passed, 3 warnings: branch, working tree, public exposure) |
| TypeScript Check | `npm run typecheck` | Exit 0 |
| Unit & Integration Tests | `npm test` | 1153/1153 pass |
| Zero Secret / PII Scan | `npm run secret-scan` | Exit 0 |
| Production Build | `npm run build` | Exit 0 |
