# Walkthrough - Show Active and Non-Active Breakdown per Copilot Plan (#353)

月次レポート概要の「レポート内アクティブ人数」(`report_kpi_active_users`) カードにおいて、Copilot プラン内訳 (Enterprise / Business) をさらにアクティブ人数およびノンアクティブ人数に分けて表示する改修を完了しました。

## 変更内容 / Changes Made

1. **ドメインモデル整備**:
   - `src/domain/entities/copilot.ts`: `ReportUserDetail` に `plan_type?: CopilotPlanType;` および `status?: UserSeatStatus;` を追加。
2. **プラン内訳アクティブ・ノンアクティブ集計・表示**:
   - `dashboard/src/components/monthly-report/MonthlyReportKpis.tsx`:
     - `PlanUserCounts` インターフェース (`active`, `nonActive`, `total`) を定義。
     - `isReportUserActive(u)` ヘルパーを新設し、ステータス、リクエスト数、AIクレジット、費用、活動履歴からアクティブ判定を実施。
     - `extractCopilotPlanCounts` を改修し、`user_details` にプラン情報がある場合は直接集計、ない場合は `sku_breakdown` のシート数量と全体アクティブ人数から按分集計。
     - `report_kpi_active_users` カードのプラン内訳表示領域 (`data-testid="report-plan-breakdown"`) を更新し、Enterprise と Business それぞれについてアクティブ人数とノンアクティブ人数を一覧表示。
3. **仕様書同期**:
   - `docs/specifications/07_dashboard_ui_ux_spec.ja.md` & `07_dashboard_ui_ux_spec.md`: セクション 2.14d を同期更新。
4. **テスト追加・更新**:
   - `src/tests/ui/monthly-report-kpis.test.tsx`:
     - 各プランでアクティブとノンアクティブが混在するケースの検証。
     - `sku_breakdown` フォールバック時のアクティブ / ノンアクティブ按分計算の検証。
     - 後方互換性テスト ID (`report-plan-enterprise-count`, `report-plan-business-count`) の維持検証。

---

## 品質ゲート検証結果 / Quality Gate Results

| ステージ | コマンド | 結果 | 備考 |
| :--- | :--- | :--- | :--- |
| 1. Fork 健全性 | `npm run fork:verify` | **PASS** | 5 Passed, 3 Expected Warnings, 0 Failures |
| 2. 型整合性 | `npm run typecheck` | **PASS** | Exit code 0, Clean |
| 3. テストスイート | `npm test` | **PASS** | 1,209 / 1,209 Passed, 1 Skipped, 0 Failures |
| 4. シークレット監査 | `npm run secret-scan` | **PASS** | 704 files scanned, 0 secrets, 0 PII, 0 absolute paths |
| 5. ビルド検証 | `npm run build` | **PASS** | SPA production build succeeded in 1.52s, within budget |

---

## 変更ファイル一覧 / Modified Files

- `src/domain/entities/copilot.ts`
- `dashboard/src/components/monthly-report/MonthlyReportKpis.tsx`
- `docs/specifications/07_dashboard_ui_ux_spec.ja.md`
- `docs/specifications/07_dashboard_ui_ux_spec.md`
- `src/tests/ui/monthly-report-kpis.test.tsx`
- `.devs/changes/2026-10-17_ShowActiveInactivePlanBreakdown/implementation_plan.md`
- `.devs/changes/2026-10-17_ShowActiveInactivePlanBreakdown/task.md`
- `.devs/changes/2026-10-17_ShowActiveInactivePlanBreakdown/walkthrough.md`
