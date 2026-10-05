# Walkthrough: Billing config port & layer boundaries (#225)

## Summary
`src/application/**` no longer imports `src/adapters/**`, and `src/domain/**` no longer reads `process.env`. The billing configuration reaches the application layer through the `IBillingConfigProvider` port, injected by the Composition Root; the Raw Landing index reaches `RetentionService` through `RetentionLandingIndex`. `layer-boundaries.test.ts` now checks both rules with no exception. Pipeline output is unchanged.

## Changes Made
### Domain
- `src/domain/ports/IBillingConfigProvider.ts` (new): port, `BillingConfigLoadResult` (moved from the adapter), `CATALOG_BILLING_CONFIG_PROVIDER` (catalog defaults, no I/O).
- `src/domain/value-objects/Money.ts`: `getSeatPricing(overrideStr?)` takes the override from the caller instead of `process.env`.

### Application
- `CreditsBillingService`: config fallback via the injected provider (`useBillingConfigProvider`, default catalog provider).
- `PipelineOrchestrator`: required `billingConfig: IBillingConfigProvider` dependency (config diagnostics and the reconciliation unit price).
- `RetentionService`: `RetentionLandingIndex` as the second constructor argument (satisfied by `RawLandingStore`).

### Adapters / processor / CLI / scripts
- `BillingConfigLoader.ts`: `billingConfigProvider` adapter; type re-export keeps existing imports working.
- `composition-root.ts`: injects the adapter into `PipelineOrchestrator` and `CreditsBillingService` (pipeline and reprocess).
- `billing-calculator.ts`: passes the resolved month config to `CreditsBillingService` explicitly and passes `COPILOT_SEAT_PRICING_OVERRIDE` to `getSeatPricing`.
- `src/cli/retention.ts`, `scripts/verify-fork-health.ts`: pass `RawLandingStore` to `RetentionService`.

### Tests
- `layer-boundaries.test.ts`: application → adapters / frameworks is forbidden; domain must not read `process.env`.
- `CreditsBillingService.test.ts`: injected provider is used (and an explicit config wins); reset to catalog defaults.
- `ValueObjects.test.ts`: `getSeatPricing` ignores the environment and applies a caller-supplied override (JSON and key=value).
- Orchestrator / retention tests pass the adapters explicitly.

### Specifications
- SDD-02 §3.1 (EN + JA): "known violation" note replaced by the enforced rules and the port / adapter table; port listed in the diagram.

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ 6 passed, 3 warnings (branch is not `main`, uncommitted files at run time, public repository notice), 0 failures |
| TypeScript Check | `npm run typecheck` | ✅ Pass |
| Unit & Integration Tests | `npm test` | ✅ 1130 / 1130 pass |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 findings |
| Production Build | `npm run build` | ✅ Built; bundle within budget, no fs / zod in the browser bundle |
| Lint | `npm run lint` | ✅ Exit 0 |

`grep -rn "adapters/" src/application` returns nothing.
