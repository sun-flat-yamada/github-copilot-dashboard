# Metric Registry（品質属性付き）の導入 (P2-3 / #183)

指標を Registry に宣言し、品質属性（実測 / 推定 / 欠損 / デモ）を共通コンポーネントで表示する（D-01）。

## Proposed Changes
- [NEW] `src/domain/metrics/metric-registry.ts`: 指標定義、品質属性の型、`qualify()`（欠損 > デモ > 既定）。
- [NEW] `dashboard/src/components/common/MetricValue.tsx`: 品質別の共通表示（バッジ・「—（理由）」）。
- [MODIFY] `dashboard/src/components/KpiSummaryCards.tsx`, `App.tsx`: 4 KPI を移行、`isDemo` を渡す。
- [NEW] `src/tests/metric-registry.test.ts`
- [MODIFY] SDD-07 §2.14a / SDD-15 §7.4（日英）

## Scope
指標カタログ v1（定義・窓・出典の表示）は P3-1。他ビューの移行は段階的に別 Issue。

## Verification Plan
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`、`npm run lint`
