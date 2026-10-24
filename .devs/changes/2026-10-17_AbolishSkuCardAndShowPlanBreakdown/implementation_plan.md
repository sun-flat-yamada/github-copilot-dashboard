# [Plan] Abolish Primary SKU Card and Display Copilot Plan Breakdown in Active Users Card (#346)

月次レポート (Monthly Usage Report) の KPI サマリーカードにおいて、「主契約 / SKU」(`report_top_sku`) カードを廃止し、「レポート内アクティブ人数」(`report_kpi_active_users`) カード内に Copilot の契約プラン (Enterprise / Business) の内訳人数を表示する改修を行います。

## User Review Required
> [!NOTE]
> - `report_kpi_top_sku` の廃止に伴い、月次レポートの標準 KPI カード数は 5 枚から 4 枚 (`lg:grid-cols-4`) へ再編されます。
> - ウィジェットカスタマイズ機能 (`useOverviewWidgets`) においても、カタログから `report_kpi_top_sku` が除外され、保存済みレイアウトの復元時にも自動サニタイズされます。
> - 指標カタログ (`METRIC_REGISTRY`) から未使用となった `report_top_sku` を削除し、孤児指標の発生を防ぎます。

## Proposed Changes

### 1. Dashboard UI Components
#### [MODIFY] [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
- `ReportKpiCardWidgetId` および `ALL_REPORT_KPI_CARD_WIDGET_IDS` から `'report_kpi_top_sku'` を削除。
- `MonthlyReportKpis` のグリッドレイアウトを `lg:grid-cols-5` から `lg:grid-cols-4` に更新。
- `report_kpi_active_users` カードの描画ロジックを更新:
  - `reportData.sku_breakdown` (および `user_details` フォールバック) から Enterprise / Business のシート数を集計するヘルパー関数 `extractCopilotPlanCounts` を実装。
  - カード内に「プラン内訳: Enterprise: X名 / Business: Y名」の表示領域 (`data-testid="report-plan-breakdown"`) を新設。
- `report_kpi_top_sku` カードの描画ケースを削除し、不要となった `Boxes` アイコンのインポートを整理。

#### [MODIFY] [dashboard/src/hooks/useOverviewWidgets.ts](../../../dashboard/src/hooks/useOverviewWidgets.ts)
- `REPORT_WIDGET_CATALOG` から `report_kpi_top_sku` 定義を削除。
- デフォルトプリセットおよびウィジェットサニタイズ処理が 4 枚の KPI カードを基準に動作することを確認。

### 2. Domain & Metric Catalog
#### [MODIFY] [src/domain/metrics/metric-registry.ts](../../../src/domain/metrics/metric-registry.ts)
- カタログから `report_top_sku` 定義を削除し、KPI コンポーネントとの整合性を維持。

#### [MODIFY] [src/processor/report-engine.ts](../../../src/processor/report-engine.ts)
- `METRIC_BINDINGS['reports']` から `report_top_sku` バインディングを削除。

### 3. Specifications
#### [MODIFY] [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md) & [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
- セクション 2.3 および 2.14d において、月次レポート KPI カードの標準枚数を 4 枚に更新し、アクティブ人数カードへの Copilot プラン内訳 (Enterprise / Business) 併記と主契約/SKU カードの廃止を明記。

#### [MODIFY] [docs/specifications/16_data_contract_and_metric_catalog_spec.ja.md](../../../docs/specifications/16_data_contract_and_metric_catalog_spec.ja.md) & [docs/specifications/16_data_contract_and_metric_catalog_spec.md](../../../docs/specifications/16_data_contract_and_metric_catalog_spec.md)
- 指標一覧から `report_top_sku` を削除。

#### [MODIFY] [docs/specifications/17_audit_and_report_spec.ja.md](../../../docs/specifications/17_audit_and_report_spec.ja.md) & [docs/specifications/17_audit_and_report_spec.md](../../../docs/specifications/17_audit_and_report_spec.md)
- レポート定義のバインディング一覧から `report_top_sku` を削除。

### 4. Tests
#### [MODIFY] [src/tests/metric-catalog.test.ts](../../../src/tests/metric-catalog.test.ts)
- `MonthlyReportKpis.tsx` の期待 `MetricLabel` 数を 6 から 5 に更新。

#### [MODIFY] [src/tests/ui/monthly-report-kpis.test.tsx](../../../src/tests/ui/monthly-report-kpis.test.tsx)
- `report_top_sku` カードが存在しないこと、グリッドが 4 列で描画されることを検証。
- `report_kpi_active_users` に Enterprise / Business の内訳が正しく描画されることを検証。

## Verification Plan
### Automated Tests
- `npm run change-dev:plan-check`
- `npx tsx --test src/tests/metric-catalog.test.ts`
- `npx tsx --test src/tests/ui/monthly-report-kpis.test.tsx`
- フルクオリティゲート:
  `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
