[English](05_data_storage_and_fork_isolation_spec.md) | [日本語](05_data_storage_and_fork_isolation_spec.ja.md)

---

# SDD-05: Data Storage & Fork Isolation Specification

- **Document ID**: SPEC-COPILOT-005
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-10

---

## 1. The Fork Conflict Problem & Solution Architecture

### 1.1 The Fork Conflict Problem
In many open-source projects and enterprise template repositories, automated bots (GitHub Actions) commit generated data files directly to the codebase branch, leading to two severe failures:
1. **Inability to Pull Upstream Updates**:
   When downstream forks commit daily analytics data directly to `main`, attempting to merge upstream updates (`git merge upstream/main` or clicking the GitHub UI "Sync Fork" button) triggers extensive merge conflicts, preventing updates.
2. **Data Pollution in Pull Requests**:
   When contributing bug fixes or feature additions back to upstream via Pull Request, years or months of accumulated data file diffs are bundled into the PR, rendering code review and merging impossible.

### 1.2 Three-Tier Isolation Architecture

```
[Repository Branch Architecture]
├── main (Code Only Branch)
│   ├── src/
│   ├── dashboard/
│   └── .github/workflows/
│       (Zero data files committed)
│
├── copilot-data (Dedicated Orphan Data Branch)
│   ├── data/
│   │   ├── raw/YYYY/MM/copilot_metrics_YYYY-MM-DD.json
│   │   ├── raw/YYYY/MM/copilot_seats_YYYY-MM-DD.json
│   │   ├── reports/monthly/YYYY-MM/copilot_monthly_usage_YYYY-MM.csv (Monthly Usage Report CSV)
│   │   ├── processed/daily/YYYY-MM-DD.json
│   │   ├── processed/monthly/YYYY-MM.json
│   │   ├── processed/reports/YYYY-MM.json (Monthly report precomputed aggregates)
│   │   └── index.json (Available dates, months, scopes, and report metadata)
│
└── GitHub Pages (Direct Artifact Deploy)
    └── Direct distribution via actions/deploy-pages (Zero branch conflicts with gh-pages)
```

---

## 2. Storage Directory Structure & Partitioning

All data files are arranged immutably using append-only daily and monthly partitions:

```
data/
├── raw/                              # Unprocessed raw API responses
│   └── 2026/
│       ├── 09/
│       │   ├── 2026-09-01-metrics.json
│       │   ├── 2026-09-01-seats.json
│       │   ├── 2026-09-01-cost-centers.json
│       │   └── ...
├── reports/                          # Exported GitHub Monthly Usage Report CSVs
│   └── monthly/
│       ├── 2026-08/
│       │   └── copilot_monthly_usage_2026-08.csv
│       └── 2026-09/
│           └── copilot_monthly_usage_2026-09.csv
├── processed/                        # Precomputed data for dashboard scopes
│   ├── daily/
│   │   ├── 2026-09-01.json           # Daily 3-axis aggregated & allocated data
│   │   └── ...
│   ├── monthly/
│   │   ├── 2026-08.json              # Monthly aggregated data
│   │   └── 2026-09.json              # Current month-to-date aggregated data
│   ├── custom/
│   │   └── latest-30d.json           # Rolling 30-day trend data
│   └── reports/
│       ├── 2026-08.json              # Monthly report precomputed data
│       └── 2026-09.json              # Monthly report precomputed data
└── index.json                        # Metadata index of available periods and summaries
```

---

## 3. Metadata Index (`index.json`) Specification

The entry metadata file loaded first by the dashboard SPA to provide available dates, months, and default scope parameters:

```json
{
  "repository": {
    "owner": "proud-corp",
    "name": "github-copilot-dashboard",
    "is_fork": false
  },
  "last_updated_at": "2026-09-10T00:30:00Z",
  "data_retention_days": 365,
  "available_months": ["2026-09", "2026-08", "2026-07"],
  "available_days": [
    "2026-09-09",
    "2026-09-08",
    "2026-09-07"
  ],
  "available_reports": ["2026-09", "2026-08"],
  "default_scopes": {
    "latest_day": "2026-09-09",
    "latest_month": "2026-09",
    "latest_report": "2026-08",
    "latest_range": {
      "start": "2026-08-11",
      "end": "2026-09-09"
    }
  },
  "summary": {
    "total_seats": 160,
    "active_seats_30d": 138,
    "idle_seats_30d": 22,
    "total_monthly_spend_usd": 6240.00,
    "idle_waste_spend_usd": 858.00
  }
}
```

---

## 4. Git Workflow & Synchronization (Zero Fork Conflict Protocol)

1. **Data Restoration Phase (`git archive` Extraction)**:
   - Run `git fetch origin copilot-data` within the Actions workflow.
   - Extract exclusively data files via `git archive origin/copilot-data data | tar -x` without touching the working branch (`main`) index or HEAD.
   - Physically suppresses 0% of data leakage into the `main` branch Git staging area.
2. **Data Persistence Phase (Isolated Temporary Working Directory)**:
   - Never execute branch checkout (`git checkout`) in the primary working tree (`$GITHUB_WORKSPACE`).
   - Clone or initialize `copilot-data` exclusively in a temporary directory (`DATA_WORK_DIR`) created via `mktemp -d`.
   - Complete commits and pushes within the isolated temporary folder, then discard the directory.
   - Eliminates crashes caused by hardcoded branch names (`main` vs `master`) and avoids leaving detached HEAD states upon job cancellation.
3. **Guarantees for Fork Operations**:
   - **Sync Fork**: Because `main` contains zero data files in downstream forks, clicking "Sync Fork" performs a 100% clean fast-forward merge without conflict.
   - **Pull Requests**: PRs from forks back to upstream `main` contain only code changes without a single line of data diff.
   - **GitHub Pages Deployment**: Direct artifact deployment (`actions/deploy-pages`) is used instead of pushing commits to a `gh-pages` branch, eliminating branch collision.
4. **Fork Maintenance & Operations Specification**:
   - For complete downstream fork synchronization runbooks, Zero-Code Customization, the dual-branch model, and health diagnostics (`npm run fork:verify`), refer to [SDD-12 (Fork Synchronization & Operations Specification)](12_fork_sync_and_customization_ops_spec.md) and the dedicated skill (`skills/fork-sync-ops/`).
