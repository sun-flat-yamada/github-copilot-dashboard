# Implementation Plan - Show Active and Non-Active Breakdown per Copilot Plan (#353)

月次レポート概要の「レポート内アクティブ人数」(`report_kpi_active_users`) カードにおいて、Copilot プラン内訳 (Enterprise / Business) をさらにアクティブ人数およびノンアクティブ人数に分けて表示する。

## Proposed Changes

### 1. ドメインエンティティ定義
#### [copilot.ts](../../../src/domain/entities/copilot.ts)
- `ReportUserDetail` インターフェースに `plan_type?: CopilotPlanType;` および `status?: UserSeatStatus;` をオプショナルフィールドとして追加し、型定義を整合させる。

### 2. UI コンポーネント
#### [MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
- `PlanUserCounts` インターフェース (`{ active: number; nonActive: number; total: number; }`) を定義。
- `CopilotPlanCounts` を `{ enterprise: PlanUserCounts; business: PlanUserCounts; }` に拡張。
- `extractCopilotPlanCounts` を改修:
  - ユーザー単位のアクティブ判定ロジック `isReportUserActive(u)` を実装。
    - `u.status` ('active'/'low_active' -> true, 'idle'/'never_used'/'inactive' -> false)
    - `u.is_active` boolean があれば優先
    - リクエスト数 > 0、クレジット消費 > 0、利用費用 > 0、最終活動日ありのいずれかを満たせば active、それ以外は nonActive
  - `user_details` に `plan_type` がある場合はユーザーごとにプラン×アクティブ/ノンアクティブを直接集計。
  - `user_details` にプラン情報がない場合は `sku_breakdown` のシート数量と `overview.total_active_users` から按分/フォールバック集計。
- `report_kpi_active_users` カードの表示レイアウトを更新:
  - Enterprise: `アクティブ X名 / ノンアクティブ Y名` (計 N名)
  - Business: `アクティブ A名 / ノンアクティブ B名` (計 M名)
  - 後方互換性テスト用の `data-testid` (`report-plan-enterprise-count`, `report-plan-business-count`, `report-plan-enterprise-active`, `report-plan-enterprise-inactive` など) を整備。

### 3. 仕様書同期
#### [07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md) & [07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
- セクション 2.14d を同期更新し、プラン内訳がアクティブ人数とノンアクティブ人数に分けて表示される仕様を明記。

### 4. テスト追加・更新
#### [monthly-report-kpis.test.tsx](../../../src/tests/ui/monthly-report-kpis.test.tsx)
- `user_details` の各プランにおいてアクティブとノンアクティブが混在するケースのテストを追加。
- `sku_breakdown` フォールバック時のアクティブ / ノンアクティブ計算テストを追加。

---

## Verification Plan

### Automated Tests
1. Unit tests:
   ```bash
   npx tsx --test src/tests/ui/monthly-report-kpis.test.tsx
   ```
2. Full 5-stage Quality Gate:
   ```bash
   npm run fork:verify
   npm run typecheck
   npm test
   npm run secret-scan
   npm run build
   ```
