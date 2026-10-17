# Walkthrough: 月次レポート「総リクエスト / クレジット」カードの表記明確化とアカウント別統計（最大・中央・最小）併記 (#339)

## 概要
Issue #339 に基づき、月次レポートの **`総リクエスト / クレジット` カード (`report_kpi_requests`)** について、表示されている数値が「リクエスト数」なのか「AI クレジット (AIC)」なのかを一目で判別できる動的表示へ刷新し、選択中のデータ内で利用実績（値 > 0）のあったアカウントにおける **最大値 (Max)**、**中央値 (Median)**、**最小値 (Min)** を併記する改修を完了しました。

---

## 変更内容

### 1. アカウント統計算出ユーティリティの新設
- [dashboard/src/utils/accountStats.ts](../../../dashboard/src/utils/accountStats.ts)
  - `computeActiveAccountStats(values)`: 正の利用実績（値 > 0）があるアカウントのみを対象にソートし、`activeCount`、`min`、`median`（偶数個の場合は 2 数の平均）、`max` を正確に算出。未利用アカウント（0 または無効値）は中央値・最小値の母集団から除外。
  - `formatStatValue(val, unit)`: 統計値が null の場合は `—`、数値の場合は 3 桁区切り＋単位付き文字列に整形。

### 2. 月次レポート KPI カードの刷新
- [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
  - **AIC vs リクエストの明確化**:
    - **リクエストのみ**: タイトル「総リクエスト数」、バッジ `リクエスト`、単位 `req`
    - **AI クレジットのみ**: タイトル「総 AI クレジット (AIC)」、バッジ `AIC (クレジット)`、単位 `AIC`
    - **両方存在**: タイトル「総リクエスト & AI クレジット」、バッジ `リクエスト & AIC`、リクエスト合計と AIC 消費量を個別行で併記
    - **実績なし**: タイトル「総リクエスト / クレジット」、バッジ `実績なし`、値 `0`
  - **利用アカウント統計の併記**:
    - カード下部に利用アカウント数（`実績 > 0: N 名`）を表示。
    - 最小値・中央値（インディゴ/アンバーで強調）・最大値の 3 カラムマイクログリッドを配置。
    - 両方存在する場合は、リクエスト統計と AIC 統計を個別に集計・表示。

### 3. 仕様書とテスト
- [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md) & [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md): Section 2.20 に仕様を明記。
- [src/tests/account-stats.test.ts](../../../src/tests/account-stats.test.ts): ゼロ除外・単一値・奇数個・偶数個中央値のユニットテスト（6 件）。
- [src/tests/ui/monthly-report-requests-kpi.test.tsx](../../../src/tests/ui/monthly-report-requests-kpi.test.tsx): リクエストのみ・AIC のみ・両方・実績ゼロ・グリッド全体の UI テスト（5 件）。

---

## 検証結果

### 自動品質ゲート
| 検査項目 | コマンド | 結果 |
| :--- | :--- | :--- |
| Plan First Gate | `npm run change-dev:plan-check` | ✅ Plan-first OK (5d57e67 -> 957768b) |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Clean (Exit 0) |
| TypeScript Check | `npm run typecheck` | ✅ Pass (Exit 0) |
| ESLint Check | `npm run lint` | ✅ Pass (Exit 0) |
| 統計・UI 単体テスト | `npx tsx --test src/tests/account-stats.test.ts src/tests/ui/monthly-report-requests-kpi.test.tsx` | ✅ 11/11 Pass (Exit 0) |
| 指標カタログ整合性 | `npx tsx --test src/tests/metric-catalog.test.ts` | ✅ 7/7 Pass (Exit 0) |
| Secret & PII Scan | `npm run secret-scan` | ✅ Clean: 0 secrets, PII or absolute paths (Exit 0) |
| Production Build | `npm run build` | ✅ Built in 3.28s, 169.03 kB / 300 kB budget (Exit 0) |
