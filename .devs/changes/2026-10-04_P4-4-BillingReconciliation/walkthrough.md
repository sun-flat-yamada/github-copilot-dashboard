# Walkthrough: 請求突合レポート (P4-4 / #200)

## Summary
AI Credits について、計算額（Billing API が返した数量 × ダッシュボードの単価）と Billing API の金額（`grossAmount`）を月ごとに突合するレポートを追加した。許容差（既定 1 USD かつ 1 %、`COPILOT_RECONCILIATION_TOLERANCE` で設定）を超えた月は GitHub issue になり、同じ月は重複して起票されない。結果には価格カタログ版・為替カタログ版・単価・許容差を記録する。請求データのない月は `unavailable`（0 円として突合しない）。

## Changes Made
- `src/domain/entities/billing-reconciliation.ts`, `src/processor/billing-reconciliation.ts`: 型、許容差の解析、集計、冪等マージ、判定、issue 下書き（請求総額を載せない。公開リポジトリでは金額も割合も載せない）。
- `src/storage/fork-safe-storage.ts`, `IStorageWriter`, `ForkSafeStorageWriter`: `audit/billing-reconciliation/{month}.json`（`processed/` の外。Pages へは配信しない）。
- `src/application/pipeline/billing-reconciliation.ts`, `PipelineOrchestrator.ts`: AI Credits 取得後（ソースが利用可能・再処理でないときだけ）に記録。超過月は警告 issue としてエラーログにも載せる。
- `src/application/pipeline/billing-reconciliation-issues.ts`, `src/cli/billing-reconcile.ts`, `package.json`: `billing:report` / `billing:issues`（`--dry-run`）。既存 issue（open / closed）を先に取得して重複を避け、取得できなければ作らない。
- `.github/workflows/copilot-analysis-cron.yml`: `issues: write`、`billing:issues` ステップ（`continue-on-error`、モックモードでは実行しない）、許容差の変数の受け渡し。
- `docs/specifications/17_*`（新 §5。未仕様の節は §6）、`06_*`（§4.7）、`05_*`（§2.9・保存レイアウト）、README の日英を同期。

## 一次情報の確認
2026-10-04、`github/rest-api-description` の `ghec.2022-11-28.json` で `GET /enterprises/{enterprise}/settings/billing/ai_credit/usage` の存在とパラメータを確認した（P1-5 のクライアントと同じエンドポイント）。

## 未検証事項
> [!WARNING]
> **実 API では未検証。** Enterprise の請求読み取り権限を持つ PAT が作業環境に無い。突合は合成データ（架空の SKU・モデル・金額）で検証した。応答形状は P1-5 のスキーマ・契約テストが保証する。実運用の最初の実行後に `npm run billing:report` で確認する。

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | Pass (Exit 0) |
| TypeScript Check | `npm run typecheck` | Pass (Exit 0) |
| Unit & Integration Tests | `npm test` | 1032/1032 Pass |
| Zero Secret / PII Scan | `npm run secret-scan` | 0 Leaks (Exit 0) |
| Production Build | `npm run build` | Pass (bundle budget OK) |
| Lint | `npm run lint` | Pass |
| Pages staging | `npm run pages:verify` | Pass（ステージ対象なし。`audit/` 禁止は `pages-staging.test.ts` で検証） |
