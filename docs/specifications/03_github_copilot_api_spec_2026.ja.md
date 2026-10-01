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
- `X-GitHub-Api-Version: 2026-03-10`（最新バージョン、環境変数 `GITHUB_API_VERSION` またはクライアント設定で変更可能。空の場合は既定値）
- `User-Agent: GitHub-Copilot-Analytics-Platform/2026.09`

**トークンの解決順**: クライアント設定の明示指定 → `COPILOT_READ_TOKEN`（ワークフローが渡すシークレット）→ `GITHUB_TOKEN` → `GH_TOKEN`。トークンが解決できない場合、クライアントは **リクエストを送る前に** 認可エラーを返す（無認証の呼び出しは行わない）。収集側は `COPILOT_READ_TOKEN` を明示した `api_auth` の issue として報告し、該当ソースを `failed` として記録する（SDD-05 §3）。

**失敗と「データなし」の区別**: データソースの各 `fetch*` は配列を返し、例外を投げない。失敗はソース別ステータス（`ok` / `partial` / `failed` / `skipped`、SDD-05 §3）と `DataFetchIssue` で表現する。呼び出し側は、空配列だけから「失敗」「データなし」を推測してはならない。

---

## 2. Copilot Metrics & Reports API

組織またはEnterprise全体の利用メトリクス（IDEコード補完、チャット、PRサマリー、CLI、エージェント等）を取得する。

### 2.1 エンドポイント体系 & Reports API (2026年9月最新)
2026年4月をもって旧メトリクスエンドポイント（`/orgs/{org}/copilot/metrics`）は完全廃止（Sunset）となり、最新仕様では署名付きダウンロードURL（NDJSON形式）を返す **Usage Metrics Reports API** が標準採用されている。

- **Enterprise Reports**:
  - `GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day` (日次NDJSONリンク取得)
  - `GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-28-day/latest`
- **Organization Reports**:
  - `GET /orgs/{org}/copilot/metrics/reports/organization-1-day`
  - `GET /orgs/{org}/copilot/metrics/reports/organization-28-day/latest`
- **User-Level Reports**:
  - `GET /orgs/{org}/copilot/metrics/reports/users-1-day`
  - `GET /orgs/{org}/copilot/metrics/reports/users-28-day/latest`

### 2.2 Inline補完受諾率（Inline Completion Acceptance Rate）のテレメトリ定義とサーフェス分離

#### (1) Inline補完受諾率の算出式
GitHub公式データにおける「受諾率」は、APIレスポンスのインライン補完カウンターから算出される指標であり、当システムでは誤解を避けるため**Inline補完受諾率**と明示して取り扱う：
- **Inline補完提案受諾率 (Inline Suggestion Acceptance Rate)**:
  $$\text{Inline Acceptance Rate} = \frac{\text{total\_code\_acceptances}}{\text{total\_code\_suggestions}} \times 100\%$$
- **Inline補完行数受諾率 (Inline Lines Acceptance Rate / Lines Utilization)**:
  $$\text{Inline Lines Acceptance Rate} = \frac{\text{total\_code\_lines\_accepted}}{\text{total\_code\_lines\_suggested}} \times 100\%$$

#### (2) テレメトリ計上ロジックと暗黙的拒否 (Implicit Rejection)
- **提案 (Suggestions)**: エディタ上で文字入力や一時停止に伴い、Ghost Text（灰色のインライン補完候補）が表示された時点でカウント。
- **受諾 (Acceptances)**: ユーザーが `Tab` キー（または受諾ショートカット）で候補を確定した時点でカウント。
- **暗黙的拒否 (Implicit Rejection)**: Ghost Textが表示された状態で、Tabを押さずにタイピングを続行（Typing through）、`Esc` キー押下、または矢印キー移動した場合、「拒否」と判定され**分母（suggestions）のみが加算**される。

#### (3) 計測サーフェス（Surface）の完全分離
- **IDEコード補完限定**: 上記受諾率は、エディタ内のインラインコード補完（`copilot_ide_code_completions`）のみを対象とする。
- **CLI / Chat / Agent の非計上**: GitHub Copilot CLI（`copilot_in_cli`）、Copilot Chat、および Autopilot/Agent モードの自律実行成果（ファイル編集・パッチ適用・Tool Call）は、受諾率の分子・分母には一切含まれない。

### 2.3 レスポンススキーマ (日次配列 / レポート構造)

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
- ページネーション: `per_page=100` を指定し、`Link: <...>; rel="next"` ヘッダーを最終ページまで追従する。次ページ URL は API ベース URL と **同一オリジンの場合のみ** 追従する（`Authorization` ヘッダーを別オリジンへ送らない）。安全弁として 1,000 ページで打ち切り、到達した場合は `data_integrity` の警告（「シート一覧が不完全な可能性」）を出す。
- 整合性チェック: 各対象の先頭ページの `total_seats` の合計と、取得したレコード数を照合する。不一致なら `data_integrity` の警告を出し、ソース状態は `partial` になる。
- 失敗時の扱い: 対象（Enterprise / いずれかの Org）の **どれか 1 つでも** 失敗した場合は、`seats` ソース全体を `failed` として空配列を返す。不完全な席数を現在値として公開しないためで、パイプラインは前回成功時の成果物を維持する（SDD-05 §3）。

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

#### フィールドの扱い（レコード単位の検証）

- レコードは **1 件ずつ** 検証する。検証に失敗したレコードは隔離（集計から除外）し、レコードの位置とスキーマ上のパスだけを列挙した `data_integrity` の警告として報告する（レコードの値は含めない）。1 件の想定外値でバッチ全体が失われることはない。
- `plan_type`: `business` / `enterprise`。欠損・未知の値（`unknown` を含む）は `unknown` として保持して警告する。シート費用は **未確定** として扱い、Enterprise と推測しない（SDD-06 §1.1）。
- `organization`: `null` の場合がある（Enterprise 直下に付与されたシート）。そのまま保持し、「未割当」としてグルーピングして警告する。
- `updated_at`: 非推奨で返らないことがある。欠損時は `created_at` で補う。
- `seat_status`: 将来追加される未知の値でレコード全体を無効にしない。
- スキーマ検証エラー（Zod）は `data_integrity`、HTTP 401/403 は `api_auth`、404 は `not_found`（警告）、429 は `rate_limit`、その他は `server_error` に分類する。

---

## 4. GitHub Enterprise Cost Centers API

GitHub EnterpriseのBilling機能である「Cost Center」一覧とリソース紐付けを取得する。

### 4.1 エンドポイント
- `GET /enterprises/{enterprise}/settings/billing/cost-centers`
- `GET /enterprises/{enterprise}/settings/billing/cost-centers/{cost_center_id}`

### 4.2 レスポンススキーマ

公開ドキュメント上のレスポンスキーは `costCenters`。旧キー `cost_centers` と素の配列も受け付ける。各レコードは `id` と `name` が必須で、`cost_center_code` と `state` は任意（公開 API は `cost_center_code` を返さない）。`state` が `deleted` の Cost Center は配賦の対象から外す。`resources[].type` の表記ゆれはドメインの種別へ正規化する（`Organization` → `Org`、`Repo` → `Repository`、`User`）。未知の種別はそのまま保持する。

Cost Center は Enterprise Billing の機能。Org 単体運用では、該当ソースを `skipped`（障害ではない）として記録する。

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

## 5. 課金モデル & 料金テーブル (2026年9月基準)

| プラン / 機能 | 月額単価 (USD) | 日割り計算基準 (USD / 日) | 備考 |
|---|---|---|---|
| **Copilot Business** | \$19.00 / seat | \$19.00 / 暦日数 (例: 30日の月は \$0.633) | 基本IDE補完・チャット |
| **Copilot Enterprise** | \$39.00 / seat | \$39.00 / 暦日数 (例: 30日の月は \$1.300) | 社内ナレッジ連携、PRサマリー、CLI等 |
| **遊休シート (Idle Seat)** | 各プランの満額 | 同上 | 遊休でも契約費用が発生（判定基準の詳細は SDD-06 §3） |
| **AI クレジット** | \$0.01 / credit | — | 2026-06-01 から使用量ベース課金（全計算経路で単価は 1 つ） |

### 5.1 価格カタログ（価格の単一ソース）

価格はすべて 1 つのモジュール `src/domain/pricing/pricing-catalog.ts` に定義し、他のモジュールは価格を直接持たない。Enterprise 固有の契約価格・割引（`COPILOT_BILLING_CONFIG`、SDD-06 §1.4）がカタログの既定値を上書きする。

| 項目 | 通常時 | 移行プロモーション (2026-06 〜 2026-08) |
|---|---|---|
| シート単価 (Business / Enterprise) | 月 \$19 / \$39 | 同左 |
| AI クレジット単価 | \$0.01 | 同左 |
| シートあたり月間包含クレジット (Business / Enterprise) | 1,900 / 3,900 | 3,000 / 7,000 |

- 包含クレジットは **プラン別・期間別** で、**請求エンティティ単位** のプール（全シートの合計）を成す。`plan_type` が `unknown` のシートはプールに算入せず、「プラン未確定」として数える。
- カタログの値は **暫定** である。一次情報を直接取得できなかったため、公開されている情報の要約に基づいて定めた。Phase 1 でカタログを版管理する際に GitHub の公式ドキュメントと照合して確定する（`PRICING_CATALOG_VERSION` が版を示す）。
- 従来のサービス別の既定値（`CreditsBillingService` だけが持っていた別の \$0.05 / credit、全プラン共通の包含 3,900 クレジット固定）は撤去した。同じ消費量でも経路によって金額が 5 倍ずれていたためである。
