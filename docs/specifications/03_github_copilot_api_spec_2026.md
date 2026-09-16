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
- `X-GitHub-Api-Version: 2026-03-10` (latest version, configurable via `GITHUB_API_VERSION` environment variable or client config)
- `User-Agent: GitHub-Copilot-Analytics-Platform/2026.09`

---

## 2. Copilot Metrics API

Retrieves daily aggregated usage metrics (code completion, chat, PR summaries, CLI, etc.) across an entire Enterprise or Organization.

### 2.1 Endpoints
- Enterprise: `GET /enterprises/{enterprise}/copilot/metrics`
- Organization: `GET /orgs/{org}/copilot/metrics`
- Query Parameters: `since` (ISO 8601 YYYY-MM-DD), `until` (ISO 8601 YYYY-MM-DD)

### 2.2 Response Schema (Daily Array)

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
- Pagination: `per_page=100`, `page=1, 2, ...`

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

---

## 4. GitHub Enterprise Cost Centers API

Retrieves Cost Centers defined in GitHub Enterprise Billing and their mapped resources.

### 4.1 Endpoints
- `GET /enterprises/{enterprise}/settings/billing/cost-centers`
- `GET /enterprises/{enterprise}/settings/billing/cost-centers/{cost_center_id}`

### 4.2 Response Schema

```json
{
  "cost_centers": [
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
| **Idle Seat** | Full plan price | Same as above | Contract fees incurred even when inactive for 14/30+ days |
