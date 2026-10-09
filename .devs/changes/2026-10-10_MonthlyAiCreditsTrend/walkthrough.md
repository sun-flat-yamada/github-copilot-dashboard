# Walkthrough: 確定月次CSVデータに基づく月別・日別 AI Credit 消費推移グラフ新設

確定月次CSVデータ（Monthly Usage Report）に基づき、選択したデータ範囲における月ごとのAI Credit消費推移、および指定月内の日ごとのAI Credit消費総量の増加を可視化するグラフ機能を新設しました。

## 実装内容の概要

### 1. ドメイン & パーサー層の拡張
- `src/domain/entities/copilot.ts`:
  - `ReportDailyTrend` インターフェースに `credits?: number` を追加。
- `src/processor/report-parser.ts`:
  - `ReportParser.aggregate()` の日別集計マップ `dailyMap` において、`dayStat.credits += rowCredits` の集計を追加し、日別トレンドに `credits` を出力するように拡張。

### 2. データ集計・ユーティリティ (`monthlyCreditsTrend.ts`)
- `dashboard/src/utils/monthlyCreditsTrend.ts`:
  - `extractTotalAiCredits`: `quantity_by_unit`, `sku_breakdown`, `daily_trends`, または公式単価換算（1 credit = $0.01）から月次AI Credit総量を安全に抽出。
  - `calculateDailyCreditsProgression`: 指定月の日別トレンドから、当日の消費量および月末に向けた日別累積消費総量の増加推移を計算。
  - `buildMonthlyCreditsTrend`: 登録されている複数月の確定月次データを時系列ソートし、月次クレジット消費量および前月比 (MoM) を算出。
  - `filterCreditsTrendByRange`: ユーザーが選択した開始月〜終了月の範囲でデータを切り出し。

### 3. UI コンポーネント (`MonthlyCreditsTrendPanel.tsx`)
- `dashboard/src/components/monthly-report/MonthlyCreditsTrendPanel.tsx`:
  - **データ範囲選択コントロール**: 開始月・終了月のドロップダウンセレクターおよび「全期間」クイック選択ボタン。
  - **グラフ 1 (月次変化)**: 選択範囲内の月ごとのAI Credit消費推移棒グラフ。棒をクリックすると即座に指定月が切り替わるインタラクティブ連動。
  - **グラフ 2 (指定月内の変化)**: 指定月における、日ごとのAI Credit消費総量の増加を見る累積エリアチャート＋日別消費量バーグラフ（「累積＋日次」「累積総量」「日別消費」の表示切替付き）。
  - **アクセシビリティ (`AccessibleChart`)**: スクリーンリーダー向けの表形式サマリー切替ボタンおよびARIA属性を完全準拠。

### 4. 画面統合
- `dashboard/src/components/views/CreditsView.tsx`: AI Credits 分析画面の末尾に「確定月次 AI Credit 消費推移」パネルを統合。
- `dashboard/src/views/credits/View.tsx`: `CreditsView` にコンテキスト（データディレクトリやレポートデータ）を伝達。
- `dashboard/src/components/monthly-report/MonthlyReportCharts.tsx`: 確定月次レポート画面にもパネルを統合。
- `dashboard/src/views/overview/View.tsx`: Overview ビューから `MonthlyReportCharts` に必要な props を伝達。

## テストと検証結果

### 1. 自動テスト
- `src/tests/processor/monthly-credits-trend.test.ts`:
  - `ReportParser` の日別クレジット集計テスト (PASS: 5/5)
- `src/tests/monthly-credits-trend-view.test.ts`:
  - 月次変化グラフ用推移データの集計・生成テスト (PASS)
  - データ範囲絞り込みテスト (PASS)
  - 指定月内の日別累積消費総量増加推移テスト (PASS)
  - フォールバック換算テスト (PASS: 4/4)

### 2. 品質ゲート
- `npm run typecheck`: PASS (型エラー 0)
- `npm run secret-scan`: PASS (651 files clean, 漏洩 0)
- `npm run build`: PASS (Vite バンドルサイズ制限準拠)
- `npm run lint`: PASS (ESLint 0 errors)
