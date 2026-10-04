# シート監査イベントと CSV 出力 (P4-3 / #199)

親 Issue: #175（Phase 4）。指摘 E-02（シート（ライセンス割当）の付与・剥奪・プラン変更の履歴が残らず、「いつ誰に付与されたか」を説明できない）を解消する。前提 P1-2（Raw Landing / `pipeline:reprocess`）はマージ済み。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 5 点（差分 → イベント生成 / CSV 出力 / 公開範囲ルールとの整合 / SDD-17・SDD-04 の日英同期 / 品質ゲート）に限定する。保持 60 か月の強制は P4-6。

> [!WARNING]
> 公開範囲の判断（SECURITY: security-zero-leakage.md §2.3）
> - 監査イベントは利用者単位の個人データ。**GitHub Pages には一切配信しない**（`pages-staging.ts` の許可リストに追加しない。`pages:verify` の禁止パスに `audit` を追加し、配信物に含まれたら CI を失敗させる）。
> - 保存先は `data/audit/seat-events/`（`processed/` の外。`copilot-data` ブランチのみ）。ブランチの公開範囲は既存の `fork:verify` 公開範囲検査（`index.json` の `privacy.contains_user_level_data` / `anonymized`）がそのまま守る。検査は弱めない・迂回しない。
> - 入力は Raw シートパーティション（`raw/YYYY/MM/*-raw.json`）。仮名化モード（`ANONYMIZE_USERS=true`）ではパイプラインが保存時にログインを HMAC 仮名へ置換し、ID・アバター URL・プロフィール URL を除去済みなので、イベントも仮名のみになる。
> - イベントに入れる利用者属性は `user`（ログインまたは仮名）だけ。氏名・メール・数値 ID・アバター URL・部署は入れない。元の Raw シートは出力しない。
> - イベント文書に `pseudonymized` を記録し、CSV 出力時に非仮名の実データであることを表示する。1 件でも非仮名のイベントが混ざれば文書は `false`（安全側）。

## Proposed Changes
### ドメインと純関数
#### [NEW] `src/domain/entities/seat-audit.ts`
- `SeatAuditEvent`（`event_id`, `day`, `type`, `user`, `organization`, `previous_snapshot_day`, `from`, `to`）、`SeatAuditMonthDocument`。種別は `granted` / `revoked` / `plan_changed` / `last_activity_changed`。
#### [NEW] `src/processor/seat-audit.ts`
- `diffSeatSnapshots(prev, curr)`: 日次シートスナップショットの差分から決定的にイベントを生成（付与 = 新規出現、剥奪 = 消失、プラン変更、最終利用日（日付部分）の変化）。`event_id` は内容の SHA-256 先頭（再実行で重複しない）。
- `mergeSeatAuditEvents`（`event_id` で冪等マージ）。
#### [NEW] `src/processor/seat-audit-csv.ts`
- CSV 出力: UTF-8 + BOM、CRLF、RFC 4180 のクォート、固定列。CSV インジェクション対策（`= + - @` タブ CR で始まるセルの先頭に `'` を付与）。

### 保存・パイプライン
#### [MODIFY] `src/storage/fork-safe-storage.ts` / `IStorageWriter` / `ForkSafeStorageWriter`
- 任意メソッド: Raw シートスナップショットの日一覧・読み出し、`audit/seat-events/{month}.json` の保存・読み出し・一覧。公開ディレクトリへは複製しない。
#### [NEW] `src/application/pipeline/seat-audit.ts`
- `SeatAuditService.update()`: 前回処理日以降の連続する Raw スナップショット対で差分を取り、月別文書へ追記。最初のスナップショットは基準（イベントなし）。`--rebuild` は全対を再計算（冪等マージ）。
#### [MODIFY] `src/application/pipeline/PipelineOrchestrator.ts`
- Raw 保存の直後（再処理を除く）に `SeatAuditService.update()`。失敗は issue 化して本処理は止めない。
#### [NEW] `src/cli/seat-audit.ts`
- `npm run seat-audit:update [-- --rebuild]` / `npm run seat-audit:export -- [--month YYYY-MM | --from --to] [--types ...] [--out path]`。

### 公開範囲
#### [MODIFY] `scripts/pages-staging.ts`
- `FORBIDDEN_DIST_PATHS` に `audit` を追加（許可リストは変更しない）。`pages-staging.test.ts` に「`data/audit/` はステージされず、dist にあれば verify が失敗」を追加。

### 仕様書
- SDD-17 §4 に「シート監査イベント」節（日英）。SDD-04 §5.1 の公開範囲表に監査イベントの行を追加（日英）。SDD-05 の保存レイアウトに `audit/seat-events/` を追記（日英）。

## Verification Plan
- 単体: 付与・剥奪・プラン変更・最終利用日の差分、冪等マージ、基準スナップショット、日の欠落、重複ログイン。
- CSV: 列・BOM・CRLF・エスケープ（カンマ・引用符・改行）、インジェクション（`=` `+` `-` `@` タブ）。
- サービス: 一時ディレクトリの Raw で update / rebuild、仮名化 Raw では実ログインが出力に現れないこと。
- 公開範囲: pages-staging の許可リスト・禁止パス。
- 品質ゲート: `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` + `npm run lint` + `pages:verify`。
