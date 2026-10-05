# Implementation Plan: Remove application → adapter dependencies via ports (Issue #225)

C-07 left two layer violations after #185 / PR #224: the application layer imports adapters, and the domain value object `Money` reads `process.env`. This change removes both without changing behaviour.

## Findings (code as of `main`)
| Location | Violation |
| :--- | :--- |
| `src/application/services/CreditsBillingService.ts` | imports `BillingConfigLoader` (adapter, `fs`) for the default config |
| `src/application/pipeline/PipelineOrchestrator.ts` | imports `BillingConfigLoader` (`loadWithDiagnostics`, `loadForMonth`) |
| `src/application/pipeline/retention.ts` | imports `RawLandingStore` (adapter) to list landing manifests |
| `src/domain/value-objects/Money.ts` | `getSeatPricing()` reads `process.env.COPILOT_SEAT_PRICING_OVERRIDE` |

The Issue names only the first one, but its done condition is "zero `src/application/**` → `src/adapters/**` imports" with no exception left in the test, so all three application files are fixed here.

## User Review Required
> [!IMPORTANT]
> - **Port**: `src/domain/ports/IBillingConfigProvider.ts` (`loadForMonth(month?)`, `loadWithDiagnostics()`); `BillingConfigLoadResult` moves there (the adapter re-exports it). `CATALOG_BILLING_CONFIG_PROVIDER` (catalog defaults, no I/O) is the domain fallback.
> - **CreditsBillingService** keeps its static API. When no config is passed it asks the injected provider (`CreditsBillingService.useBillingConfigProvider`), set by the Composition Root to the `BillingConfigLoader` adapter; the default is the catalog provider. `BillingCalculator` (processor) now passes the resolved config explicitly, so the pipeline result does not depend on the injection.
> - **PipelineOrchestrator** gets a required `billingConfig: IBillingConfigProvider` dependency, wired in `createPipelineApp` / `createReprocessApp`.
> - **RetentionService** takes the landing index as a second constructor argument (`RetentionLandingIndex`: `root`, `listRunIds()`), satisfied by `RawLandingStore`; the CLI and `verify-fork-health` pass it.
> - **Money**: `getSeatPricing(overrideSpec?)`; the caller (`getCopilotPricing` in the processor) passes `process.env.COPILOT_SEAT_PRICING_OVERRIDE`.

> [!WARNING]
> - Code that calls `CreditsBillingService.calculateCreditsCost` without a config outside the Composition Root now gets catalog defaults instead of reading `COPILOT_BILLING_CONFIG`. The only production caller (`BillingCalculator`) passes the config explicitly, so output is unchanged.

## Proposed Changes
### Domain
#### [NEW] `src/domain/ports/IBillingConfigProvider.ts`
#### [MODIFY] `src/domain/value-objects/Money.ts` — no `process.env`.
### Application
#### [MODIFY] `src/application/services/CreditsBillingService.ts`
#### [MODIFY] `src/application/pipeline/PipelineOrchestrator.ts`
#### [MODIFY] `src/application/pipeline/retention.ts`
### Adapters / Processor / CLI
#### [MODIFY] `src/adapters/storage/BillingConfigLoader.ts` — `billingConfigProvider` adapter object, type re-export.
#### [MODIFY] `src/adapters/composition-root.ts` — inject the provider.
#### [MODIFY] `src/processor/billing-calculator.ts`, `src/cli/retention.ts`, `scripts/verify-fork-health.ts`
### Tests
#### [MODIFY] `src/tests/layer-boundaries.test.ts` — `src/application/**` never imports `src/adapters/**`; `src/domain/**` never reads `process.env`.
#### [MODIFY] tests constructing `PipelineOrchestrator` / `RetentionService`; new cases for the injected provider and `getSeatPricing(override)`.
### Specifications (EN + JA)
#### [MODIFY] `docs/specifications/02_system_architecture{,.ja}.md` §3.1 — replace the "known violation" note with the enforced rules and the port.

## Verification Plan
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build && npm run lint`
- `grep -rn "adapters/" src/application` returns nothing.
