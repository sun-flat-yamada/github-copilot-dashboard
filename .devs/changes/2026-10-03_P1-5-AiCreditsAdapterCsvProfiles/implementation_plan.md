# Plan: AI Credits 利用量 API アダプタと CSV フォーマットプロファイル (P1-5)

Issue: #179（親 #172）。A-12 / B-16。

## 一次情報の確認
- GitHub REST API description（`ghec.2022-11-28.json`、`raw.githubusercontent.com` 経由）で `GET /enterprises/{enterprise}/settings/billing/ai_credit/usage` を確認（year/month/day、usageItems の項目、ページングなし、過去 24 か月、通貨の記載なし）。

## Proposed Changes
### API アダプタ
- [NEW] `src/adapters/github-api/ai-credits/{ai-credit-usage-schema,AiCreditUsageClient}.ts`
- [MODIFY] `GitHubApiCopilotDataSource.fetchAiCreditUsage()`、`DataSourceId` に `ai_credits`、`PipelineOrchestrator`（報告されたときだけ状態に載せる）、`facts/mappers.ts`（`toCostLine`）
### CSV
- [NEW] `src/processor/csv-format-profiles.ts`（別名・必須列・自動判別）、`src/domain/entities/csv-import.ts`、`csv-import-report-format.ts`
- [MODIFY] `report-parser.ts`（`parseRecordsWithReport`）、`import-report.ts`、`DataSelectionModal` / `ReportDropzoneModal`、[NEW] `CsvImportReportPanel`
- ヘッダー別名: 空白・記号を `_` として扱う形も認識（`Gross Amount ($)` / `Net Amount`。付録 B #3 の未認識の解消）
### 文書
- SDD-03 §4a、SDD-06 §1.5/1.6、SDD-09 §3.6（日英）

## 判断
- 取得した明細の集計への反映は Phase 2（本 PR は収集・検証・状態・正準ファクトへの写像まで）。
- 通貨は応答にないため断定しない（`currency: null`）。
- 古い run の再処理で記録の無い要求は `skipped`（失敗にしない）。
