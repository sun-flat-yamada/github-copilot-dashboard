# チャート刷新とアクセシビリティ対応 (P3-3 / #190)

親 Issue: #174（Phase 3）。前提 P2-6（Playwright スモーク基盤）と P3-1/P3-2 はマージ済み。付録 A.5.2 のチャート刷新と D-03（チャート選択）/ D-07（アクセシビリティ）の解消を行う。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の受け入れ基準に限定する。モデルレーダー（ドットプロット化）は P3-7 の正規化見直しと一体のため対象外（Issue 側の分担どおり）。

> [!WARNING]
> a11y の自動検査は axe-core（`@axe-core/playwright`）を devDependency に追加して P2-6 の Playwright スモークに載せる。ブラウザ未導入環境（CI は `playwright install` 済み）に依存する点は既存スモークと同じ。

## Proposed Changes
### 純関数
#### [NEW] `dashboard/src/utils/chart-series.ts`
- `rankWithOther(items, topN)`: 値の降順に並べ、上位 N + 「その他（k 件）」へ集約。同値は名前順で安定。0 以下・非有限値は除外。シェア（%）を付与。

### コンポーネント
#### [NEW] `dashboard/src/components/common/RankedBarChart.tsx`
- ソート済み横棒（上位 N + その他）。ラベル・値・シェアを必ず文字で表示（色に依存しない）。「その他」は斜線パターンで区別。各行はキーボードフォーカス可能で詳細を `aria-label` に持つ。「表で見る / グラフで見る」切替で `<table>`（caption 付き）を表示。
#### [NEW] `dashboard/src/components/common/AccessibleChart.tsx`
- Recharts チャート用のラッパー。要約 `role="img"` + `aria-label`、「表で見る」切替（データ表）。
#### [MODIFY] `dashboard/src/components/CostAllocationCharts.tsx`
- ドーナツ → `RankedBarChart`（上位 8 + その他）。稼働状況の積み上げ棒は `AccessibleChart` + 斜線パターン（遊休 / 導入期間を色以外でも判別）。
#### [MODIFY] `dashboard/src/components/UsageMetricsCharts.tsx`
- 推移・言語別チャートを `AccessibleChart` で包み、データ表への切替を提供。
#### [MODIFY] `dashboard/src/components/CostCenterBudgetCards.tsx`
- 消化率バーに `role="progressbar"` と値・文言を付与（状態は既にアイコン + 文言）。

### テスト
- `src/tests/chart-series.test.ts`（純関数）、`src/tests/ranked-bar-chart.test.ts`（SSR マークアップ: 文字ラベル、その他、表、aria）。
- `e2e/a11y.spec.ts`: axe による自動検査（ライト / ダーク）+ 表切替・キーボード操作。

### 仕様
- SDD-07（EN/JA）に §2.17 チャートとアクセシビリティ規約 + 手動チェックリストを追加。

## Verification Plan
- 品質ゲート 5 点 + `npm run lint` + `npm run e2e`。
