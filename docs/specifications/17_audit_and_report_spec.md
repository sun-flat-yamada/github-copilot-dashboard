[English](17_audit_and_report_spec.md) | [日本語](17_audit_and_report_spec.ja.md)

---

# SDD-17: Audit & Report Specification

- **Document ID**: SPEC-COPILOT-017
- **Status**: Approved / Active (completed with Phase 4: P4-2 to P4-6 added §3 to §8; P4-7 added §9)
- **Target Version**: 2026.10
- **Date**: 2026-10-04 (P4-1 / #197: audit and data quality view; P4-2 / #198: monthly close and revisions; P4-3 / #199: seat audit events; P4-4 / #200: billing reconciliation; P4-5 / #201: definition-driven reports; P4-6 / #202: privacy tiers and retention; P4-7 / #203: sync status)
- **Related**: [SDD-05 §2.3 / §2.5 / §2.7](05_data_storage_and_fork_isolation_spec.md), [SDD-07 §2.19](07_dashboard_ui_ux_spec.md), [SDD-08 §1](08_automation_workflow_spec.md), [SDD-16 Data Contract & Metric Catalog](16_data_contract_and_metric_catalog_spec.md)

---

## 1. Purpose and Audit Requirements

The dashboard is used inside the company to explain Copilot cost and usage. An operator must be able to answer "when did the data last update, which source failed, and when did quality get worse". Requirements decided by the owner (2026-10-01):

| Item | Decision | Status |
|:--|:--|:--|
| Monthly close | The 5th business day of the following month | §3 (P4-2) |
| Revisions after close | Allowed, with history | §3 (P4-2) |
| Raw data retention | 5 years (60 months); `data_retention` defaults to 60 months | §8 (P4-6) |
| Personal data | Audit screens and exports carry counts, dates and source names only. User-level outputs (seat events, `identified` reports) follow the privacy tiers and publication profile; raw and user-level audit data expire with the retention policy | §2, §4.3, §7 (P4-1, P4-3, P4-6) |
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
- **Evaluation time**: the close is evaluated at the run time, which is also the confirmed time `closed.at`. `PipelineOrchestrator` takes it from an injectable clock (`clock`, default: the real clock) so tests can reproduce the days before and after a close day; real-data runs (`pipeline:run`, `pipeline:reprocess`) always use the real clock. The DEMO (`MOCK_MODE`) evaluates the close at the DEMO base date `2026-09-10T00:00:00Z` instead, so its result does not depend on the run date (SDD-05 §2.1, #305).

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
- Closing and revising never touch `raw/`; the retention policy (§8) never deletes closed-month snapshots and revisions (`processed/closes/`).

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
- Retention follows the raw-data retention (60 months, §8): `audit/seat-events/{YYYY-MM}.json` of an expired month is deleted by `npm run retention:apply`.

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

## 6. Definition-Driven Reports (P4-5 / E-04)

Reports used to be code: a new aggregation meant a new module. A report is now **declared** in `reports/{id}.yaml`; the Report Engine validates the declaration against the metric catalog and generates the report on a schedule. **Adding one definition file adds a report, with no code change.** The contract is `ReportDefinition` of the parent plan (appendix A.7.3).

### 6.1 Definition file

```yaml
id: monthly-cost-summary          # = file name (reports/monthly-cost-summary.yaml); lowercase, digits, hyphens
title: Monthly cost summary
description: optional text
schedule: monthly-close           # monthly-close | weekly | (omitted = manual only)
dataset: monthly                  # monthly | reports
privacy_tier: aggregate-only      # aggregate-only (default) | identified (§7)
language: ja                      # ja (default) | en
outputs: [markdown, csv]
sections:
  - { type: kpi, id: headline, title: Headline, metrics: [total_spend, idle_waste] }
  - type: breakdown
    id: by-cost-center
    title: By cost center
    group_by: cost_center
    columns: [total_seats, total_cost_usd]
    sort_by: total_cost_usd       # must be one of the columns; default = first column
    order: desc                   # asc | desc (default desc)
    limit: 10                     # 1..200 (default 20)
    filters:                      # all must hold; a missing value never matches
      - { column: total_seats, op: gte, value: 2 }   # op: gt | gte | lt | lte | eq
```

Two shipped samples: `reports/monthly-cost-summary.yaml` (monthly close, dataset `monthly`) and `reports/weekly-usage-report-digest.yaml` (weekly, dataset `reports`).

### 6.2 What a definition may reference

| Dataset | Source | Metrics (ids of the metric catalog, SDD-16 §2, §6) | `group_by` |
|:--|:--|:--|:--|
| `monthly` | `processed/monthly/{month}.json` | `total_spend`, `active_rate`, `idle_waste`, `acceptance_rate`, `agent_sessions`, `agent_messages`, `agent_active_users`, `agent_adoption_rate` | `cost_center`, `organization`, `department`, `team` |
| `reports` | `processed/reports/{month}.json` (imported usage report) | `report_gross_spend`, `report_net_spend`, `report_requests`, `report_active_users`, `report_top_model`, `report_top_sku` | `cost_center`, `organization`, `department`, `model`, `sku` |

- Breakdown columns: for the seat-based groups `total_seats`, `active_seats`, `idle_seats`, `total_cost_usd`, `net_cost_usd`, `potential_savings_usd`, `active_ratio`, `acceptance_rate`, `total_chats`, `total_requests`; for `model` `total_requests`, `total_spend_usd`, `active_users`, `percentage`; for `sku` `total_quantity`, `total_spend_usd`, `percentage`. The tables live in code (`METRIC_BINDINGS`, `GROUP_SOURCES` in `src/processor/report-engine.ts`); a new metric or column is one entry there.
- A definition never names an organization, department, cost center or person (filters are on columns and numbers only). Per-user rows (`users`, `user_profiles`, `user_details`) are never read.

### 6.3 Validation

A strict schema (unknown keys are errors) plus semantic checks. `npm run reports:validate [-- --dir reports]` prints every problem and exits 1.

| Rejected | Message (excerpt) |
|:--|:--|
| A metric not in the metric catalog | `unknown metric "x" (not in the metric catalog)` |
| A catalog metric the dataset cannot provide | `metric "x" is not available from dataset "monthly"` |
| Unknown `group_by`, column, `sort_by` (not among the columns) or filter column | `unknown group` / `unknown column` / `sort_by` |
| An unknown `privacy_tier` | `unknown tier "x" (use "aggregate-only" or "identified")` (`identified` is valid; generating it needs the gate of §7.3) |
| Duplicate section id or metric; `id` differing from the file name; duplicate report id across files | |
| Invalid YAML, a file over 64 KiB | YAML is read with the safe default schema (no type tags) |

An invalid definition never blocks the others: the valid ones are still generated and the command exits 1 at the end.

### 6.4 Generation and schedule

`npm run reports:generate -- --due` (the daily workflow runs it after the pipeline, `continue-on-error`, not in mock mode) or `-- --id <id> [--month YYYY-MM] [--demo]` for one report.

| `schedule` | Target | Due when |
|:--|:--|:--|
| `monthly-close` | every month that has a close snapshot (`processed/closes`, SDD-17 §3) and data in the dataset; period `YYYY-MM` | no output yet |
| `weekly` | the latest month of the dataset; period = ISO week of the run (`YYYY-Www`, UTC) | no output for this week yet |
| (omitted) | manual only (`--id`; latest month or `--month`) | never |

Both are also due again when the **definition changed** (its SHA-256 differs from the recorded one) or an output type was added, so editing a definition refreshes the reports. Generation is idempotent: the same input gives the same body (no generation time in it). When the input month does not exist nothing is written (`no_data`).

### 6.5 Output

- Files: `audit/report-outputs/{report_id}/{period}.md` and `.csv`; the list `audit/report-outputs/index.json` records per output `report_id`, `period`, `data_month`, `generated_at`, `definition_sha256` (the definition version), `outputs`, `demo` and `privacy_tier` (P4-6; an older entry without it is read as `aggregate-only`).
- Quality attributes (metric catalog): every value is shown with its quality, `[estimated]` / `[missing]` / `[demo]` for non-measured values. A missing value is **「—（reason）」**, never 0 or an empty table; demo data carries the demo notice. The Markdown header shows the period, the data month, the dataset, the privacy tier, the definition version and, for a closed month, the current month-close checksum (SDD-17 §3).
- CSV: UTF-8 **with BOM**, **CRLF**, RFC 4180 quoting, columns `section, group, item, value, unit, quality` (long format; `value` is the raw number, a missing value is an empty cell with quality `missing`). The CSV-injection rule of §4.4 applies to every cell.

### 6.6 Publication scope (zero leakage)

| Where | Report outputs | Why |
|:--|:--|:--|
| GitHub Pages / `dist/data/` | **Never** | Outputs live under `audit/`, which is not on the `pages:stage` allow-list; `pages:verify` fails if `audit` appears in `dist/data/` (`FORBIDDEN_DIST_PATHS`). `STAGED_PROCESSED_DIRS` is unchanged |
| `copilot-data` branch | Yes, under `audit/` | Same visibility as the repository, guarded by the existing `fork:verify` exposure check (not weakened) |
| `main` branch | Definitions only (`reports/*.yaml`) | Definitions hold ids, titles and column names, never data. Outputs are never committed to `main` |

- Why not Pages: Pages sites are public by default (`security-zero-leakage.md` §2.3), and a definition can name groups (cost centers, organizations, departments) whose names are internal structure. The same figures stay visible in the dashboard through the datasets it already publishes.
- **Privacy tiers**: a definition declares `aggregate-only` (default) or `identified`; the tiers, the gate that `identified` needs and the checks are specified in §7. The outputs of both tiers stay under `audit/` and are never published on Pages. Retention of the outputs: §8.
- Samples and tests use fictitious values only.

### 6.7 Adding a report

1. Write `reports/<id>.yaml` (§6.1). 2. `npm run reports:validate`. 3. `npm run reports:generate -- --id <id> --demo` to preview against demo data. 4. Merge: the daily workflow generates it from then on. A new *kind* of value (a metric or a column no dataset binding provides yet) is the only case that needs code: add the metric to the catalog (SDD-16 §2, §6) and its binding to `METRIC_BINDINGS`.

## 7. Privacy Tiers and Publication Profile (P4-6 / E-05)

The deployment premise is internal use (SDD-01 §1.1, SDD-04 §5): a private / internal repository, access-controlled Pages, employees only. Under that premise **one build is enough**; a second, anonymized build is not required (decision #2 of the parent plan). What is needed is a **declaration** of how identifying each published artifact is, and a **check** that the declaration and what is really published agree.

### 7.1 Tiers

| Tier | Meaning | Where it is used |
|:--|:--|:--|
| `aggregate-only` | No user-level row: no login, name, department or per-user figure. Counts, amounts, dates, group totals | Default of a report definition; `index.json`, `error-log.json`, `processed/{trends,quality,closes}`, `catalog/`, `audit/billing-reconciliation/`, `audit/retention/` |
| `identified` | May contain user-level rows (a login or a resolved name, department, per-user usage; a pseudonym in `ANONYMIZE_USERS=true` mode) | `processed/{monthly,reports,deep-analysis,custom,daily}`, `raw/`, original CSVs, `audit/seat-events/`, a report definition that declares it |

A definition declares its tier with `privacy_tier` (§6.1). Both tiers are valid in the validator (§6.3); an unknown tier is an error. Today every section type (`kpi`, `breakdown` by group) is aggregate; the tier is the ceiling a definition declares so that a future user-level section cannot be added to an `aggregate-only` report unnoticed.

### 7.2 Publication profile

`src/domain/privacy-profile.ts` (`PUBLICATION_PROFILE`) declares per artifact (path under `data/`): the **tier**, whether it is **published on Pages**, and its **retention class**.

| Artifact | Tier | Pages | Retention (§8) |
|:--|:--|:--|:--|
| `index.json`, `error-log.json`, `catalog/` | aggregate-only | yes | retained |
| `processed/{monthly,reports,deep-analysis,custom,daily}` | identified | yes (premise: restricted to the enterprise) | retained |
| `processed/{trends,quality,closes}` | aggregate-only | yes | retained (**`closes/` is never deleted**) |
| `raw/` (daily partitions, Run Manifests, landing objects), `reports/monthly/` (original CSVs) | identified | **never** | raw: expires |
| `config/` (encrypted mapping) | identified | **never** | retained |
| `audit/seat-events/` | identified | **never** | audit: expires |
| `audit/billing-reconciliation/` | aggregate-only | **never** | audit: expires |
| `audit/report-outputs/` | per report (`index.json` `privacy_tier`) | **never** | audit: expires |
| `audit/retention/` | aggregate-only | **never** | retained |

Rules: an artifact that is not published stays off `pages:stage` and is on the `pages:verify` deny-list (`FORBIDDEN_DIST_PATHS`); the only `identified` artifacts on Pages are the `processed/*` scopes of the premise; everything else that identifies a person stays in `copilot-data` (same visibility as the repository, guarded by the exposure check) or is not stored at all.

### 7.3 Gate for `identified` output

An `identified` report is generated only when **either** holds; otherwise `reports:generate` refuses (`refused`, exit 1, nothing written):

1. **Pseudonymization**: `ANONYMIZE_USERS=true` with `ANONYMIZE_SECRET` of at least 16 characters (SDD-04 §5.2; keyed HMAC-SHA256). The data the report reads is then pseudonyms.
2. **Explicit allowance** by the operator: the Actions variable `COPILOT_ALLOW_IDENTIFIED_REPORTS=true`, a declaration that the repository and Pages are restricted to the enterprise (SDD-04 §5).

`COPILOT_ALLOW_PUBLIC_DATA` does **not** open the gate. The gate is an extra condition; it never replaces or relaxes the exposure check of §7.4.

### 7.4 Checks

| Check | What fails |
|:--|:--|
| `npm run pages:verify` | The profile and the staging configuration disagree (a staged `processed/` directory that is undeclared or declared as not published; a "never published" top-level path missing from the deny-list; an `identified` artifact declared as published outside `processed/`); plus the existing checks (staged files missing from `dist/data/`; `raw`, `config`, `audit`, original CSVs in `dist/data/`) |
| `npm run fork:verify` (offline part, category *Publication Profile*) | The same profile consistency; `dashboard/public/data/` holding `audit/`, `raw/`, `config/` or CSVs; `audit/report-outputs/index.json` recording an unknown tier, or an `identified` output while the gate of §7.3 is closed (demo outputs excluded). Data past the retention period is a **warning** |
| `npm run fork:verify` (exposure check, SDD-04 §5.3) | **Unchanged.** Real user-level data readable by the public still fails. `COPILOT_ALLOW_PUBLIC_DATA` keeps its documented meaning and is not extended |

So a declaration that differs from what is delivered fails the build; nothing in this section weakens the existing checks.

## 8. Retention Policy (P4-6 / E-05)

Raw data is kept for **5 years**. The retention is declared, shown before it is applied, applied only by an explicit operation, and recorded.

### 8.1 Setting and expiry

- `COPILOT_DATA_RETENTION_MONTHS` (Actions variable; integer **12 to 600**, default **60**). An invalid value falls back to 60 with a message. (`index.json` carries the value as `data_retention_months` for the About modal; it does not control deletion. The older fixed field `data_retention_days` is deprecated.)
- The latest N calendar months **including the current month** are kept. Month `M` is expired when it is more than N months before the current month (N = 60 on 2026-10: 2021-11 is kept, 2021-10 and earlier expire). Dates are UTC. The cutoff is reported as `keep_from`.

### 8.2 What expires and what never does

| Expires (by month) | Condition |
|:--|:--|
| `raw/YYYY/MM/` (daily raw partitions) | The month is **closed** (`processed/closes/{month}.json` exists); otherwise it is kept and reported as `not_closed` |
| `reports/monthly/YYYY-MM/` (original CSVs) | The month is closed (same) |
| `raw/landing/manifests/{run_id}.json` | The month of the run id; and the `raw/landing/objects/` files that no remaining manifest references any more. If a manifest cannot be read, no object is deleted |
| `audit/seat-events/{month}.json`, `audit/billing-reconciliation/{month}.json` | The month (no close needed) |
| `audit/report-outputs/{id}/{period}.{md,csv}` and its row in `index.json` | The period: `YYYY-MM`, or for `YYYY-Www` the month of the ISO week's Thursday |

**Never deleted by retention**: `processed/**` (monthly / reports / deep-analysis / custom / daily aggregates, trends, quality history and **`processed/closes/`: the closed-month snapshots, checksums and revision history**), `index.json`, `error-log.json`, `catalog/`, `config/`, `audit/retention/`, and everything outside `data/`. The planner is built so that these are never enumerated.

### 8.3 Operation and safety

| Step | Command | Behaviour |
|:--|:--|:--|
| Plan (dry run, the default) | `npm run retention:plan` (also `retention:apply` without `--execute`) | Lists the expired items per category (count, size, months or ids) and the kept-because-not-closed ones. **Changes nothing, writes nothing.** The daily workflow runs it (`continue-on-error`) and raises a `::warning::` when something is overdue |
| Apply (explicit) | `npm run retention:apply -- --execute --confirm <keep_from> [--actor <alias>]` | `--confirm` must equal the cutoff month of the current plan (a stale plan is refused). Deletes the planned items and records the run |

- **Refusals**: demo data (`data/demo`) is never touched; the run is refused when files under `data/` are tracked by Git outside the `copilot-data` branches (a contaminated `main`, SDD-05); symbolic links are neither listed nor followed; every path is rebuilt from validated names (month, run id, object hash, report id, period) and must stay inside `data/`. It does not run in CI and is never run against `main`.
- **No weakening**: `fork:verify` and `pages:verify` are not touched by a retention run; the retention check of `fork:verify` only warns.
- **Where**: run it on the `copilot-data` checkout, then commit that branch. **Git history keeps the deleted files** until the branch history is rewritten; if the expiry is a privacy or legal requirement, rewrite the history of `copilot-data` separately (outside this tool).

### 8.4 Record

`audit/retention/log.json` (`schema_version`, `runs[]`, at most 1000 runs): `run_id`, `started_at`, `finished_at`, `status` (`started` -> `completed` / `failed`), `retention_months`, `keep_from`, `actor` (an alias or role chosen by the operator; never taken from the CI user or GitHub login), per category `count` / `keys` (months, run ids, `{report_id}/{period}`; no personal data) / `bytes`, `skipped[]` and `errors[]`. The **intent is written first** (`started`), then the deletion runs, then the record is completed, so an interrupted run is visible. A failure on one item does not stop the others; the run is then `failed`. Because the closed-month records stay, the audit trail of figures (§3) outlives the raw data.

## 9. Sync Status and Known Gaps (P4-7 / #203)

P4-7 is the last Phase 4 change. It compared the specifications with the implementation and recorded the result here, so a later reader can see what was checked and what is still open.

### 9.1 Specifications checked against the implementation

| SDD | Checked topic | Result |
|:--|:--|:--|
| SDD-02 | Actual wiring and the single front-end architecture (ADR-0001) | Matches (synced in P2) |
| SDD-03 | Reports API, Cost Centers shape, Billing (AI Credits) API | Matches (synced in P1); live calls are not yet run against a real enterprise (SDD-08 §1) |
| SDD-04 | Publication scope, HMAC pseudonymization, privacy tiers | Matches (P4-6 added §5.4 cross-reference) |
| SDD-05 | Raw landing, Run Manifest, canonical facts, `audit/`, `closes/` layout | **Fixed in P4-7**: the `raw/` layout in §2 listed `*-metrics.json` / `*-seats.json` / `*-cost-centers.json`; the implementation writes one `YYYY-MM-DD-raw.json` per day (`metrics`, `seats`, `cost_centers`) |
| SDD-06 | Pricing catalog, gross / net, seat classification, estimates | Matches; reconciliation in §4.7 (P4-4). Retention does not touch aggregation, so no P4-6 change |
| SDD-07 | Quality attributes, KPI rules, audit view (§2.19) | Matches; the About modal note on the legacy retention field was added in P4-7 |
| SDD-08 | Daily workflow steps, variables, permissions | **Fixed in P4-7**: the exchange-rate, billing-issue, report-generation and retention dry-run steps, the variables `COPILOT_BUSINESS_CALENDAR`, `COPILOT_RECONCILIATION_TOLERANCE`, `COPILOT_ALLOW_IDENTIFIED_REPORTS`, `COPILOT_DATA_RETENTION_MONTHS` and the `issues: write` permission were missing |
| SDD-10 | Normalization, dataset version (content hash), data files | Matches (synced in P3-7) |
| SDD-11 | Diagnosis v2, unclassified users | Matches (synced in P3-5) |
| SDD-15 | Query layer, ESLint rules | Matches |
| SDD-16 | Catalog vs `METRIC_REGISTRY` | **Fixed in P4-7**: `adoption_unclassified_users`, `yoy_spend_change` and `yoy_active_seats_change` were missing from the table; a data-contract index (§7) was added. All 28 ids now match |

### 9.2 Known gaps (not fixed in this change)

| Gap | Where | Handling |
|:--|:--|:--|
| `index.json` `data_retention_days` was a fixed 365 shown by the About modal, which disagreed with the 60-month policy | `PipelineOrchestrator`, `dashboard/src/components/AboutModal.tsx` | Fixed in Issue #257: `data_retention_months` is written and shown; the old field is deprecated (§8.1, SDD-05 §3, SDD-07) |
| The repository rules and `AGENTS.md` named `dashboard/src/data/models.ts`, which does not exist (the UI registry is `dashboard/src/components/radar/radar-constants.ts`) | `.agents/rules/model-benchmark-management.md`, `AGENTS.md` | Corrected in Issue #258 to the same sync targets as SDD-10 §6.1.2 |
| Live verification: the Reports / Billing APIs and the schema-drift workflow have not run against a real enterprise from the development environment | SDD-03, SDD-08 §1, §5.7 | Stated where each feature is specified; needs an enterprise PAT |
