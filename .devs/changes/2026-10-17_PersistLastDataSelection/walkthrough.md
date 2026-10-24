# Walkthrough: 最後のデータ選択状態を次回表示時も維持 (#330)

## 概要
ダッシュボードでユーザーが選択した「分析対象データ（データソース・対象期間・ANDフィルター条件・DEMO/LIVEモード選好・オンデマンドCSV集計データ）」をブラウザの `localStorage` に自動保存し、次回アクセス時やページリロード時に同じ分析コンテキストから再開できるようにしました。

---

## 変更ファイル一覧

| ファイル | 変更内容 |
| :--- | :--- |
| `src/application/services/DemoModeService.ts` | `DATA_SELECTION_STORAGE_KEY` (`copilot_dashboard_data_selection`) を定義し、URL クエリパラメータや `VITE_MOCK_MODE` の明示指定がない場合に `localStorage` の `isDemoMode` を参照するフォールバックを追加 |
| `dashboard/src/utils/dataSelectionStorage.ts` | `PersistedDataSelection` 型のシリアライズ/復元、フィルター条件サニタイズ (`sanitizeFilterCriteria`)、オンデマンドCSV集計データの保存/復元 (`UPLOADED_DATA_STORAGE_KEY`、容量超過時の安全な削除)、および `index.json` との期間キー照合 (`resolveInitialScopeSelection`, `resolveInitialReportMonth`) を実装 |
| `dashboard/src/hooks/useDashboardData.ts` | 初回マウント時の `localStorage` からの状態復元、`loadIndex()` での期間キー有効性検証とフォールバック、CSVアップロード/クリア時の集計データ永続化、および選択状態変更時の自動保存エフェクトを統合 |
| `src/tests/data-selection-persistence.test.ts` | `dataSelectionStorage` の各関数および `DemoModeService` の優先順位・容量超過フォールバック・破損JSON耐性を検証する単体テストを追加 |
| `src/tests/ui/app-behavior.test.tsx` | `<AppShell />` で期間とフィルターを選択後、アンマウント→再マウントした際にも選択状態・バッジ・絞り込み後KPIが維持されること、および `user_upload` データ不在時のフォールバックを検証する RTL テストを追加 |
| `docs/specifications/07_dashboard_ui_ux_spec.ja.md` / `07_dashboard_ui_ux_spec.md` | §2.1 に最後のデータ選択状態の `localStorage` 永続化・オンデマンドCSV容量制限フォールバック・`index.json` 照合仕様を追記 |
