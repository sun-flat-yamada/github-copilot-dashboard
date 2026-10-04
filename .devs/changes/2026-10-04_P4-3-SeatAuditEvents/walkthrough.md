# Walkthrough: シート監査イベントと CSV 出力 (P4-3 / #199)

## 変更内容
- 日次シートスナップショット（Raw パーティションの `seats`）の差分から、付与（granted）・剥奪（revoked）・プラン変更（plan_changed）・最終利用日の変化（last_activity_changed）を生成（`src/processor/seat-audit.ts`）。`event_id` は内容のハッシュで、再生成しても重複しない。最初のスナップショットは基準。
- `SeatAuditService`（`src/application/pipeline/seat-audit.ts`）が前回処理日以降の対だけを処理し、`audit/seat-events/{月}.json` へ冪等に追記。パイプラインは Raw 保存後に実行（再処理を除く）。失敗は警告 issue。`npm run seat-audit:update [-- --rebuild]`。
- CSV 出力 `npm run seat-audit:export -- --month YYYY-MM`（`--from/--to`、`--types`、`--out`）。UTF-8 BOM・CRLF・RFC 4180 クォート・固定列・CSV インジェクション対策（`= + - @` タブ CR の先頭に `'`）。
- 公開範囲: イベントは `processed/` の外、Pages の許可リストに追加せず、`pages:verify` の禁止パスに `audit` を追加。イベントは `user` のみ（氏名・メール・ID・アバター・部署なし）。仮名化モードの Raw では仮名のみ。`fork:verify` の検査は変更していない。
- SDD-17 §4（新設）、SDD-04 §5.1、SDD-05 §2.8 を日英で更新。

## 公開範囲の判断
| 項目 | 判断 |
|:--|:--|
| Pages | 配信しない（許可リスト外 + 禁止パス） |
| copilot-data | 保存する（raw と同じ。既存の公開範囲検査が守る） |
| 仮名化 | Raw が仮名化されていれば仮名のみ。判定はデータから行い、実ログインが 1 つでもあれば `pseudonymized: false` |
| CSV | 権限のある社内の閲覧者のみ。出力時に仮名 / 実ログインの警告を表示 |

## テスト
- `src/tests/seat-audit.test.ts`（差分・冪等・基準・欠落日・仮名化・CSV のエスケープとインジェクション・サービス）、`src/tests/pages-staging.test.ts`（`audit/` はステージされず、dist にあれば失敗）。
- `RawLanding.test.ts`: 再処理の同一性比較から追記専用の `audit/` を除外。

## 品質ゲート
`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` 成功（1004 pass / 0 fail）、`npm run lint` 成功、`pages:verify` 成功（最終 rebase 後に再実行）。

## 範囲外
- 保持期間 60 か月の強制は P4-6。
