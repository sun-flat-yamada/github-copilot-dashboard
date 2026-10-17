# Implementation Plan: 月次レポート「総リクエスト数」カードの分布グラフを横型ミニ箱ひげ図へ刷新 (#377)

## 1. 概要・背景
月次レポート「総リクエスト数」カード内の利用量分布について、従来の5階級ヒストグラム（棒グラフ）では「連続データや時系列推移に見えてしまう錯覚」や「ビンの粗さ」が課題となっていました。

本改修では、分布の可視化表現を **横型ミニ箱ひげ図（Horizontal Mini Box Plot / Range Bar）** へ刷新します。
最小値（Min）、第1四分位数（Q1: 25%）、中央値（Median: 50%）、第3四分位数（Q3: 75%）、最大値（Max）を物理的スケール（0〜100%）に直結させて描画することで：
1. **時系列データや連続面グラフとの誤認を完全に防止**。
2. **中心50%のアカウントがどのゾーン（箱: IQR）に密集しているか、および中央値の偏り・外れ値（最大値）への伸びを一目で把握可能**。
3. **カード内のレイアウトが極めてコンパクトかつ洗練された統計ダッシュボードに進化**。

---

## 2. 設計と計算ロジック

### A. 四分位数の算出ヘルパー
利用実績のある正の値の配列 `positiveValues`（昇順ソート済み、長さ $N \ge 1$）に対し、以下のパーセンタイル計算を導入：
- $p \in [0, 1]$ に対するパーセンタイル値の線形補間算出:
  - $index = (N - 1) \times p$
  - $lower = \lfloor index \rfloor, upper = \lceil index \rceil, weight = index - lower$
  - $value = \mathrm{round}(sorted[lower] \times (1 - weight) + sorted[upper] \times weight)$
- これにより、`min`, `q1` (25%), `median` (50%), `q3` (75%), `max` を算出。

### B. 横型ミニ箱ひげ図の描画（`RequestsBoxPlot`）
- **スケール正規化**:
  - レンジ $range = max - min$
  - $range > 0$ の場合:
    - 最小値位置: $0\%$ (左端)
    - 最大値位置: $100\%$ (右端)
    - 箱の左端 (Q1): $\frac{q1 - min}{range} \times 100\%$
    - 箱の幅 (IQR): $\frac{q3 - q1}{range} \times 100\%$
    - 中央値ライン (Median): $\frac{median - min}{range} \times 100\%$
  - $range = 0$ の場合（全件同値、または1名のみ）:
    - 中央 (50%) に単一のポイント・バーをレンダリング。
- **視覚スタイル**:
  - 全体コンテナ: `h-7 flex items-center relative w-full`
  - ヒゲ（Whisker Line）: 最小値から最大値までの横線（`h-0.5 bg-slate-700/80`）
  - ヒゲ端点（Caps）: 最小値および最大値の垂直チック（`w-0.5 h-3 bg-slate-500`）
  - 箱（Box / IQR）: Q1からQ3を覆う角丸ボックス（`bg-indigo-500/25 border border-indigo-400/60 rounded-xs h-4.5`）
  - 中央値（Median Line）: 箱を貫くアクセント垂直線（`w-1 bg-indigo-300 rounded-full h-5 shadow-xs`）
  - ホバーツールチップ:
    - `title="最小: 10 req | 25%(Q1): 20 req | 中央値: 50 req | 75%(Q3): 120 req | 最大: 300 req (四分位範囲 IQR: 100 req)"`
- **下部の代表値軸**:
  - 最小値（左端・左揃え）、中央値（中央強調バッジ）、最大値（右端・右揃え）を直結配置。

---

## 3. 変更対象ファイル
1. `dashboard/src/components/monthly-report/MonthlyReportKpis.tsx`:
   - 四分位数算出関数 `calculateBoxPlotStats` の実装。
   - `RequestsDistributionChart` を `RequestsBoxPlot`（横型ミニ箱ひげ図）へ置き換え。
2. `src/tests/ui/monthly-report-requests-kpi.test.tsx`:
   - 箱ひげ図（箱・ヒゲ・中央値ライン・Q1/Q3 ツールチップ）の検証テストへ更新。
3. `docs/specifications/07_dashboard_ui_ux_spec.ja.md` & `07_dashboard_ui_ux_spec.md`:
   - Section 2.20 項3 の仕様を横型ミニ箱ひげ図（Box Plot / レンジバー）へ更新。

---

## 4. 検証計画
- UI テストの実行 (`npm test`)
- フル品質ゲートの実行 (`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`)
