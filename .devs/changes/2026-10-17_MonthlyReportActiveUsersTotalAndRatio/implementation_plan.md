# Implementation Plan: Monthly Report Active Users Total and Ratio (#336)

月次レポート (Monthly Usage Report) の KPI サマリーカード「レポート内アクティブ人数」(`report_active_users`) において、現在アクティブ人数単体のみが表示されているため、選択しているデータの総数 (分母) および割合 (%) を併記する改修の計画書。

## User Review Required
> [!NOTE]
> - **分母 (総数) の定義**: フィルター適用時にも選択しているデータ全体の総規模がわかるよう、ヘッダーの `ActiveDataSelector` (`queryPopulation`) と一致させ、未フィルターの元レポートデータ (`rawCurrentReportData`) の全ユーザー数を分母とします。未フィルター時はレポート全体の人数が分母 (100.0%) となります。
> - **デザインと配置**: メインの数値 (`text-2xl`) の横にベースラインを揃えて `/ {total} 名 ({percentage}%)` を併記します (例: `16 / 16 名 (100.0%)`、フィルター時 `4 / 16 名 (25.0%)`)。

## Proposed Changes

### Dashboard Views & Components

#### [MODIFY] [dashboard/src/views/types.ts](../../../dashboard/src/views/types.ts)
- `ViewContext` に `rawCurrentReportData?: MonthlyReportAggregatedData | null;` を追加し、ビュー層でフィルター前の元データにアクセス可能にする。

#### [MODIFY] [dashboard/src/AppShell.tsx](../../../dashboard/src/AppShell.tsx)
- `useDashboardData` から取得している `rawCurrentReportData` を `viewContext` に渡す。

#### [MODIFY] [dashboard/src/views/overview/View.tsx](../../../dashboard/src/views/overview/View.tsx)
- `ctx` から `rawCurrentReportData` を受け取り、`<MonthlyReportKpis reportData={currentReportData} rawReportData={rawCurrentReportData} />` として渡す。

#### [MODIFY] [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
- `MonthlyReportKpisProps` に `rawReportData?: MonthlyReportAggregatedData | null;` を追加。
- 「レポート内アクティブ人数」カード (`report_active_users`) にて、`activeUsers` と `totalUsers` (分母) および割合 `ratioText` を算出。
- アクティブ人数の横に `/ {totalUsers} 名 ({ratioText})` を併記表示する。
- テスト用セレクター (`data-testid="report-active-users-count"`, `data-testid="report-active-users-ratio"`) を付与。

### Unit & Regression Tests

#### [NEW] [src/tests/ui/monthly-report-kpis.test.tsx](../../../src/tests/ui/monthly-report-kpis.test.tsx)
- `MonthlyReportKpis` の表示テストを追加:
  - 未フィルター時にアクティブ人数、総数、100.0% が正しく表示されること。
  - フィルター適用時 (rawReportData 指定時) に絞り込み後のアクティブ人数、元データの総数、算出された割合 (%) が正しく表示されること。
  - totalUsers が 0 の場合でもゼロ除算なく安全に表示されること。

## Verification Plan

### Automated Tests
- `npm run fork:verify`
- `npm run typecheck`
- `npm test -- src/tests/ui/monthly-report-kpis.test.tsx`
- `npm test`
- `npm run secret-scan`
- `npm run build`
- `npm run change-dev:plan-check`

### Manual Verification
- デモモードの月次レポート (2026-09) 表示時に `16 / 16 名 (100.0%)` と表示されることを確認。
- 部署やタグ等でフィルターした際に、該当人数 / 16 名 (割合%) と追従して表示されることを確認。
