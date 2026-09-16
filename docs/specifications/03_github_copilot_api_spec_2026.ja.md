[English](03_github_copilot_api_spec_2026.md) | [日本語](03_github_copilot_api_spec_2026.ja.md)

---

# SDD-03: GitHub Copilot API & データモデル仕様書 (2026年9月最新版)

- **文書番号**: SPEC-COPILOT-003
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-10

---

## 1. 2026年時点のGitHub API概要

2026年9月時点で利用可能なGitHub Copilot関連の公式REST API仕様を定義する。

### 1.1 APIバージョンおよび共通HTTPリクエストヘッダー
GitHub REST API はカレンダーベースのバージョン体系を採用しており、本プラットフォームは公式の最新APIバージョンである **`2026-03-10`** に準拠する。
すべてのAPIリクエストには以下のヘッダーを付与する：

- `Authorization: Bearer <GITHUB_TOKEN>`
- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2026-03-10`（最新バージョン、環境変数 `GITHUB_API_VERSION` またはクライアント設定で変更可能）
- `User-Agent: GitHub-Copilot-Analytics-Platform/2026.09`

---

## 2. Copilot Metrics API

組織またはEnterprise全体の日次利用メトリクス（コード補完、チャット、PRサマリー、CLI等）を取得する。

### 2.1 エンドポイント
- Enterprise: `GET /enterprises/{enterprise}/copilot/metrics`
- Organization: `GET /orgs/{org}/copilot/metrics`
- クエリパラメータ: `since` (ISO 8601 YYYY-MM-DD), `until` (ISO 8601 YYYY-MM-DD)

### 2.2 レスポンススキーマ (日次配列)

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

## 3. Copilot Seats API (シート割当)

シートを付与されているユーザー一覧、付与日、最終アクティビティ日を取得する。

### 3.1 エンドポイント
- Enterprise: `GET /enterprises/{enterprise}/copilot/billing/seats`
- Organization: `GET /orgs/{org}/copilot/billing/seats`
- ページネーション: `per_page=100`, `page=1, 2, ...`

### 3.2 レスポンススキーマ

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
  }
}
```

---

## 4. GitHub Enterprise Cost Centers API

GitHub EnterpriseのBilling機能である「Cost Center」一覧とリソース紐付けを取得する。

### 4.1 エンドポイント
- `GET /enterprises/{enterprise}/settings/billing/cost-centers`
- `GET /enterprises/{enterprise}/settings/billing/cost-centers/{cost_center_id}`

### 4.2 レスポンススキーマ

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

## 5. 課金モデル & 料金テーブル (2026年9月基準)

| プラン / 機能 | 月額単価 (USD) | 日割り計算基準 (USD / 日) | 備考 |
|---|---|---|---|
| **Copilot Business** | \$19.00 / seat | \$19.00 / 暦日数 (例: 30日の月は \$0.633) | 基本IDE補完・チャット |
| **Copilot Enterprise** | \$39.00 / seat | \$39.00 / 暦日数 (例: 30日の月は \$1.300) | 社内ナレッジ連携、PRサマリー、CLI等 |
| **遊休シート (Idle Seat)** | 各プランの満額 | 同上 | 過去14日/30日以上未利用でも契約費用が発生 |
