# Walkthrough: 指標カタログ v1 (P3-1 / #188)

## Summary
Metric Registry を指標カタログ v1 に拡張（定義・計算式・窓・単位・出典・注意点、22 指標）。全 KPI ラベルを `MetricLabel`（定義ツールチップ + 窓チップ）に置換し、個人指標の位置づけを画面と SDD に明記。カタログ外の KPI はテストで失敗する。

## Changes Made
- `src/domain/metrics/metric-registry.ts`: 項目拡張、`windowLabel` / `describeMetric` / `PERSONAL_METRICS_NOTICE`。
- `dashboard/src/components/common/MetricLabel.tsx` (新規)。
- KpiSummaryCards / MonthlyReportKpis / AdoptionMaturityView / AgentActivityView / CreditsView を MetricLabel へ、UserDetailTable に個人指標の注記。
- `src/tests/metric-catalog.test.ts` (新規、漏れ防止)。
- SDD-16 新設（EN/JA）、README 索引、SDD-07 §2.14a（EN/JA）。

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Fork isolation | `npm run fork:verify` | Pass |
| TypeScript | `npm run typecheck` | Pass |
| Tests | `npm test` | 810 pass / 0 fail |
| Secret scan | `npm run secret-scan` | Pass |
| Build | `npm run build` | Pass (bundle budget OK) |
| Lint | `npm run lint` | Pass |
