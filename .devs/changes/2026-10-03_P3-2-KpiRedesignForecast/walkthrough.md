# Walkthrough: KPI 再設計と前期比・月末予測 (P3-2 / #189)

## Summary
概要 KPI カードを判断順（コスト → 利用定着 → 最適化 → 予算消化 → 受諾率（参考））に再設計し、前期比と月末着地予測を根拠付きで表示した。データ不足は 0 ではなく「—（理由）」。予測は推定バッジ（P2-3）で明示し、新 KPI はすべて指標カタログに登録して `MetricLabel` で描画する。

## Changes Made
### ドメイン
- `src/domain/metrics/kpi-analysis.ts` (新規): `forecastMonthEnd`（実績累計 + 直近 7 観測日平均 × 残日数、レンジ、信頼度、締め済み月・月初・欠損多の扱い）、`compareToPrevious`（前期 0 / 欠損の扱い）、`previousScopeKey`。
- `src/domain/metrics/metric-registry.ts`: `budget_utilization` / `spend_forecast` / `credits_forecast` を登録。
### フロント
- `useDashboardData.ts` / `views/types.ts` / `AppShell.tsx` / `views/overview/View.tsx`: 前期スコープを index に存在するときだけ取得し、同じフィルターで再集計して `previousData` として渡す。
- `KpiSummaryCards.tsx`: 再設計、前期比（`PeriodDelta`）、月末予測（`ForecastNote`）、予算消化率、受諾率に「参考」チップ。`MetricValue` に `compact` を追加。
### テスト
- `kpi-analysis.test.ts`（予測式: 通常・欠損・月初・締め済み・カバレッジ不足・信頼度・うるう年、前期比、前期キー）、`kpi-summary-cards.test.ts`（描画）、`metric-catalog.test.ts`（下限更新）。
### 仕様
- SDD-06 §4.5、SDD-07 §2.14c、SDD-16 §6（いずれも EN/JA 同期）。

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | Clean (Exit 0) |
| TypeScript Check | `npm run typecheck` | Pass (Exit 0) |
| Unit & Integration Tests | `npm test` | 837/837 Pass |
| Zero Secret / PII Scan | `npm run secret-scan` | 0 Leaks (Exit 0) |
| Production Build | `npm run build` | Built, bundle budget OK |
| Lint | `npm run lint` | Pass (Exit 0) |

## Notes
- シート費は日割りでほぼ一定のため、予測が効くのは主に AI Credits。`daily_trends` は全社値のため、フィルター適用中は全社値である旨を表示する。
