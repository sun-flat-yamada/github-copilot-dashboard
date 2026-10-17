# Walkthrough: Abolish Primary SKU Card and Show Plan Breakdown in Active Users Card (#346)

Issue #346 に基づき、月次レポートの **`主契約 / SKU` (`report_kpi_top_sku`) カードの廃止** と、**`レポート内アクティブ人数` (`report_kpi_active_users`) カードへの Copilot プラン内訳 (Enterprise / Business 人数) 表示** の実装、および関連仕様・カタログ・テストの同期を完了しました。

## Summary of Changes

### 1. Dashboard UI Components
- **[MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)**:
  - `report_kpi_top_sku` カードおよびその ID を型定義 `ReportKpiCardWidgetId` / `ALL_REPORT_KPI_CARD_WIDGET_IDS` から撤去。
  - レポート KPI カードの全体グリッドを 5 列から 4 列 (`lg:grid-cols-4`) へ再編。
  - ヘルパー関数 `extractCopilotPlanCounts` を実装し、`sku_breakdown` (および `user_details`) から Enterprise / Business のシート数を集計。
  - `report_kpi_active_users` カード下部にプラン内訳セクション (`data-testid="report-plan-breakdown"`) を新設し、Enterprise と Business の人数を明瞭に表示。
- **[useOverviewWidgets.ts](../../../dashboard/src/hooks/useOverviewWidgets.ts)**:
  - ウィジェットカタログから `report_kpi_top_sku` を削除し、ウィジェット追加パネルおよび保存済みレイアウトの復元時に自動的に除外・サニタイズされるよう同期。

### 2. Domain & Metric Catalog
- **[metric-registry.ts](../../../src/domain/metrics/metric-registry.ts)**:
  - 未使用となった `report_top_sku` 指標定義を `METRIC_REGISTRY` から削除し、孤児指標の発生を防止。
- **[report-engine.ts](../../../src/processor/report-engine.ts)**:
  - レポートバインディング `METRIC_BINDINGS['reports']` から `report_top_sku` を削除。

### 3. Specifications Synchronization
- **[07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md)** / **[07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)**:
  - セクション 2.4 および 2.14d を更新し、月次レポート KPI カードの標準構成が 4 枚であること、アクティブ人数カードへのプラン内訳併記、主契約/SKU カードの廃止を明記。
- **[16_data_contract_and_metric_catalog_spec.ja.md](../../../docs/specifications/16_data_contract_and_metric_catalog_spec.ja.md)** / **[16_data_contract_and_metric_catalog_spec.md](../../../docs/specifications/16_data_contract_and_metric_catalog_spec.md)**:
  - 指標カタログ一覧から `report_top_sku` を削除。
- **[17_audit_and_report_spec.ja.md](../../../docs/specifications/17_audit_and_report_spec.ja.md)** / **[17_audit_and_report_spec.md](../../../docs/specifications/17_audit_and_report_spec.md)**:
  - レポート指標一覧テーブルから `report_top_sku` を削除。

### 4. Tests
- **[metric-catalog.test.ts](../../../src/tests/metric-catalog.test.ts)**:
  - `MonthlyReportKpis.tsx` の期待 `MetricLabel` 数を 6 から 5 に更新し、7/7 テストすべて通過。
- **[monthly-report-kpis.test.tsx](../../../src/tests/ui/monthly-report-kpis.test.tsx)**:
  - `report_kpi_top_sku` カードが非描画であること、4 列グリッドであること、`report_kpi_active_users` に Enterprise / Business の内訳人数が正しく表示されることを検証するテストケースを追加し、全 7 テスト通過。

## Verification Results

### Quality Gate Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Clean (Exit 0, 8 Passed, 2 Expected Warnings) |
| TypeScript Check | `npm run typecheck` | ✅ Pass (Exit 0, Clean) |
| Unit & Integration Tests | `npm test` | ✅ 1207/1207 Pass (1 Skipped, 0 Fail) |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ Clean (0 Secrets, 0 PII, 0 Absolute paths) |
| Production Build | `npm run build` | ✅ Built in 1.64s (Bundle within budget) |
