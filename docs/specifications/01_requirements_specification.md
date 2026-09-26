[English](01_requirements_specification.md) | [日本語](01_requirements_specification.ja.md)

---

# SDD-01: GitHub Copilot Usage & Cost Analytics Requirements Specification

- **Document ID**: SPEC-COPILOT-001
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-10

---

## 1. Background & Purpose

As enterprise adoption of GitHub Copilot (Copilot Business / Copilot Enterprise) accelerates, organizations encounter several critical management and operational challenges:

1. **Difficulty in Accurate Departmental Cost Allocation (Chargeback / Showback)**:
   GitHub Enterprise invoices at the Organization or Cost Center level. However, apportioning expenses to custom internal accounting groups (e.g., HR departments, project codes, development squads, or contractor teams) is difficult.
2. **License Inactivity & Opaque Return on Investment (ROI)**:
   Many assigned seats sit unused for weeks or months ("Idle Seats"), causing recurring waste of license budgets without visibility.
3. **Merge Conflicts When Operating via Forks or Open Source**:
   When an enterprise forks an analytics repository or shares templates across parent/child organizations, committing data files directly to `main` results in severe Git merge conflicts, blocking upstream synchronizations and PRs.
4. **Privacy & Compliance (Risk of Sensitive Information Leaks)**:
   If mapping tables containing employee names, staff IDs, and internal team assignments are committed to public Git logs, privacy violations and security incidents occur.

This platform resolves these challenges by adhering strictly to the September 2026 GitHub Copilot API and GitHub Enterprise specifications, providing **3-axis group allocation (Org, Cost Center, Arbitrary User Attributes)**, **fork-safe data persistence**, and an **auto-updating GitHub Pages dashboard**.

---

## 2. Target Systems & Prerequisites (as of September 2026)

### 2.1 GitHub Copilot Plans & Billing Model
- **Copilot Business**: \$19.00 / seat / month
- **Copilot Enterprise**: \$39.00 / seat / month
- **Add-ons / Premium Models & Metered Usage**:
  Multi-model Copilot usage (Claude 3.7 Sonnet, GPT-4o, o1, Gemini 2.0 Flash, etc.), Copilot Workspace, and Pull Request summaries consumption metrics.

### 2.2 Target API Endpoints
1. **Copilot Metrics API**:
   - `GET /enterprises/{enterprise}/copilot/metrics`
   - `GET /orgs/{org}/copilot/metrics`
   - Daily active users, acceptance rates, suggested/accepted lines, IDE chat, CLI, and PR summary aggregates.
2. **Copilot User Seats API**:
   - `GET /enterprises/{enterprise}/copilot/billing/seats`
   - `GET /orgs/{org}/copilot/billing/seats`
   - User seat assignments, creation timestamps, `last_activity_at`, editors, and plan types.
3. **GitHub Enterprise Cost Centers API**:
   - `GET /enterprises/{enterprise}/settings/billing/cost-centers`
   - Cost Center definitions and associated resources (Organizations, Users, Repositories).

---

## 3. Functional Requirements

### FR-1: Flexible 3-Axis Multidimensional Aggregation
The system must allow seamless switching and analysis of usage data and costs across 3 dimensions:
1. **GitHub Organization Axis**: Cross-organization comparison and aggregation.
2. **GitHub Cost Center Axis**: Aggregation by Cost Centers defined in GitHub Enterprise Billing.
3. **Arbitrary User Attribute Group Axis**: Aggregation by internal departments, projects, or employment classifications.

### FR-2: Zero-Leakage User Attribute Mapping (GitHub Variables)
- User attribute records (`github_user`, `display_name`, `department / cost_group`, `notes`) **must never be committed to Git**.
- Injected at runtime via GitHub Actions **Repository / Organization Variable (`COPILOT_USER_MAPPING`)** or **Secret (`COPILOT_USER_MAPPING`)**.
- Fallback gracefully to "Unassigned" and GitHub login handles when mappings are omitted.

### FR-3: Multi-Source & Multi-Scope Analysis Switching
The aggregation engine and dashboard must support rapid switching between data sources and time scopes:
1. **Active Data Source Switching (`ActiveDataSelector`)**:
   - **Live Metrics (API-Synced Auto Collection)**: Rolling past 1 year (12 months) and rolling past 30 days daily metrics.
   - **Monthly Usage Report**: Immutable persisted monthly usage reports (CSV-derived).
   - **User Upload File (On-demand)**: In-browser memory analysis of user-provided CSV/JSON reports (Zero-Leakage).
2. **Time Scope Switching**:
   - **Daily Scope**: Daily active users, activity status, and prorated daily expense for any selected date in the past 30 days.
   - **Monthly Scope**: Calendar month (YYYY-MM) cumulative costs, MAU, and idle seat expenses for the past 12 rolling months.
   - **Custom Date Range Scope**: Trend curves, acceptance rates, and cumulative costs across 30-day or 1-year windows.

### FR-4: Cost Optimization & Idle Seat Detection
- Identify seats with no activity for $N$ days (defaults: 14 / 30 days) as "Idle Seats", quantifying wasted monthly and annualized costs.
- Provide exportable recommendation lists for license reclamation and reassignment.

### FR-5: Auto-Updating GitHub Pages Dashboard
- Automated GitHub Actions execution (cron workflow: daily at UTC 00:00) to fetch, aggregate, build, and deploy the dashboard to GitHub Pages.
- Support manual triggers via `workflow_dispatch`.
- Built as a high-speed client-side Single Page Application (SPA).

### FR-6: Multi-Tag AND Filtering (`TagFilterBar`)
- Dynamically extract distinct tags from user group mapping `tags` attribute (e.g. `["Full-time", "Remote", "AI-Champion"]`) and permit multi-tag selection.
- Apply **AND logic (must match all selected tags)** to dynamically re-aggregate KPI summary cards, group allocations, rankings, detail tables, and deep analytics.

### FR-7: Single-Column Vertical Stack Layout & Progressive Disclosure
- Enforce a strict **single-column vertical stack (`flex flex-col space-y-6 w-full`)**, prohibiting horizontal multi-column splits (2-3 columns).
- Implement progressive disclosure via accordion sections: Block 0 (Executive Summary) is expanded by default, subsequent blocks start collapsed showing title, icon, and summary chips.
- Provide global `[Expand All]` and `[Collapse All]` controls.

### FR-8: 9 Dedicated Analysis Views Navigation (`ViewNavigation`)
- Transition from legacy mode switching to 9 dedicated purpose-built plugin views:
  1. `overview` (Executive Cost Allocation & Summary)
  2. `users` (User Details & Activity Breakdown)
  3. `trend` (User Model Trends & Acceptance Metrics)
  4. `budget` (Cost Center Budget Tracking & FinOps)
  5. `deep_analysis` (Deep Diagnostics & 9 Inefficiency Behavioral Rules)
  6. `model_radar` (AI Model Characteristic Benchmark Radar)
  7. `credits` (GitHub AI Credits & Consumption Analysis)
  8. `agent` (AI Agent & MCP Activity Dynamics)
  9. `adoption` (AI Adoption Maturity Cohorts & Impact Dashboard)
- Dynamically enable or disable views according to data source compatibility and ViewPluginRegistry contracts (`canRender`).

### FR-9: GitHub AI Credits & Shared Pool Consumption
- Visualize shared organizational credits consumption (3,900 credits/seat monthly allowance), token-equivalent cost conversions ($0.01/credit), and monthly user quota limits (`ai_credits_limit_monthly`).
- Automatically aggregate base seat costs and credits overages into Total Combined Cost with cost center budget attribution.

### FR-10: AI Agent, MCP Tools & PR Lifecycle Metrics
- Track sessions, message volume, and invocations across VS Code Agent, custom agents, 3rd-party agents, MCP (Model Context Protocol) servers, skills, and slash commands.
- Quantify coding agent outcomes through automated PR creation, merge volume, and median merge duration (`outcome_indicators`).

### FR-11: Adoption Maturity Cohorts (GitHub Impact Dashboard Alignment)
- Classify all evaluated users into 4 standardized maturity cohorts (`no_cohort`, `code_first`, `agent_first`, `multi_agent`).
- Provide organizational maturity pyramid distributions and team-level cohort portfolio metrics to support strategic AI enablement.

### FR-12: Cross-View Data-Centric Reactivity
- Every analysis View (FR-8) must render its displayed content (KPI figures, default selections, charts, derived usage percentages, etc.) as a **pure function of "the analysis target data the user currently has actively selected"** — i.e., the combination of the active data source type (FR-3-1) × time/group scope (FR-3-2) × Tag AND filter (FR-6).
- When a View is already mounted and visible and the user changes only the scope or tag filter (without revisiting the View tab itself), that View's displayed content, default selections, and derived aggregates **must immediately recompute and track the change without requiring a remount**. Implementations that "compute once on first render and never again" violate this requirement.
- When a computed value has a cross-data-source fallback path (e.g., falling back to Monthly Usage Report aggregates when Live Metrics data is empty), **the fallback path must equally honor the active filters**. Being a "fallback" path is never a valid excuse for ignoring filter state.
- The detailed design policy, implementation conventions, and known anti-patterns for satisfying this requirement are defined in [SDD-15: Data-Centric Reactivity Design Specification](15_data_centric_reactivity_design_spec.md).

### FR-13: FinOps Dynamic Multi-Currency & Enterprise Agreement (EA) Pricing
- Enforce permanent USD ($) primary display across all 9 analysis views, KPI summary cards, charts, and user tables, with optional secondary sub-currency display in parentheses (e.g. `$2,975.00 (¥461,125)` or `$100.00 (€92.00)`).
- Provide a header Currency Selector allowing viewers to dynamically toggle sub-currency display (USD Only / USD + JPY / USD + EUR) in real time with localStorage persistence.
- Enable volume discount percentage application (0-100%) and direct enterprise contract unit rate overrides (e.g., custom credit rate such as `1.273 JPY / AIC` with arbitrary precision or custom seat pricing). Direct contract rates shall always take highest priority over calculated discounts.
- Seamlessly inject configuration via environment variable `COPILOT_BILLING_CONFIG` or `data/config/billing.json`, with safe fallback to default standard USD rates when omitted.

---

## 4. Non-Functional Requirements

### NFR-1: Fork-Safe Data Persistence & Perpetual Accumulation (1-Year Rolling Scope)
- Absolute zero commit conflicts when forks run `Sync Fork` or create PRs against upstream `main`.
- Prohibit data commits to code branches (`main`).
- Store data in a dedicated orphan branch (`copilot-data`) using immutable date-partitioned files with **perpetual unlimited accumulation**.
- Present dashboard index (`index.json`) scoped to a **rolling 1-year window (past 12 months + past 30 days)**, backed by a pre-aggregated trend file (`trends/rolling-1year.json`) and monthly deep analysis archives (`deep-analysis/{YYYY-MM}.json`) to optimize SPA network payload and render latency.
- Deploy to GitHub Pages via official artifact deployment (`actions/deploy-pages`).

### NFR-2: Security & Principle of Least Privilege
- Restrict GitHub API credentials (Fine-grained PAT or GitHub App) to minimum required scopes (`copilot:read`, `enterprise_billing:read`, `org:read`).
- Provide anonymization/masking options via environment variables to protect personal identities on public deployments.
- Apply AES-256 symmetric GPG encryption for enterprise user mappings exceeding GitHub's 48KB secret limit, isolating encrypted blobs to `copilot-data` and decrypting strictly into ephemeral `$RUNNER_TEMP` (see [GPG Key Management & Operational Guide](../security/01_gpg_key_management_and_user_mapping_guide.md)).

### NFR-3: Offline & Mock Support
- Support full local and CI simulation via 2026 specification-compliant mock generators without live GitHub Enterprise credentials.

### NFR-4: Portability & Maintainability
- 100% type safety with Node.js 20+ and TypeScript.
- Zero external database dependencies (no PostgreSQL or RDS required); entirely serverless with GitHub Actions and GitHub Pages.

### NFR-5: Frontend Code Splitting & Performance Optimization
- Maintain initial entry JavaScript bundle at **< 300 kB (< 80 kB gzip)**.
- Dynamically split and lazy-load heavy analysis views (Model Radar, Deep Analysis, Credits, Agent Activity, Adoption Maturity) via `React.lazy` and `<Suspense>` to ensure near-instant initial render.
- Provide a unified skeleton placeholder (`ViewSkeleton`) to prevent visual layout shifts during dynamic chunk loading.

### NFR-6: Strict Browser/Node Repository Isolation
- Ensure frontend repositories (`HttpJsonMetricsRepository`) rely purely on browser-native `fetch` APIs without references to Node.js `fs` or `path` modules.
- Guarantee 0 build warnings from Vite regarding Node.js module externalization (`Module "fs" has been externalized`).

