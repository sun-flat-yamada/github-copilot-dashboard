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
├── copilot-data (Dedicated Orphan Data Branch — REAL data only)
│   ├── data/
│   │   ├── raw/YYYY/MM/copilot_metrics_YYYY-MM-DD.json
│   │   ├── raw/YYYY/MM/copilot_seats_YYYY-MM-DD.json
│   │   ├── reports/monthly/YYYY-MM/copilot_monthly_usage_YYYY-MM.csv (Monthly Usage Report CSV)
│   │   ├── processed/daily/YYYY-MM-DD.json
│   │   ├── processed/monthly/YYYY-MM.json
│   │   ├── processed/reports/YYYY-MM.json (Monthly report precomputed aggregates)
│   │   └── index.json (Available dates, months, scopes, and report metadata)
│
├── copilot-data-mock (Dedicated Orphan Data Branch — MOCK/simulated data only)
│   └── data/                          (Same layout as above, but force-reset on every mock run;
│                                        see Section 1.3. Never merged with or read by real-data runs.)
│
└── GitHub Pages (Direct Artifact Deploy)
    └── Direct distribution via actions/deploy-pages (Zero branch conflicts with gh-pages).
        Only built/deployed for real-data runs — mock runs never publish to Pages (Section 1.3).
```

### 1.3 Mock/Real Data Branch Separation

Simulated ("mock" or "demo") data and real, credential-derived data are stored on **two entirely separate orphan branches** so that dummy data can never contaminate, be confused with, or overwrite real operational history:

| Aspect | `copilot-data` (Real) | `copilot-data-mock` (Simulated) |
|---|---|---|
| Populated by | Live Copilot Metrics/Seats API + Monthly Usage Report CSV imports | `MockDataGenerator` (`MOCK_MODE=true`) |
| Write pattern | Incremental — prior history is restored, then new partitions are appended/committed | **Force-reset** — a fresh orphan branch is created and force-pushed every run |
| History retained? | Yes, indefinitely (valuable operational record) | No — each run fully regenerates a new 30-day simulated bundle, so retaining prior mock commits has no analytical value and would only bloat the branch (this exact bloat was diagnosed and cleaned up in an earlier remediation) |
| Read by GitHub Pages deploy? | Yes — the live, production-facing dashboard is always built from `copilot-data` | **No** — `copilot-analysis-cron.yml` skips the SPA build and GitHub Pages deployment steps entirely when `MOCK_MODE=true`, so simulated data is never published to the production site |
| Selected via | Default (`MOCK_MODE` unset/`false`) | `MOCK_MODE=true` Actions Variable, or the `workflow_dispatch` `mock_mode` input |

This design was chosen over alternatives such as (a) a single shared branch with a mock/real subdirectory split, or (b) tagging commits by mode, because a fully separate orphan branch:
- Requires zero changes to the existing per-partition file layout inside `data/` (both branches use the identical structure).
- Makes it trivially easy to verify isolation (`git log copilot-data -- data/` never shows a mock-mode commit).
- Allows the mock branch to be safely force-pushed/reset without any risk of destructively rewriting real historical data.
- Is fully implemented via a single computed `DATA_BRANCH` environment variable in the workflow (`copilot-data-mock` when `MOCK_MODE=='true'`, else `copilot-data`), requiring no duplicated workflow logic.

`scripts/verify-fork-health.ts` (`npm run fork:verify`) reports the presence/absence of `copilot-data-mock` as an `info`-level check — it never affects pass/warn/fail health status, since the mock branch is optional and only created when mock mode has been explicitly used at least once.

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

### 3.1 Empty-State Representation (No Live Credentials Configured)

When `COPILOT_ENTERPRISE`/`COPILOT_ORGS` are unset, or the configured credential lacks Enterprise Owner/Org Admin permission, the pipeline still generates a valid `index.json` rather than aborting or fabricating placeholder values:

```json
{
  "available_months": [],
  "available_days": [],
  "available_reports": [],
  "default_scopes": {},
  "summary": {
    "total_seats": 0,
    "active_seats_30d": 0,
    "idle_seats_30d": 0,
    "total_monthly_spend_usd": 0,
    "idle_waste_spend_usd": 0
  },
  "issues": [
    {
      "severity": "warning",
      "category": "api_auth",
      "target": "config:copilot-metrics",
      "message": "COPILOT_ENTERPRISE and COPILOT_ORGS are both unset — skipping live Copilot Metrics collection."
    }
  ]
}
```

- `default_scopes.latest_day`/`latest_month`/`latest_range` are simply omitted (not fabricated with a placeholder date) when no live metrics exist.
- `available_reports` reflects any independently-imported Monthly Usage Report CSVs (`npm run import:report`) even when `available_months`/`available_days` are empty — CSV-based reporting has no dependency on Copilot Metrics/Seats credentials.
- The dashboard SPA (`dashboard/src/App.tsx`) detects this state (`noLiveData`) and renders an informational banner explaining that credential-independent features (CSV reports, AI Model Benchmarks) remain available, instead of silently defaulting to a hardcoded fallback month or crashing.

---

## 4. Git Workflow & Synchronization (Zero Fork Conflict Protocol)

> The steps below reference `copilot-data` for brevity. In the actual workflow, the target branch is computed once as `$DATA_BRANCH` (`copilot-data-mock` when `MOCK_MODE=='true'`, otherwise `copilot-data`) — see Section 1.3.

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
