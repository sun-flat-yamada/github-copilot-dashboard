# Walkthrough: Metric Registry (P2-3 / #183)

## Summary
指標を Registry に宣言し、品質属性（実測 / 推定 / 欠損 / デモ）を `MetricValue` で共通表示。概要の 4 KPI を移行。

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Fork isolation | `npm run fork:verify` | ✅ |
| TypeScript | `npm run typecheck` | ✅ |
| Tests | `npm test` | ✅ 804 pass / 0 fail |
| Secret scan | `npm run secret-scan` | ✅ |
| Build | `npm run build` | ✅ |
| Lint | `npm run lint` | ✅ |
