# 確定月次CSVデータに基づく月別・日別 AI Credit 消費推移グラフ新設 実装計画

確定月次CSVデータ（Monthly Usage Report）に基づき、選択したデータ範囲における月ごとのAI Credit消費推移、および指定月内の日ごとのAI Credit消費総量の増加を可視化するグラフ機能を新設します。

## ユーザー確認事項 (User Review Required)

> [!IMPORTANT]
> **AI Creditの算出仕様について**
> 1. CSVに明示的なAI Credit明細（SKU: `copilot_ai_credit`、`unit_type: credits`、または `ai_credits_consumed` 列）が存在する場合は、その実数値を最優先で採用します。
> 2. 明示的なcredit行がなくリクエスト/従量課金行のみのCSVに対しても、GitHub公式換算仕様（`1 AI Credit = $0.01`）に基づくフォールバック換算を行い、どんな確定月次CSVでも適切にAI Credit推移を把握できるようにします。

## 変更概要 (Proposed Changes)

### 1. ドメイン & パーサー層
#### [MODIFY] [src/domain/entities/copilot.ts](../../../src/domain/entities/copilot.ts)
- `ReportDailyTrend` インターフェースに `credits?: number` を追加。

#### [MODIFY] [src/processor/report-parser.ts](../../../src/processor/report-parser.ts)
- `ReportParser.aggregate()` において、日別マップ (`dailyMap`) で日ごとのAI Credit消費量 (`credits`) を集計し、`daily_trends` に出力するよう拡張。

### 2. データ取得・集計層
#### [NEW] [dashboard/src/utils/monthlyCreditsTrend.ts](../../../dashboard/src/utils/monthlyCreditsTrend.ts)
- 登録されている確定月次CSV（`available_reports`）から月次レポートを読み込み、月ごとのAI Credit消費量、前月比、および月内の日別・累積消費総量を整形するヘルパー関数群。
- `extractMonthlyCreditsPoint(report: MonthlyReportAggregatedData): MonthlyCreditsPoint`
- `calculateCumulativeDailyCredits(dailyTrends: ReportDailyTrend[]): CumulativeDailyCredit[]`

### 3. UI コンポーネント層
#### [NEW] [dashboard/src/components/monthly-report/MonthlyCreditsTrendPanel.tsx](../../../dashboard/src/components/monthly-report/MonthlyCreditsTrendPanel.tsx)
- **データ範囲選択コントロール**: 開始月・終了月（または全期間）の絞り込みセレクター。
- **グラフ 1 (月次変化)**: 選択したデータ範囲における、月ごとのAI Credit消費推移棒グラフ/折れ線（月をクリックすると指定月が切り替わる）。
- **グラフ 2 (指定月内の変化)**: 指定月における、日ごとのAI Credit消費総量の増加を見る累積折れ線/エリアグラフ、および日別消費量バー。
- **AccessibleChart準拠**: スクリーンリーダー用の表形式サマリー (`AccessibleChart`) を完備。

#### [MODIFY] [dashboard/src/components/views/CreditsView.tsx](../../../dashboard/src/components/views/CreditsView.tsx)
- `CreditsView` に「確定月次CSV AI Credits 推移分析」セクションを追加。

#### [MODIFY] [dashboard/src/components/monthly-report/MonthlyReportCharts.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportCharts.tsx)
- 確定月次レポート画面にもAI Credit推移セクションを組み込み、両画面から一貫して利用可能に。

### 4. テスト層
#### [NEW] [src/tests/processor/monthly-credits-trend.test.ts](../../../src/tests/processor/monthly-credits-trend.test.ts)
- `ReportParser` の `daily_trends.credits` 集計ロジックのユニットテスト。
- 月次・日次累積クレジット計算の整合性テスト。

#### [NEW] [dashboard/src/components/monthly-report/__tests__/MonthlyCreditsTrendPanel.test.tsx](../../../dashboard/src/components/monthly-report/__tests__/MonthlyCreditsTrendPanel.test.tsx)
- コンポーネントの描画、月次データ範囲の切り替え、指定月内の日別・累積グラフ表示のテスト。

## 検証計画 (Verification Plan)
1. **自動テスト**:
   - `npm run test` による全ユニットテスト・統合テストの実行。
   - `npm run typecheck` による型整合性チェック。
   - `npm run secret-scan` によるシークレットスキャン。
   - `npm run build` によるビルド正常確認。
2. **手動・目視確認**:
   - デモデータ (`2026-08`, `2026-09` 等) において、月次変化グラフおよび日別累積増加グラフが正しく描画されることを確認。
