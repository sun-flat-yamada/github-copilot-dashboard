# 月次締め・改訂履歴・差分表示（翌月 5 営業日締め）(P4-2 / #198)

親 Issue: #175（Phase 4）。指摘 E-01（月次の数値が再集計や API の遅延反映で後から黙って変わり、請求・監査の根拠にならない）を解消する。前提 P1-2（Raw Landing / `pipeline:reprocess`）はマージ済み。P3-6 の 1 年推移が日付だけで導出している「確定 / 暫定」を、確定スナップショットの有無に置き換える。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 5 点（締めジョブと営業日計算 / 改訂履歴と差分 / 再処理が確定月を黙って上書きしない / SDD-05・SDD-17 の日英同期 / 品質ゲート）に限定する。

> [!WARNING]
> - 公開してよいのは数値（figures）とチェックサムだけ。確定スナップショットに利用者単位の行（`users` / `user_details` / `user_profiles`）・ログイン名・氏名は入れない。`processed/closes/*.json` を `pages-staging.ts` の許可リストに追加する（`raw/`・CSV 原本・暗号化マッピングは追加しない）。
> - 実施者（actor）は運用者が明示した別名・役割のみ記録する（`GITHUB_ACTOR` 等から自動取得しない）。実行 ID（Run ID）は常に記録する。
> - 確定月の成果物は、改訂（`--revise <month> --reason`）なしには書き換えない。差が出る再処理は成果物を保持して issue 化する。

## Proposed Changes
### ドメインと純関数
#### [NEW] `src/domain/entities/month-close.ts`
- `MonthCloseRecord`（確定スナップショット + 改訂履歴）、`CloseFigures`、`FigureDiff`、`BusinessCalendarConfig`。
#### [NEW] `src/processor/month-close.ts`
- 営業日計算（既定は土日除外、祝日・週末曜日・締め営業日数は設定可能）、`monthCloseDate` / `isCloseDue`。
- 正準 JSON + SHA-256 チェックサム、`extractFigures`（月次スコープ・月次レポートから数値のみ抽出）、`diffFigures`、`createCloseRecord` / `appendRevision` / `verifyCloseRecord`。
#### [MODIFY] `src/processor/yearly-trend.ts`
- 確定 / 暫定を `closedMonths`（確定スナップショットのある月）で決める。`monthCloseDate` は営業日カレンダーを受け取る。`monthCloseStatus` は廃止。

### 保存・パイプライン
#### [MODIFY] `src/storage/fork-safe-storage.ts` / `IStorageWriter` / `ForkSafeStorageWriter`
- `processed/closes/{month}.json` の保存・読み出し・一覧、レポート読み出し。
#### [NEW] `src/application/pipeline/month-close.ts`
- `MonthCloseService`: 締め期限の来た月を確定、確定月の保護（`guardClosedMonth`）、改訂の適用、整合性検査（`verifyClosedMonths`）。
- 事業日カレンダー設定の読み込み（`COPILOT_BUSINESS_CALENDAR`、不正は issue 化）。
#### [MODIFY] `src/application/pipeline/PipelineOrchestrator.ts`
- 月次スコープ・月次レポートの保存前に確定月を検査し、改訂の指定が無ければ書き込まず差分を issue 化。締めジョブを 1 年推移の前に実行。
#### [MODIFY] `src/cli/reprocess-pipeline.ts`、[NEW] `src/cli/month-close.ts`
- `pipeline:reprocess -- --revise <month> --reason "..." [--actor <alias>]`、`npm run month:close` / `month:verify`（改訂なしで数値が変わっていれば exit 1）。
#### [MODIFY] `scripts/pages-staging.ts`
- `closes` を許可リストへ追加。

### 画面
#### [MODIFY] `dashboard/src/components/AuditDataQualityPanel.tsx` / `datasetLoader.ts`
- 監査ビューに「月次締めと改訂履歴」を追加（締め日・確定日時・チェックサム・改訂ごとの理由 / Run ID / 時刻・確定版と改訂版の差分）。取得不能は「—（理由）」。ビュー登録は変更しない（`['audit']` のまま）。
#### [MODIFY] `dashboard/src/components/YearlyTrendPanel.tsx`
- 確定の定義の文言を確定スナップショットに合わせる。改訂済みの月を示す。

### テスト・文書
- 営業日計算（祝日・月またぎ）、チェックサムの決定性、差分、改訂履歴の追記と元の確定値の不変、確定月の保護（黙って上書きしない）、改訂なしで数値が変わると検知して失敗、再処理、1 年推移の状態、画面。
- SDD-05（§ 月次締めのレイアウト）、SDD-17（§3 月次締め・改訂）、SDD-07（監査ビュー追記）、README 索引。日英を同期。

## Verification Plan
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`、`npm run lint`、`npm run pages:verify`。
