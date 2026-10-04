# Walkthrough: モデルレーダー正規化見直し・内容ハッシュ版管理・外部化 (P3-7 / #195)

## 変更内容
- **正規化 (B-15)**: `benchmark-evaluator.ts` に `buildNormalizationContext` / `percentileRank` を追加。データセット内のパーセンタイル順位（`percentile-rank-v1`、20〜99、小数 1 桁）で軸スコアを算出し、固定アンカーによる 99 の頭打ちを解消。総合スコアは 6 軸の加重平均。コンテキスト無しは従来式（後方互換）。定性評価は絶対しきい値のまま。
- **モデル判定 (A-13)**: `model-catalog.ts`（正規 ID + 別名）。`normalizeModelId` は別名の完全一致（括弧書き・日付サフィックスのみ許容）。未知は `unknown:<raw>`、別名衝突は例外。
- **外部化と版管理**: `scripts/benchmark-data/benchmark-records.json`（43 モデル）。`content_hash`（sha256 先頭 16 桁）が同じなら版と `last_updated` を据え置き、内容が変わったときだけ連番を進める。
- **画面**: `ModelDotPlot`（軸ごとのスモールマルチプル、形 + 凡例、`AccessibleChart` で生値表）。`ModelRadarView` から recharts のレーダーを撤去。
- **SDD / 文書**: SDD-10 §2.6 / §3.1 / §3.2 / §6.1 / §6.1.1 / §6.1.2、SDD-07 §2.17（EN/JA）、ingestion / version skill と agent の参照更新。

## rule 8（二重同期）
- `dashboard/src/data/models.ts` は存在しない（実体は生成 JSON + `radar-constants.ts` のプリセット）。SDD-10 §6.1.2 に実在ファイルでの同期手順を明記。
- モデルの追加・削除・改名なし → `supported_models.md` は不変。カタログとレコードの一致をテストで強制。

## テスト
- `benchmark-normalization.test.ts`: 上位 GA モデル 10 件が coding / reasoning / Elo で同点にならない、順位境界、順序非依存、完全一致と未知 ID、ハッシュ安定・変化、版の据え置き / 繰り上げ。
- `model-dot-plot.test.ts`: 行・ドット・形・title・a11y。`radar-table-sort.test.ts`: 旧モーフィング検査をドットプロット使用の検査に置換。

## 品質ゲート
結果は PR 本文に記載（最終 rebase 後に実行）。
