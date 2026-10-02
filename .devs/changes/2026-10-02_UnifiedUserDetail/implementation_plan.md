# Implementation Plan: ユーザー明細の統一と、ライブ側への使用量列の追加

前回（`2026-10-02_UserDetailUsageInsights`、PR #167）の続き。ユーザーから次の 2 点の指示を受けた。

1. AI usage report の実際の形式を、GitHub 公式情報の最新から特定する（まずはダミーデータでよい）。
2. ライブデータ側のユーザー明細にも同じ列を追加する。そもそもユーザー明細は、表示経路の違いや配置される View によらず、すべて同じ形式にする。

- **対象 `main`**: `c28322a`（2026-10-02）
- **承認**: 上記はユーザーの明示的な実装指示であり、Phase 2 の「Proceed」にあたるものとして進めた。方針と設計の判断は本書に記録する。

## User Review Required

> [!IMPORTANT]
> **ライブの「利用費用」と「超過請求」は、従来どおり同じ値（スコープ単位のシート費）を出す。** 既存の挙動で、Reports API にユーザー別の請求対象額が無いため。月次レポートでは、利用費用 = gross、超過請求 = net で意味が異なる。統一したのは「列と形式」であり、この 2 列の中身の意味まで同一にはできていない。ライブの超過請求を別の根拠（例: AI クレジット API）で出すかは、別の判断として残す。

> [!WARNING]
> - 旧 `MonthlyReportUserTable` を**削除**した（外部から import している箇所は本リポジトリ内のみ）。構造を検査する既存テスト 5 本は、統合後の 1 コンポーネントを対象に更新した（検査する不変条件は維持）。
> - 月次レポートの表は、列が 13 から 22 に増える（横スクロールは従来どおり。先頭 3 列は固定）。
> - AI usage report の CSV の**列順と `unit_type` の文字列**は公式に公開されておらず、実ファイルでの確認が必要（列はヘッダー名で照合し、`unit_type` は部分文字列 `credit` で判定する）。

## 公式情報の調査結果（GitHub Docs、`github/docs` の最新 `main`、2026-10-02）

| 項目 | 結果 | 出典 |
| :--- | :--- | :--- |
| AI usage report の項目 | `billing-reports` の項目表。AI usage report は `date × model × username` で合算し、モデルごとに `input` / `output` / `cache_read` / `cache_write` を持つ。最長 31 日 | `content/billing/reference/billing-reports.md` |
| `quantity` の単位 | AI クレジット。REST の例が `unitType: "credits"`、`pricePerUnit: 0.01`。1 クレジット = $0.01 | `src/rest/data/*/billing.json`、`data/variables/product.yml` |
| SKU | `copilot_ai_credit`（ほか `coding_agent_ai_credit`、`code_quality_ai_credit`、`spark_ai_credits`） | `content/billing/reference/product-and-sku-names.md` |
| クレジットの換算 | トークン × モデル別単価（100 万トークンあたり。入力 / キャッシュ入力 / キャッシュ書込 / 出力）÷ $0.01 | `data/tables/copilot/models-and-pricing.yml` |
| 取得経路（未実装） | REST `GET /enterprises/{enterprise}/settings/billing/ai_credit/usage`、非同期エクスポート `POST .../billing/reports`（`report_type: ai_credit`。完成後 31 日ダウンロード可） | `billing.json` |
| 制約 | Organization のオーナーは UI でユーザー別に絞り込めず、レポートのダウンロードが必要 | `view-productlicense-use.md` |
| 公開されていない | CSV の列順、CSV の `unit_type` の正確な文字列 | — |

`docs.github.com` は作業環境のネットワーク方針で遮断されていたため、同じ原稿である `github/docs` リポジトリ（読み取り専用の浅いクローン）を読んだ。公開ページより先行している可能性がある。

## 設計

- **行モデル**: `UserDetailRow`（`src/adapters/presenters/UserDetailRows.ts`）。ライブ（`buildLiveRows`: シート + Reports API のプロファイル）と月次（`buildReportRows`: `user_details`）の両方が、**まったく同じキー**の行を作る。そのソースに無い値は `null` / `false`（0 にしない）。
- **コンポーネント**: `UserDetailTable` に一本化。`data`（ライブ）か `reportData`（月次）を受け取り、行モデルへ変換して描画する。列は 22 で固定、値が無いセルは「—」と理由。
- **ライブの兆候**: 計測済みプロファイルの日別履歴から、月次と同じ算出関数で出す（`accumulatorFromDailyHistory`）。組織基準は全プロファイルから作る。トークンは無いため S1 / S2 / S5 は「データ不足」。
- **欠損の見せ方**: `requests` 系の明細が無い（AI usage report のみ）月次ユーザーは、リクエスト数を 0 ではなく `null`。「特記なし」のバッジは、評価できていない指標をツールチップに示す。
- **ダミーデータ**: `generateAiUsageReportCSV` を公式の項目・単価・クレジット換算に合わせた。列は公式の項目のみ、`date × model × username` で 1 行、付与クレジットはダミー額。

## Proposed Changes

### 取り込み・ダミーデータ
#### [MODIFY] [src/collector/mock-generator.ts](../../../src/collector/mock-generator.ts)
- 公式単価表（`COPILOT_MODEL_TOKEN_PRICES`）と $0.01/クレジットで、クレジットを計算。`unit_type` は `credits`。

### 行モデル・算出
#### [NEW] [src/adapters/presenters/UserDetailRows.ts](../../../src/adapters/presenters/UserDetailRows.ts)
#### [MODIFY] [src/processor/usage-insight.ts](../../../src/processor/usage-insight.ts)
- `accumulatorFromDailyHistory`、`requestRows`（リクエスト数の「不明」と「0 件」を区別）。
#### [MODIFY] [src/processor/usage-insight-definitions.ts](../../../src/processor/usage-insight-definitions.ts)
- `describeInsightTooltip`、S5 の文言。
#### [MODIFY] [src/domain/entities/copilot.ts](../../../src/domain/entities/copilot.ts)
- `UsageInsight.usage.requests` を `number | null` に。

### 表示
#### [MODIFY] [dashboard/src/components/UserDetailTable.tsx](../../../dashboard/src/components/UserDetailTable.tsx)
- 統合コンポーネント。
#### [DELETE] `dashboard/src/components/monthly-report/MonthlyReportUserTable.tsx`
#### [MOVE] `monthly-report/UsageInsightPanel.tsx` → `dashboard/src/components/UsageInsightPanel.tsx`
#### [MODIFY] `App.tsx`、`MonthlyReportView.tsx`、`Overview/Users/BudgetViewPlugin.tsx`
- 呼び出しを `UserDetailTable` に統一。

### 仕様書・テスト
- SDD-07 §2.16（統一ルール）、§2.15 の更新、SDD-09 §3.5（公式情報の確認結果）、SDD-09 / SDD-11 の名称更新（英日）。
- 新規テスト: `UserDetailRows.test.ts`、`user-detail-table-unified.test.ts`（両ソースを描画し、見出しとセル数の同一を検査）、ダミーデータの公式仕様適合テスト。

## Verification Plan

### Automated Tests
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`（`npm test` は lint を含む）

### Manual Verification
- 実ブラウザ（Chromium + Playwright）で、ライブ（デモ）と、ダミーの AI usage report（オンデマンド CSV）の両方でユーザー明細を開き、見出しが同一（22 列）であること、兆候・ドリルダウンの表示を確認した。
