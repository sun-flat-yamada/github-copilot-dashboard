[English](07_dashboard_ui_ux_spec.md) | [日本語](07_dashboard_ui_ux_spec.ja.md)

---

# SDD-07: Dashboard UI/UX Specification

- **Document ID**: SPEC-COPILOT-007
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-10

---

## 1. Overall Layout

The dashboard is designed as a responsive Single Page Application (SPA) optimized for execution on GitHub Pages, adhering to an **Anti-Multi-Column Single-Stack** structure and **Progressive Disclosure** via accordions.

```
+-----------------------------------------------------------------------------------------------+
|  GitHub Copilot Analytics [ℹ️ About] [Active Data: Live Metrics ▼]   [🔗 Repo: owner/name] [⚠️] |
+-----------------------------------------------------------------------------------------------+
| [Navigation: 7 Analysis Views]                                                                 |
|  [Overview] [Rankings] [Users] [Trends] [Budget] [Deep Analytics] [Model Radar]              |
+-----------------------------------------------------------------------------------------------+
| [Multi-Tag AND Filter Bar]                                                                    |
|  Filter by tags: [正社員] [リモート] [AI推進] ... (AND logic: All selected must match) [Reset] |
+-----------------------------------------------------------------------------------------------+
| [Block Controls]                                                    [Expand All] [Collapse All] |
+-----------------------------------------------------------------------------------------------+
| [Block 0: Executive KPI Summary (Always Expanded)]                                            |
|  +--------------+  +--------------+  +--------------+  +--------------+                       |
|  | Total Spend  |  | Total Seats  |  | Active Rate  |  | Acceptance % |                       |
|  |  $6,240.00   |  |  160 seats   |  |  86.2% (138) |  |  32.8%        |                       |
|  +--------------+  +--------------+  +--------------+  +--------------+                       |
+-----------------------------------------------------------------------------------------------+
| [Block 1: Collapsible Section (Default: Collapsed with Summary Chip Badges)]                 |
|  [▼ Cost Optimization Advisor (Idle Seat Alert)] [Potential Savings: $858.00/mo]             |
|  (Expanded: 30+ day idle seat list & CSV export)                                              |
+-----------------------------------------------------------------------------------------------+
| [Block 2: Collapsible Section (Default: Collapsed)]                                           |
|  [▶ Group Cost Allocation & License Utilization] [12 Depts]                                  |
+-----------------------------------------------------------------------------------------------+
| [Block 3: Collapsible Section (Default: Collapsed)]                                           |
|  [▶ Cost Center Budget Tracking] [3 Cost Centers]                                             |
+-----------------------------------------------------------------------------------------------+
| [Block 4: Collapsible Section (Default: Collapsed)]                                           |
|  [▶ User Usage Details Table] [160 users]                                                     |
+-----------------------------------------------------------------------------------------------+
```

---

## 2. Interaction Specifications

### 2.1 Header Active Data Selector (`ActiveDataSelector`)
The center of the header prominently displays the currently active dataset, allowing instantaneous switching via modal dialog:
1. **Live Metrics (API-Synced Auto Collection)**:
   - Scope switching across rolling past 1 year (12 months), rolling past 30 days daily, and 30-day aggregated preset.
2. **Monthly Usage Report**:
   - Switching among immutable monthly usage reports (CSV-derived) persisted on the `copilot-data` branch.
3. **User Upload File (On-demand)**:
   - Instant drag-and-drop ingestion of local CSV files. Parsed and rendered entirely in-memory within the client browser, strictly preventing any outbound transmission to server or repository (Zero-Leakage on-demand analysis).

### 2.2 Multi-Tag AND Filtering (`TagFilterBar`)
- Dynamically extracts unique tags from user group mapping `tags` attribute (e.g., `["Full-time", "Remote", "AI-Champion"]`).
- Supports multi-tag selection evaluated with **AND logic (must match all selected tags)**.
- Displays matching user counts ("Matched N / M users") and a "Clear" button. Re-aggregates KPI cards, group allocations, rankings, detail tables, and deep analytics dynamically in real time.

### 2.3 Anti-Multi-Column Single-Stack Rule
- Page layouts follow a strict **single-column vertical stack (`flex flex-col space-y-6 w-full`)**.
- Splitting cards or charts horizontally (2-3 columns) is strictly prohibited to eliminate horizontal table scrolling and compressed timeline charts.
- **Exception Rule**: Side-by-side elements are permitted only when simultaneous comparative inspection is essential (e.g., budget vs. actuals) AND both elements have identical fixed heights.

### 2.4 Progressive Disclosure via Accordions
- **Block 0 (Summary Block)**: Always expanded at the top, presenting executive KPI summaries.
- **Block 1..N (Feature Blocks)**: Collapsed by default, displaying title, icon, and summary chips (e.g., `12 Departments`, `$6,240.00`).
- **Batch Controls**: Global `[Expand All]` and `[Collapse All]` buttons in the control bar for instant toggling.

### 2.5 Anomaly Detection & Error Handling (Error & Warning Detection)
Surfaces data fetching irregularities (API rate limits, 403 shortages, endpoint disruptions):
1. **Header Error/Warning Icon**:
   - Displays a pulsing red (error) or yellow (warning) badge with count in the header.
   - Clicking opens the anomaly diagnostics overlay.
2. **Anomaly Diagnostics Modal (`ErrorLogModal`)**:
   - **Window Dimensions**: 80% viewport width (`w-[80vw]`), 80% viewport height (`h-[80vh]`).
   - **Card Layout**: Spacious layout displaying approximately 3 cards per screen, with internal scroll.
   - **3-Line Truncation & Expansion**: Truncates messages to 3 lines (`line-clamp-3`), with a "Show Details" button for full stack traces and API JSON responses.
   - **ErrorLog Export**: An "Export Log" button downloads a timestamped `copilot_error_log_YYYYMMDD-HHmmss.json`.

### 2.6 Per-User Daily Trends & Model Breakdown View (`UserTrendViewer`)
- **User Selection**: Searchable dropdown or direct transition from rankings/details tables.
- **Stacked Bar & Trend Line by AI Model**:
   - Daily interaction counts for 2026 frontier models (`Claude 3.7 Sonnet`, `GPT-4o`, `o1`, `Gemini 2.0 Flash`).
   - Total chat turns overlaid as a line graph.
- **Productivity Indicators**: Daily suggestions, acceptances, and acceptance rate (%) trends.

### 2.7 Intra-Group Usage Rankings (`GroupUsageRanking`)
- **Page-Wide Synchronization**: Synchronizes automatically with the active axis and target group selected at the top.
- **Active Axis Indication**: Explicitly displays the current axis name and a "Synchronized" indicator badge.
- **3-Axis Support**: Displays member rankings within the active Cost Center, Organization, or Custom Allocation Group.
- **Metric Sorting**: One-click sorting by acceptances, suggestions, chat turns, acceptance rate, or incurred cost.

### 2.8 Cost Center Budget Cards
- Displays budget limit, free allowance, current expenditure, and remaining capacity with color-coded progress bars.
- 80% threshold surfaces warning (amber); 100% surfaces alert (animated red), accompanied by a company-wide summary bar.

### 2.9 Responsive Header, Active Data Selector & View Navigation
1. **Fork-Safe Repository Link**:
   - External link in the header dynamically resolves repository URLs via runtime metadata (`indexMeta.repository`) or host origin (`<owner>.github.io/<repo>/`). Zero hardcoded URLs; guaranteed conflict-free for downstream forks.
2. **Active Data Selector & View Navigation**:
   - **ActiveDataSelector (Header)**: Continuously displays the active data source at header center, facilitating quick dataset switching.
   - **ViewNavigation (Navigation Bar)**: Replaces legacy mode switching with 7 dedicated analysis views (`overview`, `ranking`, `users`, `trend`, `budget`, `deep_analysis`, `model_radar`), automatically managing view availability based on active data source capabilities.
3. **About Modal & Metadata**:
   - Info icon (`Info`) in the header opens a modal displaying the exact generation timestamp (`yyyy-mm-dd hh:MM:ss`), specification version (2026.09 LTS), source repository details (with fork attributes), data retention limits, and managed seat totals.
