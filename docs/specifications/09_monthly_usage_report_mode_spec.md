[English](09_monthly_usage_report_mode_spec.md) | [日本語](09_monthly_usage_report_mode_spec.ja.md)

---

# SDD-09: GitHub Copilot Monthly Usage Report Mode Specification

- **Document ID**: SPEC-COPILOT-009
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-11 (revised 2026-10-01: multi-file merge, unit families, undated rows, no synthesized profiles)

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
- **Several files for the same month (P0-10)**: GitHub exports are often split (by organization, by date range) or re-downloaded. The pipeline reads **every** CSV under `data/reports/monthly/YYYY-MM/`, merges the records and aggregates the month **once** (`ReportParser.mergeRecordSets` → `aggregate`); previously only one file was used and the others were silently ignored.
  - **Duplicate detection**: rows identical in every identifying field (date, user — case-insensitive —, product, SKU, model, quantity, unit, unit price, gross/discount/net, organization, cost center, last activity, surface, credits, tokens) that appear in *different* files are counted once (for each distinct row, the maximum number of occurrences in any one file is kept). Identical rows inside one file may be legitimate separate line items and are all kept.
  - **Traceability**: the result carries `import_summary` — `source_files`, `records_total`, `duplicates_skipped` and, when present, `undated_records` — and the pipeline log reports the same numbers.

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
- `quantity`: Consumed volume in the unit given by `unit_type`. (`tokens` is a header alias of `token_count` only; it is never also mapped to `quantity`.)
- `unit_type`: Unit (`requests`, `ai_credits`, seat / licence units, …). **Quantities are never added across different unit families** — see §3.4.
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
- **Missing values are not invented**: a row without a `quantity` is *not* counted as one request; it contributes nothing to quantities while its amounts still count. A row without a date is **not** assigned to "today" — it stays undated, is included in the totals, is left out of `daily_trends`, and is counted in `import_summary.undated_records`.
- **Metrics a report cannot contain**: a billing CSV has no suggestions, acceptances, chats or PR summaries. The per-group metrics derived from it are `null` (SDD-06 §4.4), not a fixed rate such as 35%.


### 3.4 Unit Families (`unit_type`)
A report mixes requests, AI credits and seat (user-month) rows. Adding their `quantity` produced a meaningless "request count", so `ReportParser.classifyUnit` assigns every row to a family and each aggregate uses only the family it means:

| Family | Matches `unit_type` containing | Used for |
|:--|:--|:--|
| `requests` | `request`, `prompt`, `interaction`, `completion`, `message`, `chat`; **also a missing `unit_type`** (legacy CSVs, kept for compatibility) | `overview.total_requests`, per-user / per-model / per-day request counts |
| `credits` | `credit` | `quantity_by_unit` (credit consumption) |
| `seats` | `seat`, `licen[sc]e`, `user`, `member`, `month` | `quantity_by_unit` (licence rows are not requests) |
| `tokens` | `token` | `quantity_by_unit` |
| `other` | anything else | `quantity_by_unit` |

`overview.quantity_by_unit` keeps the per-unit totals (e.g. `{ "requests": 120, "ai-credits": 3400, "seats": 85 }`) so nothing is lost, and `sku_breakdown` has one row per SKU **and unit** (quantities of different units are never summed into one row).

### 3.5 AI usage report (token columns) and `usage_insight`
Official field reference: GitHub Docs "Billing reports reference" (`billing/reference/billing-reports`). The **AI usage report** is a per-user breakdown of AI credits for at most 31 days, summed over `date × model × username`, and adds the token fields `input`, `output`, `cache_read`, `cache_write` per model.

| Header (normalised) | Record field |
|:--|:--|
| `input` / `input_tokens` | `input_tokens` |
| `output` / `output_tokens` | `output_tokens` |
| `cache_read` / `cache_read_tokens` | `cache_read_tokens` |
| `cache_write` / `cache_write_tokens` | `cache_write_tokens` |
| `token_count` / `tokens` / `total_tokens` | `token_count` (total only) |

- A row that carries token columns but **no `unit_type`** is classified as the `other` family: its `quantity` is not added to the request count (the legacy "no `unit_type` = requests" rule applies to rows without token columns only). Credits then come from `ai_credits_consumed` or from rows whose `unit_type` mentions credits.
- Rows differing only in token values are distinct rows for duplicate detection.
- `aggregate()` attaches `usage_insight` (SDD-06 §5) to every user row; it is computed before any display filter, and the filter engine keeps it untouched.
- **Verified against GitHub Docs (latest `main` of `github/docs`, 2026-10-02)** — still **not** against a real export file:
  - Unit: the REST AI-credit usage example (`GET /enterprises/{enterprise}/settings/billing/ai_credit/usage`) returns `unitType: "credits"`, `pricePerUnit: 0.01`; 1 AI credit = $0.01 USD. So `quantity` is AI credits.
  - SKU: `copilot_ai_credit` (also `coding_agent_ai_credit`, `code_quality_ai_credit`, `spark_ai_credits`).
  - Credits = tokens × the per-model price (USD per 1M tokens; input / cached input / cache write / output) ÷ $0.01. The price table is `data/tables/copilot/models-and-pricing.yml`; the demo generator (`generateAiUsageReportCSV`) embeds the rates it uses (`COPILOT_MODEL_TOKEN_PRICES`).
  - The `model` example is the slug `claude-sonnet-4`; the REST example uses a display name (`GPT-5`). Model names are matched as written, so the same model can appear under two spellings across sources.
  - **Not published**: the column order of the CSV and the exact `unit_type` string in the CSV. The parser matches columns by header name, and `unit_type` by the substring `credit`.
  - Collection paths that exist but are not implemented here: the REST endpoint above (enterprise; also org/user levels) and the asynchronous export API (`POST /enterprises/{enterprise}/settings/billing/reports` with `report_type: ai_credit`; completed exports are downloadable for 31 days). Org owners cannot filter AI usage by user in the UI and must download the report.
- **Demo data**: `MockDataGenerator.generateAiUsageReportCSV()` follows the fields and pricing above (columns limited to the official fields; one row per `date × model × username`; discounts use a dummy included-credit amount). A test checks the conformance.

---

### 3.6 Format Profiles and the Import Report (P1-5)

Header recognition is declared in `src/processor/csv-format-profiles.ts` (field aliases + per-format required columns). A header is lower-cased and recognized if either of two forms matches an alias: punctuation removed (`user-name` → `username`) or non-alphanumerics turned into `_` (`Gross Amount ($)` → `gross_amount`, `Net Amount` → `net_amount`).

| Profile | Required columns |
|:--|:--|
| `ai-usage-report` | `username`, `model` and one of `input_tokens` / `output_tokens` / `token_count` |
| `activity-report` | `username`, `last_activity_at` |
| `billing-usage-report` | `username` and one of `quantity` / `net_amount` / `gross_amount` / `ai_credits_consumed` |

If no profile's requirements are met the import **stops** (no records) and the reason is shown (which required column is missing and which columns were recognized).

Every import produces a `CsvImportReport` (`src/domain/entities/csv-import.ts`, kept in `import_summary.csv_reports`), shown at import time (header data-selection modal upload area, and `npm run report:import` on the CLI):
- recognized and **unrecognized columns** (unrecognized ones are not used in any aggregation),
- rows: imported / total, **skipped rows with reason** (currently: empty username) and the data-row numbers of the first samples (the header and blank lines are not counted), rows with a different column count (suspected column shift), rows without a usable date, identical repeated rows within a file (kept, since they can be legitimate separate line items; cross-file duplicates are collapsed by `mergeRecordSets`),
- **totals per unit family** (requests / credits / seats / tokens / other): row count, quantity, gross and net amounts. Different units are never added together; a unit with no value stays `null` (shown as "—（値なし）"), not 0.

The report contains counts, column names and totals only (no user names or individual values).

## 4. Aggregated Data Structure (`MonthlyReportAggregatedData`)

```typescript
export interface MonthlyReportAggregatedData {
  report_month: string; // e.g. "2026-08"
  source_type: 'persisted' | 'local_drop';
  file_name: string;
  parsed_at: string;
  import_summary?: {                // present for merged monthly reports (§2.2)
    source_files: string[];
    records_total: number;          // records used after de-duplication
    duplicates_skipped: number;     // rows collapsed because another file had the same row
    undated_records?: number;       // rows without a date: in totals, not in daily_trends
  };
  overview: {
    total_net_spend_usd: number;
    total_gross_spend_usd: number;
    total_discount_usd: number;
    total_requests: number;         // requests-family rows only (§3.4)
    quantity_by_unit?: Record<string, number>; // totals per unit, e.g. { requests: 120, 'ai-credits': 3400 }
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
    surface?: string;               // absent when the CSV has no surface column (no default such as "VS Code")
  }[];
  filter_notice?: { unfiltered_sections: string[] }; // while a filter is active: sections shown company-wide (SDD-15 §3.6)
}
```

---

## 5. Dashboard UI/UX Specifications

1. **Header Active Data Selector (`ActiveDataSelector`)**:
   - `Auto-collected Data`: Real-time daily, monthly, and custom range API dashboard.
   - `Monthly Usage Report`: Dedicated view for monthly billing CSV analysis, with support for on-demand local CSV upload.
2. **Report Selector & On-Demand Import**:
   - Switch rapidly between past reported months (`2026-08`, `2026-09`, etc.).
   - Instant client-side drag-and-drop ingestion parsed in browser memory (Zero-Leakage).
3. **Analytics Sections & View Integration**:
   - Synchronized across dedicated analysis views (Overview, Users, Trend, Model Radar, Budget).
   - 1. **KPI Cards**: Net spend, gross spend, total requests, active users, top model.
   - 2. **3-Axis Allocation (`MonthlyReportCharts`)**:
     - Dedicated axis selector for Department (`department`), Cost Center (`cost_center`), and Organization (`organization`).
     - Bi-directionally synchronized with the top control bar for active group filtering.
   - 3. **Model & SKU Breakdown**: Request shares and expenditure percentages.
   - 4. **Daily Trends Chart**: Spending cadence and peak consumption days across the month.
   - 5. **Per-User Usage Details Table (`UserDetailTable`, the same component as auto-collected data — SDD-07 §2.16)**:
     - Explicit `Organization` column alongside Cost Center and Department.
     - Group filter dropdown dynamically adapts options based on the active grouping axis (Department / Cost Center / Organization).
     - Row-click interaction triggers inline deep analysis drilldown (`UserDrilldownPanel`).
   - 6. **Cost Center Budget Tracking (View 5: Budget & Cost Center)**:
     - Automatically computes budget cards (`CostCenterBudgetCards`) from `by_cost_center` in monthly report mode.
   - 7. **Per-User Model Trend Viewer (View 3: Trend & Model Usage)**:
     - Uses the stored monthly archive (`deep-analysis/{YYYY-MM}.json`, measured telemetry) when one exists. A monthly CSV or an uploaded CSV is an aggregate without per-user daily telemetry, so **no per-user profile is synthesized from it**: the viewer shows the data source badge "月次集計のみ・日次診断不可" and the reason instead of an estimated trend (SDD-11 §6.4).
     - When profiles exist, all active AI models are detected dynamically for the stacked bar charts and an explicit data source badge is shown in the header.
     - Connects with the "トレンド" button in `UserDetailTable`.
   - 8. **Filters**: `daily_trends` and `sku_breakdown` cannot be re-aggregated per user and are labelled "全社値 (フィルター非対応)" while a filter is active (SDD-07 §2.14).

