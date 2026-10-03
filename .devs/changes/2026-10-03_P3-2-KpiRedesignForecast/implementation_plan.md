# KPI 再設計と前期比・月末予測 (P3-2 / #189)

親 Issue: #174（Phase 3）。前提 P3-1（指標カタログ v1, #188）はマージ済み。付録 A.5.2 の KPI 再設計と D-02（比較文脈なし）の解消を行う。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。予測は「推定」として推定バッジ（P2-3）で明示し、算出式・窓・信頼度を表示する。データ不足は 0 ではなく「—（理由）」とする。

> [!WARNING]
> 予測の入力は `daily_trends`（観測済みの日次値）のみ。シート費は日割りでほぼ一定のため、予測が効くのは主に AI Credits 消費量。前期データがない・カスタム期間のときは前期比を出さない（理由表示）。

## Proposed Changes
### ドメイン
#### [NEW] `src/domain/metrics/kpi-analysis.ts`（純関数）
- `compareToPrevious(current, previous, {higherIsBetter})`: 差分・変化率・方向。前期が欠損/0 のとき理由付きで算出不能を返す。
- `forecastMonthEnd(series, {month, now})`: 月末着地予測。式 = 当月実績累計 + 直近 7 観測日の平均 × 残日数。
  - 締め済み月（月末までの観測あり / 月が過去）は予測せず実績を返す。
  - 観測 7 日未満（月初）・カバレッジ 50% 未満は予測しない（理由付き）。
  - 信頼度 high / medium / low（観測日数・変動係数・カバレッジ）と予測レンジ（平均 ± 標準偏差）。
- `previousScopeKey(scopeType, key)`: 月次=前月 / 日次=前日 / 期間=なし。

#### [MODIFY] `src/domain/metrics/metric-registry.ts`
- 新 KPI を登録: `budget_utilization`（予算消化率）、`spend_forecast`（月末着地予測・費用）、`credits_forecast`（月末着地予測・AI Credits）。いずれも定義・式・窓・出典・注意点つき。予測は `defaultQuality: estimated`。

### フロント
#### [MODIFY] `dashboard/src/hooks/useDashboardData.ts` / `views/types.ts` / `AppShell.tsx`
- 前期スコープを取得（index に存在するときのみ）し、同じフィルターで再集計して `previousData` として ViewContext に渡す。

#### [MODIFY] `dashboard/src/components/KpiSummaryCards.tsx`、`views/overview/View.tsx`
- 並びを判断順（コスト → 利用定着 → 遊休 → 予算消化 → 受諾率（参考）に格下げ）へ再設計。
- 各 KPI に前期比（`PeriodDelta`）、費用と AI Credits に月末着地予測（`ForecastNote`: 式・窓・信頼度・レンジ、不足時は「—（理由）」）。全て MetricLabel / MetricValue 経由。
#### [NEW] `dashboard/src/components/common/PeriodDelta.tsx`, `ForecastNote.tsx`

### テスト
#### [NEW] `src/tests/kpi-analysis.test.ts`
- 予測式: 通常、欠損日、月初（不足）、締め済み月、カバレッジ不足、信頼度、前期比（0 除算・欠損）、前期キー。
#### [MODIFY] `src/tests/metric-catalog.test.ts`
- KpiSummaryCards の MetricLabel 下限を更新。新 KPI の孤児チェックは既存テストが担保。

### 仕様
#### [MODIFY] SDD-06 §（予測・前期比の算出式）、SDD-07 §2.14a（KPI 再設計）、SDD-16 カタログ一覧（EN/JA 同期）

## Verification Plan
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`、`npm run lint`
