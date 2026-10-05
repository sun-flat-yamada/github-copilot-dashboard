# Walkthrough: Verify pricing against GitHub official docs (Issue #212, pricing part)

## Summary
Every value of the pricing catalog and every per-token price in `docs/models_pricing.md` was compared with GitHub's official documentation on 2026-10-05, using the source of docs.github.com (`github/docs`, commit `45a0f053ac67e8d1f56fc8f7ee38f0b2a58925c3`). All catalog values match; the catalog version drops `unverified` and each entry records its sources. The model price table was stale (model list only) and was synchronised. The ECB half of Issue #212 is unchanged (ECB unreachable from this environment); the Issue stays open.

## Results
| Item | Result |
| :--- | :--- |
| Business $19 / Enterprise $39 | Match |
| 1 AI credit = $0.01, usage-based billing from 2026-06-01 | Match |
| Included 1,900 / 3,900 per user per month, pooled per billing entity | Match |
| Promotion 2026-06..08: 3,000 / 7,000 | Match (values and period, from `f169461e985f` before the expired section was removed); officially existing customers only -> Issue #296 |
| `docs/models_pricing.md` prices | All 43 rows equal the official table after the sync (6 models added, 4 retired removed, footnote updated) |
| `benchmark-records.json` (cross-check) | Prices match; GPT-6.1 Sol lacks cache write / long-context prices -> Issue #297 |
| ECB / `catalog:fx` | Not verified (unreachable) -> stays in Issue #212 |

## Changes Made
- [src/domain/pricing/pricing-catalog.ts](../../../src/domain/pricing/pricing-catalog.ts): version `2026-10-05-v2`, `PricingVerification` records, `PRICING_CATALOG_VERIFICATION`, promotion note.
- [src/tests/domain/Phase0Rules.test.ts](../../../src/tests/domain/Phase0Rules.test.ts): every entry carries a verification record pinned to a commit; the version has no `unverified`.
- [docs/models_pricing.md](../../../docs/models_pricing.md): verification header, tables synchronised with `data/tables/copilot/models-and-pricing.yml`.
- [SDD-06 EN](../../../docs/specifications/06_aggregation_and_billing_logic_spec.md) §1.3.4 / [JA](../../../docs/specifications/06_aggregation_and_billing_logic_spec.ja.md) §1.4.4: verification date, sources, results, remaining items.

No UI change: the catalog version appears only in the billing reconciliation report (SDD-17), so no screenshot and no DEMO data change.

## Verification Results
### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | Pass (Exit 0) |
| TypeScript Check | `npm run typecheck` | Pass (Exit 0) |
| Unit & Integration Tests | `npm test` | 1145/1145 Pass |
| Zero Secret / PII Scan | `npm run secret-scan` | 0 findings (634 files) |
| Production Build | `npm run build` | Built in 2.48s |
