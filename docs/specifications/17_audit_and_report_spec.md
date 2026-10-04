[English](17_audit_and_report_spec.md) | [日本語](17_audit_and_report_spec.ja.md)

---

# SDD-17: Audit & Report Specification

- **Document ID**: SPEC-COPILOT-017
- **Status**: Approved / Active (grows with Phase 4; sections are added by P4-2 to P4-6)
- **Target Version**: 2026.10
- **Date**: 2026-10-04 (P4-1 / #197: audit and data quality view; P4-2 / #198: monthly close and revisions)
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

## 4. Planned Sections (not yet specified)

Sheet audit events and CSV export (P4-3), billing reconciliation (P4-4), definition-driven reports (P4-5), privacy tiers and retention policy (P4-6) are specified here when each task lands.
