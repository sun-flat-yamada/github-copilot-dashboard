# モデルレーダーの正規化見直し・内容ハッシュ版管理・ベンチマーク外部化 (P3-7 / #195)

親 Issue: #174（Phase 3）。指摘 B-15（固定アンカーによる頭打ち・版が内容と無関係・値がコード埋め込み）と A-13（モデル名の部分一致判定）を解消する。P3-3 で据え置かれたレーダーのドットプロット化もここで行う。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 4 点（正規化 / 版管理と外部化 / レーダー置換 / 仕様同期）に限定する。

> [!WARNING]
> `dashboard/src/data/models.ts` はこのリポジトリに存在しない（UI カタログは `dashboard/public/data/model-benchmarks.json` を `update-benchmarks.ts` が生成し、`radar-constants.ts` がプリセットを持つ）。rule 8 の同期対象は実在する 3 点（`supported_models.md` / `scripts/update-benchmarks.ts` とその JSON データ / プリセット定義）として扱い、モデル追加・削除は行わないため `supported_models.md` の表は不変であることを確認し、同期手順を SDD-10 に明記する。

## Proposed Changes
### 正規化（B-15）
#### [MODIFY] `src/processor/benchmark-evaluator.ts`
- 固定アンカー（SWE 75 / AIME 90 / Elo 1460 など）をやめ、データセット内のパーセンタイル順位（同値は平均順位）で軸スコアを出す `buildNormalizationContext(rawList)` / `computeRadarScores(raw, context?)` を追加する。コンテキスト未指定時は従来のアンカー式（後方互換）。
- スコアは小数 1 桁で保持し、上位同点を避ける。生値は `raw_metrics` に常に併記される。

### モデル判定（A-13）
#### [NEW] `src/processor/model-catalog.ts`
- 正規 ID + 別名リストのカタログ。判定は別名を正規化（小文字・英数字のみ）した **完全一致**。未知の名前は `unknown:<raw>` を返し、部分一致で既存 ID に誤分類しない。
#### [MODIFY] `src/processor/benchmark-evaluator.ts`
- `normalizeModelId` の if 連鎖をカタログ参照に置換。`isUnknownModelId` を追加。

### 版管理と外部化（B-15）
#### [NEW] `scripts/benchmark-data/benchmark-records.json`
- `LATEST_BENCHMARK_RECORDS` を JSON データとして外部化。
#### [MODIFY] `scripts/update-benchmarks.ts`
- JSON を読み込み、レコード + 正規化方式の内容ハッシュ（sha256）を `content_hash` として出力。ハッシュが既存と同じなら版と `last_updated` を据え置き、変わったときだけ `yyyy-mm-dd-NNNN` を繰り上げる（ビルドのたびに繰り上がらない）。

### 画面
#### [NEW] `dashboard/src/components/radar/ModelDotPlot.tsx`
- 6 軸ごとのスモールマルチプル（1 軸 = 1 行の横軸 0〜100 ドットプロット）。モデルは色 + 形 + ラベルで区別、`AccessibleChart` で表でも読める。
#### [MODIFY] `dashboard/src/components/ModelRadarView.tsx`
- レーダー（Recharts `RadarChart`）を `ModelDotPlot` + 生値表に置換。

### テスト・文書
- 単体: 上位モデルの識別（同点なし）、パーセンタイルの境界、完全一致判定と未知 ID、内容ハッシュの安定性と変化、JSON 外部化の整合、ドットプロットの表示。
- SDD-10 / SDD-07（EN/JA）、`supported_models.md` 同期確認、`skills` / agent 文書の参照更新。
