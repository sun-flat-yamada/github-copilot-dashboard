[English](07_dashboard_ui_ux_spec.md) | [日本語](07_dashboard_ui_ux_spec.ja.md)

---

# SDD-07: Dashboard UI/UX Specification

- **Document ID**: SPEC-COPILOT-007
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-10 (revised 2026-10-01: data status, missing-value and demo policy added as §2.13 / §2.14)

---

## 1. Overall Layout (Data-Centric & Single-Column Vertical Stack)

The dashboard is designed as a responsive Single Page Application (SPA) optimized for execution on GitHub Pages, adhering to an **Anti-Multi-Column Single-Stack** structure and **Progressive Disclosure** via accordions.

> **What "Data-Centric" means here**: This term is not merely a layout philosophy (consolidating data selection at the top of the screen). It also encodes an implementation requirement (SDD-01 FR-9): **every View's displayed content must always behave as a pure function of the header's Active Selected Data (source / scope / tags / filters)**. Because the global controls (unified within header `ActiveDataSelector` / `DataSelectionModal`) are rendered as elements outside each View, filter changes never remount the View. Views must therefore never rely on a one-time, mount-time computation, and must instead track every change to the Active Selected Data. See [SDD-15: Data-Centric Reactivity Design Specification](15_data_centric_reactivity_design_spec.md) for the detailed design policy, implementation conventions, and checklist.

```
+------------------------------------------------------------------------------------------------------+
|  GitHub Copilot Analytics [ℹ️ About] [Active Data: Live Metrics ▼]   [🔗 Repo: owner/name] [⋮ Menu] [⚠️] |
+------------------------------------------------------------------------------------------------------+
| [Navigation: 6 Analysis Views]                                                                 |
|  [Overview] [Users (Rankings Consolidated)] [Trends] [Budget] [Deep Analytics] [Model Radar] |
+-----------------------------------------------------------------------------------------------+
| [Block 0: Executive KPI Summary (Always Expanded)]                                            |
|  +--------------+  +--------------+  +--------------+  +--------------------+                 |
|  | Total Spend  |  | Total Seats  |  | Active Rate  |  | Inline Acc. Rate   |                 |
|  |  $6,240.00   |  |  160 seats   |  |  86.2% (138) |  |  32.8%              |                 |
|  +--------------+  +--------------+  +--------------+  +--------------------+                 |
+-----------------------------------------------------------------------------------------------+
| [Detailed Analysis Sections] (5 Sections)                                          [⤓] [⤒]     |
+-----------------------------------------------------------------------------------------------+
+-----------------------------------------------------------------------------------------------+
| [Block 1: Collapsible Section (Default: Collapsed with Summary Chip Badges)]                 |
|  [▼ Cost Optimization Advisor (Idle Seat Alert)] [Potential Savings: $858.00/mo]             |
|  (Expanded: idle seat list with the shown criteria & CSV export)                              |
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

**Layout & Filter Summary Specifications**:
- **Harmonized 2-Row Layout**: Employs a 2-row layout matching the height of the left title block (approx. 38–44px), cleanly separating the data source and period hierarchy on the left and the active filter badge summary on the right.
- **Display of at least 6 Filter Elements**: Directly renders at least 6 filter badges on the header (split across top and bottom rows, up to 3 per row) when multiple Cost Centers, Organizations, Departments, Tags, or User patterns are applied. Additional filters beyond 6 are summarized with a `+N` badge.
- **Click-to-Dismiss Filter Pills**: Clicking any individual filter summary badge immediately clears that specific filter condition without triggering the parent modal opener (`stopPropagation`). Badges display an intuitive `✕` icon and dismissal tooltip on hover.
- **Category-Specific Color Coordination**: Distinct visual color tokens differentiate each filter category across both header badges and `DataSelectionModal` input containers, icons, and toggle controls:
  - **CostCenter (Financial axis)**: **Amber** (`bg-amber-950/80 text-amber-300 border-amber-800` / icon: `Landmark`)
  - **Organization (Enterprise/Org axis)**: **Blue** (`bg-blue-950/80 text-blue-300 border-blue-800` / icon: `Building2`)
  - **UserDefinedGroup (Team/Project axis)**: **Purple** (`bg-purple-950/80 text-purple-300 border-purple-800` / icon: `Briefcase`)
  - **Tag (Attribute/Label axis)**: **Rose** (`bg-rose-950/80 text-rose-300 border-rose-800` / icon: `Tag` / toggle: `bg-rose-600`)
  - **UserPattern (Account/Pattern axis)**: **Cyan** (`bg-cyan-950/80 text-cyan-300 border-cyan-800` / icon: `User`)
- **Responsive Ellipsis Truncation**: When screen real estate is limited, each badge truncates overflowing text with `truncate` (max-width constrained) to prevent header layout breakage.
- **Comprehensive Tooltip & Keyboard Shortcut Tips**: The hover tooltip (`title` attribute) displays full information: active source, period, all applied filters without truncation, matching count, and total count. Keyboard shortcut tips (`/` or `Ctrl+K`) are preserved. Individual badges also provide full-text tooltips on hover.

### 2.2 Multi-Tag AND Filtering (`DataSelectionModal` Consolidation)
- Dynamically extracts unique tags from user group mapping `tags` attribute (e.g., `["Full-time", "Remote", "AI-Champion"]`) and allows multi-tag selection within the header's Data Selection & Filter Modal (`DataSelectionModal`).
- Supports multi-tag selection evaluated with **AND logic (must match all selected tags)**.
- Displays matching filters in header summary badges (Rose color scheme) and tooltips with individual click dismissal and a one-click clear all button. Re-aggregates KPI cards, group allocations, rankings, detail tables, and deep analytics dynamically in real time.

### 2.3 Anti-Multi-Column Single-Stack & Fluid Responsive Width Rule
- Page layouts follow a strict **single-column vertical stack (`flex flex-col space-y-6 w-full`)**.
- Splitting cards or charts horizontally (2-3 columns) is strictly prohibited to eliminate horizontal table scrolling and compressed timeline charts.
- **Fluid Responsive Expansion on Window Maximization**: Narrow or fixed maximum widths (`max-w-7xl`, `max-w-[1600px]`, etc.) are eliminated. While maintaining appropriate side margins/padding (`px-4 sm:px-6 lg:px-8`), the content body (`<main>`) as well as header and navigation containers automatically expand to fill available space on large displays and maximized windows (`w-full mx-auto`).
- **Exception Rule**: Side-by-side elements are permitted only when simultaneous comparative inspection is essential (e.g., budget vs. actuals) AND both elements have identical fixed heights.

### 2.4 Progressive Disclosure via Accordions
- **Block 0 (Summary Block)**: Always expanded at the top, presenting executive KPI summaries.
- **Block 1..N (Feature Blocks)**: Collapsed by default, displaying title, icon, and summary chips (e.g., `12 Departments`, `$6,240.00`).
- **Detailed Analysis Section Header & Batch Icon Controls**: A clean section divider bar positioned beneath the summary block featuring a "Detailed Analysis Sections" heading with section count pill badge (`5 Sections` / `2 Sections`). Rounded compact icon buttons (`[⤓]` / `[⤒]`, `ChevronsDown` / `ChevronsUp`) are placed on the right, providing high accessibility with hover tooltips (`title`) and `aria-label`. Negative margins are eliminated to structurally prevent visual overlap with neighboring blocks.

### 2.5 Anomaly Detection & Error Handling (Error & Warning Detection)
Surfaces data fetching irregularities (API rate limits, 403 shortages, endpoint disruptions):
1. **Header Error/Warning Icon & Badge (Compact Error Indicator)**:
   - Eliminates redundant text labels (`エラー検知` / `警告あり`) in favor of a clean, compact indicator displaying only the anomaly icon (`AlertCircle` for red pulse error, `AlertTriangle` for amber warning) alongside a pill-shaped count badge (`allIssuesCount`).
   - Provides dynamic accessible `aria-label` and detailed tooltip (`title`) for screen reader and keyboard accessibility.
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
- **Productivity Indicators**: Daily suggestions, acceptances, and Inline Completion Acceptance Rate (%) trends.

### 2.7 User Details & Utilization Breakdown (`UserDetailTable`)
- **Neutral Record List & Ranking Phasing-out**: In alignment with FinOps principles where raw volume does not inherently signify contribution, rankings and podium badges have been phased out in favor of neutral record IDs (`#`).
- **Separated User and Display Name Columns with Tag Column Addition**: GitHub account handle (`User`) and employee real name (`Display Name`) are isolated into distinct sortable columns. Furthermore, a dedicated `Tags` column is positioned directly before the `Cost Center` column to surface organizational/employment attributes.
- **Compact Style Padding & Non-Wrapping Horizontal Scroll**: Cell padding across headers and rows is refined to a compact design (`py-2 px-2.5`), preventing automatic line breaks (`whitespace-nowrap min-w-max`) when viewing on narrow viewports. Horizontal overflow scrolling (`overflow-x-auto`) preserves table geometry across any resolution.
- **3-Axis & Group Integration**: Seamlessly sorts members across Cost Centers, Organizations, and User Defined Groups (`ユーザー定義Gr`).
- **Metric Sorting**: One-click interactive sorting by user handle, display name, department/group, tags, cost center, organization, acceptances, suggestions, chat turns, Inline Completion Acceptance Rate, incurred cost, excess billing, or inactive days.
- **User Selection & Inline Drill-down Analysis (`UserDrilldownPanel`)**: Clicking any user row or clicking the "Drilldown" button expands a comprehensive diagnostic panel directly beneath the row without navigating away. Allows instant 360-degree micro-analysis of FinOps costs (monthly/daily/excess billing), productivity KPIs, daily trends with AI model breakdown charts, overall AI health score (0-100), and 5 anti-pattern diagnostic evaluations with actionable prescriptions while preserving table context. Fully compatible with Live Metrics, Monthly Usage Report, and User Upload (CSV) data sources.
- **Direct Navigation**: Direct transitions to individual model trends (`trend`) and deep diagnostics (`deep_analysis`) from row actions or within the drilldown panel.

### 2.8 Cost Center Budget Cards
- Displays budget limit, free allowance, current expenditure, and remaining capacity with color-coded progress bars.
- 80% threshold surfaces warning (amber); 100% surfaces alert (animated red), accompanied by a company-wide summary bar.

### 2.9 Responsive Header, Active Data Selector & View Navigation
1. **Fork-Safe Repository Link**:
   - External link in the header dynamically resolves repository URLs via runtime metadata (`indexMeta.repository`) or host origin (`<owner>.github.io/<repo>/`). Zero hardcoded URLs; guaranteed conflict-free for downstream forks.
2. **Active Data Selector & View Navigation**:
    - **ActiveDataSelector (Header) & Large Data Selection Modal (DataSelectionModal)**: Central UI component governing the two-tier data selection model to uniquely determine analysis scope. The header trigger button embeds an explicit "分析対象データ" (Analysis Target Data) badge (indigo accent, `h-11` harmonized) to immediately clarify the control's purpose. Utilizing a 2-row layout harmonized with the left title section height (approx. 38–44px), the header button continuously displays the active data source and period hierarchy, alongside active filter summary pills (rendering at least 6 filter elements, with `+N` for excess) and responsive ellipsis truncation. On narrow viewports, both active filter badges and unfiltered state labels ("フィルタなし", "全体: X名") enforce horizontal `truncate` and `whitespace-nowrap`, structurally preventing multi-line text wrapping and vertical height expansion outside header bounds. Each filter pill supports individual click-to-dismiss to quickly clear specific criteria, displaying an intuitive `✕` icon on hover. Furthermore, category-specific visual color coding (CostCenter: Amber, Organization: Blue, UserDefinedGroup: Purple, Tag: Rose, UserPattern: Cyan) enhances visual scanning and ensures unified styling with the expanded `DataSelectionModal`. On hover, the tooltip (`title` attribute) reveals the comprehensive dataset, scope, and all filter criteria alongside keyboard shortcut tips (`/`, `Ctrl+K`). A one-click reset button (`[✕]`) is provided when filters are active. Clicking launches the large 2-column modal (`DataSelectionModal`: `w-[92vw] max-w-5xl h-[85vh] max-h-[820px]`) making optimal use of screen real estate. The modal features an explicit "分析対象データ" heading alongside real-time preview counts (displayed as "選択ユーザー数" in the modal header), with left-column dataset/period selection and right-column 4-category AND filters. To prevent popup clipping and containing block traps caused by the parent header's CSS `backdrop-filter` (`backdrop-blur`), the selection modal is mounted directly into `document.body` via React Portal (`createPortal`). The modal maintains a fixed card height (`h-[85vh] max-h-[820px]`) with fixed headers/footers (`flex-shrink-0`) and internal scrolling (`overflow-y-auto`). All view updates upon dataset or filter changes are structurally guaranteed through a single-derived-dataset contract and root cache-busting key (`datasetVersionKey`).
   - **ViewNavigation (Navigation Bar)**: Replaces legacy mode switching with 6 dedicated analysis views (`overview`, `users`, `trend`, `budget`, `deep_analysis`, `model_radar`), automatically managing view availability based on active data source capabilities with rankings consolidated into user details.
3. **About Modal & Metadata**:
   - Info icon (`Info`) in the header opens a modal displaying the exact generation timestamp (`yyyy-mm-dd hh:MM:ss`), specification version (2026.09 LTS), source repository details (with fork attributes), data retention limits, and managed seat totals.
4. **Header Title Responsive Collapse & Info Icon Preservation**:
   - The left header title section (`GitHub Copilot Analytics`, operation mode badge, subtitle) is fully responsive: it displays full title and badges on viewports with sufficient width (width >= 768px / `md`), and automatically collapses to icon-only (`Sparkles` icon) on narrow mobile viewports (width < 768px / `< md`).
   - The Information icon button (`Info`) triggering the About modal is preserved immediately adjacent to the `Sparkles` icon even when collapsed, maintaining instant accessibility.
   - Removing the `min-w-max` constraint from the left container minimizes its footprint to approximately 64px, entirely eliminating layout collisions and visual overlap where the title previously slipped underneath right-side action controls (`ActiveDataSelector`, three-dots settings menu, GitHub repo link).

### 2.10 Three-Dots Settings Menu (Display Settings: Theme & Currency Switching) Specification
1. **Design Rationale**:
   - To eliminate header clutter caused by multiple disparate toggle buttons and streamline display preferences into a unified, modern interface, Currency Switching (sub-currency selection) and Display Mode Switching (Dark/Light mode) are consolidated into a three-dots menu icon (⋮, `MoreVertical`).
2. **UI Placement & Interaction**:
   - The three-dots menu button is positioned directly adjacent to the GitHub repository link container in the header action area.
   - Clicking the button toggles a dropdown panel (`w-64 sm:w-72`).
   - Automatically closes upon outside clicks (`mousedown`) or pressing the `Escape` key.
3. **Menu Organization**:
   - **Display Mode (Theme)**: Real-time display of current mode (Dark / Light) with an accessible one-click toggle button (`Sun` / `Moon`). Preferences persist in `localStorage` under `copilot_dashboard_theme`.
   - **Sub-Currency Selection & EA Contract Rate Display (EA-USD, EA-JPY, EA-EUR)**:
     - **GitHub Catalog Price (USD) as Primary Baseline**: The primary USD currency (`$`) strictly represents the official GitHub Catalog list price. Dedicated tooltips and indicators are embedded across CurrencySelector, KPI cards, and table headers.
     - **Selector Top Comment**:
       ```text
       USD (GitHubのカタログ価格)と併記するサブ表示単位
       ユーザーが設定したEA契約レートで表示する
       ```
     - **Display Units & Options (Clean format without bracket descriptions)**:
       - `USD Only ($)`
       - `USD + EA-USD ($)`
       - `USD + EA-JPY (¥)`
       - `USD + EA-EUR (€)`
     - **Effective Rate Calculation via EA Contract Rates**: Computes the effective cost for each sub-currency (EA-USD, EA-JPY, EA-EUR) based on user-configured EA contract exchange rates and discount percentages (`discountPercent`), displaying side-by-side with USD list prices. Unconfigured intervals fall back gracefully to official public reference rates (ECB/BOJ).
     - **Persistence**: Preferences persist in `localStorage` under `copilot_dashboard_preferred_sub_currency`, with legacy stored values (`JPY`, `EUR`) automatically normalized to `EA-JPY`, `EA-EUR`.
4. **Semantic Token Architecture (Tailwind CSS v4)**:
   - Utilizes CSS variables (`--color-slate-*`) under `html.light` and `[data-theme="light"]` selectors, automatically adapting canvas backgrounds (`#f8fafc`), cards (`#ffffff`), borders (`#e2e8f0`), and typography (`#0f172a`).
   - Dynamically binds Recharts gridlines, axis labels, and floating tooltips to theme tokens for high legibility across all views.

### 2.11 Separate Cost/Overage Columns & Universal Table Sorting Specification
1. **Independent Columns for Usage Cost and Excess Billing**:
   - In `MonthlyReportCharts` (3-Axis Allocation Table), `UserDetailTable`, and `GroupUsageRanking`, usage cost (`利用費用` / `利用料金 (USD)`) and excess billing (`超過請求 (USD)`) are displayed in dedicated, separate columns rather than merged.
   - The excess billing (Net Billable Overage) column is rendered with amber accents (`text-amber-400`) and monospace font (`font-mono`) to clearly distinguish billable overages after free-tier budget deductions.
2. **Universal Multi-Column Sorting Across All Tables**:
   - All table components throughout the dashboard (`MonthlyReportCharts`, `UserDetailTable`, `GroupUsageRanking`, `AdoptionMaturityView`, `AgentActivityView`, `CreditsView`, `ModelRadarView`) provide interactive bidirectional sorting on every sortable column header.
   - **Sort Indicators**: Subdued `ArrowUpDown` for inactive columns, dynamic `ArrowUp` (ascending) / `ArrowDown` (descending) for active columns with alternating sort order on consecutive clicks.
   - **Accessibility & UX**: All sortable headers include `cursor-pointer select-none` and hover highlight feedback for intuitive data inspection.

### 2.12 Header Action Controls Height & Icon Size Standardization
1. **Unified Button Container Height (`h-11` / 44px)**:
   - All right-side action button containers (`ActiveDataSelector` analysis target selector, source repository link & Star pill, three-dots display settings menu, anomaly error/warning trigger) strictly adhere to `h-11` (44px).
   - Eliminates height mismatches by standardizing to the largest control's height (`ActiveDataSelector`), achieving complete horizontal baseline alignment and balanced visual weight.
2. **Standardized Action Icon Sizing (`w-4 h-4` / 16px)**:
   - All icons within the action buttons (GitHub SVG, Star, MoreVertical, AlertCircle, AlertTriangle) are standardized to `w-4 h-4` (16px).
   - Discontinues arbitrary viewport expansion (`sm:w-5 sm:h-5`) for the error indicator, preserving geometric harmony and balanced visual weight.

### 2.13 Data Status Banner and Explicit Demo Policy (P0-3 / P0-7)

The first thing a viewer must be able to tell is **whether the numbers are real, stale, missing or fictional**. A failure that is rendered as "0" or as demo data is the worst failure mode of an analytics dashboard, so the status is surfaced at the top of `<main>` (`DataStatusBanner`, `data-testid="data-status-banner"`) before any chart.

1. **Banner items** (built by `buildDataStatusItems`, ordered error → warning → demo):
   | Level | Trigger | Wording (excerpt) |
   |:--|:--|:--|
   | `error` (red, `AlertCircle`, `role="alert"`) | `index.json` `source_status[]` has `status: failed` for a source of the active Live Metrics data | "{source}の取得に失敗しました" + "前回成功 (YYYY-MM-DD HH:MM UTC) のデータを表示しています。最新の値ではありません。" or, if it never succeeded, "該当する値は「—（未取得）」と表示されます" (+ cause) |
   | `warning` (yellow, `AlertTriangle`) | `status: partial` | "{source}の一部を取得できませんでした" + number of quarantined records excluded from the aggregation |
   | `demo` (amber, `FlaskConical`) | The active data is demo data (see 3 below) | "デモ（架空）データを表示しています" |
   - `ok` and `skipped` (not configured, not a fault) sources show nothing.
   - The level is conveyed by **icon + bracketed label (`[エラー]` / `[警告]` / `[デモ]`) + colour**, never by colour alone.
2. **A failure never becomes empty or demo.** When `index.json` cannot be fetched, the dashboard shows the error card (`データの読み込みに失敗しました`, with the attempted URL in the error log) and stops the loading spinner; it does **not** switch to demo data. The card carries an explicit **「デモデータを表示」** button (`data-testid="show-demo-data-button"`); the same button is offered in the "ライブ利用データはまだありません" empty state.
3. **Demo is explicit-only.** The data is treated as demo only when (a) the user chose it (header DEMO badge, the button above, `?demo=true`), (b) the data lives under the `/demo/` path, or (c) its `index.json` declares `is_mock_mode: true` (`pipeline:mock`). It is **never inferred** from the repository owner name, a seat count of 0 or the number of data days. Candidate data URLs for the current mode do not include the other mode's directory (`includeAlternateMode` is an explicit opt-in), so a missing live file can no longer be filled by demo JSON.
   - The header mode badge is a real toggle: `DEMO` → returns to live data, `LIVE` → shows demo data (always with an explicit boolean target, never an event object).
   - The banner shows **「実データを表示」** only when demo was chosen by the user; when the data itself declares `is_mock_mode`, there is nothing to switch back to, so the button is not offered.
   - User uploads (`user_upload`) are always treated as real data.

### 2.13a Data Quality in the Banner (P1-7)

`buildDataStatusItems` also reads `index.json` `data_quality` (SDD-05 §2.5) for Live Metrics data:

| Level | Trigger | Wording (excerpt) |
|:--|:--|:--|
| `warning` / `error` | latest level is not `ok` | "データ品質: 注意 (欠損日 N 日、隔離 N 件 …)" + "前回 (良好) から悪化しました。" or "{time} UTC からこの状態が続いています。" + link "品質の履歴 (JSON)" to `quality/history.json` |
| `info` (slate, `Info`) | recovered from a worse level | "データ品質: 回復しました" + link |
| `info` | metrics collected but no `data_quality` (artifact predates P1-7) | "データ品質: —（品質レポートがありません）" + the reason. Absence of information is never shown as "no problem" |

Steady `ok` quality shows nothing. A failed or unconfigured source shows no quality item (the failure banner above already says why).

### 2.14 Missing Values, Estimates and Scope Notices (P0-4 / P0-5 / P0-6 / P0-9)

Missing data is **`null`, shown as "—" with its reason — never `0`, never a plausible-looking constant** (SDD-06 §4.4).

| Situation | Display |
|:--|:--|
| Usage metrics (acceptance rate, chats, PRs, daily trend, languages) were not retrieved (`usage_metrics.availability: unavailable`, `overall_acceptance_rate: null`) | KPI shows "—"; the chart area shows "— 利用状況メトリクスを取得できていません" (`data-testid="usage-metrics-unavailable"`) with where to look (status banner / error details). No zero-filled chart is drawn. |
| The latest collection failed but an earlier success exists (`availability: carried_over`) | The previous values are shown with a **「前回値」** badge and the acquisition time (`as_of`). |
| A seat's `plan_type` is `unknown` (cost cannot be determined) | The per-seat cost cell shows "—" / "未確定" instead of $0, the drill-down shows "料金プランが未確定のため算定できません", the KPI card notes "料金プラン未確定 N 席は費用に含まれません", and the seat is excluded from totals and from "potential savings" (`IdleSeatAdvisor` notes this too). |
| A seat was assigned fewer than `SEAT_ONBOARDING_DAYS` (7) days ago and has not been used | Classified **導入期間 (onboarding)**, not idle: the KPI card shows "導入期間 N 席 (遊休に含まない)", the user table has an `onboarding` status filter, and the group chart has a dedicated "導入期間" series. |
| Idle criteria | Every place that mentions idle seats (KPI card, advisor header, section subtitle) renders the single constant `SEAT_IDLE_CRITERIA_TEXT` (SDD-06 §3) instead of a hard-coded "30 days". |
| A filter is active and a section cannot be re-aggregated per user (`usage_metrics`, `daily_trends`, `top_languages`, `agent_summary`, `code_generation_summary`, `outcome_indicators`; for reports `daily_trends`, `sku_breakdown`) | The section keeps its organisation-wide value and carries the badge **「全社値 (フィルター非対応)」** (`filter_notice.unfiltered_sections`), so it is not read as the same population as the filtered seat count. |
| A diagnostic pattern cannot be evaluated from the data source | See SDD-11 §6: shown as "判定不可" and excluded from the score, never "healthy". |

Hooks in these components obey the SDD-15 §6 rules (no hook after an early return); this is enforced by ESLint (`npm run lint`, also part of `npm test`).

### 2.14a Metric Registry and Quality Attributes (P2-3 / D-01)

Metrics are declared once in `src/domain/metrics/metric-registry.ts` (id, label ja/en, unit, window, filterability, sources, default quality). Every value carries a **quality attribute**, decided by `qualify()` with the priority **missing > demo > the definition's default**:

| Quality | Meaning | Display (`MetricValue`) |
|:--|:--|:--|
| `measured` | Measured value | Value only |
| `estimated` | Computed from criteria / unit prices (e.g. idle cost) | Value + **「推定」** badge (tooltip: reason) |
| `missing` | Not retrieved | "—（reason）" — never `0` |
| `demo` | Fictitious demo data | Value + **「デモ」** badge |

Badges always carry a text label (never colour alone). Missing wins over demo so that the absence of a value is never hidden. The overview KPI cards (spend, active rate, idle cost, acceptance rate) are migrated; other views migrate step by step. The metric catalog v1 (definition / window / source display) extends this registry in P3-1.

### 2.14b View Registry (P2-4 / C-01, D-06)

The View Registry is the **only entry point for rendering a view**. `App.tsx` has no per-view branch: it builds one `ViewContext` and renders `<ViewHost>`; the navigation is built from the same registry.

| Item | Where |
|:--|:--|
| Manifest (`ViewManifest`): id, label, title, description, icon, order, supported data sources, `requiredDatasets`, badge, `isVisible`, component | `dashboard/src/views/types.ts` |
| Registry (`createViewRegistry`, `getMissingDatasets`) | `dashboard/src/views/viewRegistry.ts` |
| Auto-collection of `views/<id>/manifest.ts` (`import.meta.glob`) | `dashboard/src/views/defaultRegistry.ts` |
| Rendering with Suspense | `dashboard/src/views/ViewHost.tsx` |

- **Adding a view = two files**: `views/<id>/manifest.ts` and `views/<id>/View.tsx`. Neither `App.tsx` nor `ViewNavigation` changes. `src/tests/view-registry.test.ts` shows this with a dummy view (`src/tests/fixtures/dummy-view/`).
- `order` sorts the navigation (ascending, ties keep registration order). `isVisible(ctx)` hides a view from both the navigation and the rendering (e.g. permission control). A duplicate id throws.
- `requiredDatasets` (`scope` / `report`) lists the inputs of the view; the view is renderable when **any one** is loaded (an empty list means data-independent). `getMissingDatasets` returns the missing ones so a reason can be shown; existing views keep rendering their own empty states (no behaviour change).
- Views receive everything through `ViewContext` (data, focus state, handlers); focus-reset rules (e.g. the radar model reset on tab click) stay in `App.tsx` handlers.
- The legacy `src/adapters/views/*` plugins were removed together with the DataStore path (P2-5).

### 2.15 Usage Insights in the User Detail Table (`UserDetailTable`)
- Columns after "Total Requests": **Tokens**, **Cost per 1M Tokens**, **Signal** (badge). All three are sortable and included in the CSV export (tokens split into input / output / cache read / cache write). A cell without data shows "—" with the reason in the tooltip (e.g. the CSV has no token columns).
- The **Signal** badge shows the level with a text label (never colour alone): 特記なし / 参考 / **確認を推奨** / データ不足. The tooltip lists the evidence of every signal that is `watch` or `review`. The checkbox **「確認を推奨のみ」** narrows the list to users whose overall level is `review`.
- Opening a row shows **使用量と効率** (`UsageInsightPanel`) above the drilldown: usage, tokens and coverage, unit costs, the evidence sentence per signal (S1–S5, SDD-06 §5.3), a tentative suggestion when the level is `review`, a daily bar chart, and the standing disclaimer (estimates from daily aggregates; conversation content is not read; not a personal evaluation).
- Wording rule: recommend, never accuse (no "不当" / "違反" / "問題").
- Live-metrics rows (Reports API) carry no token data, so the token columns show "—" with the reason; the signals are still computed from the daily history (S3 / S4 and, where available, others) with the same functions (§2.16).

### 2.16 One User Detail Format for Every Data Source and View
The user detail table has **one format**, whatever the data source (live metrics, monthly report, uploaded CSV) and whatever view hosts it (Overview, Users, Budget, monthly report view).

- **One component**: `UserDetailTable` is the only user detail table (`MonthlyReportUserTable` was removed). Call sites pass `data` (live) or `reportData` (monthly report); they differ only in the filter axis (`grouping`) and the callbacks.
- **One row model**: `buildLiveRows` / `buildReportRows` (`src/adapters/presenters/UserDetailRows.ts`) turn each source into `UserDetailRow`. Both produce **exactly the same keys**; a value the source does not have is `null` (or `false`), never 0.
- **Same columns, same order, same meaning**: `#`, User, Display Name, ユーザー定義Gr, Tag, Cost Center, Organization, Plan, Status, Primary Model, Requests, Suggestions, Acceptances, Inline Acceptance Rate, AI Chats, Tokens, Cost per 1M Tokens, Signal, Usage Cost, Excess Billing, Last Activity, Actions (22 columns, `USER_DETAIL_COLUMN_COUNT`). The CSV export has the same columns for every source.
- **Unavailable cells**: shown as "—" with the reason in the tooltip (e.g. "シート情報は月次レポートに含まれません", "トークン列のないデータです"). Columns are never hidden per source, so the table does not change shape when the source changes. The status filter is the one exception: it is shown only when the data has seat status.
- **Cost columns**: live shows the seat cost for the scope (daily / monthly / period); the monthly report shows the usage amount (gross) and the billable amount (net). The header states the unit (`利用費用 (月額)` / `利用費用 (月次)`). Live still shows the same value in both cost columns (pre-existing behaviour; the Reports API has no per-user billable amount).
- **Signals for live data**: computed by the same functions (SDD-06 §5) from the daily history of the measured profile; tokens are absent there, so S1 / S2 / S5 are "データ不足". The badge tooltip lists the signals that could not be evaluated, so "特記なし" is not read as "everything was checked".
- **Behavioural test**: `src/tests/user-detail-table-unified.test.ts` renders both sources and asserts identical headers and cell counts.

