[English](07_dashboard_ui_ux_spec.md) | [日本語](07_dashboard_ui_ux_spec.ja.md)

---

# SDD-07: Dashboard UI/UX Specification

- **Document ID**: SPEC-COPILOT-007
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-10

---

## 1. Overall Layout

The dashboard is designed as a responsive Single Page Application (SPA) optimized for execution on GitHub Pages.

```
+-----------------------------------------------------------------------------------------------+
|  GitHub Copilot Analytics [ℹ️ About]   [Mode: Live Metrics ▼ (Responsive)]   [🔗 Repo: owner/name] [⚠️] |
+-----------------------------------------------------------------------------------------------+
| [1. Analysis Scope Selection]                                                                 |
|  (●) Daily: [2026-09-09 ▼]   ( ) Monthly: [2026-09 ▼]   ( ) Custom Range: [Start to End]      |
+-----------------------------------------------------------------------------------------------+
| [2. Aggregation Axis & Target Group Selection (Paired Controls)]                              |
|  [● Custom Group (Dept/PJ)] [Cost Center] [Organization]  [Selected: Engineering HQ ▼]        |
+-----------------------------------------------------------------------------------------------+
| [3. KPI Summary Cards]                                                                        |
|  +--------------+  +--------------+  +--------------+  +--------------+                       |
|  | Total Spend  |  | Total Seats  |  | Active Rate  |  | Acceptance % |                       |
|  |  $6,240.00   |  |  160 seats   |  |  86.2% (138) |  |  32.8%        |                       |
|  +--------------+  +--------------+  +--------------+  +--------------+                       |
+-----------------------------------------------------------------------------------------------+
| [4. Cost Optimization Advisor (Idle Seat Alert)]                                              |
|  ⚠️ 22 idle seats detected (inactive 30+ days) (Potential Savings: $858.00/mo)                |
|  [View Idle Seats] [Export Candidate CSV]                                                     |
+-----------------------------------------------------------------------------------------------+
| [5. Visual Analytics Grid (2 Columns)]                                                        |
|  [ Left: Group Cost Allocation Charts ]    [ Right: Usage & Acceptance Trends ]               |
+-----------------------------------------------------------------------------------------------+
| [6. Per-User Usage Details Table]                                                             |
|  [Search: _______] [Status: All ▼] [Department: All ▼] [Export CSV]                          |
|  - Username | Display Name | Dept | Cost Center | Org | Last Active | Estimated Cost          |
+-----------------------------------------------------------------------------------------------+
```

---

## 2. Interaction Specifications

### 2.1 Analysis Scope Switching
- **Daily**: Details activity metrics and prorated daily seat costs for a specific date.
- **Monthly**: Cumulative monthly expenses, monthly active users (MAU), and suggested/accepted code volume.
- **Custom Range**: 7-day, 30-day, 90-day, or arbitrary start-and-end calendar range trends.

### 2.2 Aggregation Axis & Target Group Selection (Paired Control Set)
A paired control bar at the top unifies aggregation across the entire page:
1. **Custom Allocation Group (Department / Project Group)**: Internal groups configured via user mapping. The target group dropdown sits immediately adjacent to the axis toggle buttons.
2. **GitHub Cost Center**: Based on GitHub Enterprise Billing Cost Centers.
3. **GitHub Organization**: Based on GitHub Organization.
- **Page-Wide Synchronization**: Selections immediately synchronize all child widgets, including the rankings widget and detail tables.

### 2.4 Anomaly Detection & Error Handling (Error & Warning Detection)
Surfaces data fetching irregularities (API rate limits, 403 shortages, endpoint disruptions):
1. **Header Error/Warning Icon**:
   - Displays a pulsing red (error) or yellow (warning) badge with count in the header.
   - Clicking opens the anomaly diagnostics overlay.
2. **Anomaly Diagnostics Modal (`ErrorLogModal`)**:
   - **Window Dimensions**: 80% viewport width (`w-[80vw]`), 80% viewport height (`h-[80vh]`).
   - **Card Layout**: Spacious layout displaying approximately 3 cards per screen, with internal scroll.
   - **3-Line Truncation & Expansion**: Truncates messages to 3 lines (`line-clamp-3`), with a "Show Details" button for full stack traces and API JSON responses.
   - **ErrorLog Export**: An "Export Log" button downloads a timestamped `copilot_error_log_YYYYMMDD-HHmmss.json`.

### 2.5 Per-User Daily Trends & Model Breakdown View (`UserTrendViewer`)
- **User Selection**: Searchable dropdown or direct transition from rankings/details tables.
- **Stacked Bar & Trend Line by AI Model**:
  - Daily interaction counts for 2026 frontier models (`Claude 3.7 Sonnet`, `GPT-4o`, `o1`, `Gemini 2.0 Flash`).
  - Total chat turns overlaid as a line graph.
- **Productivity Indicators**: Daily suggestions, acceptances, and acceptance rate (%) trends.

### 2.6 Intra-Group Usage Rankings (`GroupUsageRanking`)
- **Page-Wide Synchronization**: Synchronizes automatically with the active axis and target group selected at the top.
- **Active Axis Indication**: Explicitly displays the current axis name and a "Synchronized" indicator badge.
- **3-Axis Support**: Displays member rankings within the active Cost Center, Organization, or Custom Allocation Group.
- **Metric Sorting**: One-click sorting by acceptances, suggestions, chat turns, acceptance rate, or incurred cost.

### 2.7 Cost Center Budget Cards
- Displays budget limit, free allowance, current expenditure, and remaining capacity with color-coded progress bars.
- 80% threshold surfaces warning (amber); 100% surfaces alert (animated red), accompanied by a company-wide summary bar.

### 2.8 Responsive Header, Fork-Safe Repository Links, & About Modal
1. **Fork-Safe Repository Link**:
   - External link in the header dynamically resolves repository URLs via runtime metadata (`indexMeta.repository`) or host origin (`<owner>.github.io/<repo>/`). Zero hardcoded URLs; guaranteed conflict-free for downstream forks.
2. **Responsive ModeSwitcher**:
   - **Wide Screens (`2xl` / 1536px+)**: Displays all 4 modes side-by-side in segmented tabs.
   - **Narrow Screens (< `2xl`)**: Renders a compact dropdown button showing only the active mode, expanding a menu overlay upon click.
3. **About Modal & Metadata**:
   - Info icon (`Info`) in the header opens a modal displaying the exact generation timestamp (`yyyy-mm-dd hh:MM:ss`), specification version (2026.09 LTS), source repository details (with fork attributes), data retention limits, and managed seat totals.
