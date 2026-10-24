# 最多利用 AI モデルカードにおける Top 3 モデル割合(%)表示 (#337)

## 背景と目的
Issue #337 に基づき、月次レポート（Monthly Usage Report / User Upload モード）の「最多利用 AI モデル」カード (`report_top_model`) において、選択されているデータ (`model_breakdown`) から上位 3 件の AI モデルを順位・モデル名・割合(%)付きで表示するように改善する。

### 現状の課題
- 現状は第 1 位のモデル名 (`reportData.overview.top_model`) とその占有率（`{reportData.model_breakdown[0]?.percentage || 0}% のリクエストを占有`）のみが表示されている。
- ユーザーが複数のモデルを併用している場合や、フィルター（組織・部署・タグ）適用時にどのようなモデルが上位で利用されているかの構成比（Top3）をカード上で素早く確認できない。

### 改善内容
- `MonthlyReportKpis.tsx` の `report_top_model` カード描画において、`reportData.model_breakdown` から上位 3 件を取り出し、順位（1〜3）・モデル名・割合(%)を一覧表示する。
- モデルデータが 3 件未満（1〜2 件）の場合は存在する件数分のみ表示し、0 件の場合は「データなし」等の適切なフォールバックを表示する。
- 順位バッジ、モデル名（長い場合は省略表示）、割合（パーセンテージ）の視認性を高め、カード全体の高さとレイアウトを他の KPI カードと調和させる。

## 変更ファイル一覧

### 1. UI コンポーネント
- [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
  - `case 'report_kpi_top_model':` または該当カード描画ロジックを更新し、`model_breakdown` の Top 3 モデルを順位・モデル名・割合(%)付きで表示。
  - データ未存在時のフォールバックおよび 1〜2 件時のレイアウトを整備。

### 2. 単体テスト
- [src/tests/ui/monthly-report-kpis.test.tsx](../../../src/tests/ui/monthly-report-kpis.test.tsx)
  - 3 モデル以上存在する場合に Top 3 が順位・モデル名・割合付きで描画され、4 件目以降が表示されないことを検証。
  - 2 モデルのみ存在する場合に 2 件のみ正しく描画されることを検証。
  - 0 モデル（空配列）の場合に「データなし」フォールバックが描画されることを検証。

### 3. 仕様書
- [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md)
- [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
  - 「最多利用 AI モデル」カードの Top 3 割合(%)表示仕様を反映。

## 検証計画
- `npm run change-dev:plan-check`
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
- 単体テスト: `npx tsx --test "src/tests/ui/monthly-report-kpis.test.tsx"`
