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

All data files are arranged immutably using append-only daily and monthly partitions, with **perpetual accumulation without upper limits**:

```
data/
├── raw/                              # Unprocessed raw API responses (Perpetual append-only)
│   └── 2026/
│       ├── 09/
│       │   ├── 2026-09-01-metrics.json
│       │   ├── 2026-09-01-seats.json
│       │   ├── 2026-09-01-cost-centers.json
│       │   └── ...
├── reports/                          # Exported GitHub Monthly Usage Report CSVs (Perpetual append-only)
│   └── monthly/
│       ├── 2026-08/
│       │   └── copilot_monthly_usage_2026-08.csv
│       └── 2026-09/
│           └── copilot_monthly_usage_2026-09.csv
├── processed/                        # Precomputed data for dashboard scopes
│   ├── daily/                        # Daily 3-axis aggregated & allocated data (Rolling 30 days)
│   │   ├── 2026-09-01.json
│   │   └── ...
│   ├── monthly/                      # Perpetual monthly aggregated data
│   │   ├── 2026-08.json
│   │   └── 2026-09.json
│   ├── custom/
│   │   └── latest-30d.json           # Rolling 30-day trend data
│   ├── trends/
│   │   └── rolling-1year.json        # Pre-aggregated 1-year trends for instant SPA loading
│   ├── deep-analysis/
│   │   ├── 2026-08.json              # Monthly deep analytics archives
│   │   └── 2026-09.json
│   └── reports/
│       ├── 2026-08.json              # Monthly report precomputed data
│       └── 2026-09.json              # Monthly report precomputed data
```

### 2.1 Dedicated DEMO Data Partition (`data/demo/`)

To support instant demonstration, offline evaluation, and reliable integration testing without requiring live GitHub API credentials or exposing real operational history, a dedicated DEMO storage partition is established on the `copilot-data` orphan branch under `data/demo/`:

```
copilot-data (Orphan Data Branch)
├── data/
│   ├── raw/                           # Real operational API responses
│   ├── processed/                     # Real operational processed scopes
│   ├── reports/                       # Real operational monthly reports
│   ├── index.json                     # Live metadata index
│   └── demo/                          # 🌟 Dedicated DEMO simulation dataset
│       ├── raw/                       # DEMO raw API response fixtures
│       ├── reports/                   # DEMO monthly usage report CSV fixtures
│       ├── processed/                 # DEMO precomputed scopes (daily, monthly, custom, trends, deep-analysis, reports)
│       ├── index.json                 # DEMO metadata index (is_mock_mode: true)
│       └── error-log.json             # DEMO diagnostic anomaly issues
```

#### DEMO Mode Referencing Behavior
- **Dashboard Dynamic Resolution**: The directory that is read is chosen **explicitly**: (a) URL parameter `?demo=true` / `?mock=true` / `?mode=demo` / `?data=demo`, (b) `VITE_MOCK_MODE=true`, or (c) the header DEMO/LIVE badge, or the "Show demo data" button shown when live data cannot be loaded. When DEMO is selected, the data resolver prefixes all fetch requests with `./data/demo/` instead of `./data/`.
- **No implicit demo fallback (C-06)**: a missing live file (a past month that was not deployed, a failed index request, an empty collection) must **never** be answered with demo data. The SPA shows the error / "no live data" state instead, with an explicit button to look at the demo.
- **What counts as DEMO**: the data is treated as DEMO only when it was loaded from the `data/demo/` path **or** its `index.json` declares `is_mock_mode: true` (data generated with `MOCK_MODE`). Repository owner names, zero seats or zero days of data never imply DEMO; a failed or unconfigured live collection is not demo data. While DEMO data is shown, a banner at the top of the screen says so.
- **Interactive Switching**: The header DEMO/LIVE badge toggles to the other mode explicitly (clicking the DEMO badge returns to live data; clicking LIVE selects the demo data).
- **Pipeline & Tooling**:
  - `npm run demo:generate`: Generates/updates the complete 2026 LTS Live Metrics DEMO bundle under `data/demo/` and `dashboard/public/data/demo/`.
  - `npm run demo:sync [-- --push]`: Safely commits and syncs `data/demo/` to the `copilot-data` branch in an isolated temporary worktree.

### 2.2 Dual Hierarchy Convention: Persistent Storage (`processed/`) vs. SPA Distribution Root

To prevent routing and 404 discrepancies across environments, the following conventions are strictly enforced:

#### 1. Separation of Responsibilities
- **Persistent Storage (`copilot-data`)**: To strictly separate unadulterated raw inputs (`raw/`) from aggregated derivatives, scope data is saved under `data/processed/{monthly,daily,custom,reports,trends,deep-analysis}/` (and similarly `data/demo/processed/`).
- **SPA Public Serving Path (`dashboard/public/data/` and `dist/data/`)**: For performance and clean URL aesthetics, scopes are queried directly under the root of the distribution directory (e.g. `monthly/`, `reports/`).

#### 2. CI/CD Staging Convention (`copilot-analysis-cron.yml`)
When staging `data/demo` prior to SPA build in GitHub Actions, the workflow must copy both root metadata AND unnest `data/demo/processed/*` directly into `dashboard/public/data/demo/`:
```bash
mkdir -p dashboard/public/data/demo
# 1. Copy root metadata (index.json, error-log.json, etc.)
cp -r data/demo/* dashboard/public/data/demo/
# 2. Flatten persistent storage processed/* directly into public root (dual availability)
if [ -d "data/demo/processed" ]; then
  cp -r data/demo/processed/* dashboard/public/data/demo/
fi
```

#### 2a. Real-Data Staging & Artifact Verification (`scripts/pages-staging.ts`)
The workflow stages the **real** `data/` in addition to the DEMO partition. Previously only `data/demo` was staged, so past months (`processed/monthly`, `reports`, `deep-analysis`) never reached Pages and the SPA fell back to demo data (C-06).

- `npm run pages:stage` copies an **allow-list** from `data/` into `dashboard/public/data/` (flattening `processed/*` per the convention above): `index.json`, `error-log.json`, `processed/{monthly,reports,deep-analysis,trends,custom}/*.json`, and `processed/daily/<date>.json` only for the dates listed in `index.json` `available_days` (what the UI can reach).
- **Never published**: `raw/` (unprocessed API responses), `reports/` (original imported CSVs), `config/` (encrypted user mapping), anything else.
- `npm run pages:verify` runs **after** the build and fails the job when (1) a staged file is missing from `dist/data/` (it would 404 on Pages), or (2) `dist/data/` contains `raw/`, `config/`, `reports/monthly/`, or any `.csv` (outside the fictional `demo/`).
- The DEMO staging step is kept as before (`cp -r data/demo/* ...` and the `processed/*` flattening) so the demo stays deployable under `/data/demo/`.

#### 3. Client-Side Candidate Resolution (`pathResolver.ts`)
The client SPA (`useDashboardData.ts`) does not rely on a single URL for the **selected** mode. `getCandidateDataUrls` returns:
1. **Public distribution root path** (e.g. `/github-copilot-dashboard/data/monthly/2026-09.json`, or `.../data/demo/...` in DEMO mode)
2. **Persistent storage processed path** (e.g. `/github-copilot-dashboard/data/processed/monthly/2026-09.json`; backward compatibility with `copilot-data` layouts)

The alternate mode's paths (LIVE <=> DEMO) are **not** candidates by default. They can be added only by explicit opt-in (`includeAlternateMode: true`), which the SPA does not use.

#### 4. Subdirectory & Trailing-Slash Agnostic Resolution
All data fetches resolve through `resolveDataPath`, dynamically extracting the base path from `window.location.pathname` to prevent RFC 3986 relative path drops when accessed without a trailing slash.

---

### 2.3 Raw Landing & Run Manifest (P1-2)

Every live collection run lands the HTTP responses it received **immutably**, so that artifacts can be regenerated from the same input (`npm run pipeline:reprocess`) after a logic change or a bug fix, without calling the API again.

```
data/raw/landing/
├── manifests/<run_id>.json          # one Run Manifest per run (written once, never overwritten)
└── objects/<aa>/<sha256>.json|ndjson  # response bodies, content-addressed (identical content is stored once)
```

- **Run Manifest** (`RunManifest`, `src/domain/entities/run-manifest.ts`): `run_id` (time-ordered, e.g. `20261003T041500Z-ab12`), `api_version`, the collection `config` (enterprise / org slugs and the requested report days — no personal data) and `entries[]`, one per request: canonical `request` key, `kind` (`json` / `paginated` / `download`), `outcome` (`ok` / `empty` / `error`), `status`, `fetched_at`, and for `ok` the `object` path, `sha256` and `bytes`. Errors keep only a summary (name, status, truncated message), never a body.
- **No signatures at rest**: signed report URLs (`download_links`) are stored with the query string removed; the download is keyed by host + path. A signature is a short-lived credential and is never persisted.
- **Dedup**: the 30-day window re-fetches the same finished days every run; content addressing makes an unchanged report cost nothing.
- **Anonymization mode lands nothing.** Raw bodies contain real logins and names and cannot be pseudonymized, so with `ANONYMIZE_USERS=true` (and in mock mode) no landing is written, and `index.json` carries no `run`.
- **`index.json` `run`**: `{ run_id, reprocessed? }` names the run an artifact was built from (`reprocessed: true` for `pipeline:reprocess`). It is omitted when no run was landed (or the manifest could not be written — such a run is not reprocessable).
- **Reprocess** (`npm run pipeline:reprocess [-- --run <run_id>]`, default: the latest run) replays one run through the same fetch → normalize → aggregate code via a replay client (`ReplayFetcher`) and makes **no network access**. A request the run never made fails loudly (`ReplayMissError`); a recorded failure replays as the same failure. The existing `raw/YYYY/MM/*-raw.json` partitions are not rewritten.
- **Not yet covered**: merging several runs into a longer history (backfill beyond one run's window), retention / pruning (SDD target: 60 months, Phase 4), and canonical-fact (`schema_version`) regeneration (P1-3).
- `raw/` is never published: `pages:stage` allow-lists, and `pages:verify` forbids it in `dist/`.

## 3. Metadata Index (`index.json`) Specification

The entry metadata file loaded first by the dashboard SPA to provide available dates, months, archives, and default scope parameters.
`available_months` presents the rolling past 1 year (up to 12 months), while `all_recorded_months` retains all historically recorded months without truncation.

```json
{
  "repository": {
    "owner": "proud-corp",
    "name": "github-copilot-dashboard",
    "is_fork": false
  },
  "generated_at": "2026-09-10T00:30:00Z",
  "data_retention_days": 365,
  "is_mock_mode": false,
  "source_status": [
    { "source": "metrics", "status": "failed", "records": 0,
      "last_attempt_at": "2026-09-10T00:30:00Z", "last_success_at": "2026-09-09T00:30:00Z",
      "error": "HTTP 503 from /enterprises/…/copilot/metrics" },
    { "source": "seats", "status": "ok", "records": 160,
      "last_attempt_at": "2026-09-10T00:30:00Z", "last_success_at": "2026-09-10T00:30:00Z" },
    { "source": "cost_centers", "status": "skipped", "records": 0,
      "last_attempt_at": "2026-09-10T00:30:00Z", "last_success_at": null }
  ],
  "privacy": { "anonymized": false, "contains_user_level_data": true },
  "available_months": ["2026-09", "2026-08", "2026-07"],
  "all_recorded_months": ["2026-09", "2026-08", "2026-07", "2025-12", "2025-11"],
  "available_days": [
    "2026-09-09",
    "2026-09-08",
    "2026-09-07"
  ],
  "available_reports": ["2026-09", "2026-08"],
  "rolling_1year_trend_file": "processed/trends/rolling-1year.json",
  "deep_analysis_months": ["2026-09", "2026-08"],
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

### 3.0 Per-Source Status, Last-Known-Good and the Meaning of `is_mock_mode`

The pipeline collects three independent sources: `metrics` (usage), `seats` (seat assignments) and `cost_centers`. Each run records a status per source in `source_status`:

| `status` | Meaning |
|---|---|
| `ok` | Fetched successfully |
| `partial` | Fetched, but some records were quarantined (failed validation) or counts disagreed |
| `failed` | The fetch failed (API error, missing token, an org of several failed, …) |
| `skipped` | Not configured / not applicable (e.g. no credentials, org-only operation for cost centers). **Not a failure** |

`last_success_at` is the last time the source succeeded; for a `failed` / `skipped` source it is **carried over from the previous `index.json`** (null if it never succeeded). The SPA shows the failure and this timestamp in the status banner.

**Last-known-good rules** — a failure is never turned into "empty":
- `seats` failed → the previous monthly scope and the previous `summary` are kept; nothing is overwritten with an empty seat list.
- `metrics` failed → seat / cost analysis still runs (it does not depend on usage metrics). The current month's scope is written from the fresh seats and the usage sections (acceptance rate, chats, daily trend, languages, agent summary) are **carried over from the previous successful scope** with `usage_metrics: { availability: "carried_over", as_of }`. Without a previous value they are `null` with `usage_metrics.availability: "unavailable"` (the UI shows "—（取得不可）", never 0%). Daily / custom scopes are not regenerated without metrics; previous files are kept.
- All sources failed → every previous artifact is kept and `source_status` records each failure.

**`is_mock_mode`** is `true` **only** when the pipeline itself ran in `MOCK_MODE` (`--mock` / `--demo`). A failed collection, an unconfigured deployment, or zero seats never flips it.

**`privacy`** (`anonymized`, `contains_user_level_data`) feeds the public-exposure check of `npm run fork:verify` (SDD-04 §5.3). `contains_user_level_data` is `true` for real data that contains seats, per-user usage or imported reports (and stays `true` when a later run fails, because previous artifacts are retained); it is `false` for demo data.

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
- The dashboard SPA (`dashboard/src/App.tsx`) detects this state (`noLiveData`) and renders an informational banner explaining that credential-independent features (CSV reports, AI Model Benchmarks) remain available, instead of silently defaulting to a hardcoded fallback month or crashing. The banner offers an explicit **"Show demo data"** button; the SPA never switches to demo data on its own.
- Each source then has `source_status` `skipped` (not configured) or `failed` (e.g. the token is missing) — both are distinguishable from "collected, and there is simply nothing".

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
