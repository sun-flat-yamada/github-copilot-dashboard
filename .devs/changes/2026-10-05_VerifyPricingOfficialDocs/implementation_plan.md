# Implementation Plan: Verify the pricing catalog against GitHub's official documentation (Issue #212, pricing part)

Issue #212 has two halves: the live ECB connection for `npm run catalog:fx` and the verification of the pricing values against GitHub's official documentation. ECB is not reachable from this environment, so **this change covers the pricing verification only**; the ECB items stay open and the PR uses `Refs #212` (not `Closes`).

## Primary source
`docs.github.com` is not reachable from this environment, but the source of that site, the `github/docs` repository, is. The verification uses its content and data files at a pinned commit:

| Item | Value |
| :--- | :--- |
| Repository | `github/docs`, branch `main` |
| Commit checked | `45a0f053ac67e8d1f56fc8f7ee38f0b2a58925c3` (committed 2026-10-05) |
| Verification date | 2026-10-05 |
| Seat prices | `data/variables/copilot.yml` (`cfb_price_per_month`, `ce_price_per_month`), used by `content/copilot/get-started/plans.md` and `content/copilot/concepts/billing-and-usage/organizations-and-enterprises/seats-and-billing-cycles.md` |
| AI credit unit price | `data/variables/product.yml` (`prodname_ai_credits_value`), `content/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing.md` |
| Included credits / pooling | `data/variables/copilot.yml` (`ai_credits_per_user_business`, `ai_credits_per_user_enterprise`), `.../organizations-and-enterprises/billing.md` |
| Usage-based billing start | `content/copilot/reference/copilot-billing/request-based-billing-legacy/what-changed-with-billing.md` |
| Transition promotion | `data/variables/copilot.yml` (`*_promo`); the period text was removed as expired by `github/docs` commit `19a110200a3b64a718bd1008e1f3d87830acc012` (2026-09-11), so it is read from its parent `f169461e985f3820a38233db99648dc0e75fd4dc`, `.../organizations-and-enterprises/billing.md` ("Promotional amounts for existing customers") |
| Per-token model prices | `data/tables/copilot/models-and-pricing.yml` (rendered by `content/copilot/reference/copilot-billing/models-and-pricing.md`) |

## Findings
| Catalog value | Official | Result |
| :--- | :--- | :--- |
| Business $19 / Enterprise $39 per user per month | `$19 USD` / `$39 USD` | Match |
| 1 AI credit = $0.01, usage-based billing from 2026-06-01 | `$0.01 USD`, "As of June 1, 2026" | Match |
| Included 1,900 / 3,900 credits per user per month, pooled per billing entity | `1,900` / `3,900`, pooled at the billing entity level | Match |
| Promotion 2026-06..2026-08: 3,000 / 7,000 | `3,000` / `7,000`, "June 1 - September 1, 2026" | Values and period match. **Scope difference**: the promotion applies to *existing* customers only; the catalog applies it to every seat (it cannot tell new from existing customers) -> follow-up Issue |
| `docs/models_pricing.md`: per-token prices of every listed model | `models-and-pricing.yml` | All listed prices match. The model list is stale: GPT-6 Luna, GPT-6 Sol, GPT-6.1 Sol, Claude Opus 5.5, Claude Sonnet 5.5, Grok 4.7 are missing; Claude Opus 4.7, Gemini 3.5 Flash, Gemini 3.6 Flash, Kimi K2.7 Code are no longer listed (retired 2026-10-02, already recorded in `supported_models.md`); the Gemini promo footnote now names 3.7 / 3.8 Flash only |
| (cross-check, out of scope) `scripts/benchmark-data/benchmark-records.json` | `models-and-pricing.yml` | GPT-6.1 Sol lacks `cache_write_cost_per_m` ($2.50) and long-context prices ($4.00 / $15.00) -> follow-up Issue |

## User Review Required
> [!IMPORTANT]
> - `PRICING_CATALOG_VERSION` becomes `2026-10-05-v2` (no `unverified`). Every catalog entry gets a `verification` record (`verifiedAt`, `sources` with the `github/docs` commit). The version string is printed in the billing reconciliation report (SDD-17), not in the dashboard UI, so no screenshot is needed.
> - `docs/models_pricing.md` is synchronised to the official table (add 6 models, drop 4 retired ones, update the footnote) and gets a verification header. This is documentation only; the model catalog, the radar registry and `supported_models.md` already contain these models (dual-sync rule satisfied, no model data changes).
> - Out-of-scope differences become new Issues (promotion applicability, GPT-6.1 Sol price fields in the benchmark records).

> [!WARNING]
> - The promotion period text no longer exists in the current official docs (removed as expired); it is verified from the commit before its removal. This is recorded as such.
> - ECB / `catalog:fx` stays unverified (Issue #212 stays open).

## Proposed Changes
#### [MODIFY] [src/domain/pricing/pricing-catalog.ts](../../../src/domain/pricing/pricing-catalog.ts)
- Header comment: verification date, sources, commit; remove "未照合" text.
- `PricingVerification` type and `verification` field per entry; `PRICING_CATALOG_VERIFICATION` (date, source repository, commit).
- `PRICING_CATALOG_VERSION = '2026-10-05-v2'`.
- Promotion note: applies to existing customers only (documented limitation).
#### [MODIFY] [src/tests/domain/Phase0Rules.test.ts](../../../src/tests/domain/Phase0Rules.test.ts) (or a dedicated pricing test)
- Version has no `unverified`; every entry has `verifiedAt` and at least one source.
#### [MODIFY] [docs/models_pricing.md](../../../docs/models_pricing.md)
- Verification header; table synchronised with the official table.
#### [MODIFY] [docs/specifications/06_aggregation_and_billing_logic_spec.md](../../../docs/specifications/06_aggregation_and_billing_logic_spec.md) / [.ja.md](../../../docs/specifications/06_aggregation_and_billing_logic_spec.ja.md)
- New subsection "Pricing catalog verification" next to §1.3.3 (EN) / §1.4.3 (JA): date, sources, commit, results, remaining items.
#### [MODIFY] SDD-17 (EN/JA) if it quotes the old version string.

## Verification Plan
### Automated Tests
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
### Manual Verification
- Re-run the comparison script (scratch, not committed) against `models-and-pricing.yml` after the edit: no differences.
