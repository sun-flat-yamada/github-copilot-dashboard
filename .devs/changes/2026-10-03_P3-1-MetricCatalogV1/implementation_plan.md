# 指標カタログ v1・定義ツールチップ・窓の明示 (P3-1 / #188)

親 Issue: #174（Phase 3）。前提 P2-3（Metric Registry, #183）はマージ済み。付録 A.3.4 の指標カタログを Metric Registry の上に載せ、全 KPI に定義・窓・出典を表示する。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。判断結果 #2（個人表示は閲覧権限のある社員向け）を SDD に明記する。

## Proposed Changes
### ドメイン
#### [MODIFY] `src/domain/metrics/metric-registry.ts`
- `MetricDefinition` に `definition`（ja/en）、`formula`、`windowKind`（表示用の窓）、`caveats` を追加（カタログ v1）。
- 対象 KPI を全面登録: 概要 4 / 月次レポート 5 / 採用成熟度 4 / Agent 4 / クレジット 4。
- `windowLabel()` / `unitLabel()` / `describeMetric()`（ツールチップ文面）を提供。

### フロント
#### [NEW] `dashboard/src/components/common/MetricLabel.tsx`
- 指標名 + 定義ツールチップ（`title` と可視の窓チップ、`aria-describedby` 相当）。出典・窓を併記。
#### [MODIFY] KpiSummaryCards / MonthlyReportKpis / AdoptionMaturityView / AgentActivityView / CreditsView
- 全 KPI ラベルを `MetricLabel` に置換。窓はスコープ種別（日次/月次/期間）に追従。
- 個人指標（ユーザー別）は閲覧権限のある社員向けである旨を表示（UserDetailTable 見出し注記）。

### テスト
#### [NEW] `src/tests/metric-catalog.test.ts`
- 全定義が定義文・窓・出典・単位を持つ。
- 漏れ防止: KPI コンポーネントが参照する `metricId` / `qualify('...')` がすべてカタログに存在し、KPI コンポーネントは `MetricLabel` を使う（カタログ外の指標を表示すると失敗）。

### 仕様
#### [NEW] SDD-16 データ契約 & 指標カタログ（EN/JA）、README 索引（EN/JA）
#### [MODIFY] SDD-07 §2.14a（EN/JA）: カタログ v1・個人指標の位置づけ

## Verification Plan
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`、`npm run lint`
