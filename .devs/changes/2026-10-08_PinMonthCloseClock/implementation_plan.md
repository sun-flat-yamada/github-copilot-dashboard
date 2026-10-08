# Pin the month-close clock in tests and the DEMO pipeline (Issue #305)

Since the 2026-09 close day (2026-10-07, 5th business day of October) two tests fail only because of the date they run on
([Issue #305](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/305)):

1. `src/tests/adapters/RawLanding.test.ts` (replay): `processed/closes/2026-09.json` is created by both the collect and the replay run with `closed.at` = real time, so the two outputs differ.
2. `src/tests/demo-data.test.ts` (`display pattern coverage (#264)`): the DEMO pipeline evaluates the month close with the real clock, so the DEMO month `2026-09` becomes `closed` and the trend no longer has a `provisional` month.

Root cause: `PipelineOrchestrator.run()` takes its time from `new Date()` and hands it to `MonthCloseService` (`closeDueMonths()` / `createCloseRecord()`).

## User Review Required
> [!IMPORTANT]
> Real-data behavior does not change: without an injected clock the orchestrator uses the real clock, and the live / reprocess paths evaluate the close with it as before.

> [!WARNING]
> DEMO only: the month-close evaluation (and the close / revision timestamps of the DEMO close records) is pinned to the DEMO base date `2026-09-10T00:00:00Z`. Display timestamps such as `generated_at`, source status and the DEMO quality history keep the real run time, so the UI freshness indicators are unchanged.

## Proposed Changes
### Pipeline (application layer)
#### [MODIFY] [src/application/pipeline/PipelineOrchestrator.ts](../../../src/application/pipeline/PipelineOrchestrator.ts)
- New optional dependency `clock?: () => Date` (default: real clock). `nowIso` is taken from it once per run.
- `MonthCloseService` gets `now` = the run time for real data, and the DEMO close clock (`demoMonthCloseAt()`) when `isMock`.
- `DemoHistoryService` gets the DEMO close clock for the seeded revised close (`closeNow`).

#### [MODIFY] [src/application/pipeline/demo-history.ts](../../../src/application/pipeline/demo-history.ts)
- `demoMonthCloseAt()`: the DEMO base date at 00:00 UTC.
- `DemoHistoryDeps.closeNow?` used by `seedRevisedClose()` (falls back to `now`).

#### [MODIFY] [src/collector/mock-generator.ts](../../../src/collector/mock-generator.ts)
- Export `DEMO_BASE_DATE = '2026-09-10'` and use it as the `MockDataGenerator` default.

### Composition root
#### [MODIFY] [src/adapters/composition-root.ts](../../../src/adapters/composition-root.ts)
- `PipelineAppConfig.clock?` / `ReprocessAppConfig.clock?` passed through to the orchestrator (tests only; the CLI passes nothing).

### Tests
#### [MODIFY] [src/tests/adapters/RawLanding.test.ts](../../../src/tests/adapters/RawLanding.test.ts)
- The replay test runs collect and replay with the same fixed clock, for 2026-10-06, 2026-10-07 and the current date; it asserts `closes/2026-09.json` exists exactly when the clock is on or after the close day.

#### [NEW] [src/tests/application/demo-month-close-clock.test.ts](../../../src/tests/application/demo-month-close-clock.test.ts)
- Runs the DEMO pipeline into a temporary directory with fixed clocks before and after the 2026-09 close day (2026-10-06, 2026-10-07, 2027-03-15): `2026-09` is `provisional`, `2026-08` is `closed`, `2026-01` is `missing`, and the close records are identical across the clocks.
- Real-data path: with the same fixed clocks a non-DEMO run closes `2026-09` only on/after 2026-10-07 (real close behavior unchanged).

### Specifications
#### [MODIFY] [docs/specifications/05_data_storage_and_fork_isolation_spec.md](../../../docs/specifications/05_data_storage_and_fork_isolation_spec.md) / [.ja.md](../../../docs/specifications/05_data_storage_and_fork_isolation_spec.ja.md)
- DEMO display-pattern coverage: the month close of the DEMO is evaluated at the DEMO base date, so `2026-09` stays provisional regardless of the run date.

#### [MODIFY] [docs/specifications/17_audit_and_report_spec.md](../../../docs/specifications/17_audit_and_report_spec.md) / [.ja.md](../../../docs/specifications/17_audit_and_report_spec.ja.md)
- Month close job: the evaluation time is the run time (injectable clock for tests); DEMO uses the DEMO base date.

## Verification Plan
### Automated Tests
- Reproduce first: `npx tsx --test src/tests/adapters/RawLanding.test.ts src/tests/demo-data.test.ts` fails with the real clock (2026-10-08) before the change.
- After: the same command passes (with `data/demo` and `dashboard/public/data/demo` removed so the DEMO is regenerated).
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`

### Manual Verification
- `data/demo/processed/trends/rolling-1year.json` after `npm run demo:generate`: `2026-09` is `provisional`.
