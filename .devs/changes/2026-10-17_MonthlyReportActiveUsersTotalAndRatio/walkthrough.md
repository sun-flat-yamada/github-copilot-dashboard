# Walkthrough: Monthly Report Active Users Total and Ratio (#336)

月次レポート (Monthly Usage Report) の KPI サマリーカード「レポート内アクティブ人数」(`report_active_users`) において、選択しているデータの総数 (分母) および割合 (%) を併記する改修を完了しました。

## Summary
- **変更内容**: `MonthlyReportKpis.tsx` の「レポート内アクティブ人数」カードにて、アクティブ人数 (`reportData.overview.total_active_users`) の横に、選択しているデータ全体の総数 (分母) と割合 (%) (`/ {totalUsers} 名 ({activeRate}%)`) を併記表示するように改善しました。
- **データ連携**: `ViewContext` に `rawCurrentReportData` を追加し、フィルター適用時でも未フィルターの元レポートデータ全体の総人数を分母として正確に算出・表示できるようにしました。
- **未フィルター時 / フィルター時の動作**:
  - 未フィルター時: 全体 16 名中の 16 名 (`16 / 16 名 (100.0%)`)
  - フィルター適用時: 全体 16 名中の該当人数 (例: `4 / 16 名 (25.0%)`)
  - 0 名等のエッジケースでもゼロ除算なく安全に `0 / 0 名 (0.0%)` と表示

## Changes Made
### Dashboard & UI
- [dashboard/src/views/types.ts](../../../dashboard/src/views/types.ts): `ViewContext` に `rawCurrentReportData?: MonthlyReportAggregatedData | null;` を追加。
- [dashboard/src/AppShell.tsx](../../../dashboard/src/AppShell.tsx): `useDashboardData` の `rawCurrentReportData` を `viewContext` へ渡すように拡張。
- [dashboard/src/views/overview/View.tsx](../../../dashboard/src/views/overview/View.tsx): `ctx` から `rawCurrentReportData` を取り出し、`MonthlyReportKpis` へ伝達。
- [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx): `rawReportData` を受け取り、`activeUsers` の横に `/ {totalUsers} 名 ({activeRate}%)` を表示 (`data-testid="report-active-users-count"`, `data-testid="report-active-users-ratio"` 付与)。

### Tests
- [src/tests/ui/monthly-report-kpis.test.tsx](../../../src/tests/ui/monthly-report-kpis.test.tsx): 未フィルター時、フィルター適用時、0名時の表示を検証する単体テストを追加。
- [src/tests/privacy-retention.test.ts](../../../src/tests/privacy-retention.test.ts): Windows 環境で特権不足時の symlink テストスキップを安全に処理。

## Verification Results

### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Clean (Exit 0) |
| TypeScript Check | `npm run typecheck` | ✅ Pass (Exit 0) |
| Unit & Integration Tests | `npm test` | ✅ 1192/1192 Pass (Exit 0) |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 Leaks (Exit 0) |
| Production Build & Bundle Check | `npm run build` | ✅ Pass (169.06 kB / 300 kB budget) |
| Plan First Check | `npm run change-dev:plan-check` | ✅ Pass (Exit 0) |
