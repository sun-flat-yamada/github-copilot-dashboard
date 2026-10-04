[English](17_audit_and_report_spec.md) | [日本語](17_audit_and_report_spec.ja.md)

---

# SDD-17: Audit & Report Specification

- **Document ID**: SPEC-COPILOT-017
- **Status**: Approved / Active (grows with Phase 4; sections are added by P4-2 to P4-6)
- **Target Version**: 2026.10
- **Date**: 2026-10-04 (P4-1 / #197: audit and data quality view)
- **Related**: [SDD-05 §2.3 / §2.5](05_data_storage_and_fork_isolation_spec.md), [SDD-07 §2.19](07_dashboard_ui_ux_spec.md), [SDD-16 Data Contract & Metric Catalog](16_data_contract_and_metric_catalog_spec.md)

---

## 1. Purpose and Audit Requirements

The dashboard is used inside the company to explain Copilot cost and usage. An operator must be able to answer "when did the data last update, which source failed, and when did quality get worse". Requirements decided by the owner (2026-10-01):

| Item | Decision | Status |
|:--|:--|:--|
| Monthly close | The 5th business day of the following month | Defined here; implemented by P4-2 |
| Revisions after close | Allowed, with history | P4-2 |
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

## 3. Planned Sections (not yet specified)

Monthly close and revision history (P4-2), sheet audit events and CSV export (P4-3), billing reconciliation (P4-4), definition-driven reports (P4-5), privacy tiers and retention policy (P4-6) are specified here when each task lands.
