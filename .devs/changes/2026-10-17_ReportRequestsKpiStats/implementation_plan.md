# 月次レポート 総リクエスト/クレジット カードにおける単位表記明確化とアカウント別統計（最大・中央・最小）併記 (#339)

## 背景と目的
月次レポートの **`総リクエスト / クレジット` カード (`report_kpi_requests`)** について、以下の課題を解決する：

1. **表記単位（AIC vs リクエスト）の明確化**
   - 従来はカードタイトルが「総リクエスト / クレジット」、サブテキストが「リクエスト / AIC 呼出総量」と併記されており、表示されている数値が「リクエスト数」なのか「AI クレジット (AIC)」なのか判別できなかった（また AIC のみのレポートデータで 0 と表示される課題もあった）。
   - 選択されたデータ（`reportData`）の内容に基づき、以下の通り明確に区別・動的表示する：
     - **リクエストのみ**: タイトル「総リクエスト数」、バッジ `リクエスト`、単位 `req`
     - **AI クレジットのみ**: タイトル「総 AI クレジット (AIC)」、バッジ `AIC (クレジット)`、単位 `AIC`
     - **両方存在**: タイトル「総リクエスト & AI クレジット」、バッジ `リクエスト & AIC`、リクエスト数 (`req`) と AIC 消費量 (`AIC`) を両方明記
     - **実績なし**: タイトル「総リクエスト / クレジット」、値 `0`、利用実績なし
2. **利用のあったアカウントにおける最大値・中央値・最小値の併記**
   - 選択されているデータ（フィルター適用時はフィルター後のアカウント群）において、利用実績（値 > 0）のあったユニークアカウントを抽出。
   - 利用アカウント数、およびその中での **最小値 (Min)**、**中央値 (Median)**、**最大値 (Max)** を計算してカード内に併記する。
   - 未利用アカウント（0 または無効値）は中央値・最小値の母集団から除外する。利用実績が 0 件の場合は `—` と表示し、無意味なゼロや外れ値で誤認させない。

---

## 変更ファイル一覧

### 1. アカウント統計算出ユーティリティ
#### [NEW] `dashboard/src/utils/accountStats.ts`
- `computeActiveAccountStats(values: (number | null | undefined)[]): ActiveAccountStats`
  - 値 > 0 の要素のみを対象にソートし、`activeCount`、`min`、`median`（偶数個の場合は 2 数の平均、小数第 1 位まで）、`max` を算出。要素が 0 件の場合は `activeCount: 0`、各統計値は `null` を返す。
- `formatStatValue(val: number | null | undefined, unit?: string): string`
  - null の場合は `—`、数値の場合は 3 桁区切り + 単位を付与。

### 2. 月次レポート KPI カードの改修
#### [MODIFY] `dashboard/src/components/monthly-report/MonthlyReportKpis.tsx`
- `report_kpi_requests` カード（`SingleMonthlyReportKpiCard` および `MonthlyReportKpis`）において：
  - 選択中の `reportData.user_details` からリクエスト利用値・AIC利用値を抽出。
  - `reportData.overview` および `extractTotalAiCredits(reportData)` と連動して、リクエストのみ / AIC のみ / 両方の種別判定を行う。
  - 数値に単位 (`req` / `AIC`) を付加し、バッジとタイトルで種別を明示。
  - カード下部に利用アカウント数（実績 > 0）と最小値・中央値・最大値の 3 カラムマイクログリッドを表示。

### 3. 仕様書・テストの更新
#### [NEW] `src/tests/account-stats.test.ts`
- `computeActiveAccountStats` のゼロ件、単一要素、奇数個、偶数個、ゼロ除外などのユニットテスト。
#### [NEW] `src/tests/ui/monthly-report-requests-kpi.test.tsx`
- `MonthlyReportKpis` におけるリクエストのみ、AIC のみ、両方、実績なしの各パターンでの表示検証（タイトル・バッジ・単位・最小値・中央値・最大値）。
#### [MODIFY] `docs/specifications/07_dashboard_ui_ux_spec.ja.md` および `docs/specifications/07_dashboard_ui_ux_spec.md`
- `総リクエスト / クレジット` カードの表示仕様およびアカウント統計併記の仕様（Section 2.20）を追記。

---

## 検証計画
### 自動テスト
- `npx tsx --test src/tests/account-stats.test.ts`
- `npx tsx --test src/tests/ui/monthly-report-requests-kpi.test.tsx`
- `npm run fork:verify && npm run typecheck && npm run lint && npm test && npm run secret-scan && npm run build`
