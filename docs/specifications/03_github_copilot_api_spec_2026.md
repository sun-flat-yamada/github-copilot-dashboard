[English](03_github_copilot_api_spec_2026.md) | [日本語](03_github_copilot_api_spec_2026.ja.md)

---

# SDD-03: GitHub Copilot API & Data Model Specification (September 2026 Edition)

- **Document ID**: SPEC-COPILOT-003
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-10

---

## 1. Overview of GitHub APIs (as of 2026)

Defines the official GitHub REST API specifications for GitHub Copilot and Enterprise Billing available as of September 2026.

### 1.1 API Versioning and Common HTTP Request Headers
The GitHub REST API adheres to calendar-based versioning. This platform complies with the latest official REST API version: **`2026-03-10`**.
All API requests must supply the following HTTP headers:

- `Authorization: Bearer <GITHUB_TOKEN>`
- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2026-03-10` (latest version, configurable via `GITHUB_API_VERSION` environment variable or client config; an empty value falls back to the default)
- `User-Agent: GitHub-Copilot-Analytics-Platform/2026.09`

**Token resolution order**: explicit client config → `COPILOT_READ_TOKEN` (the secret the workflow provides) → `GITHUB_TOKEN` → `GH_TOKEN`. When no token is resolved, the client raises an authorization error **before sending any request** (no unauthenticated calls); the collector reports it as an `api_auth` issue naming `COPILOT_READ_TOKEN`, and the affected sources are recorded as `failed` (see SDD-05 §3).

**Failure vs. empty**: every `fetch*` of the data source returns an array and never throws; failures are expressed by the per-source status (`ok` / `partial` / `failed` / `skipped`, SDD-05 §3) plus `DataFetchIssue`s. Callers must not infer "failure" or "no data" from an empty array.

---

## 2. Copilot Metrics & Reports API

Retrieves usage metrics (IDE code completions, chat, PR summaries, CLI, agents, etc.) across an entire Enterprise or Organization.

### 2.1 Endpoint Architecture & Reports API (Latest as of September 2026)
As of April 2026, the legacy metrics endpoint (`/orgs/{org}/copilot/metrics`) was fully deprecated and sunset. The current standard utilizes the **Usage Metrics Reports API**, which returns signed download links pointing to NDJSON data files.

- **Enterprise Reports**:
  - `GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day` (Daily NDJSON signed link)
  - `GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-28-day/latest`
- **Organization Reports**:
  - `GET /orgs/{org}/copilot/metrics/reports/organization-1-day`
  - `GET /orgs/{org}/copilot/metrics/reports/organization-28-day/latest`
- **User-Level Reports**:
  - `GET /orgs/{org}/copilot/metrics/reports/users-1-day`
  - `GET /orgs/{org}/copilot/metrics/reports/users-28-day/latest`

### 2.2 Telemetry Definition of Inline Completion Acceptance Rate & Surface Isolation

#### (1) Inline Completion Acceptance Rate Formulas
In GitHub Copilot telemetry, acceptance rate is derived from IDE inline ghost-text counters. To avoid ambiguity with agentic and CLI workflows, this system explicitly denotes and tracks this metric as **Inline Completion Acceptance Rate**:
- **Inline Suggestion Acceptance Rate**:
  $$\text{Inline Acceptance Rate} = \frac{\text{total\_code\_acceptances}}{\text{total\_code\_suggestions}} \times 100\%$$
- **Inline Lines Acceptance Rate (Volume / Utilization)**:
  $$\text{Inline Lines Acceptance Rate} = \frac{\text{total\_code\_lines\_accepted}}{\text{total\_code\_lines\_suggested}} \times 100\%$$

#### (2) Telemetry Trigger Logic & Implicit Rejections
- **Suggestions**: Incremented when Copilot displays ghost text (inline gray completion preview) in the editor buffer upon keystrokes or debounce pauses.
- **Acceptances**: Incremented when the user commits the ghost text by pressing `Tab` (or the configured accept key).
- **Implicit Rejections**: If ghost text is displayed and the user types through it without pressing Tab, hits `Esc`, or navigates away via arrow keys, the event is recorded as a rejection—**incrementing the denominator (`total_code_suggestions`) without incrementing acceptances**.

#### (3) Surface Isolation Principle
- **IDE Code Completions Only**: Acceptance rates exclusively measure inline ghost-text completions (`copilot_ide_code_completions`).
- **Exclusion of CLI, Chat, and Agent Actions**: Activity in GitHub Copilot CLI (`copilot_in_cli`), Copilot Chat, and autonomous agent/autopilot tool executions (patches, file edits, shell tool calls) is tracked separately and is **never** included in the completion acceptance rate counters.

### 2.3 Response Schema (Daily Array / Report Structure)

```json
[
  {
    "date": "2026-09-09",
    "total_active_users": 142,
    "total_engaged_users": 128,
    "copilot_ide_code_completions": {
      "total_engaged_users": 120,
      "languages": [
        {
          "name": "typescript",
          "total_engaged_users": 85,
          "total_code_suggestions": 12450,
          "total_code_acceptances": 4120,
          "total_code_lines_suggested": 85400,
          "total_code_lines_accepted": 28900
        },
        {
          "name": "python",
          "total_engaged_users": 62,
          "total_code_suggestions": 9800,
          "total_code_acceptances": 3200,
          "total_code_lines_suggested": 64200,
          "total_code_lines_accepted": 21800
        }
      ],
      "editors": [
        { "name": "vscode", "total_engaged_users": 105 },
        { "name": "jetbrains", "total_engaged_users": 23 }
      ]
    },
    "copilot_ide_chat": {
      "total_engaged_users": 98,
      "total_chats": 1840,
      "total_chat_copy_events": 430,
      "total_chat_insertion_events": 620,
      "models": [
        { "name": "claude-3-7-sonnet", "total_chats": 1100 },
        { "name": "gpt-4o", "total_chats": 540 },
        { "name": "o1", "total_chats": 200 }
      ]
    },
    "copilot_dotcom_chat": {
      "total_engaged_users": 45,
      "total_chats": 310
    },
    "copilot_dotcom_pull_requests": {
      "total_engaged_users": 68,
      "total_pr_summaries_created": 115
    },
    "copilot_in_cli": {
      "total_engaged_users": 28,
      "total_cli_completions": 420
    }
  }
]
```

---

## 3. Copilot Seats API (Seat Assignments)

Retrieves all users assigned a Copilot seat, assignment timestamps, and last activity timestamps.

### 3.1 Endpoints
- Enterprise: `GET /enterprises/{enterprise}/copilot/billing/seats`
- Organization: `GET /orgs/{org}/copilot/billing/seats`
- Pagination: `per_page=100` and follow the `Link: <...>; rel="next"` response header until the last page. The next URL is followed **only when it has the same origin** as the API base URL (the `Authorization` header is never sent to another origin). A safety limit of 1,000 pages applies; reaching it raises a `data_integrity` warning ("the seat list may be incomplete").
- Integrity check: the sum of `total_seats` (first page of each target) is compared with the number of retrieved records; a mismatch raises a `data_integrity` warning and the source status becomes `partial`.
- Failure semantics: if **any** target (enterprise / one of the orgs) fails, the whole `seats` source is `failed` and an empty list is returned, so a partial headcount is never published as the current value (the pipeline keeps the last-known-good artifacts, SDD-05 §3).

### 3.2 Response Schema

```json
{
  "total_seats": 160,
  "seats": [
    {
      "created_at": "2026-01-15T09:00:00Z",
      "updated_at": "2026-08-01T12:00:00Z",
      "pending_cancellation_date": null,
      "last_activity_at": "2026-09-09T18:32:10Z",
      "last_activity_editor": "vscode/1.110.0/copilot/1.240.0",
      "plan_type": "enterprise",
      "assignee": {
        "login": "tanaka-taro",
        "id": 10001,
        "avatar_url": "https://avatars.githubusercontent.com/u/10001?v=4",
        "html_url": "https://github.com/tanaka-taro",
        "type": "User"
      },
      "assigning_team": {
        "id": 501,
        "name": "Backend Engineers",
        "slug": "backend-engineers"
      },
      "organization": {
        "login": "corp-core-engineering",
        "id": 901
      }
    }
  ]
}
```

#### Field handling rules (record-level validation)

- Records are validated **one by one**. A record that fails validation is quarantined (excluded from aggregation) and reported as a `data_integrity` warning that lists the record position and the schema path only — never the record values. One malformed record no longer discards the whole batch.
- `plan_type`: `business` / `enterprise`. A missing or unrecognized value (including `unknown`) is preserved as `unknown` and raises a warning; the seat cost is treated as **unconfirmed** (not estimated as Enterprise, SDD-06 §1.1).
- `organization`: may be `null` (seats assigned directly at the enterprise level). It is preserved and the seat is grouped as unassigned, with a warning.
- `updated_at`: deprecated and may be absent; `created_at` is used as the fallback.
- `seat_status`: an unknown future value does not invalidate the record.
- Schema validation errors (Zod) are classified as `data_integrity`; HTTP 401/403 → `api_auth`; 404 → `not_found` (warning); 429 → `rate_limit`; others → `server_error`.

---

## 4. GitHub Enterprise Cost Centers API

Retrieves Cost Centers defined in GitHub Enterprise Billing and their mapped resources.

### 4.1 Endpoints
- `GET /enterprises/{enterprise}/settings/billing/cost-centers`
- `GET /enterprises/{enterprise}/settings/billing/cost-centers/{cost_center_id}`

### 4.2 Response Schema

The documented response key is `costCenters`; the legacy key `cost_centers` and a bare array are also accepted. Each record needs `id` and `name`; `cost_center_code` and `state` are optional (the public API does not return `cost_center_code`). Cost Centers whose `state` is `deleted` are excluded from allocation. `resources[].type` aliases are normalized to the domain kinds (`Organization` → `Org`, `Repo` → `Repository`, `User`); unknown kinds are kept as-is.

Cost Centers are an Enterprise Billing feature: for organization-only operation the source is recorded as `skipped` (not a failure).

```json
{
  "costCenters": [
    {
      "id": "cc-eng-001",
      "name": "Platform-Engineering",
      "cost_center_code": "COST-8812",
      "resources": [
        { "type": "Org", "name": "corp-core-engineering" },
        { "type": "User", "name": "tanaka-taro" }
      ]
    },
    {
      "id": "cc-data-002",
      "name": "AI-and-Data-Platform",
      "cost_center_code": "COST-9921",
      "resources": [
        { "type": "Org", "name": "corp-ai-lab" }
      ]
    }
  ]
}
```

---

## 5. Billing Model & Pricing Table (September 2026 Baseline)

| Plan / Feature | Monthly Price (USD) | Prorated Daily Rate (USD / day) | Notes |
|---|---|---|---|
| **Copilot Business** | \$19.00 / seat | \$19.00 / calendar days (e.g., \$0.633 in a 30-day month) | Standard IDE completion & Chat |
| **Copilot Enterprise** | \$39.00 / seat | \$39.00 / calendar days (e.g., \$1.300 in a 30-day month) | Internal knowledge base, PR summaries, CLI, etc. |
| **Idle Seat** | Full plan price | Same as above | Contract fees incurred even when idle (see SDD-06 §3 for the exact criteria) |
| **AI Credit** | \$0.01 / credit | — | Usage-based billing since 2026-06-01 (single unit price on every calculation path) |

### 5.1 Pricing Catalog (single source of prices)

All prices are defined in one module, `src/domain/pricing/pricing-catalog.ts`; no other module may embed a price. Enterprise-specific contract prices and discounts (`COPILOT_BILLING_CONFIG`, SDD-06 §1.3) override the catalog defaults.

| Item | Baseline | Transition promotion (2026-06 to 2026-08) |
|---|---|---|
| Seat price (Business / Enterprise) | \$19 / \$39 per seat per month | same |
| AI Credit unit price | \$0.01 | same |
| Included credits per seat per month (Business / Enterprise) | 1,900 / 3,900 | 3,000 / 7,000 |

- Included credits are **plan-specific and period-specific** and form a pool **per billing entity** (sum over all seats). A seat whose plan is `unknown` contributes nothing to the pool and is counted as "plan unconfirmed".
- The catalog values are **provisional**: they were established from publicly available summaries because the primary sources could not be fetched; they are re-verified against GitHub's documentation when the catalog is versioned in Phase 1 (`PRICING_CATALOG_VERSION` identifies the revision).
- The previous per-service defaults (a separate \$0.05 per credit in `CreditsBillingService`, a fixed 3,900 included credits for all plans) were removed: the same consumption produced amounts that differed by 5x depending on the path.
