# Dashboard タブ新設・コスト内訳との分離および全 KPI 項目の Widget 化 (#334)

## 背景と目的
Issue #334 に基づき、以下の 2 点を実現する：
1. **初期表示用の `Dashboard` タブ (`id: 'dashboard'`) の新設と `コスト内訳` (`overview`) タブとの分離**
   - 従来の `コスト内訳` (`overview`) タブは本来の固定セクションによるコスト内訳・月次詳細分析ビューとして維持する。
   - 初期表示タブとして `Dashboard` タブ (`order: 5`) を新設し、Widget カスタマイズ機能（追加・削除・表示順序変更・デフォルトプリセットへのリセット・`localStorage` による設定永続化）を `Dashboard` タブに集約する。
2. **KPI サマリーカード群（`当月 月額費用 (シート費)`、`Inline補完受諾率` 等）の個別 Widget 化**
   - Live Metrics モードの 5 つの KPI 項目（`当月 月額費用 (シート費)`、`シート稼働率`、`遊休シート推定無駄コスト`、`予算消化率`、`Inline補完受諾率`）および Report / Upload モードの 5 つの KPI 項目（`費用サマリー`、`総リクエスト数`、`アクティブ人数`、`最多使用モデル`、`主要課金 SKU`）を、それぞれ独立した Widget として追加・削除・並び替え・リセット・永続化できるようにする。

## 変更ファイル一覧

### 1. Widget カタログ・永続化フック
- `dashboard/src/hooks/useOverviewWidgets.ts`
  - `OverviewWidgetDefinition` に `size?: 'kpi' | 'full'` を追加（KPI カード Widget は `'kpi'`、セクション Widget は `'full'`）。
  - Live Metrics カタログ (`LIVE_WIDGET_CATALOG`) に以下の 5 つの KPI Widget を追加し、`DEFAULT_LIVE_WIDGET_IDS` の先頭に配置：
    - `kpi_total_spend`: `当月 月額費用 (シート費)`
    - `kpi_active_rate`: `シート稼働率`
    - `kpi_idle_waste`: `遊休シート推定無駄コスト`
    - `kpi_budget_utilization`: `予算消化率`
    - `kpi_acceptance_rate`: `Inline補完受諾率`
  - Report カタログ (`REPORT_WIDGET_CATALOG`) に以下の 5 つの KPI Widget を追加し、`DEFAULT_REPORT_WIDGET_IDS` の先頭に配置：
    - `report_kpi_cost`: `費用サマリー (Cost Overview)`
    - `report_kpi_requests`: `総リクエスト数`
    - `report_kpi_active_users`: `アクティブ人数`
    - `report_kpi_top_model`: `最多使用モデル`
    - `report_kpi_top_sku`: `主要課金 SKU`

### 2. KPI カードの個別レンダリング対応
- `dashboard/src/components/KpiSummaryCards.tsx`
  - 既存の 5 枚一括表示 (`KpiSummaryCards`) を維持しつつ、単一 KPI カード (`KpiCardId = 'kpi_total_spend' | 'kpi_active_rate' | 'kpi_idle_waste' | 'kpi_budget_utilization' | 'kpi_acceptance_rate'`) を個別に描画できる `SingleKpiSummaryCard`（または `onlyCardId` / Widget コントロール付きラッパー）をエクスポート。
- `dashboard/src/components/monthly-report/MonthlyReportKpis.tsx`
  - 既存の 5 枚一括表示 (`MonthlyReportKpis`) を維持しつつ、単一レポート KPI カード (`ReportKpiCardId = 'report_kpi_cost' | 'report_kpi_requests' | 'report_kpi_active_users' | 'report_kpi_top_model' | 'report_kpi_top_sku'`) を個別に描画できる `SingleMonthlyReportKpiCard` をエクスポート。

### 3. `Dashboard` ビューの新設と `overview` ビューの分離
- `dashboard/src/views/dashboard/manifest.ts`
  - `id: 'dashboard'`, `label: 'Dashboard'`, `title: 'Dashboard (カスタムウィジェット)'`, `iconName: 'LayoutDashboard'`, `order: 5` を定義。
- `dashboard/src/views/dashboard/View.tsx`
  - Widget 管理ツールバー（Widget 追加パネル、リセットボタン、ドラッグ＆ドロップ / 順序変更 / 削除コントロール）を備え、KPI カード Widget と大型セクション Widget の両方を `activeWidgetIds` の順序に従って描画する。
- `dashboard/src/components/layout/ViewNavigation.tsx`
  - `ICON_MAP` に `LayoutDashboard` アイコンを追加。
- `dashboard/src/AppShell.tsx`
  - 初期表示タブ `activeView` の初期値を `'dashboard'` に変更。
- `dashboard/src/views/overview/View.tsx`
  - `コスト内訳` タブを固定構成の標準ビューへ戻し、`Dashboard` タブと役割を分離する。

### 4. テスト・仕様書の更新
- `src/tests/view-registry.test.ts`: `dashboard` ビュー (`order: 5`) の追加に合わせてレジストリ検証テストを更新。
- `src/tests/ui/overview-widgets.test.tsx`:
  - `Dashboard` タブと `コスト内訳` タブの分離検証。
  - `当月 月額費用 (シート費)` (`kpi_total_spend`) や `Inline補完受諾率` (`kpi_acceptance_rate`) 等の KPI Widget の個別削除・追加・順序変更・デフォルトプリセットへのリセット・`localStorage` 永続化のテスト。
- `docs/specifications/07_dashboard_ui_ux_spec.ja.md` および `docs/specifications/07_dashboard_ui_ux_spec.md`: `Dashboard` タブと KPI Widget 化の仕様を反映。

## 検証計画
- `npm run change-dev:plan-check`
- `npm run fork:verify && npm run typecheck && npm run lint && npm test && npm run secret-scan && npm run build`
