# 実装計画: DEMO ダミーデータの表示パターン網羅 (#264)

## 目的
最新仕様 (1 年トレンド・月次締め・データ品質・モデルカタログ) に合わせ、DEMO 表示で全ての表示パターンを確認できるようにする。

## 変更
1. `src/collector/mock-generator.ts`: seed 指定の決定的乱数、モデル名を現行カタログへ更新、Cost Center 予算を normal / warning / exceeded の 3 状態に固定。
2. `src/application/pipeline/demo-history.ts` (新規): モック実行時のみ、24 か月 (欠損月 1 を含む) の月次スコープ・Deep Analysis、過去月の月次レポート CSV、確定後に改訂した月次締め、データ品質履歴を生成。確定済みの月は書き換えない。
3. `PipelineOrchestrator`: モック時に上記を呼び出し、index の `data_quality` を履歴から算出。
4. `MockCopilotDataSource`: source_status に一部失敗 / 失敗、代表的な issue (warning / error) を追加。
5. テスト: `demo-data.test.ts` に網羅性テスト。SDD-05 (EN/JA) を同期。

## 範囲外
`audit/` 配下 (シート監査・請求突合) は Pages に配信されず画面に出ないため対象外。

## 検証
`npm run demo:generate` の出力検査、品質ゲート一式。
