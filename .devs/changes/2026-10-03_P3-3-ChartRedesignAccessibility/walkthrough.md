# Walkthrough: チャート刷新とアクセシビリティ対応 (P3-3 / #190)

## 変更内容
- `chart-series.ts` `rankWithOther`: 降順 上位 N + 「その他 (k 件)」。余り 1 件は畳まない。0 / 負 / 欠損は除外。
- `RankedBarChart`: ソート済み横棒。順位・名前・値・シェアを文字で表示、「その他」は斜線、行は `tabindex=0` + `aria-label`、「表で見る」切替。
- `AccessibleChart`: SVG チャートの `role="img"` 要約 + データ表切替。
- `CostAllocationCharts`: ドーナツ → `RankedBarChart`（上位 8）。稼働状況の積み上げ棒に斜線 / 水玉パターンと表切替。
- `UsageMetricsCharts`: 推移・言語別に表切替。`CostCenterBudgetCards`: 消化率バーを `progressbar` 化。
- `e2e/a11y.spec.ts`: axe-core（ライト / ダーク、critical / serious ゼロ）+ 表切替 / キーボード。`@axe-core/playwright` を devDependency に追加。
- SDD-07 §2.17（EN / JA）に規約と手動チェックリスト。

## 検証
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` + `npm run lint` + `npm run e2e`: すべて成功（テスト 848 件 pass、e2e 6 件 pass）。

## 対象外（別 Issue / 後続）
モデルレーダー（P3-7）、100% 積み上げ推移・ブレットチャート（予算再設計）。color-contrast の自動検査は既存配色全体の整理が必要なため手動チェックリストで扱う。
