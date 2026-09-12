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

### FR-3: Multi-Scope Analysis Switching
The aggregation engine and dashboard must support rapid switching between time scopes:
- **Daily Scope**: Daily active users, activity status, and prorated daily expense for any selected date.
- **Monthly Scope**: Calendar month (YYYY-MM) cumulative costs, MAU, and idle seat expenses.
- **Custom Date Range Scope**: Trend curves, acceptance rates, and cumulative costs across any user-defined start and end dates.

### FR-4: Cost Optimization & Idle Seat Detection
- Identify seats with no activity for $N$ days (defaults: 14 / 30 days) as "Idle Seats", quantifying wasted monthly and annualized costs.
- Provide exportable recommendation lists for license reclamation and reassignment.

### FR-5: Auto-Updating GitHub Pages Dashboard
- Automated GitHub Actions execution (cron workflow: daily at UTC 00:00) to fetch, aggregate, build, and deploy the dashboard to GitHub Pages.
- Support manual triggers via `workflow_dispatch`.
- Built as a high-speed client-side Single Page Application (SPA).

---

## 4. Non-Functional Requirements

### NFR-1: Fork-Safe Data Persistence (Orphan Branch & Append-Only)
- Absolute zero commit conflicts when forks run `Sync Fork` or create PRs against upstream `main`.
- Prohibit data commits to code branches (`main`).
- Store data in a dedicated orphan branch (`copilot-data`) using immutable date-partitioned files (`data/raw/YYYY/MM/...`). Deploy to GitHub Pages via official artifact deployment (`actions/deploy-pages`).

### NFR-2: Security & Principle of Least Privilege
- Restrict GitHub API credentials (Fine-grained PAT or GitHub App) to minimum required scopes (`copilot:read`, `enterprise_billing:read`, `org:read`).
- Provide anonymization/masking options via environment variables to protect personal identities on public deployments.

### NFR-3: Offline & Mock Support
- Support full local and CI simulation via 2026 specification-compliant mock generators without live GitHub Enterprise credentials.

### NFR-4: Portability & Maintainability
- 100% type safety with Node.js 20+ and TypeScript.
- Zero external database dependencies (no PostgreSQL or RDS required); entirely serverless with GitHub Actions and GitHub Pages.
