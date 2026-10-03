# Walkthrough: 1 年推移（月次締めからの実系列、前年比）(P3-6 / #193)

## 変更概要
- `src/processor/yearly-trend.ts`（新規）: 翌月第 5 営業日で締めを導出（確定 / 暫定）、暦月 12 か月の連続系列、欠損月は `missing`（null、0 で補完しない）、前年同月比（差・変化率・理由）。
- `PipelineOrchestrator`: 24 か月前までの保存済み月次を読み、`rolling-1year.json` に `schema_version: 2` / `window` / `close_rule` / `points` を追加（`months` / `trends` は互換のまま）。
- 指標カタログ: `yoy_spend_change` / `yoy_active_seats_change`。
- フロント: `loadYearlyTrendDataset`、`YearlyTrendPanel`（凡例は文言 + パターン、欠損は線を切る、表で見る、前年比は「—（理由）」）、概要ビューに「1 年推移」セクション、`ViewContext.dataBaseDir`。
- SDD-05（§2.6）/ SDD-06（§4.6）/ SDD-07（§2.18）を EN / JA で更新。

## 判断・限界
- P4-2（月次締め）は未マージ。Issue の方針どおり暫定表示で先行し、締めは暦から導出するだけ（祝日は考慮しない）。「確定」は締め日を過ぎたことを示し、数値の凍結・チェックサム・改訂版は P4-2 の責務。画面と SDD に明記した。

## 検証
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`: すべて成功（916 テスト合格）。`npm run lint`: 成功。
- 新規テスト: `src/tests/yearly-trend.test.tsx`（締め日の境界、確定 / 暫定、欠損月、前年比の各ケース、UI 表示）、`pipeline-degradation.test.ts`（出力の `points`）、`metric-catalog.test.ts`（漏れ防止）。
