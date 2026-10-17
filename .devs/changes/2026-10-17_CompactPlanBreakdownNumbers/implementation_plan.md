# Implementation Plan - Compact Plan Breakdown Numbers Display (#358)

月次レポート概要の「レポート内アクティブ人数」(`report_kpi_active_users`) カードにおいて、プラン内訳の表記を `プラン内訳 (アクティブ / ノンアクティブ / 全数)` とし、Enterprise および Business の行には `124 / 26 / 150` のように数字のみを表示する。アクティブの数字のみ太字かつ表示色を合わせて直感的に識別できるようにする。

## Proposed Changes

### 1. UI コンポーネント改修
#### [MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
- `report_kpi_active_users` カードのプラン内訳ヘッダーを更新:
  - `プラン内訳 (`<span className="text-emerald-400 font-bold">アクティブ</span>` / ノンアクティブ / 全数):`
- 各プラン（Enterprise, Business）の表示を更新:
  - `Enterprise:` `<b className="font-bold text-emerald-400">{enterprise.active}</b> / <span className="text-slate-400">{enterprise.nonActive}</span> / <span className="text-slate-400">{enterprise.total}</span>`
  - `Business:` `<b className="font-bold text-emerald-400">{business.active}</b> / <span className="text-slate-400">{business.nonActive}</span> / <span className="text-slate-400">{business.total}</span>`
  - テストID (`report-plan-enterprise-active`, `report-plan-enterprise-inactive`, `report-plan-enterprise-total`, `report-plan-business-active`, `report-plan-business-inactive`, `report-plan-business-total`) を付与。
  - 後方互換性テストID (`report-plan-enterprise-count`, `report-plan-business-count`) を維持。

### 2. 仕様書同期
#### [07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md) & [07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
- セクション 2.14d を同期更新し、プラン内訳のヘッダー表記 `プラン内訳 (アクティブ / ノンアクティブ / 全数)` および行表示 `アクティブ / ノンアクティブ / 全数` (数字のみ、アクティブのみ太字・強調色) を記載。

### 3. テスト更新
#### [monthly-report-kpis.test.tsx](../../../src/tests/ui/monthly-report-kpis.test.tsx)
- 新しいフォーマット（数字のみ、全数追加）およびヘッダーテキストの表示検証テストを同期更新。

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
