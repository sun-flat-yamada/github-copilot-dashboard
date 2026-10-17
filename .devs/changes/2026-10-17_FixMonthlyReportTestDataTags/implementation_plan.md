# Fix: 月次レポート選択時にテストデータでTagが表示されない問題の修正 (#389)

テストデータ環境（`src/tests/fixtures/auto-collected-data-fixtures.ts` / `src/tests/ui/test-harness.ts`）において、「月次レポート（登録済み月次利用レポート）」を選択した際にデータが 404 となり、Tag が一切表示されない問題を修正します。

## User Review Required
> [!NOTE]
> `CHG_DEV_AUTO_PILOT` が有効 (`enabled: true`) のため、プランレビューは proceed-and-report ポリシーに従い自動進行します。

## Proposed Changes

### 1. Test Dataset & Fixtures
#### [MODIFY] [src/tests/fixtures/auto-collected-data-fixtures.ts](../../../src/tests/fixtures/auto-collected-data-fixtures.ts)
- `TEST_USERS_MATRIX`（全13名のテストユーザー、Tag情報含む）に基づき、各月（`2026-09`, `2026-08`）の `MonthlyReportAggregatedData` を生成する `buildMonthlyReportTestDataset()` 関数を追加。
- `createAutoCollectedTestDataset()` の返却値に `reports: Record<string, MonthlyReportAggregatedData>` を含める。

#### [MODIFY] [src/tests/ui/test-harness.ts](../../../src/tests/ui/test-harness.ts)
- `buildFileMap` 関数において、`${baseDir}/reports/${month}.json` を仮想ファイルマップに配置し、テスト実行時の `fetch` に対して 200 OK で月次レポートデータを返却できるようにする。

### 2. UI Components & Resilience
#### [MODIFY] [dashboard/src/components/layout/DataSelectionModal.tsx](../../../dashboard/src/components/layout/DataSelectionModal.tsx)
- STEP 1 で「月次レポート」カードをクリックした際、`localReportMonth` が空文字または未設定の場合に `availableReports[0]` を安全にフォールバック設定する。

### 3. Automated Tests
#### [NEW / MODIFY] [src/tests/ui/data-selection-modal-realtime-candidates.test.tsx](../../../src/tests/ui/data-selection-modal-realtime-candidates.test.tsx)
- `createAutoCollectedTestDataset()` を用いたテストデータ環境下で、月次レポート選択時に `TEST_USERS_MATRIX` の Tag（`backend`, `lead`, `frontend`, `ai-ml`, `sre` 等）が正しく STEP 2 の Tag 候補として抽出・表示されることを検証するテストケースを追加。

## Verification Plan

### Automated Tests
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
- 単体・UIテスト:
  - `npx tsx --test src/tests/ui/data-selection-modal-realtime-candidates.test.tsx`
  - `npx tsx --test src/tests/auto-collected-selection-matrix.test.ts`
  - `npx tsx --test src/tests/ui/app-behavior.test.tsx`

### Manual Verification
- テストデータ環境でのモーダル操作および Tag ボタンのレンダリング確認。
