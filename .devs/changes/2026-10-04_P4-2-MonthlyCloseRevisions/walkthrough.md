# Walkthrough: 月次締め・改訂履歴・差分表示 (P4-2 / #198)

## Summary
月次の主要な数値を、翌月の第 N 営業日（既定 5、営業日カレンダーは設定可能）にチェックサム付きで確定し、締め後の変更は履歴付きの改訂としてのみ許すようにした。確定月はパイプライン・再処理が黙って上書きしない。画面（監査ビュー）と JSON で確定版と改訂版の差分を確認できる。P3-6 の 1 年推移の「確定」は、日付ではなく確定スナップショットの有無で決まる。

## Changes Made
### ドメイン・純関数
- `src/domain/entities/month-close.ts`: `MonthCloseRecord` / `CloseRevision` / `FigureDiff` / 営業日カレンダー設定。
- `src/processor/month-close.ts`: 営業日計算（祝日・週末曜日・営業日数を設定可能）、確定する数値の抽出（利用者単位の値を含めない）、正準 JSON + SHA-256、差分、改訂の追記、整合性検査。
- `src/processor/yearly-trend.ts`: `monthCloseStatus` を廃止し、`closedMonths`（確定スナップショットのある月）で `closed` / `provisional` を決定。`revision_count` を点に追加。

### 保存・パイプライン
- `ForkSafeStorage` / `IStorageWriter`: `processed/closes/{month}.json` と `index.json`（`pages:stage` の許可リストに `closes` を追加）。
- `src/application/pipeline/month-close.ts` (`MonthCloseService`): 締めジョブ、確定月の書き込み保護、改訂の適用、整合性検査。
- `PipelineOrchestrator`: 実行冒頭で整合性検査、monthly / report の保存前に保護、締めジョブを 1 年推移の前に実行、保留した変更と不整合を `error-log.json` の issue に追加。
- CLI: `pipeline:reprocess -- --revise <月> --reason "..." [--actor ...]`、`month:close`、`month:verify`（改訂なしで数値が変わっていれば exit 1）。
- `COPILOT_BUSINESS_CALENDAR`（任意の JSON）。不正値は既定値で続行し issue 化。ワークフローに変数を結線。

### 画面
- `AuditMonthClosePanel`（監査ビューに追加。ビュー登録は `['audit']` のまま）: 締め日・確定日時・チェックサム・改訂（理由・実行 ID・実施者・時刻）・差分表。取得不能は「—（理由）」。
- 1 年推移の凡例・要約を確定スナップショットの意味に更新。

### 文書
- SDD-17 §3（新設）、SDD-05 §2.7 / §2.6、SDD-06 §4.6、SDD-07 §2.19、README 索引、README の環境変数。日英を同期。

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | 0 failure（公開範囲の警告は従来どおり） |
| TypeScript Check | `npm run typecheck` | Pass |
| Unit & Integration Tests | `npm test` | 987/987 Pass（新規: month-close 24 件・audit-month-close 5 件ほか） |
| Zero Secret / PII Scan | `npm run secret-scan` | 0 leaks |
| Production Build | `npm run build` | Built（bundle 予算内） |
| Lint | `npm run lint` | Clean |
| Pages | `npm run pages:verify` | `data/` が無いローカルでは対象なし。許可リストは `pages-staging.test.ts` で検証 |

受け入れ基準との対応:
- 締めジョブ・営業日計算・チェックサム・確定スナップショット: `month-close.test.ts`
- 改訂履歴と差分、改訂なしで数値が変わると検知して失敗: `month-close.test.ts`（`unrecorded_change` / `checksum_mismatch`、`month:verify`）
- 再処理が確定月を黙って上書きしない: `month-close.test.ts`（パイプライン結線）
- SDD-05 / SDD-17 の日英同期: 上記文書

## 後続への引き継ぎ
- P4-6（保持期間）は `data_retention` 60 か月を強制する。確定記録（`closes/`）は数値のみのため、保持期間の対象外とするか P4-6 で決める。
- 確定する数値は主要な指標（overview・AI クレジット・エージェントセッション・レポート overview）。行単位の明細は凍結対象外。
