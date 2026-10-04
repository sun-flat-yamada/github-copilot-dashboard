[English](17_audit_and_report_spec.md) | [日本語](17_audit_and_report_spec.ja.md)

---

# SDD-17: Audit & Report Specification

- **Document ID**: SPEC-COPILOT-017
- **Status**: Approved / Active (grows with Phase 4; sections are added by P4-2 to P4-6; P4-4 adds §5)
- **Target Version**: 2026.10
- **Date**: 2026-10-04 (P4-1 / #197: audit and data quality view; P4-2 / #198: monthly close and revisions; P4-3 / #199: seat audit events; P4-4 / #200: billing reconciliation)
- **Related**: [SDD-05 §2.3 / §2.5 / §2.7](05_data_storage_and_fork_isolation_spec.md), [SDD-07 §2.19](07_dashboard_ui_ux_spec.md), [SDD-16 Data Contract & Metric Catalog](16_data_contract_and_metric_catalog_spec.md)

---

## 1. Purpose and Audit Requirements

The dashboard is used inside the company to explain Copilot cost and usage. An operator must be able to answer "when did the data last update, which source failed, and when did quality get worse". Requirements decided by the owner (2026-10-01):

| Item | Decision | Status |
|:--|:--|:--|
| Monthly close | The 5th business day of the following month | §3 (P4-2) |
| Revisions after close | Allowed, with history | §3 (P4-2) |
| Raw data retention | 5 years (60 months); `data_retention` defaults to 60 months | P4-6 |
| Personal data | Audit screens and exports carry counts, dates and source names only | P4-1 (this document §2) |
| Seat history | Grants, revocations, plan changes and last-activity changes are recorded from daily seat snapshots and exported as CSV for authorized internal reviewers; never published | §4 (P4-3) |

## 2. Audit & Data Quality View (P4-1 / E-01)

| Information | Source | Where it is produced |
|:--|:--|:--|
| Per-source status, records, quarantined, last attempt / last success | `index.json` `source_status` | `PipelineOrchestrator` (SDD-05 §2.3 / SDD-02) |
| Latest quality level, trend, time of the last level change | `index.json` `data_quality` | `summarizeQualityHistory` (SDD-05 §2.5) |
| Per-run history: `run_id`, time, per-source status, missing days, duplicates, out-of-range, quarantined, malformed lines | `quality/history.json` (max 90 entries, newest last) | `buildDataQualityReport` / `appendQualityHistory` (SDD-05 §2.5) |

- **Why not the Run Manifest itself**: it lives under `raw/landing/` and contains request keys and content hashes of raw responses; `raw/` is never published (`pages:stage` allow-list, `pages:verify`). The published quality report carries the same `run_id`, so an operator can find the Run Manifest in `copilot-data` from the screen.
- **Display rules**: SDD-07 §2.19. Unavailable data is shown as **「—（reason）」**, never as 0 or an empty table. Demo data has no run history and says so.
- **No personal data**: only counts, dates and source names are stored in these files and shown.
- The view is registered with a manifest and a component (View Registry, SDD-07 §2.14b); it needs no change to `App.tsx` or the navigation.

## 3. Monthly Close, Revisions and Diff (P4-2 / E-01)

A monthly number must not change silently after the fact (late API data, a re-aggregation, a re-import). At the close day the headline figures of a month are **frozen with a checksum**; a later change is allowed only as a **revision with history**.

### 3.1 Close job and business calendar

- **Close day** = the **N-th business day of the following month** (N = `close_business_days`, default **5**). Business days exclude the weekend days (default Sunday and Saturday) and the configured holidays. The day itself is due. Dates are UTC.
- **Calendar setting** `COPILOT_BUSINESS_CALENDAR` (GitHub Actions variable, JSON; optional): `{ "close_business_days": 5, "weekend_days": [0, 6], "holidays": ["2026-11-03"] }`. Holidays are added by configuration (no built-in holiday table). An invalid value falls back to the default and is recorded as an issue (`config:COPILOT_BUSINESS_CALENDAR`).
- **Job**: every pipeline run closes the months whose close day has come and that have no snapshot yet (`MonthCloseService.closeDueMonths`); `npm run month:close` runs the same job on its own. A month is closed only if it has a stored aggregate (`processed/monthly` and/or `processed/reports`).

### 3.2 What is frozen

The **figures** of the month: numeric values of the monthly scope `overview` (seats, active / idle seats, spend, billable amount, acceptance rate, chats, ...), the AI-credit total and agent sessions (`monthly.*`), and the numeric `overview` of the monthly usage report (`report.*`). Unmeasured values stay `null` (never 0). **No per-user row, login, name or department is part of a snapshot** (zero PII); the files are numbers, dates and checksums only.

- **Checksum**: SHA-256 (hex) of the canonical JSON (sorted keys) of `{ month, figures }`.
- **Record** `processed/closes/{YYYY-MM}.json` (`MonthCloseRecord`): `closes_on`, the `calendar` used, `closed` (the original version 1: `at`, `run_id`, `figures`, `checksum`) and `revisions[]`. The original `closed` version is never rewritten.
- **Index** `processed/closes/index.json`: per month `closes_on`, `closed_at`, the **current** checksum, `revision_count`, `last_revised_at` (newest month first). Both files are on the `pages:stage` allow-list (`closes`).

### 3.3 Revisions

- A revision is **explicit**: `npm run pipeline:reprocess -- --revise <YYYY-MM> --reason "<why>" [--actor <alias>]` (`--revise` may repeat; a reason is mandatory). The reprocess recomputes the month from the Raw Landing run and the CSV reports; if the figures differ from the current version, a revision is appended and the stored aggregate is replaced. If they do not differ, nothing is recorded.
- A revision stores: `version` (2, 3, ...), `at`, `run_id` (the Run Manifest id), `reason`, `actor` (optional), `figures`, `checksum`, `previous_checksum` and `diff` (changed items only: `before`, `after`, `delta`). The original confirmed values stay in `closed`.
- `actor` is an alias or role chosen by the operator. It is **never** taken automatically from the CI user or the GitHub login (zero PII); use a team or role name.

### 3.4 Closed months are not overwritten silently

- Before the pipeline writes `processed/monthly/{m}.json` or `processed/reports/{m}.json` for a closed month it compares the new figures with the **current version**. Equal: written as usual. Different and no `--revise` for that month: **not written**; the stored figures are kept and a warning issue `month-close:{m}` (with the first differences) is added to `error-log.json`. This covers `pipeline:run`, a CSV imported late and `pipeline:reprocess` alike.
- **Integrity check** `npm run month:verify` (also run at the start of every pipeline run): fails (exit 1; an error issue in the pipeline) when a closed month's stored aggregate differs from its current version without a recorded revision (`unrecorded_change`), or when a record's checksum or revision chain does not match its content (`checksum_mismatch`). It prints the differing items.
- Closing and revising never touch `raw/`; data retention (60 months) is enforced by P4-6.

### 3.5 Where it appears

- **1-year trend (SDD-06 §4.6)**: a month is `closed` only when a close snapshot exists; the close day alone is not enough. `points[].revision_count` shows revisions after the close.
- **Audit view (SDD-07 §2.19)**: per month the close day, confirmed time, checksum and revision count; each revision with reason, run id, actor, time and the **diff table** (before / after / difference). The JSON is `closes/{month}.json`. Unavailable data is shown as 「—（reason）」.

## 4. Seat Audit Events and CSV Export (P4-3 / E-02)

An audit must be able to answer "when was a seat granted to whom, and when was it revoked or changed". The events are derived from the **daily seat snapshots** (the `seats` of the Raw partitions `raw/YYYY/MM/YYYY-MM-DD-raw.json`) by comparing each snapshot with the previous one.

### 4.1 Events

| `type` | Generated when | `from` → `to` |
|:--|:--|:--|
| `granted` | a login is in the snapshot and not in the previous one | `null` → plan |
| `revoked` | a login was in the previous snapshot and is gone | plan → `null` |
| `plan_changed` | `plan_type` differs (`business` / `enterprise`; an unknown value is `unknown`, never guessed) | old plan → new plan |
| `last_activity_changed` | the **date** (`YYYY-MM-DD`) of `last_activity_at` differs (the time of day is ignored) | old date / `null` → new date / `null` |

- Event fields: `event_id`, `day` (the day of the newer snapshot = detection day), `type`, `user`, `organization`, `previous_snapshot_day`, `from`, `to`. **Nothing else** about a person is stored: no display name, email, department, numeric user ID, avatar or profile URL.
- `event_id` = first 16 hex of SHA-256 over `day`, `type`, `user`, `from`, `to`: the same difference always yields the same id, so regeneration never duplicates an event.
- The **first snapshot is the baseline** (no events). If a day has no readable partition, the next readable one is compared with the last readable one; `previous_snapshot_day` shows the gap. Events show when a change was *detected*, which can be later than when it happened if the pipeline did not run in between.
- A login that is returned twice in one snapshot counts once (the last row wins).

### 4.2 Generation and storage

- `SeatAuditService.update()` runs in every pipeline run right after the Raw partition is saved (not in a reprocess, which never rewrites Raw). It processes only the snapshot pairs after the last processed day (`through`) and merges by `event_id`. A failure becomes a warning issue `audit:seat-events` and never stops the pipeline. `npm run seat-audit:update [-- --rebuild]` runs the same job on its own; `--rebuild` recomputes every pair (idempotent).
- File `audit/seat-events/{YYYY-MM}.json` (month of detection): `schema_version`, `month`, `pseudonymized`, `through`, `events[]` (sorted by `day`, `type`, `user`). It is **outside `processed/`** and is never copied to the public (Pages) directory.
- `pseudonymized` is derived from the data: `true` only if every login of the input snapshots is a pseudonym (`dev_<16 hex>`) with numeric ID 0 and no avatar, i.e. the Raw partitions were stored in `ANONYMIZE_USERS=true` mode (SDD-04 §5.2). One real login makes the month document `false` (safe side).

### 4.3 Publication scope (zero PII)

| Where | Seat audit events | Why |
|:--|:--|:--|
| GitHub Pages / `dist/data/` | **Never** | `audit/` is not on the `pages:stage` allow-list, and `pages:verify` fails if `audit` appears in `dist/data/` (`FORBIDDEN_DIST_PATHS`) |
| `copilot-data` branch | Yes, like `raw/` | Same visibility as the repository. The existing `fork:verify` exposure check guards it through `index.json` `privacy` (`contains_user_level_data` / `anonymized`); it is not weakened or bypassed |
| `main` branch | **Never** | Data isolation (SDD-05) |
| Issues, PRs, chat | **Never** | The CSV is handed to authorized internal reviewers only |

- Real, non-pseudonymized events (real GitHub logins) are valid only where the repository and Pages are private / internal and access-controlled (SDD-04 §5 premise), or the deployment runs with `ANONYMIZE_USERS=true` and a strong `ANONYMIZE_SECRET`. In pseudonymized mode the events carry HMAC pseudonyms only; raw seat data, avatar URLs, numeric IDs and original CSVs are never published. Pseudonyms are still personal data (SDD-04 §5.2 limits).
- Retention follows the raw-data retention (60 months, enforced by P4-6).

### 4.4 CSV export

`npm run seat-audit:export -- --month YYYY-MM` (or `--from YYYY-MM-DD --to YYYY-MM-DD`), optional `--types granted,revoked,plan_changed,last_activity_changed` and `--out <file>` (default `data/audit/exports/seat-events-{from}_{to}.csv`).

| Item | Rule |
|:--|:--|
| Encoding / line ending | UTF-8 **with BOM** (Excel opens it correctly), **CRLF** |
| Columns (fixed order; new columns only at the end) | `event_id`, `day`, `type`, `user`, `organization`, `previous_snapshot_day`, `from`, `to` |
| Quoting | RFC 4180: a cell with a comma, double quote or line break is quoted; `"` is doubled |
| CSV injection | A cell that starts with `=`, `+`, `-`, `@`, tab or CR gets a leading `'` so a spreadsheet never evaluates it as a formula. Applies to every cell |
| Warning | The command states whether the file holds pseudonyms only or real logins and that it must be shared only with authorized reviewers |

## 5. Billing Reconciliation Report (P4-4 / E-03)

The dashboard's amounts come from its own calculation (price catalog + usage). Nothing guaranteed that they equal what GitHub bills. The reconciliation compares them per month and makes a difference visible; a difference beyond the tolerance becomes a GitHub issue.

### 5.1 What is compared

| Item | Rule |
|:--|:--|
| Source of the billed side | `GET /enterprises/{enterprise}/settings/billing/ai_credit/usage` (the P1-5 client; one request per day). Confirmed against the GitHub REST API description (`ghec.2022-11-28.json`) on 2026-10-04 |
| Scope | AI Credits only. Seat licence amounts are out of scope (`billing/usage`, `billing/usage/summary` and `billing/premium_request/usage` exist for later tasks) |
| Computed amount | Billed quantity (`grossQuantity`) x the dashboard's unit price in USD (billing configuration, defaulting to the price catalog) |
| Billed amount | `grossAmount`. `discountAmount` and `netAmount` are kept for reference: the dashboard has no discount / included-credit model, so the verdict uses gross |
| Currency | The API returns none. The amounts are used as GitHub bills them and assumed to be USD (`currency_assumed`) |
| Breakdown | Per SKU x model. No user, organization or cost center identifier is read or stored |

### 5.2 Verdict and tolerance

| Status | Meaning |
|:--|:--|
| `match` | The difference is below 0.005 USD (rounding) |
| `within_tolerance` | There is a difference, but it does not exceed **both** the absolute and the relative tolerance |
| `exceeded` | The difference exceeds both the absolute tolerance (USD) **and** the relative tolerance (%). Subject to issue filing |
| `unavailable` | No billing data for the month (API missing, permission, source failed). Never reconciled as 0 USD, never `exceeded`, never `match` |

- Default tolerance: **1 USD and 1 %**. Configure with the environment variable `COPILOT_RECONCILIATION_TOLERANCE` (JSON `{"absolute_usd":1,"percent":1}`; omitted keys keep the default; the Actions variable of the same name is passed to the pipeline and to `billing:issues`). An invalid value (not JSON, negative, not a number) falls back to the default and is recorded as a warning issue `env:COPILOT_RECONCILIATION_TOLERANCE`.
- The percentage is `|difference| / |billed gross| x 100`. When the billed amount is 0 and the computed amount is not, the percentage is undefined and counts as exceeded.
- `npm run billing:report` re-judges every stored month with the current tolerance, so changing the tolerance applies to past months too.

### 5.3 Versions recorded with every result

`versions.pricing_catalog_version` (`PRICING_CATALOG_VERSION`), `versions.exchange_rate_catalog` (`fetched_at` and number of months of the P1-6 catalog, or `null`), `versions.unit_price_usd` and `tolerance`. The comparison itself is in USD; the exchange-rate catalog is recorded to identify the rate set used for display conversion at that time.

### 5.4 Generation and storage

- `BillingReconciliationService.record()` runs in every pipeline run after the AI Credits are collected, **only when the `ai_credits` source is usable and the run is not a reprocess**. A failed or skipped source writes nothing (the stored values are kept). A failure becomes a warning issue `audit:billing-reconciliation` and never stops the pipeline.
- File `audit/billing-reconciliation/{YYYY-MM}.json`: `schema_version`, `month`, `scope`, `days` (day -> rows of SKU x model: `quantity`, `billed_gross`, `billed_discount`, `billed_net`), `updated_at`, `versions`, `tolerance`. A re-fetched day replaces the stored day (idempotent); the verdict is derived from the stored days each time. `days_covered` shows how many days a month has (the collection window can cover a month only partly).
- A month that exceeds the tolerance also appears in the error log as a warning issue `billing:ai_credits:{month}`.

### 5.5 Issue filing (no duplicates)

`npm run billing:issues [-- --month YYYY-MM] [--dry-run]` (the daily workflow runs it after the pipeline with `issues: write`, `continue-on-error`, not in mock mode).

- One issue per exceeded month, label `billing-reconciliation`, hidden marker `<!-- billing-reconciliation:YYYY-MM -->` in the body.
- **No duplicates**: existing issues with the label (open **and** closed) are listed first and a month whose marker already exists is skipped, so closing an issue does not cause a new one. If the existing issues cannot be listed (HTTP error), nothing is created.
- `--dry-run` creates nothing (it still reads existing issues when `GITHUB_TOKEN` is available).

### 5.6 Publication scope (zero leakage)

| Where | Reconciliation data | Why |
|:--|:--|:--|
| GitHub Pages / `dist/data/` | **Never** | Derived from real billing amounts. `audit/` is not on the `pages:stage` allow-list and `pages:verify` fails if `audit` appears in `dist/data/` |
| `copilot-data` branch | Yes, under `audit/` | Same visibility as the repository (guarded by the existing `fork:verify` exposure check, not weakened) |
| GitHub issue | Month, verdict, tolerance, versions and (private repository only) the difference in USD and the percentage. **Never the billed or computed totals** | The totals stay in `copilot-data`. In a **public** repository the issue carries no amount or percentage at all |
| `main` branch, tests, fixtures | **Never** real data | Tests use fictitious SKUs, models and amounts only |

### 5.7 Verification status

The reconciliation logic is verified with synthetic data (match, within tolerance, exceeded, missing data, negative adjustment rows, idempotent merge, no duplicate issues). **It has not been verified against the real API**: that needs an Enterprise token with billing read permission, which the development environment does not have. The response shape is covered by the P1-5 schema and contract tests. Verify with the first real run: `npm run billing:report` after a pipeline run with `COPILOT_ENTERPRISE` and `COPILOT_READ_TOKEN`.

## 6. Planned Sections (not yet specified)

Definition-driven reports (P4-5), privacy tiers and retention policy (P4-6) are specified here when each task lands.
