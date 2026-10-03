# 1 年推移（月次締めからの実系列、前年比）(P3-6 / #193)

親 Issue: #174（Phase 3）。指摘 B-01 の残り（実系列化は P0-4 で済み。本タスクは「確定 / 暫定の区別」「欠損月の扱い」「前年比」「画面への表示」）を解消する。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 3 点（推移データセットの再構成と前年比 / 暫定・確定の区別 / 欠損月を 0 で補完しない）に限定する。

> [!WARNING]
> 前提の P4-2（月次締め・改訂履歴）は未着手でマージされていない。Issue は「無い間は暫定表示で先行可能」としているため、本 PR では **締めのルールだけを暦から導出**する（翌月 5 営業日 = 平日のみ・祝日は考慮しない）。締め日以降の月を「確定」、それ以前を「暫定」と表示する。凍結・チェックサム・改訂版の保存は P4-2 の責務であり、本 PR では実装しない（確定表示は「締め日を過ぎた」ことを示し、数値の不変性は P4-2 で保証する）。この限界は画面と SDD に明記する。

## Proposed Changes
### ドメイン / 集計
#### [NEW] `src/processor/yearly-trend.ts`
- `MONTH_CLOSE_BUSINESS_DAYS = 5` と `monthCloseDate(month)`（翌月の第 5 営業日、UTC）、`monthCloseStatus(month, now)`（closed / provisional）。
- `buildYearlyTrend({ endMonth, entries, now })`: 終端月までの暦月 12 か月（古い順）の `YearlyTrendPoint[]` を作る。保存が無い月は `missing`（値は null、0 で補完しない）。各点に前年同月比（`yoy`）を付ける。
- 前年比は指標ごとに `current / prior / delta / change_rate / reason`。当月・前年のどちらかが欠損、前年が 0（変化率）の場合は null と理由（「—（理由）」で表示）。
- `yearlyTrendMonthsNeeded(endMonth)`: 窓 12 か月 + 前年同月 12 か月の対象月一覧。

#### [MODIFY] `src/domain/entities/copilot.ts`
- `RollingTrendDataset` に任意の `schema_version` / `window` / `close_rule` / `points` を追加（旧ファイルでは存在しない）。既存の `months` / `trends` は互換のまま残す。

#### [MODIFY] `src/application/pipeline/PipelineOrchestrator.ts`
- 窓外（前年同月）を含む保存済み月次から `RollingTrendEntry` を作り、`buildYearlyTrend` の結果を `rolling-1year.json` に出力する。

### 指標カタログ
#### [MODIFY] `src/domain/metrics/metric-registry.ts`
- 新指標 `yoy_spend_change`（利用費用 前年同月比）、`yoy_active_seats_change`（シート数 前年同月比）をカタログ登録（定義・窓・出典・注意点）。

### フロント
#### [MODIFY] `dashboard/src/dataset/datasetLoader.ts`
- `loadYearlyTrendDataset(baseDir)`: `trends/rolling-1year.json` を `getCandidateDataUrls` で取得（DEMO への暗黙フォールバックなし、失敗は failed）。
#### [NEW] `dashboard/src/components/YearlyTrendPanel.tsx`
- 12 か月の推移（費用の棒 / 受諾率の線。確定と暫定を別の塗り分け + 凡例テキスト）、欠損月は線を切り棒を出さない。`AccessibleChart` で表でも見られる。前年同月比を表に表示（欠損は「—（理由）」）。
#### [MODIFY] `dashboard/src/views/overview/View.tsx` / `views/types.ts` / `AppShell.tsx`
- `ViewContext.dataBaseDir` を追加し、概要ビューの詳細分析に「1 年推移」セクションを追加（新ビューは増やさない）。

### テスト
- 締め日（5 営業日）の境界（月またぎ・週末）、確定 / 暫定の判定、欠損月が null で 0 にならないこと、前年比（前年なし・欠損・前年 0・通常）、窓の暦月連続性、旧ファイル互換、パイプライン出力、UI の表示（欠損の理由・暫定表示・確定表示）、カタログ漏れ防止。

### 仕様
- SDD-05（§ trends 出力形式）/ SDD-06（前年比・締めルール）/ SDD-07（1 年推移の表示）を EN / JA で同期。

## Verification Plan
- 品質ゲート 5 点 + `npm run lint`。
