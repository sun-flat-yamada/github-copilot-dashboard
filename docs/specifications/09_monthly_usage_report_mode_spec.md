[English](09_monthly_usage_report_mode_spec.md) | [日本語](09_monthly_usage_report_mode_spec.ja.md)

---

# SDD-09: GitHub Copilot Monthly Usage Report Mode Specification

- **Document ID**: SPEC-COPILOT-009
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-11

---

## 1. Purpose & Background

In enterprise organizations adopting GitHub Copilot, several crucial operational use cases arise:
1. **Leveraging Detailed Monthly Usage Reports Downloaded from GitHub Enterprise Billing**:
   The Monthly Usage Report (CSV) exported from GitHub Enterprise / Organization "Billing & licensing" or "Copilot Access" contains granular per-user and per-day metered records (SKUs, consumed AI credits, selected models, discounts) that are difficult to access directly via standard REST APIs.
2. **Analysis for Team Leads Lacking Organization-Wide API Credentials**:
   Department leads and team managers without Enterprise Owner privileges or Fine-grained PATs need to visualize cost allocations and usage simply by uploading CSV files.
3. **Zero-Conflict File Persistence in Forked Environments**:
   Ensures stored historical report CSVs never conflict with upstream updates during `Sync Fork` or Pull Requests.

---

## 2. Fork-Safe File Architecture

### 2.1 Three-Tier Hybrid Architecture
In strict compliance with `RULE[GEMINI.md]` and `SDD-05`:

```
[Repository Branch Architecture]
├── main (Code Only Branch)
│   ├── src/
│   ├── dashboard/
│   └── (Zero CSV reports or data files committed)
│
├── copilot-data (Dedicated Orphan Data Branch)
│   └── data/
│       ├── reports/
│       │   └── monthly/
│       │       ├── 2026-08/copilot_monthly_usage_2026-08.csv
│       │       └── 2026-09/copilot_monthly_usage_2026-09.csv
│       ├── processed/
│       │   └── reports/
│       │       ├── 2026-08.json
│       │       └── 2026-09.json
│       └── index.json (available_reports metadata update)
│
└── Browser In-Memory (Zero-Commit Direct Dropzone)
    └── Drag-and-drop client-side CSV files for instant in-memory parsing & visualization
```

### 2.2 Persistent Storage (`copilot-data` Branch)
- **Directory Path**: `data/reports/monthly/YYYY-MM/`
- **Filename Convention**: `copilot_monthly_usage_YYYY-MM.csv` (or `YYYY-MM.csv`)
- **Immutable Operations**: Historical reports are append-only; past files are never overwritten.
- **Fork Safety**: With `main` remaining 100% free of data files, downstream forks encounter 0% merge conflicts when syncing upstream.

### 2.3 Local Ingestion CLI (`scripts/import-report.ts`)
Provides administrators with an automated command to store CSV reports into `copilot-data`:
```bash
npm run report:import -- ./path/to/copilot-report.csv 2026-08
```
Operates within an isolated temporary directory, cleanly pushing to remote `copilot-data` without leaving staging diffs on `main`.

### 2.4 Direct Client-Side Parsing (Local Dropzone)
- Dragging and dropping CSV files directly onto the web dashboard parses and aggregates records in browser JavaScript memory.
- No network transmission to servers or repositories occurs, ensuring complete zero-leakage protection for proprietary internal data.

---

## 3. CSV Format Compatibility & Smart Header Detection

The parser automatically detects and normalizes major GitHub report formats:

### 3.1 GitHub Enterprise Detailed Usage Report (Metered Usage)
- `date`: Usage date (YYYY-MM-DD)
- `username` / `login`: GitHub username
- `product`: Product name (`copilot`)
- `sku`: Billing SKU (`copilot_business`, `copilot_enterprise`, `copilot_premium_request`, `copilot_ai_credit`)
- `model`: Model name (`Claude 3.7 Sonnet`, `GPT-4o`, `o1`, `Gemini 2.0 Flash`, etc.)
- `quantity`: Consumed volume (requests, tokens)
- `unit_type`: Unit (`requests`, `ai_credits`)
- `applied_cost_per_quantity`: Unit cost (USD)
- `gross_amount`: Gross total before discounts (USD)
- `discount_amount`: Discount total (USD)
- `net_amount`: Net billed amount (USD)
- `organization`: Organization name
- `cost_center_name`: Mapped Cost Center

### 3.2 Copilot Activity Report
- `report_time`: Report generation timestamp
- `login`: GitHub username
- `last_authenticated_at`: Last authentication timestamp
- `last_activity_at`: Last activity timestamp
- `last_surface_used`: Last editor or client surface used

### 3.3 Fallback & Error Handling
- Unrecognized columns are gracefully ignored.
- Rows missing critical keys (username, date, quantity/amount) trigger diagnostic warnings while salvaging valid records.
- **Date normalization**: date values are normalized to zero-padded `YYYY-MM-DD` before being used as a sort key. This prevents inconsistent source formatting (e.g. an un-padded `2026-9-5` from a spreadsheet-edited export) from breaking the chronological ordering of `daily_trends` via plain string comparison. Values that cannot be parsed as a date fall back to the raw leading 10 characters (never fabricated) and log a warning.
- **Report-month scoping**: `aggregate()` discards any record whose `date` does not fall within the target `reportMonth` (e.g. a CSV export spanning a rolling date range that crosses a month boundary). This keeps a given month's `daily_trends`/`overview`/`user_details` limited to that calendar month; skipped records are counted and logged as a warning, never silently included.

---

## 4. Aggregated Data Structure (`MonthlyReportAggregatedData`)

```typescript
export interface MonthlyReportAggregatedData {
  report_month: string; // e.g. "2026-08"
  source_type: 'persisted' | 'local_drop';
  file_name: string;
  parsed_at: string;
  overview: {
    total_net_spend_usd: number;
    total_gross_spend_usd: number;
    total_discount_usd: number;
    total_requests: number;
    total_active_users: number;
    top_model: string;
    top_sku: string;
  };
  by_department: Record<string, GroupSummary>;
  by_cost_center: Record<string, GroupSummary>;
  by_organization: Record<string, GroupSummary>;
  model_breakdown: {
    model_name: string;
    total_requests: number;
    total_spend_usd: number;
    active_users: number;
  }[];
  sku_breakdown: {
    sku_name: string;
    total_quantity: number;
    unit_type: string;
    total_spend_usd: number;
  }[];
  daily_trends: {
    date: string;
    requests: number;
    spend_usd: number;
    active_users: number;
  }[];
  user_details: {
    login: string;
    display_name: string;
    department: string;
    cost_center: string;
    organization: string;
    total_requests: number;
    total_spend_usd: number;
    primary_model: string;
    last_activity_date?: string;
    surface?: string;
  }[];
}
```

---

## 5. Dashboard UI/UX Specifications

1. **Header Active Data Selector (`ActiveDataSelector`)**:
   - `Live Metrics`: Real-time daily, monthly, and custom range API dashboard.
   - `Monthly Usage Report`: Dedicated view for monthly billing CSV analysis, with support for on-demand local CSV upload.
2. **Report Selector & On-Demand Import**:
   - Switch rapidly between past reported months (`2026-08`, `2026-09`, etc.).
   - Instant client-side drag-and-drop ingestion parsed in browser memory (Zero-Leakage).
3. **Analytics Sections & View Integration**:
   - Synchronized across dedicated analysis views (Overview, Users, Trend, Model Radar).
   - 1. **KPI Cards**: Net spend, gross spend, total requests, active users, top model.
   - 2. **3-Axis Allocation**: Donut and bar charts grouped by department, cost center, and organization (single-column vertical stack).
   - 3. **Model & SKU Breakdown**: Request shares and expenditure percentages.
   - 4. **Daily Trends Chart**: Spending cadence and peak consumption days across the month.
   - 5. **Per-User Usage Details Table**: Multi-tag AND filtering, searchable, filterable, sortable table with CSV export.
