# 請求突合レポート（計算値と Billing API の金額）(P4-4 / #200)

親 Issue: #175（Phase 4）。指摘 E-03（ダッシュボードの計算額と GitHub の請求 API の金額が一致する保証がなく、差異を検出する仕組みがない）を解消する。前提 P1-5（AI Credits 利用量 API）と P1-6（為替カタログ）はマージ済み。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 5 点（突合ロジックと単体テスト / 許容差の設定と issue 化（重複なし）/ 実 API 検証の扱い / SDD-06・SDD-17 の日英同期 / 品質ゲート）に限定する。

> [!IMPORTANT]
> エンドポイントの一次情報確認（2026-10-04、`github/rest-api-description` の `ghec.2022-11-28.json`）
> - `GET /enterprises/{enterprise}/settings/billing/ai_credit/usage`（year / month / day、organization / user / model / product / cost_center_id）が存在し、P1-5 のクライアントが既に使っている。突合の請求側はこのエンドポイントの `usageItems`（`grossQuantity` / `pricePerUnit` / `grossAmount` / `discountAmount` / `netAmount`）を使う。
> - 同じ記述に `billing/usage`、`billing/usage/summary`、`billing/premium_request/usage` がある。シート料金（ライセンス）の突合はこれらが対象になりうるが、本 Issue のスコープ外（AI Credits のみ）。必要なら別 Issue にする。

> [!WARNING]
> 公開範囲の判断（`security-zero-leakage.md` / `storage-and-data-routing.md`）
> - 請求金額は実際の請求データに由来するため、`processed/`（Pages へ配信）には置かない。保存先は `data/audit/billing-reconciliation/{month}.json`（`audit/` は P4-3 で `FORBIDDEN_DIST_PATHS` に登録済み。許可リスト `STAGED_PROCESSED_DIRS` は変更しない）。
> - 保存するのは日 × SKU × モデルの数量と金額の集計だけ。利用者・組織・Cost Center の識別子は保存しない。
> - GitHub issue に載せるのは月、判定、差額（USD）、差の割合、許容差、価格カタログと為替カタログの版だけ。請求総額そのものは載せない（リポジトリが公開でも詳細は漏れない）。詳細は `copilot-data` の文書を見る。
> - 実 API での検証には Enterprise の PAT が必要で、作業環境には無い。**実 API では未検証**であることを PR に明記する（応答形状は P1-5 の契約テストとスキーマで保証、突合は合成データで検証）。
> - テスト・フィクスチャの金額・SKU・モデルはすべて架空の値。トークンや実請求データは使わない。

## 設計
- 突合の単位: 月 × `ai_credits`。計算値 = Billing API が返した数量（`grossQuantity`）× ダッシュボードの単価（請求設定 → 既定は価格カタログの AI クレジット単価、USD / credit）。請求値 = Billing API の `grossAmount`（`netAmount` と `discountAmount` は参考値として併記。割引・包含分の計算モデルは持たないため総額（gross）で比べる）。
- 判定: `match`（差が 0.005 USD 未満）/ `within_tolerance` / `exceeded` / `unavailable`（API 欠損: その月の請求データなし）。許容差は絶対額（USD）と割合（%）の両方を超えたときに `exceeded`（どちらか一方以内なら許容内）。既定は 1 USD かつ 1 %。設定は環境変数 `COPILOT_RECONCILIATION_TOLERANCE`（JSON `{"absolute_usd":1,"percent":1}`）。不正な値は issue として記録し既定値に戻す。
- 欠損の扱い: 請求データのない月を 0 円として突合しない。`unavailable` とし、`exceeded` 扱いにも `match` 扱いにもしない（issue 化しない）。ソース状態が failed / skipped の実行では何も書き込まない（前回の保存値を保つ）。
- 日別の行を `days` に保存して冪等にマージする（同じ日を再取得したら置換）。月の判定は保存済みの日の合計から毎回導出する。収集窓が月の一部しか覆わない場合は `days_covered` で分かる。
- 版の記録: 価格カタログ版（`PRICING_CATALOG_VERSION`）、為替カタログの版（`fetched_at` と収録月数。無ければ null）、単価、許容差、通貨前提（API は通貨を返さないため USD と仮定）。
- issue 化: `npm run billing:issues` が許容差超過の月ごとに GitHub REST（`GITHUB_TOKEN`、`issues: write`）で issue を作る。本文に隠しマーカー `<!-- billing-reconciliation:YYYY-MM -->` を入れ、ラベル `billing-reconciliation` の issue（open / closed の両方）を検索して、同じ月のマーカーがあれば作らない（重複起票しない）。`--dry-run` で作成せずに表示する。

## Proposed Changes
### ドメインと純関数
#### [NEW] `src/domain/entities/billing-reconciliation.ts`
- `ReconciliationTolerance`、`BillingReconciliationMonthDocument`（日別の行・版・許容差）、`BillingReconciliationReport`、判定の型、既定の許容差。
#### [NEW] `src/processor/billing-reconciliation.ts`
- `parseTolerance`（環境変数。不正値は既定値と理由を返す）、`aggregateCostLines`（CostLine → 日 × SKU × モデルの行）、`mergeDays`、`reconcileMonth`（合計・差・判定）、`buildIssueDraft`（件名・本文・マーカー。総額を含めない）。

### 保存・パイプライン・CLI
#### [MODIFY] `src/storage/fork-safe-storage.ts` / `IStorageWriter` / `ForkSafeStorageWriter`
- 任意メソッド: `audit/billing-reconciliation/{month}.json` の保存・読み出し・月一覧。公開ディレクトリへは複製しない。
#### [NEW] `src/application/pipeline/billing-reconciliation.ts`
- `BillingReconciliationService.record(lines, context)`: 月ごとに文書へ日別の行をマージして保存し、レポートを返す。`reportFor(month)` / `reports()`。
#### [MODIFY] `src/application/pipeline/PipelineOrchestrator.ts`
- AI Credits 取得の直後（再処理を除く、ソースが取得できたときだけ）に `record`。失敗は issue 化して本処理は止めない。許容差超過は warning の issue として error-log にも載せる。
#### [NEW] `src/application/pipeline/billing-reconciliation-issues.ts`
- `GitHubIssueClient` 最小インタフェース（注入可能）と `fileReconciliationIssues`: 超過月の検出、既存 issue の検索（重複回避）、作成。
#### [NEW] `src/cli/billing-reconcile.ts`
- `npm run billing:report [-- --month YYYY-MM]`（表示）/ `npm run billing:issues [-- --month YYYY-MM] [--dry-run]`。
#### [MODIFY] `.github/workflows/copilot-analysis-cron.yml`
- `permissions` に `issues: write`。パイプライン後に `billing:issues`（`continue-on-error`、モックモードでは実行しない）。

### 仕様書
- SDD-17 に「請求突合レポート」節（§5。既存の「未仕様の節」は §6 へ）を日英で追加。SDD-06 に突合の位置づけと「計算額は請求額と一致するとは限らない」旨を日英で追記。SDD-05 の保存レイアウトに `audit/billing-reconciliation/` を日英で追記。

## Verification Plan
- 単体（`src/tests/billing-reconciliation.test.ts`）: 一致・許容内（絶対額のみ / 割合のみ）・超過・API 欠損、許容差の解析と不正値、集計の冪等マージ、複数 SKU、負の調整行、issue 本文に総額・識別子が含まれないこと。
- issue 化: 偽の GitHub クライアントで、超過月の作成・同月の再実行で重複しない・closed でも重複しない・`--dry-run`・欠損月は作らない。
- サービス: 一時ディレクトリへの保存と再読込、ソース失敗時に書かない。
- 公開範囲: `audit/billing-reconciliation/` が `pages:stage` に含まれず、dist にあれば `pages:verify` が失敗する（`pages-staging.test.ts` に追加）。
- 品質ゲート: `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` + `npm run lint` + `pages:verify`。
