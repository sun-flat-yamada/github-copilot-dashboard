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
The GitHub REST API adheres to calendar-based versioning. This platform defaults to the internal standard version **`2026-03-10`** while guaranteeing complete backward compatibility with the official GitHub GA calendar version **`2022-11-28`** (configurable via the `GITHUB_API_VERSION` environment variable or client config; an empty value falls back to the default).
All API requests must supply the following HTTP headers:

- `Authorization: Bearer <GITHUB_TOKEN>`
- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2026-03-10` (or `2022-11-28`)
- `User-Agent: GitHub-Copilot-Analytics-Platform/2026.09` (Mandatory per GitHub API specification)

**Rate Limiting & Detection Rules**:
Rate limits are indicated by HTTP `429 Too Many Requests` or HTTP `403 Forbidden` with header `x-ratelimit-remaining: 0`.
The client layer (`RawApiFetcher`) intercepts both status signals and raises a `RateLimitError`, pausing and scheduling exponential backoff based on the `x-ratelimit-reset` timestamp.

**Token resolution order**: explicit client config → `COPILOT_READ_TOKEN` (the secret the workflow provides) → `GITHUB_TOKEN` → `GH_TOKEN`. When no token is resolved, the client raises an authorization error **before sending any request** (no unauthenticated calls); the collector reports it as an `api_auth` issue naming `COPILOT_READ_TOKEN`, and the affected sources are recorded as `failed` (see SDD-05 §3).

**Failure vs. empty**: every `fetch*` of the data source returns an array and never throws; failures are expressed by the per-source status (`ok` / `partial` / `failed` / `skipped`, SDD-05 §3) plus `DataFetchIssue`s. Callers must not infer "failure" or "no data" from an empty array.

**Client contract and recording**: sources call the API only through `RawApiClient` (`fetchRaw` / `fetchRawAllowing` / `fetchPaginated` / `downloadSigned`). In live runs every response is landed immutably with a Run Manifest (SDD-05 §2.3) and can be replayed offline (`npm run pipeline:reprocess`, SDD-02 §2.8). Signed report URLs are recorded without their signature.

### 1.2 Permission levels & graceful fallback (Issue #234)

The `/enterprises/{enterprise}/...` endpoints (usage reports, billing seats, Cost Centers, AI credit usage) need an **enterprise owner / billing manager** token. A department administrator or an engineer usually holds organization-level permission only, and those endpoints answer **HTTP 403**. The collector then uses the scopes the token can read instead of failing:

| Level | Scope | Behavior |
| :--- | :--- | :--- |
| 1 | Enterprise (`COPILOT_ENTERPRISE`) | Tried first. Denial (401 / 403; for seats also 404; for usage reports a 404 on every day) is recorded as a `warning` (`api_auth` / `not_found`) when another scope is collected, and collection falls back to Level 2. |
| 2 | Organizations (`COPILOT_ORGS`) | Used as configured. When `COPILOT_ORGS` is **unset and the enterprise scope is denied**, or when `COPILOT_ORGS=auto`, the organizations are discovered with `GET /user/orgs` (paginated, called once per run and shared by metrics and seats). Usage reports and seats of every organization are merged and de-duplicated as in §2.1 / §3.1. |
| — | Enterprise-only features | Cost Centers (§4) and AI credit usage (§4a) answering 401 / 403 are recorded as `skipped` with one `warning` (`api_auth`, `http_status: 403`); cost allocation continues with the `cost_center` attribute of `COPILOT_USER_MAPPING` (SDD-04), and AI credit amounts with the Monthly Usage Report (CSV). |

- **Per-scope tolerance**: a scope denied with 401 / 403 (seats: also 404) is excluded and recorded as a `warning` naming the scope (`enterprise:<slug>` / `org:<slug>`) while the other scopes are collected; the source status is `partial`. When **no** scope can be read, the source is `failed` and the denial is an `error`.
- **Transient failures are not denials**: 5xx, 429 and network errors keep their previous semantics (seats: the whole source fails so a partial headcount is never published, §3.1).
- **Discovery failure**: `GET /user/orgs` needs a user token (classic PAT with `read:org`, or a fine-grained PAT); GitHub App installation tokens cannot call it. A failed or empty discovery is a `warning` on `config:org-discovery` and never fails a source by itself. A successful discovery is not an issue; the organizations actually collected are recorded in the Run Manifest (`config.orgs`) so that a reprocess requests the same endpoints.
- **Not configured**: with neither `COPILOT_ENTERPRISE` nor `COPILOT_ORGS`, no discovery is attempted and the sources stay `skipped` (no-credentials mode). Set `COPILOT_ORGS=auto` to opt in to discovery without an enterprise.
---

## 2. Copilot Metrics & Reports API

Retrieves usage metrics (IDE code completions, chat, PR summaries, CLI, agents, etc.) across an entire Enterprise or Organization.

### 2.1 Endpoint Architecture & Reports API (verified against the REST API description)
The legacy metrics endpoints (`/enterprises/{enterprise}/copilot/metrics`, `/orgs/{org}/copilot/metrics`) were sunset in April 2026 and are **not called**. The standard is the **Usage Metrics Reports API**: a request returns `{ report_day, download_links[] }` (1-day reports) or `{ report_start_day, report_end_day, download_links[] }` (28-day reports), and each link is a **signed, short-lived URL to an NDJSON file** (1 JSON object per line).

*Source: GitHub's REST API description (`api.github.com` / `ghec`, version `2026-03-10`, `github/rest-api-description`), checked 2026-10-01.*

| Report | Enterprise path | Organization path |
|:--|:--|:--|
| Aggregate, 1 day (`?day=YYYY-MM-DD`) | `/enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day` | `/orgs/{org}/copilot/metrics/reports/organization-1-day` |
| Aggregate, latest 28 days | `.../enterprise-28-day/latest` | `.../organization-28-day/latest` |
| **Per user, 1 day** (`?day=`) — **used** | `.../users-1-day` | `.../users-1-day` |
| Per user, latest 28 days | `.../users-28-day/latest` | `.../users-28-day/latest` |
| Per repository / per user-team, 1 day | `.../repos-1-day`, `.../user-teams-1-day` | same |

- **Availability**: reports exist from 2025-10-10; 1-day reports are available for up to 1 year back. The day must be complete (the latest day may not be generated yet → `404`; an organization may answer `204`).
- **Authentication** (PAT, per decision 2026-10-01): classic PAT with `manage_billing:copilot` or `read:enterprise` for the Enterprise reports (the caller must be an enterprise owner / billing manager, or hold the fine-grained "View Enterprise Copilot Metrics" permission); classic PAT with `read:org` for Organization reports (organization owner, or "View Organization Copilot Metrics").
- **The signed download link must be fetched without the `Authorization` header** (it points at object storage, not at `api.github.com`; sending the PAT there would leak it). The adapter also accepts `https` links only and caps the file size.
- **Collection**: the pipeline requests `users-1-day` for the Enterprise **and** for every configured (or discovered, §1.2) Organization, for each day of the 30 days ending yesterday (UTC), extended back to the first day of the current month if that is earlier, 3 requests in parallel. A user who appears in more than one scope on the same day is counted **once** (the Enterprise row wins, matched by `user_id`). The aggregate reports are not used: overall figures are derived from the de-duplicated user rows.
- **Status**: every day fetched → `ok`; some days or scopes failed, the enterprise scope was denied and the organization scope was used instead (§1.2), or rows were quarantined → `partial` (+ issue); not a single report could be read → `failed` (+ issue naming the required token scopes). A missing latest day alone is not an error.

#### Field mapping (users-1-day row → internal metrics)
Row fields (official names): `day`, `user_id`, `user_login`, `enterprise_id`, `organization_id`, `ai_credits_used`, `user_initiated_interaction_count`, `code_generation_activity_count`, `code_acceptance_activity_count`, `loc_suggested_to_add_sum`, `loc_suggested_to_delete_sum`, `loc_added_sum`, `loc_deleted_sum`, `used_agent` / `used_chat` / `used_cli` / `used_copilot_app` / `used_copilot_cloud_agent` (booleans) and the arrays `totals_by_ide`, `totals_by_feature`, `totals_by_language_feature`, `totals_by_language_model`, `totals_by_model_feature`. `feature` values include `code_completion`, `chat_inline`, `chat_panel_{ask,edit,agent,plan,custom,unknown}_mode`, `agent_edit`, `copilot_cli`, `copilot_app`, `others`; unknown values are kept, never dropped.

| Internal value | Source |
|:--|:--|
| Inline suggestions / acceptances / lines | `totals_by_feature[feature = code_completion]`: `code_generation_activity_count`, `code_acceptance_activity_count`, `loc_suggested_to_add_sum`, `loc_added_sum` (per language from `totals_by_language_feature`). Chat, CLI and agent activity are **never** mixed in (§2.2 surface isolation). |
| Chats | `user_initiated_interaction_count` summed over the `chat_*` features; models from `totals_by_model_feature` (chat features only) |
| CLI | `copilot_cli` interactions |
| AI credits | `ai_credits_used` (per user and day) |
| Lines added / deleted | row-level `loc_added_sum` / `loc_deleted_sum`; by mode from `totals_by_feature` |
| Active users | number of de-duplicated rows of the day |
| **Not provided** | PR summaries created (stored as `null`, shown "—"), chat copy / insertion events, agent session counts (the agent block is omitted rather than invented), and **tokens and session length** (token counts exist only in the billing *AI usage report*, see SDD-09 §3.5; no source carries session IDs or turn counts) |

Per-user profiles (daily history, totals, model use, 28-day credits) are built from the same rows; display name, department, Cost Center, organization and plan come from the seats and the attribute mapping (`enrichUserProfiles`).

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

### 2.3 Legacy Response Schema (retired endpoint; for reference only)

> The adapter no longer contains a schema or normalizer for this format: `metrics-schema.ts`, `teams-metrics-schema.ts`, `normalizers/metrics-2026-03-10.ts` and `normalizers/teams-2026-03-10.ts` were removed (Issue #241). The example is kept only to explain the field names of the internal `CopilotDailyMetrics` model, which the Reports API mapper (§2.1) still produces.

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

### 2.4 Team Metrics (derived; Issue #241)

The team endpoint of the retired API (`GET /orgs/{org}/teams/{team}/copilot/metrics`, sunset with the other `/copilot/metrics` endpoints in April 2026) is **not called**. `fetchTeamMetrics(teamSlug)` derives team figures from data the run has already collected:

- **Inputs**: the de-duplicated `users-1-day` rows of `fetchMetrics` (§2.1) and the seats of `fetchSeats` (§3). A user belongs to a team when the team's `slug` is in the seat's `assigning_teams`, or, when that list is absent or empty, equals `assigning_team.slug` (§3.2). Slugs and logins are compared case-insensitively. No additional API call is made.
- **Per day** (only days with at least one member row; no day is filled with 0): `total_active_users` = member rows; `total_engaged_users` = members with any activity; `total_code_suggestions` / `total_code_acceptances` = `code_completion` only; `total_chat_turns` = interactions of the `chat_*` features (the same per-user extraction as the organization-wide metrics, surface isolation §2.2); `ai_credits_used` = sum of `ai_credits_used`, omitted when no member row carries it. `total_agent_sessions` is never produced (the reports carry no session counts). `team_name` comes from the seat's team object.
- **Precondition / status**: call it after `fetchMetrics` and `fetchSeats`. When either has not run or failed, the result is empty and no issue is recorded (the failure is already reported on the `metrics` / `seats` sources).
- **Scope of "team"**: membership is the team **through which the seat was assigned**, not the full team membership; seats assigned directly to users belong to no team.
- **Why not `user-teams-1-day`**: the Reports API lists a per user-team report (§2.1), but its row schema is not recorded in this specification and could not be verified; fields are never guessed. Switching to it is a follow-up once its schema is confirmed against a real Enterprise (see "Unverified items" below).
- **DEMO**: `MockCopilotDataSource.fetchTeamMetrics` derives its rows the same way (seat `assigning_team` x the users' `daily_history`); it no longer returns a constant row with invented agent session counts.
- **Callers**: no pipeline step or view consumes team metrics yet; the method is an optional port (`ICopilotDataSource.fetchTeamMetrics`).

#### Unverified items (need a live Enterprise)
| Item | What must be confirmed |
| :--- | :--- |
| `user-teams-1-day` row schema | Field names and team identifiers of the per user-team report; whether its figures match the derivation above |
| `assigning_teams` | Whether the seat API returns `assigning_teams` (multiple teams) in addition to `assigning_team` for seats granted through several teams |
| Retired team endpoint | The exact status returned today by `GET /orgs/{org}/teams/{team}/copilot/metrics` (404 or 410); not called, so not relied on |

---

## 3. Copilot Seats API (Seat Assignments)

Retrieves all users assigned a Copilot seat, assignment timestamps, and last activity timestamps.

### 3.1 Endpoints
- Enterprise: `GET /enterprises/{enterprise}/copilot/billing/seats`
- Organization: `GET /orgs/{org}/copilot/billing/seats`
- Pagination: `per_page=100` and follow the `Link: <...>; rel="next"` response header until the last page. The next URL is followed **only when it has the same origin** as the API base URL (the `Authorization` header is never sent to another origin). A safety limit of 1,000 pages applies; reaching it raises a `data_integrity` warning ("the seat list may be incomplete").
- Integrity check: the sum of `total_seats` (first page of each target) is compared with the number of retrieved records; a mismatch raises a `data_integrity` warning and the source status becomes `partial`.
- Failure semantics: a target denied with 401 / 403 / 404 (no permission or not visible; retrying does not change it) is excluded with a `warning`, the seats of the other targets are used and the status is `partial`; when the enterprise target is denied and `COPILOT_ORGS` is unset, the organizations are discovered (§1.2). If **any** target fails transiently (5xx, 429, network) or no target can be read, the whole `seats` source is `failed` and an empty list is returned, so a partial headcount is never published as the current value (the pipeline keeps the last-known-good artifacts, SDD-05 §3). The `total_seats` check and the per-login merge use the targets actually read.

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

Cost Centers are an Enterprise Billing feature: for organization-only operation the source is recorded as `skipped` (not a failure). A token without enterprise billing permission (401 / 403) is also `skipped`, with a `warning`; allocation then uses the `cost_center` attribute of `COPILOT_USER_MAPPING` (§1.2). Other errors are `failed`.

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

### 4.3 Cost Center Budgets (not an API source; Issue #241)

- Spending limits and free tiers of Cost Centers are **not** read from GitHub. They come only from the administrator declaration `COPILOT_COST_CENTER_BUDGETS` (SDD-08, SDD-12) and are evaluated against the seat cost by the pipeline (`BillingCalculator.computeCostCenterBudgets`, SDD-06 §1.2). Nothing is generated or guessed.
- `GitHubApiCopilotDataSource.fetchCostCenterBudgets()` therefore returns an empty list **by contract**: it makes no HTTP request, records no issue and sets no source status (it is not a failure). The DEMO source returns generated budgets.
- **Unverified**: GitHub may offer a billing budgets REST endpoint for enterprises (for example under `/enterprises/{enterprise}/settings/billing/`). It is not recorded in this specification and its response could not be verified from the development environment, so it is not called and no field of it is modelled. Adopting it requires checking the endpoint, its permissions and whether a budget can be scoped to a Cost Center against a real Enterprise.

### 4a. AI Credit Usage API (Billing)

Verified against the REST API description (`ghec.2022-11-28.json`, via `raw.githubusercontent.com/github/rest-api-description`).

- `GET /enterprises/{enterprise}/settings/billing/ai_credit/usage` (Enterprise only; there is no organization form). Query: `year`, `month`, `day` (integers), `organization`, `user`, `model`, `product`, `cost_center_id`. Only the past 24 months are available. Requires enterprise administrator / billing manager (or fine-grained read access to enterprise billing); GitHub may answer 404 for insufficient permission.
- Response: `{ timePeriod: { year, month?, day? }, enterprise, user?, organization?, product?, model?, costCenter?, usageItems: [ { product, sku, model, unitType, pricePerUnit, grossQuantity, grossAmount, discountQuantity, discountAmount, netQuantity, netAmount } ] }`. No pagination and no signed URLs. The response does **not** state a currency.
- Adapter (`src/adapters/github-api/ai-credits/`): one request per report day (the same window as the Reports API), items validated one by one (an invalid item is quarantined, without echoing values; negative amounts are allowed because adjustments can be negative), a response for another period is rejected.
- Mapping: each item becomes a `fact.cost_line` (SDD-05 §2.4) with `user_key: null` (not fetched per user), `quantity = grossQuantity`, `unit_type` kept as returned (units are never added together), `currency: null` (not assumed), `source: "api"`.
- `SourceStatus` `ai_credits`: all days read → `ok`; some days failed or items quarantined → `partial`; no day readable → `failed` (with the permission hint); every request denied with 401 / 403 → `skipped` with one `warning` (§1.2); no enterprise configured → `skipped`; replaying an older run that never recorded the request → `skipped`. A failure never stops the other sources. Consuming the lines in aggregation is Phase 2.

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
