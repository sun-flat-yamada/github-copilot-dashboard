[English](17_audit_and_report_spec.md) | [日本語](17_audit_and_report_spec.ja.md)

---

# SDD-17: 監査 & レポート仕様書 (Audit & Report Specification)

- **文書番号**: SPEC-COPILOT-017
- **ステータス**: Approved / Active（Phase 4 に合わせて拡張。P4-2〜P4-6 で節を追加する）
- **対象バージョン**: 2026.10
- **作成日**: 2026-10-04 (P4-1 / #197: 監査・データ品質ビュー、P4-2 / #198: 月次締めと改訂)
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

## 4. 今後追加する節（未仕様）

シート監査イベントと CSV 出力（P4-3）、請求突合（P4-4）、定義駆動レポート（P4-5）、プライバシー階層と保持期間ポリシー（P4-6）は、各タスクの実装時に本書へ追記する。
