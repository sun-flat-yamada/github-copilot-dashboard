# Task Checklist (#334)

- [x] Issue #334 の作成およびブランチ `feat/334-dashboard-tab-and-kpi-widgets` の作成
- [x] `implementation_plan.md` の作成・先行コミット
- [x] `useOverviewWidgets.ts` に KPI カード Widget カタログ (`kpi_*`, `report_kpi_*`) を追加
- [x] `KpiSummaryCards.tsx` および `MonthlyReportKpis.tsx` に単一 KPI カード描画コンポーネントと `WidgetCardFrame.tsx` の Widget 操作ヘッダーを追加
- [x] `dashboard/src/views/dashboard/manifest.ts` と `dashboard/src/views/dashboard/View.tsx` を新設し、`AppShell.tsx` の初期表示タブを `dashboard` に設定
- [x] `dashboard/src/views/overview/View.tsx` (`コスト内訳`) を固定ビューへ分離
- [x] テスト (`src/tests/view-registry.test.ts`, `src/tests/ui/overview-widgets.test.tsx`) および仕様書 (`07_dashboard_ui_ux_spec*.md`) の更新
- [x] 品質ゲート (`fork:verify`, `typecheck`, `lint`, `test`, `secret-scan`, `build`, `change-dev:plan-check`) 通過と PR・Rebase Merge
