[English](17_audit_and_report_spec.md) | [日本語](17_audit_and_report_spec.ja.md)

---

# SDD-17: 監査 & レポート仕様書 (Audit & Report Specification)

- **文書番号**: SPEC-COPILOT-017
- **ステータス**: Approved / Active（Phase 4 で完成。P4-2〜P4-6 が §3〜§8 を追加し、P4-7 が §9 を追加した）
- **対象バージョン**: 2026.10
- **作成日**: 2026-10-04 (P4-1 / #197: 監査・データ品質ビュー、P4-2 / #198: 月次締めと改訂、P4-3 / #199: シート監査イベント、P4-4 / #200: 請求突合、P4-5 / #201: 定義駆動レポート、P4-6 / #202: プライバシー階層と保持期間、P4-7 / #203: 同期状況)
- **関連**: [SDD-05 §2.3 / §2.5 / §2.7](05_data_storage_and_fork_isolation_spec.ja.md)、[SDD-07 §2.19](07_dashboard_ui_ux_spec.ja.md)、[SDD-08 §1](08_automation_workflow_spec.ja.md)、[SDD-16 データ契約 & 指標カタログ](16_data_contract_and_metric_catalog_spec.ja.md)

---

## 1. 目的と監査要件

ダッシュボードは社内で Copilot の費用と利用状況を説明するために使う。運用者が「データが最後に更新されたのはいつか、どのソースが失敗したか、品質がいつ悪化したか」に答えられなければならない。オーナーが決定した要件（2026-10-01）:

| 項目 | 決定 | 状態 |
|:--|:--|:--|
| 月次締め | 翌月 5 営業日 | §3（P4-2） |
| 締め後の改訂 | 履歴付きで可 | §3（P4-2） |
| 生データの保持 | 5 年（60 か月）。`data_retention` の既定は 60 か月 | §8（P4-6） |
| 個人情報 | 監査画面と出力は件数・日付・ソース名のみ。ユーザー単位の出力（シートイベント、`identified` レポート）はプライバシー階層と公開プロファイルに従い、生データとユーザー単位の監査データは保持期間のポリシーで失効する | §2、§4.3、§7（P4-1、P4-3、P4-6） |
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
- **判定時刻**: 締めは実行時刻で判定し、確定時刻 `closed.at` も実行時刻とする。`PipelineOrchestrator` は実行時刻を注入可能な時計（`clock`、既定は実時計）から取り、テストで締め日の前後を再現できるようにする。実データの実行（`pipeline:run` / `pipeline:reprocess`）は常に実時計を使う。DEMO（`MOCK_MODE`）は DEMO の基準日 `2026-09-10T00:00:00Z` で判定し、結果が実行日に依存しない（SDD-05 §2.1、#305）。

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
- 締めと改訂は `raw/` に触れない。保持期間ポリシー（§8）は、締め済みの月のスナップショットと改訂履歴（`processed/closes/`）を削除しない。

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
- 保持は生データの保持期間（60 か月、§8）に従う。期限切れの月の `audit/seat-events/{YYYY-MM}.json` は `npm run retention:apply` が削除する。

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

## 6. 定義駆動レポート (P4-5 / E-04)

これまでレポートはコードで、集計を 1 つ足すたびにモジュールが要った。レポートを `reports/{id}.yaml` に**宣言**する形にし、Report Engine が宣言を指標カタログに照らして検証し、定期的に生成する。**定義ファイルを 1 件追加するだけでレポートが増え、コード変更は要らない**。契約は親計画の付録 A.7.3 の `ReportDefinition`。

### 6.1 定義ファイル

```yaml
id: monthly-cost-summary          # ファイル名と一致 (reports/monthly-cost-summary.yaml)。小文字・数字・ハイフン
title: 月次コストサマリー
description: 任意の説明
schedule: monthly-close           # monthly-close | weekly | (省略 = 手動のみ)
dataset: monthly                  # monthly | reports
privacy_tier: aggregate-only      # aggregate-only (既定) | identified (§7)
language: ja                      # ja (既定) | en
outputs: [markdown, csv]
sections:
  - { type: kpi, id: headline, title: 全社の指標, metrics: [total_spend, idle_waste] }
  - type: breakdown
    id: by-cost-center
    title: Cost Center 別
    group_by: cost_center
    columns: [total_seats, total_cost_usd]
    sort_by: total_cost_usd       # columns のどれか。既定は先頭の列
    order: desc                   # asc | desc (既定 desc)
    limit: 10                     # 1〜200 (既定 20)
    filters:                      # すべて満たす行だけ。欠損値は合致しない
      - { column: total_seats, op: gte, value: 2 }   # op: gt | gte | lt | lte | eq
```

同梱のサンプルは 2 件: `reports/monthly-cost-summary.yaml`（月次締め、データセット `monthly`）と `reports/weekly-usage-report-digest.yaml`（週次、データセット `reports`）。

### 6.2 定義が参照できるもの

| データセット | 入力 | 指標（指標カタログの ID。SDD-16 §2, §6） | `group_by` |
|:--|:--|:--|:--|
| `monthly` | `processed/monthly/{month}.json` | `total_spend`、`active_rate`、`idle_waste`、`acceptance_rate`、`agent_sessions`、`agent_messages`、`agent_active_users`、`agent_adoption_rate` | `cost_center`、`organization`、`department`、`team` |
| `reports` | `processed/reports/{month}.json`（取り込んだ利用レポート） | `report_gross_spend`、`report_net_spend`、`report_requests`、`report_active_users`、`report_top_model`、`report_top_sku` | `cost_center`、`organization`、`department`、`model`、`sku` |

- 内訳の列: シート系のグループは `total_seats`、`active_seats`、`idle_seats`、`total_cost_usd`、`net_cost_usd`、`potential_savings_usd`、`active_ratio`、`acceptance_rate`、`total_chats`、`total_requests`。`model` は `total_requests`、`total_spend_usd`、`active_users`、`percentage`。`sku` は `total_quantity`、`total_spend_usd`、`percentage`。対応表はコード（`src/processor/report-engine.ts` の `METRIC_BINDINGS` / `GROUP_SOURCES`）にあり、指標や列の追加はそこへ 1 項目足すだけ。
- 定義に組織・部署・Cost Center・個人の名前は書かない（フィルターは列と数値だけ）。利用者単位の行（`users`、`user_profiles`、`user_details`）は読まない。

### 6.3 検証

strict スキーマ（未知のキーはエラー）と意味の検証。`npm run reports:validate [-- --dir reports]` がすべての問題を表示し、exit 1 で終わる。

| 拒否するもの | メッセージ（抜粋） |
|:--|:--|
| 指標カタログに無い指標 | `unknown metric "x" (not in the metric catalog)` |
| そのデータセットが提供できないカタログ指標 | `metric "x" is not available from dataset "monthly"` |
| 未知の `group_by`・列・`sort_by`（列に含まれない）・フィルター列 | `unknown group` / `unknown column` / `sort_by` |
| 未知の `privacy_tier` | `unknown tier "x" (use "aggregate-only" or "identified")`（`identified` は有効。生成には §7.3 のゲートが要る） |
| セクション ID・指標の重複、ファイル名と異なる `id`、ファイルをまたぐレポート ID の重複 | |
| 不正な YAML、64 KiB を超えるファイル | YAML は安全な既定スキーマ（型タグなし）で読む |

不正な定義は他の定義を止めない。有効なものは生成し、最後に exit 1 で知らせる。

### 6.4 生成と定期実行

`npm run reports:generate -- --due`（日次ワークフローがパイプラインの後に実行する。`continue-on-error`、モックモードでは実行しない）、または 1 件を `-- --id <id> [--month YYYY-MM] [--demo]` で生成する。

| `schedule` | 対象 | 生成する条件 |
|:--|:--|:--|
| `monthly-close` | 月次締めのスナップショット（`processed/closes`、SDD-17 §3）があり、データセットにデータがある月ごと。期間は `YYYY-MM` | まだ出力が無い |
| `weekly` | データセットの最新の月。期間は実行日の ISO 週（`YYYY-Www`、UTC） | 今週の出力がまだ無い |
| （省略） | 手動のみ（`--id`。最新の月または `--month`） | 自動では生成しない |

**定義が変わった**（SHA-256 が記録と異なる）か出力の種類が増えたときも再生成の対象になるので、定義を直せばレポートが更新される。生成は冪等で、同じ入力なら本文も同じ（生成時刻は本文に入れない）。入力の月が無いときは何も書かない（`no_data`）。

### 6.5 出力

- ファイル: `audit/report-outputs/{report_id}/{period}.md` と `.csv`。一覧 `audit/report-outputs/index.json` は出力ごとに `report_id`、`period`、`data_month`、`generated_at`、`definition_sha256`（定義の版）、`outputs`、`demo`、`privacy_tier`（P4-6。無い古い項目は `aggregate-only` として読む）を持つ。
- 品質属性（指標カタログ）: すべての値に品質を付け、実測以外は `[推定]` / `[欠損]` / `[デモ]` と表示する。欠損は**「—（理由）」**で、0 や空の表にしない。デモデータにはデモである旨を付ける。Markdown の冒頭に、期間・データの月・データセット・プライバシー階層・定義の版、締め済みの月は現在の月次締めのチェックサム（SDD-17 §3）を載せる。
- CSV: UTF-8 **BOM 付き**、**CRLF**、RFC 4180 のクォート、列は `section, group, item, value, unit, quality`（縦持ち。`value` は生の数値で、欠損は空セルと品質 `missing`）。§4.4 の CSV インジェクション対策をすべてのセルに適用する。

### 6.6 公開範囲（ゼロリーク）

| 場所 | レポートの出力 | 理由 |
|:--|:--|:--|
| GitHub Pages / `dist/data/` | **載せない** | 出力は `audit/` 配下にあり、`pages:stage` の許可リストに無い。`dist/data/` に `audit` があれば `pages:verify` が失敗する（`FORBIDDEN_DIST_PATHS`）。`STAGED_PROCESSED_DIRS` は変更しない |
| `copilot-data` ブランチ | 載せる（`audit/` 配下） | リポジトリと同じ公開範囲。既存の `fork:verify` の公開範囲検査が守る（弱めない） |
| `main` ブランチ | 定義（`reports/*.yaml`）だけ | 定義が持つのは ID・タイトル・列名で、データは持たない。出力は `main` に置かない |

- Pages に載せない理由: Pages は既定で公開で（`security-zero-leakage.md` §2.3）、定義はグループ（Cost Center・組織・部署）を指定でき、その名前は社内の組織構造になる。同じ数値は、ダッシュボードが既に配信しているデータセット経由で画面から見られる。
- **プライバシー階層**: 定義は `aggregate-only`（既定）か `identified` を宣言する。階層・`identified` に必要なゲート・検査は §7 に定める。どちらの階層の出力も `audit/` に置き、Pages へは配信しない。出力の保持は §8。
- サンプルとテストの値はすべて架空。

### 6.7 レポートの追加手順

1. `reports/<id>.yaml` を書く（§6.1）。2. `npm run reports:validate`。3. `npm run reports:generate -- --id <id> --demo` でデモデータに対して確認する。4. マージすると、以降は日次ワークフローが生成する。コードが要るのは新しい*種類*の値（どのデータセットの束縛にもまだ無い指標や列）だけで、その場合は指標を指標カタログ（SDD-16 §2, §6）に追加し、`METRIC_BINDINGS` に束縛を足す。

## 7. プライバシー階層と発行プロファイル (P4-6 / E-05)

運用前提は社内限定（SDD-01 §1.1、SDD-04 §5）で、プライベート / 社内のリポジトリ、アクセス制御付きの Pages、閲覧者は従業員のみ。この前提では**ビルドは 1 系統で足りる**（二重ビルド＝匿名化版の別ビルドは必須ではない。親計画の判断結果 #2）。必要なのは、発行物ごとに「どれだけ個人を特定するか」の**宣言**と、宣言と実際の配信物が一致していることの**検査**である。

### 7.1 階層

| 階層 | 意味 | 使われる場所 |
|:--|:--|:--|
| `aggregate-only` | 利用者単位の行を含まない（ログイン・氏名・部署・個人別の数値なし）。件数・金額・日付・グループ合計のみ | レポート定義の既定、`index.json`、`error-log.json`、`processed/{trends,quality,closes}`、`catalog/`、`audit/billing-reconciliation/`、`audit/retention/` |
| `identified` | 利用者単位の行を含み得る（ログイン、解決済みの氏名・部署、個人別の利用量。`ANONYMIZE_USERS=true` では仮名） | `processed/{monthly,reports,deep-analysis,custom,daily}`、`raw/`、CSV 原本、`audit/seat-events/`、これを宣言したレポート定義 |

定義は `privacy_tier` で階層を宣言する（§6.1）。検証では両方の階層が有効で、未知の階層はエラーになる。現在のセクション種別（`kpi`、グループ別の `breakdown`）はすべて集計であり、階層は定義が宣言する上限である。将来、利用者単位のセクションを足すとき、`aggregate-only` のレポートに気づかれずに入ることを防ぐ。

### 7.2 発行プロファイル

`src/domain/privacy-profile.ts`（`PUBLICATION_PROFILE`）が、発行物（`data/` 配下のパス）ごとに**階層**・**Pages へ配信するか**・**保持の扱い**を宣言する。

| 発行物 | 階層 | Pages | 保持（§8） |
|:--|:--|:--|:--|
| `index.json`、`error-log.json`、`catalog/` | aggregate-only | 配信する | 保持 |
| `processed/{monthly,reports,deep-analysis,custom,daily}` | identified | 配信する（前提: 社内限定） | 保持 |
| `processed/{trends,quality,closes}` | aggregate-only | 配信する | 保持（**`closes/` は削除しない**） |
| `raw/`（日次 Raw・Run Manifest・landing の object）、`reports/monthly/`（CSV 原本） | identified | **配信しない** | raw: 期限切れで削除 |
| `config/`（暗号化済みマッピング） | identified | **配信しない** | 保持 |
| `audit/seat-events/` | identified | **配信しない** | audit: 期限切れで削除 |
| `audit/billing-reconciliation/` | aggregate-only | **配信しない** | audit: 期限切れで削除 |
| `audit/report-outputs/` | レポートごと（`index.json` の `privacy_tier`） | **配信しない** | audit: 期限切れで削除 |
| `audit/retention/` | aggregate-only | **配信しない** | 保持 |

規則: 配信しない発行物は `pages:stage` に載せず、`pages:verify` の禁止リスト（`FORBIDDEN_DIST_PATHS`）に載せる。Pages に載る `identified` は前提に基づく `processed/*` のスコープだけ。個人を特定するそれ以外のものは `copilot-data`（リポジトリと同じ可視性で、露出検査が守る）に置くか、そもそも保存しない。

### 7.3 `identified` の出力のゲート

`identified` のレポートは、次の**どちらか**を満たすときだけ生成する。満たさなければ `reports:generate` は生成を拒否する（`refused`、exit 1、何も書かない）。

1. **仮名化**: `ANONYMIZE_USERS=true` かつ `ANONYMIZE_SECRET` が 16 文字以上（SDD-04 §5.2、キー付き HMAC-SHA256）。レポートが読むデータは仮名になる。
2. 運用者の**明示許可**: Actions 変数 `COPILOT_ALLOW_IDENTIFIED_REPORTS=true`。リポジトリと Pages が社内限定であることの宣言（SDD-04 §5）。

`COPILOT_ALLOW_PUBLIC_DATA` はゲートを**開けない**。ゲートは追加の条件であり、§7.4 の露出検査を置き換えたり緩めたりしない。

### 7.4 検査

| 検査 | 失敗する条件 |
|:--|:--|
| `npm run pages:verify` | プロファイルとステージ設定が食い違う（宣言の無い、または配信しないと宣言された `processed/` のディレクトリがステージされている、「配信しない」トップレベルのパスが禁止リストに無い、`processed/` 以外で配信すると宣言された `identified` がある）。既存の検査（ステージ対象が `dist/data/` に無い、`raw`・`config`・`audit`・CSV 原本が `dist/data/` にある）も同じ |
| `npm run fork:verify`（オフライン部分、カテゴリ *Publication Profile*） | 同じプロファイルの整合、`dashboard/public/data/` に `audit/`・`raw/`・`config/`・CSV がある、`audit/report-outputs/index.json` が未知の階層を記録している、または §7.3 のゲートが閉じているのに `identified` の出力がある（デモ出力は除く）。保持期間を過ぎたデータは**警告** |
| `npm run fork:verify`（露出検査、SDD-04 §5.3） | **変更なし**。実在の利用者単位データが誰にでも読める状態なら引き続き失敗する。`COPILOT_ALLOW_PUBLIC_DATA` は文書化された意味のままで、拡張しない |

宣言と配信物が食い違えばビルドが失敗する。本節のどれも既存の検査を弱めない。

## 8. 保持期間ポリシー (P4-6 / E-05)

生データは **5 年**保持する。保持期間は宣言され、適用前に見え、明示操作でだけ適用され、記録される。

### 8.1 設定と期限

- `COPILOT_DATA_RETENTION_MONTHS`（Actions 変数。整数 **12〜600**、既定 **60**）。不正な値はメッセージを出して 60 に戻す（`index.json` は About モーダル用にこの値を `data_retention_months` として持つ。削除は制御しない。旧項目 `data_retention_days`（固定値）は非推奨）。
- **当月を含む**直近 N 暦月を保持する。月 `M` は、当月から N か月より前なら期限切れ（N = 60 の 2026-10 では 2021-11 を保持、2021-10 以前が期限切れ）。日付は UTC。カットオフは `keep_from` として表示する。

### 8.2 期限切れになるもの・ならないもの

| 期限切れで削除（月単位） | 条件 |
|:--|:--|
| `raw/YYYY/MM/`（日次 Raw） | その月が**締め済み**（`processed/closes/{month}.json` がある）。未締めは保持し `not_closed` と報告 |
| `reports/monthly/YYYY-MM/`（CSV 原本） | 締め済み（同上） |
| `raw/landing/manifests/{run_id}.json` | run_id の月。および、残る manifest のどれからも参照されなくなった `raw/landing/objects/` のファイル。読めない manifest があれば object は 1 件も削除しない |
| `audit/seat-events/{month}.json`、`audit/billing-reconciliation/{month}.json` | その月（締めは不要） |
| `audit/report-outputs/{id}/{period}.{md,csv}` と `index.json` の該当行 | 期間: `YYYY-MM`、`YYYY-Www` は ISO 週の木曜日が属する月 |

**保持期間で削除しないもの**: `processed/**`（月次・レポート・深掘り・カスタム・日次の集計、トレンド、品質履歴、**`processed/closes/`＝締め済みの月のスナップショット・チェックサム・改訂履歴**）、`index.json`、`error-log.json`、`catalog/`、`config/`、`audit/retention/`、`data/` の外のすべて。計画の生成はこれらを列挙しない作りになっている。

### 8.3 操作と安全策

| 手順 | コマンド | 動作 |
|:--|:--|:--|
| 計画（ドライラン、既定） | `npm run retention:plan`（`--execute` 無しの `retention:apply` も同じ） | 期限切れの対象をカテゴリ別（件数・サイズ・月または ID）と、未締めのため保持するものを一覧する。**何も変更せず、何も書かない**。日次ワークフローが実行し（`continue-on-error`）、期限超過があれば `::warning::` を出す |
| 実行（明示操作） | `npm run retention:apply -- --execute --confirm <keep_from> [--actor <alias>]` | `--confirm` は現在の計画のカットオフ月と一致しなければならない（古い計画は拒否）。計画の対象を削除し、実行を記録する |

- **拒否**: デモデータ（`data/demo`）には触れない。`copilot-data` 系ブランチ以外で `data/` 配下が Git で追跡されている場合（汚染された `main`、SDD-05）は拒否する。シンボリックリンクは列挙も追跡もしない。パスは検証済みの名前（月・run_id・object のハッシュ・レポート ID・期間）から組み立て、`data/` の外に出ない。CI では実行せず、`main` に対しては実行しない。
- **弱めない**: 保持の実行は `fork:verify` / `pages:verify` に触れない。`fork:verify` の保持の検査は警告だけ。
- **場所**: `copilot-data` のチェックアウトで実行し、そのブランチをコミットする。**削除したファイルはブランチの履歴に残る**（履歴を書き換えるまで）。期限切れがプライバシー上・法令上の要件なら、`copilot-data` の履歴の書き換えを（このツールの外で）別に行う。

### 8.4 記録

`audit/retention/log.json`（`schema_version`、`runs[]`、最大 1000 件）: `run_id`、`started_at`、`finished_at`、`status`（`started` → `completed` / `failed`）、`retention_months`、`keep_from`、`actor`（運用者が選ぶ別名・役割名。CI ユーザーや GitHub ログインは自動で入れない）、カテゴリ別の `count` / `keys`（月・run_id・`{report_id}/{period}`。個人情報なし）/ `bytes`、`skipped[]`、`errors[]`。**先に意図を書き**（`started`）、削除し、記録を完了にするので、中断された実行も見える。1 件の失敗は他を止めない（その実行は `failed`）。締め済みの記録は残るため、数値の監査証跡（§3）は生データより長く残る。

## 9. 同期状況と既知の差分 (P4-7 / #203)

P4-7 は Phase 4 の最後の変更である。仕様書と実装を突き合わせ、その結果をここに残す。後から読む人が、何を確認し、何が未解決かを分かるようにする。

### 9.1 実装と突き合わせた仕様書

| SDD | 確認した内容 | 結果 |
|:--|:--|:--|
| SDD-02 | 実際の結線と単一フロントエンド構成（ADR-0001） | 一致（P2 で同期済み） |
| SDD-03 | Reports API、Cost Centers の形、Billing（AI Credits）API | 一致（P1 で同期済み）。実 Enterprise への実 API 呼び出しは未実施（SDD-08 §1） |
| SDD-04 | 公開範囲、HMAC 仮名化、プライバシー階層 | 一致（P4-6 が §5.4 の相互参照を追加） |
| SDD-05 | Raw Landing、Run Manifest、正準ファクト、`audit/`、`closes/` のレイアウト | **P4-7 で修正**: §2 の `raw/` のレイアウトが `*-metrics.json` / `*-seats.json` / `*-cost-centers.json` だったが、実装は 1 日 1 ファイルの `YYYY-MM-DD-raw.json`（`metrics`、`seats`、`cost_centers`）を書く |
| SDD-06 | 価格カタログ、総額 / 純額、シート分類、推定 | 一致。突合は §4.7（P4-4）。保持期間は集計に触れないので P4-6 の変更なし |
| SDD-07 | 品質属性、KPI 規約、監査ビュー（§2.19） | 一致。旧保持期間フィールドについての About モーダルの注記を P4-7 で追加 |
| SDD-08 | 日次ワークフローのステップ、変数、権限 | **P4-7 で修正**: 為替、請求 Issue、レポート生成、保持期間のドライランの各ステップと、変数 `COPILOT_BUSINESS_CALENDAR`・`COPILOT_RECONCILIATION_TOLERANCE`・`COPILOT_ALLOW_IDENTIFIED_REPORTS`・`COPILOT_DATA_RETENTION_MONTHS`、権限 `issues: write` が欠けていた |
| SDD-10 | 正規化、データセット版（内容ハッシュ）、データファイル | 一致（P3-7 で同期済み） |
| SDD-11 | 診断 v2、判定不能ユーザー | 一致（P3-5 で同期済み） |
| SDD-15 | Query 層、ESLint 規約 | 一致 |
| SDD-16 | カタログと `METRIC_REGISTRY` | **P4-7 で修正**: 表に `adoption_unclassified_users`・`yoy_spend_change`・`yoy_active_seats_change` が欠けていた。データ契約の索引（§7）を追加。28 件の id がすべて一致 |

### 9.2 既知の差分（この変更では直さない）

| 差分 | 場所 | 扱い |
|:--|:--|:--|
| `index.json` の `data_retention_days` は固定の 365 で、About モーダルが表示するため 60 か月のポリシーと食い違っていた | `PipelineOrchestrator`、`dashboard/src/components/AboutModal.tsx` | Issue #257 で修正: `data_retention_months` を出力・表示し、旧項目は非推奨（§8.1、SDD-05 §3、SDD-07） |
| リポジトリのルールと `AGENTS.md` が存在しない `dashboard/src/data/models.ts` を挙げていた（UI のレジストリは `dashboard/src/components/radar/radar-constants.ts`） | `.agents/rules/model-benchmark-management.md`、`AGENTS.md` | Issue #258 で SDD-10 §6.1.2 と同じ同期対象に訂正した |
| 実機検証: Reports / Billing API とスキーマドリフトのワークフローは、開発環境から実 Enterprise に対して実行していない | SDD-03、SDD-08 §1、§5.7 | 各機能の仕様に明記済み。Enterprise の PAT が必要 |
