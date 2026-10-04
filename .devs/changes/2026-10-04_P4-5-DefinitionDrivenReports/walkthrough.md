# Walkthrough: 定義駆動レポート (P4-5 / #201)

## 変更の要約
- `reports/*.yaml` に宣言したレポートを Report Engine が検証・生成する。定義ファイル 1 件の追加だけでレポートが増える（コード変更なし）。
- 検証は strict スキーマ + 意味検証。指標カタログ（`METRIC_REGISTRY`）に無い指標、データセットが提供できない指標、未知の列・グループ・ソートキー、`privacy_tier: identified`（P4-6 まで未対応）、ID とファイル名の不一致、重複を拒否する。不正な定義は他の定義の生成を止めない。
- 生成は純関数 `renderReport`（品質属性付き、欠損は「—（理由）」、CSV は BOM + CRLF + インジェクション対策）。定期判定は `monthly-close`（締め済みの月）/ `weekly`（ISO 週）。定義の SHA-256 が変わると再生成する。
- ワークフローに `reports:generate -- --due` を追加（`continue-on-error`、モックモードでは実行しない）。

## 公開範囲の判断
- 生成物は `audit/report-outputs/`（Pages へ配信しない。`pages:stage` の許可リスト・`STAGED_PROCESSED_DIRS` は変更なし。`pages:verify` が `audit` の混入を検出する）。`aggregate-only` のみ受け付け、利用者行は読まない。
- `fork:verify` / `secret-scan` は弱めていない。サンプル・テストの値はすべて架空。

## 依存関係
- `js-yaml`（既に推移依存として 4.3.2 がインストール済み）と `@types/js-yaml` を devDependency に明示。ロックファイルは該当エントリのみの最小差分（`npm install` が生じさせた `libc` フィールドの削除は取り込まず元に戻した）。

## 計画との差分
- `IStorageWriter` / `ForkSafeStorageWriter` の拡張は行わず、レポート生成は `ForkSafeStorage` を最小インタフェース（`ReportGenerationStorage`）経由で使う（パイプライン本体に組み込まないため。ワークフローの独立ステップとして実行）。

## 検証
- `src/tests/report-engine.test.ts`（スキーマ・描画・定期判定・冪等・「定義 1 件の追加だけで生成」・同梱サンプルの検証）、`pages-staging.test.ts`（`audit/report-outputs` が配信されない）。
- 品質ゲート: `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` + `npm run lint` + `pages:verify`（結果は PR に記載）。
