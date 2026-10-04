[English](17_audit_and_report_spec.md) | [日本語](17_audit_and_report_spec.ja.md)

---

# SDD-17: 監査 & レポート仕様書 (Audit & Report Specification)

- **文書番号**: SPEC-COPILOT-017
- **ステータス**: Approved / Active（Phase 4 に合わせて拡張。P4-2〜P4-6 で節を追加する。P4-4 は §5）
- **対象バージョン**: 2026.10
- **作成日**: 2026-10-04 (P4-1 / #197: 監査・データ品質ビュー、P4-2 / #198: 月次締めと改訂、P4-3 / #199: シート監査イベント、P4-4 / #200: 請求突合)
- **関連**: [SDD-05 §2.3 / §2.5 / §2.7](05_data_storage_and_fork_isolation_spec.ja.md)、[SDD-07 §2.19](07_dashboard_ui_ux_spec.ja.md)、[SDD-16 データ契約 & 指標カタログ](16_data_contract_and_metric_catalog_spec.ja.md)

---

## 1. 目的と監査要件

ダッシュボードは社内で Copilot の費用と利用状況を説明するために使う。運用者が「データが最後に更新されたのはいつか、どのソースが失敗したか、品質がいつ悪化したか」に答えられなければならない。オーナーが決定した要件（2026-10-01）:

| 項目 | 決定 | 状態 |
|:--|:--|:--|
| 月次締め | 翌月 5 営業日 | §3（P4-2） |
| 締め後の改訂 | 履歴付きで可 | §3（P4-2） |
| 生データの保持 | 5 年（60 か月）。`data_retention` の既定は 60 か月 | P4-6 |
| 個人情報 | 監査画面と出力は件数・日付・ソース名のみ | P4-1（本書 §2） |
| シート履歴 | 付与・剥奪・プラン変更・最終利用日の変化を日次シートスナップショットから記録し、権限のある社内の閲覧者向けに CSV で出力する。公開しない | §4（P4-3） |

## 2. 監査・データ品質ビュー (P4-1 / E-01)

| 情報 | 出典 | 生成箇所 |
|:--|:--|:--|
| ソース別の状態・取得件数・隔離・最終試行・最終成功 | `index.json` `source_status` | `PipelineOrchestrator`（SDD-05 §2.3 / SDD-02） |
| 最新の品質レベル・トレンド・レベルが変わった時刻 | `index.json` `data_quality` | `summarizeQualityHistory`（SDD-05 §2.5） |
| 実行別の履歴: `run_id`・時刻・ソース別ステータス・欠損日・重複・範囲外・隔離・不正行 | `quality/history.json`（最大 90 件、新しいものが末尾） | `buildDataQualityReport` / `appendQualityHistory`（SDD-05 §2.5） |

- **Run Manifest 本体を読まない理由**: `raw/landing/` にあり、生の応答のリクエストキーと内容ハッシュを含む。`raw/` は公開しない（`pages:stage` の許可リスト、`pages:verify`）。公開済みの品質レポートが同じ `run_id` を持つため、運用者は画面から `copilot-data` の Run Manifest を特定できる。
- **表示規約**: SDD-07 §2.19。取得できないデータは **「—（理由）」** で表示し、0 や空の表にしない。デモデータは実行履歴を持たず、その旨を表示する。
- **個人情報なし**: これらのファイルに保存され画面に出るのは、件数・日付・ソース名のみ。
- ビューは manifest とコンポーネントで登録する（View Registry、SDD-07 §2.14b）。`App.tsx` やナビゲーションの変更は不要。

## 3. 月次締め・改訂履歴・差分 (P4-2 / E-01)

月次の数値は、遅れて届いた API データ・再集計・CSV の再取り込みで、後から黙って変わってはならない。締め日に月の主要な数値を**チェックサム付きで確定（凍結）**し、その後の変更は**履歴付きの改訂**としてのみ許す。

### 3.1 締めジョブと営業日カレンダー

- **締め日** = **翌月の第 N 営業日**（N = `close_business_days`、既定は **5**）。営業日は、休業の曜日（既定は日・土）と設定した祝日を除く。当日から締め対象。日付は UTC。
- **カレンダー設定** `COPILOT_BUSINESS_CALENDAR`（GitHub Actions の変数、JSON、任意）: `{ "close_business_days": 5, "weekend_days": [0, 6], "holidays": ["2026-11-03"] }`。祝日は設定で追加する（祝日表は内蔵しない）。不正な値は既定値で続行し、issue（`config:COPILOT_BUSINESS_CALENDAR`）として記録する。
- **ジョブ**: パイプラインの実行ごとに、締め日を迎えスナップショットがまだ無い月を確定する（`MonthCloseService.closeDueMonths`）。`npm run month:close` は同じ処理を単独で実行する。保存済みの集計（`processed/monthly` または `processed/reports`）がある月だけを締める。

### 3.2 凍結するもの

その月の**数値（figures）**: 月次スコープ `overview` の数値（シート数・利用中 / 遊休シート・費用・請求対象額・受諾率・チャット数など）、AI クレジット合計とエージェントセッション数（`monthly.*`）、月次利用レポートの `overview` の数値（`report.*`）。未計測の値は `null` のまま（0 にしない）。**利用者単位の行・ログイン名・氏名・部署はスナップショットに含めない**（個人情報ゼロ）。ファイルは数値・日付・チェックサムだけである。

- **チェックサム**: `{ month, figures }` の正準 JSON（キー順固定）の SHA-256（hex）。
- **記録** `processed/closes/{YYYY-MM}.json`（`MonthCloseRecord`）: `closes_on`、使用した `calendar`、`closed`（元の版 1: `at`・`run_id`・`figures`・`checksum`）、`revisions[]`。元の `closed` は書き換えない。
- **一覧** `processed/closes/index.json`: 月ごとの `closes_on`・`closed_at`・**現在有効な版**のチェックサム・`revision_count`・`last_revised_at`（新しい月が先頭）。2 つとも `pages:stage` の許可リスト（`closes`）に載る。

### 3.3 改訂

- 改訂は**明示的**に行う: `npm run pipeline:reprocess -- --revise <YYYY-MM> --reason "<理由>" [--actor <別名>]`（`--revise` は複数指定可。理由は必須）。再処理が Raw Landing の run と CSV レポートからその月を再計算し、現在の版と数値が違えば改訂版を追記して保存済みの集計を置き換える。違いが無ければ何も記録しない。
- 改訂が保存するもの: `version`（2, 3, ...）、`at`、`run_id`（Run Manifest の ID）、`reason`、`actor`（任意）、`figures`、`checksum`、`previous_checksum`、`diff`（変わった項目のみ: `before`・`after`・`delta`）。元の確定値は `closed` に残る。
- `actor` は運用者が決める別名・役割である。CI のユーザーや GitHub ログインから**自動では取らない**（個人情報ゼロ）。チーム名・役割名を使う。

### 3.4 確定月は黙って上書きしない

- パイプラインは、確定済みの月の `processed/monthly/{m}.json` / `processed/reports/{m}.json` を書く前に、新しい数値を**現在の版**と比べる。同じなら通常どおり書く。違い、かつその月に `--revise` の指定が無ければ**書かない**: 保存済みの数値を維持し、警告の issue `month-close:{m}`（先頭の差分つき）を `error-log.json` に追加する。`pipeline:run`・遅れて取り込んだ CSV・`pipeline:reprocess` のすべてが対象。
- **整合性検査** `npm run month:verify`（パイプライン実行の冒頭でも実行）: 確定月の保存済み集計が、改訂の記録なしに現在の版と違う（`unrecorded_change`）、または記録のチェックサム・改訂の連鎖が内容と合わない（`checksum_mismatch`）と失敗する（exit 1。パイプラインではエラーの issue）。違う項目を表示する。
- 締めと改訂は `raw/` に触れない。保持期間（60 か月）の強制は P4-6。

### 3.5 表示

- **1 年推移（SDD-06 §4.6）**: 月は確定スナップショットがあるときだけ `closed`（締め日を過ぎただけでは確定にしない）。`points[].revision_count` に締め後の改訂回数を示す。
- **監査ビュー（SDD-07 §2.19）**: 月ごとに締め日・確定日時・チェックサム・改訂回数。各改訂の理由・実行 ID・実施者・時刻と**差分の表**（改訂前 / 改訂後 / 差）。JSON は `closes/{month}.json`。取得できないデータは「—（理由）」で表示する。

## 4. シート監査イベントと CSV 出力 (P4-3 / E-02)

監査では「いつ誰にシートを付与し、いつ剥奪・変更したか」に答えられなければならない。イベントは**日次のシートスナップショット**（Raw パーティション `raw/YYYY/MM/YYYY-MM-DD-raw.json` の `seats`）を、直前のスナップショットと比較して生成する。

### 4.1 イベント

| `type` | 生成条件 | `from` → `to` |
|:--|:--|:--|
| `granted` | スナップショットに在り、直前に無いログイン | `null` → プラン |
| `revoked` | 直前に在り、いまは無いログイン | プラン → `null` |
| `plan_changed` | `plan_type` が変わった（`business` / `enterprise`。未知の値は `unknown` で、推測しない） | 旧プラン → 新プラン |
| `last_activity_changed` | `last_activity_at` の**日付**（`YYYY-MM-DD`）が変わった（時刻は無視） | 旧日付 / `null` → 新日付 / `null` |

- イベントの項目: `event_id`、`day`（新しい側のスナップショットの日 = 検出日）、`type`、`user`、`organization`、`previous_snapshot_day`、`from`、`to`。人物に関する情報は**これ以外を保存しない**（表示名・メール・部署・数値ユーザー ID・アバター・プロフィール URL は入れない）。
- `event_id` は `day`・`type`・`user`・`from`・`to` の SHA-256 の先頭 16 hex。同じ差分からは常に同じ ID になるので、再生成しても重複しない。
- **最初のスナップショットは基準**（イベントなし）。読めるパーティションが無い日があれば、次に読める日を直前に読めた日と比較し、`previous_snapshot_day` に欠落が現れる。イベントは変更を*検出した*日を示し、その間にパイプラインが動いていなければ実際の変更日より遅れうる。
- 1 つのスナップショットに同じログインが 2 回返っても 1 件として扱う（後の行が勝つ）。

### 4.2 生成と保存

- `SeatAuditService.update()` は、パイプラインの各実行で Raw パーティションの保存直後に動く（再処理は Raw を書き換えないので対象外）。最後に処理した日（`through`）より後のスナップショット対だけを処理し、`event_id` でマージする。失敗は警告 issue `audit:seat-events` になり、パイプラインは止めない。`npm run seat-audit:update [-- --rebuild]` は同じ処理を単独で実行する（`--rebuild` は全対を再計算。冪等）。
- ファイル `audit/seat-events/{YYYY-MM}.json`（検出日の月）: `schema_version`、`month`、`pseudonymized`、`through`、`events[]`（`day`・`type`・`user` の昇順）。**`processed/` の外**に置き、配信用ディレクトリ（Pages）へは複製しない。
- `pseudonymized` はデータから判定する: 入力のスナップショットのログインがすべて仮名（`dev_<16 hex>`）で、数値 ID が 0・アバターなしのときだけ `true`（Raw が `ANONYMIZE_USERS=true` で保存されたことを意味する。SDD-04 §5.2）。実ログインが 1 つでもあれば、その月の文書は `false`（安全側）。

### 4.3 公開範囲（個人情報ゼロ）

| 場所 | シート監査イベント | 理由 |
|:--|:--|:--|
| GitHub Pages / `dist/data/` | **配信しない** | `audit/` は `pages:stage` の許可リストに無く、`dist/data/` に `audit` があれば `pages:verify` が失敗する（`FORBIDDEN_DIST_PATHS`） |
| `copilot-data` ブランチ | 保存する（`raw/` と同じ） | リポジトリと同じ公開範囲。既存の `fork:verify` の公開範囲検査が `index.json` の `privacy`（`contains_user_level_data` / `anonymized`）で守る。検査は弱めない・迂回しない |
| `main` ブランチ | **置かない** | データ隔離（SDD-05） |
| Issue・PR・チャット | **載せない** | CSV は権限のある社内の閲覧者だけに渡す |

- 実ログインのままのイベント（非仮名）を扱ってよいのは、リポジトリと Pages が private / internal でアクセス制御されている場合（SDD-04 §5 の前提）、または `ANONYMIZE_USERS=true` と十分な長さの `ANONYMIZE_SECRET` で運用する場合のみ。仮名化モードのイベントは HMAC 仮名だけを持ち、シートの生データ・アバター URL・数値 ID・元の CSV は公開しない。仮名も個人データとして扱う（SDD-04 §5.2 の限界）。
- 保持は生データの保持期間（60 か月。強制は P4-6）に従う。

### 4.4 CSV 出力

`npm run seat-audit:export -- --month YYYY-MM`（または `--from YYYY-MM-DD --to YYYY-MM-DD`）。任意で `--types granted,revoked,plan_changed,last_activity_changed` と `--out <file>`（既定は `data/audit/exports/seat-events-{from}_{to}.csv`）。

| 項目 | 規則 |
|:--|:--|
| 文字コード・改行 | UTF-8 **BOM 付き**（Excel で文字化けしない）、**CRLF** |
| 列（順序固定。追加は末尾のみ） | `event_id`、`day`、`type`、`user`、`organization`、`previous_snapshot_day`、`from`、`to` |
| クォート | RFC 4180: カンマ・二重引用符・改行を含むセルは二重引用符で囲み、`"` は 2 つにする |
| CSV インジェクション | `=`、`+`、`-`、`@`、タブ、CR で始まるセルは先頭に `'` を付け、表計算ソフトが数式として評価しないようにする。全セルに適用 |
| 警告 | 出力したファイルが仮名のみか実ログインを含むか、権限のある閲覧者だけに渡すことをコマンドが表示する |

## 5. 請求突合レポート (P4-4 / E-03)

ダッシュボードの金額は独自の計算（価格カタログ + 使用量）で、GitHub の請求額と一致する保証がなかった。月ごとに突合して差を見えるようにし、許容差を超えた差は GitHub issue にする。

### 5.1 何を比べるか

| 項目 | 規則 |
|:--|:--|
| 請求側の取得元 | `GET /enterprises/{enterprise}/settings/billing/ai_credit/usage`（P1-5 のクライアント。1 日 1 リクエスト）。2026-10-04 に GitHub REST API description（`ghec.2022-11-28.json`）で存在を確認 |
| 対象 | AI Credits のみ。シート（ライセンス）の金額は対象外（`billing/usage`、`billing/usage/summary`、`billing/premium_request/usage` が後続タスク向けに存在する） |
| 計算額 | 請求 API の数量（`grossQuantity`）× ダッシュボードの単価（USD。請求設定。既定は価格カタログ） |
| 請求額 | `grossAmount`。`discountAmount` と `netAmount` は参考値として保存する。ダッシュボードには割引・包含クレジットのモデルがないため、判定は gross で行う |
| 通貨 | API は通貨を返さない。請求のとおりの金額を USD と仮定する（`currency_assumed`） |
| 内訳 | SKU × モデル。利用者・組織・Cost Center の識別子は読まず、保存もしない |

### 5.2 判定と許容差

| 状態 | 意味 |
|:--|:--|
| `match` | 差が 0.005 USD 未満（丸め） |
| `within_tolerance` | 差はあるが、絶対額・割合の**両方**は超えていない |
| `exceeded` | 差が絶対額の許容差（USD）**かつ**割合の許容差（%）を超えた。issue 化の対象 |
| `unavailable` | その月の請求データがない（API 欠損・権限不足・ソース失敗）。0 USD として突合せず、`exceeded` にも `match` にもしない |

- 既定の許容差は **1 USD かつ 1 %**。環境変数 `COPILOT_RECONCILIATION_TOLERANCE`（JSON `{"absolute_usd":1,"percent":1}`。省略したキーは既定値。同名の Actions 変数がパイプラインと `billing:issues` に渡される）で設定する。不正な値（JSON でない・負数・数でない）は既定値に戻し、警告 issue `env:COPILOT_RECONCILIATION_TOLERANCE` に記録する。
- 割合は `|差| / |請求額 (gross)| × 100`。請求額が 0 で計算額が 0 でないときは割合を定義できず、超過として扱う。
- `npm run billing:report` は保存済みのすべての月を現在の許容差で判定し直す。許容差を変えると過去月にも反映される。

### 5.3 結果とともに記録する版

`versions.pricing_catalog_version`（`PRICING_CATALOG_VERSION`）、`versions.exchange_rate_catalog`（P1-6 カタログの `fetched_at` と収録月数。無ければ `null`）、`versions.unit_price_usd`、`tolerance`。比較自体は USD で行う。為替カタログは、そのとき表示換算に使ったレート集合を特定するために記録する。

### 5.4 生成と保存

- `BillingReconciliationService.record()` は、AI Credits を収集した後のパイプラインで、**`ai_credits` ソースが利用可能で、再処理でないときだけ**動く。ソースが失敗・スキップの実行では何も書かない（保存値を保つ）。失敗は警告 issue `audit:billing-reconciliation` になり、パイプラインは止めない。
- ファイル `audit/billing-reconciliation/{YYYY-MM}.json`: `schema_version`, `month`, `scope`, `days`（日 → SKU × モデルの行: `quantity`, `billed_gross`, `billed_discount`, `billed_net`）, `updated_at`, `versions`, `tolerance`。再取得した日は保存済みの日を置き換える（冪等）。判定は保存済みの日から毎回導く。`days_covered` が月の日数を示す（収集窓が月の一部しか覆わないことがある）。
- 許容差を超えた月は、エラーログにも警告 issue `billing:ai_credits:{month}` として載る。

### 5.5 issue 化（重複なし）

`npm run billing:issues [-- --month YYYY-MM] [--dry-run]`（日次ワークフローがパイプラインの後に `issues: write`・`continue-on-error` で実行する。モックモードでは実行しない）。

- 超過した月ごとに 1 件。ラベルは `billing-reconciliation`、本文に隠しマーカー `<!-- billing-reconciliation:YYYY-MM -->` を入れる。
- **重複しない**: 先にこのラベルの既存 issue（open **と** closed）を取得し、同じ月のマーカーがあれば作らない。issue を閉じても再作成されない。既存 issue を取得できないとき（HTTP エラー）は何も作らない。
- `--dry-run` は何も作らない（`GITHUB_TOKEN` があれば既存 issue の読み取りはする）。

### 5.6 公開範囲（ゼロリーク）

| 場所 | 突合データ | 理由 |
|:--|:--|:--|
| GitHub Pages / `dist/data/` | **配信しない** | 実際の請求額に由来する。`audit/` は `pages:stage` の許可リストになく、`dist/data/` に `audit` があれば `pages:verify` が失敗する |
| `copilot-data` ブランチ | `audit/` 配下に保存する | リポジトリと同じ公開範囲（既存の `fork:verify` 公開範囲検査が守る。弱めない） |
| GitHub issue | 月・判定・許容差・版と、（非公開リポジトリのときだけ）差額 (USD) と割合。**請求総額・計算総額は載せない** | 総額は `copilot-data` に留める。**公開**リポジトリでは金額も割合も載せない |
| `main` ブランチ・テスト・フィクスチャ | 実データは**置かない** | テストは架空の SKU・モデル・金額だけを使う |

### 5.7 検証状況

突合ロジックは合成データで検証した（一致・許容内・超過・データ欠損・負の調整行・冪等マージ・issue の重複なし）。**実 API では未検証**: Enterprise の請求読み取り権限を持つトークンが必要で、開発環境にはない。応答形状は P1-5 のスキーマと契約テストが保証する。最初の実運用の実行で、`COPILOT_ENTERPRISE` と `COPILOT_READ_TOKEN` を設定したパイプライン実行の後に `npm run billing:report` で確認する。

## 6. 今後追加する節（未仕様）

定義駆動レポート（P4-5）、プライバシー階層と保持期間ポリシー（P4-6）は、各タスクの実装時に本書へ追記する。
