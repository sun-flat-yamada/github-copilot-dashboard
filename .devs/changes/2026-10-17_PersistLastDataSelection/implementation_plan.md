# 最後のデータ選択状態を次回表示時も維持できるようにする 実装計画

Issue: [#330](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/330)

ダッシュボードの「分析対象データ」（Step 1: データソース種別・期間/スコープ、Step 2: ANDフィルター条件、オンデマンドCSVデータ、および DEMO / 実データ切替状態）をブラウザの `localStorage` に永続化し、次回表示（リロード・再訪）時にも最後の選択状態を自動的に維持・復元できるようにする。

## 変更概要 (Proposed Changes)

### 1. データ選択状態の永続化・復元ユーティリティの新設
#### [NEW] [dashboard/src/utils/dataSelectionStorage.ts](../../../dashboard/src/utils/dataSelectionStorage.ts)
- ストレージキーの定義:
  - `DATA_SELECTION_STORAGE_KEY = 'copilot_dashboard_data_selection'`: `{ version: 1, activeSource, scopeType, selectedKey, selectedReportMonth, filterCriteria, isDemoMode }` を JSON として保存。
  - `UPLOADED_DATA_STORAGE_KEY = 'copilot_dashboard_uploaded_data'`: オンデマンドCSVの集計済みデータ (`MonthlyReportAggregatedData`) を独立キーに保存。容量制限 (`QuotaExceededError`) 発生時も選択状態本体 (`DATA_SELECTION_STORAGE_KEY`) を破損させず安全にフォールバックする。
- 純粋関数・ヘルパー:
  - `loadPersistedDataSelection()` / `savePersistedDataSelection()`: 型・列挙値・正規表現パターンの妥当性を検証した上で読み書きする。
  - `loadPersistedUploadedData()` / `savePersistedUploadedData()`: `uploadedData` の保存・復元・削除を行う。
  - `resolveInitialScopeSelection(meta, persisted)`: 初回 `index.json` 読み込み時に、保存されていた `scopeType` / `selectedKey` が最新の `index.json` (`available_months` / `all_recorded_months` / `available_days` / `custom`) で有効かどうかを判定し、有効なら維持、存在しない場合は `default_scopes.latest_month` へ安全にフォールバックする。
  - `resolveInitialReportMonth(meta, persistedMonth)`: 保存されていた `selectedReportMonth` が `meta.available_reports` に存在する場合は維持し、存在しない場合は `default_scopes.latest_report` へフォールバックする。

### 2. DEMOモード判定とデータ管理フックの更新
#### [MODIFY] [src/application/services/DemoModeService.ts](../../../src/application/services/DemoModeService.ts)
- URL クエリパラメータ (`?demo=true` / `?demo=false` 等) および環境変数 (`VITE_MOCK_MODE`) を最優先しつつ、指定がない場合は `localStorage` (`copilot_dashboard_data_selection`) に保存された `isDemoMode` を参照して初期値を解決する。

#### [MODIFY] [dashboard/src/hooks/useDashboardData.ts](../../../dashboard/src/hooks/useDashboardData.ts)
- 初回マウント時に `loadPersistedDataSelection()` および `loadPersistedUploadedData()` から `activeSource`、`scopeType`、`selectedKey`、`selectedReportMonth`、`filterCriteria`、`uploadedData` を初期化する（`activeSource === 'user_upload'` かつ `uploadedData` が復元できない場合は `'live_metrics'` にフォールバック）。
- 初回 `loadIndex()` 実行時（`forcedDir === undefined`）に、保存済みの有効な期間・レポート月を上書きせず `resolveInitialScopeSelection` / `resolveInitialReportMonth` で解決する。明示的なモード切替時（`toggleDemoMode` からの `loadIndex(nextDir)`）は切り替え先モードのデフォルト期間へリセットする既存仕様を維持する。
- 選択状態（`activeSource` / `scopeType` / `selectedKey` / `selectedReportMonth` / `filterCriteria` / `isDemoMode`）および `uploadedData` の変更時に `localStorage` へ自動保存する。

### 3. ドキュメント・仕様書の同期
#### [MODIFY] [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md)
#### [MODIFY] [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
- §2.1 / §2.8 (`ActiveDataSelector` / `DataSelectionModal`) に、最後のデータ選択状態（データソース・期間・フィルター条件・オンデマンドCSV・DEMOモード）が `localStorage` により次回表示時も維持される仕様およびフォールバック規約を追記する。

### 4. テストの追加
#### [NEW] [src/tests/data-selection-persistence.test.ts](../../../src/tests/data-selection-persistence.test.ts)
- `dataSelectionStorage` の保存・復元・不正データサニタイズ・容量超過時フォールバック・`index.json` との期間整合性検証の単体テスト。
#### [MODIFY] [src/tests/ui/app-behavior.test.tsx](../../../src/tests/ui/app-behavior.test.tsx)
- 画面上でデータソース・期間・フィルター条件を変更した後にアンマウント＆再マウント（次回表示を模擬）した際、前回の選択状態とフィルター適用結果が維持されることを検証する RTL 挙動テストを追加。

## 検証計画 (Verification Plan)
- 5段階品質ゲート + Lint の実行:
  - `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
  - `npm run lint`
