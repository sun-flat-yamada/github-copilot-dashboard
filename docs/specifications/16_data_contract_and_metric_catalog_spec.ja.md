[English](16_data_contract_and_metric_catalog_spec.md) | [日本語](16_data_contract_and_metric_catalog_spec.ja.md)

---

# SDD-16: データ契約 & 指標カタログ仕様書 (Data Contract & Metric Catalog Specification)

- **文書番号**: SPEC-COPILOT-016
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.10
- **作成日**: 2026-10-04 (P3-1 / #188: 指標カタログ v1、P3-2 / #189: 予算・予測指標、P3-5 / P3-6: 採用成熟度・前年同月比の指標、P4-7 / #203: データ契約の節とカタログの同期)
- **関連**: [SDD-06 集計・課金ロジック](06_aggregation_and_billing_logic_spec.ja.md)、[SDD-07 ダッシュボード UI/UX §2.14a](07_dashboard_ui_ux_spec.ja.md)、[SDD-15 データセントリック・リアクティビティ](15_data_centric_reactivity_design_spec.ja.md)、[SDD-05 §2.3 / §2.4](05_data_storage_and_fork_isolation_spec.ja.md)、[SDD-17 監査 & レポート](17_audit_and_report_spec.ja.md)

---

## 1. 目的

同名の指標が画面ごとに別の意味で使われ、定義・集計窓・出典が画面から分からなかった。**指標カタログ**はダッシュボードが表示する全 KPI を 1 箇所 (`src/domain/metrics/metric-registry.ts`、SDD-07 §2.14a の Metric Registry) に宣言する。UI・ツールチップ・テストはこの単一の定義を共有する。

## 2. カタログ項目 (`MetricDefinition`)

| 項目 | 意味 |
|:--|:--|
| `id` | 安定した識別子 (`METRIC_REGISTRY` のキー) |
| `label` | 表示名 (`ja` / `en`) |
| `definition` | 何を数えた値か (`ja` / `en`) |
| `formula` | 人が読める計算式 |
| `unit` | `usd` / `ratio` / `count` / `seats` / `users` / `credits` / `name` |
| `window` | 集計窓 (§3) |
| `filterable` | フィルター有効時に再集計されるか (`false` = 全社値。「全社値 (フィルター非対応)」バッジを付ける) |
| `sources` | 値の出典 (データセット / API) |
| `caveats` | 読み取り上の注意 (任意) |
| `defaultQuality` | `measured` / `estimated` (SDD-07 §2.14a の品質属性) |

## 3. 集計窓

| `window` | 意味 | 表示 |
|:--|:--|:--|
| `scope` | 選択したスコープ (日次 / 月次 / 期間) | スコープ種別に追従: 当日 (日次スコープ) / 当月 (月次スコープ) / 選択期間 |
| `report_month` | 選択した月次利用レポートの月 | 選択した月次レポートの月 |
| `collection_period` | 収集した利用状況データの対象期間 | 収集データの対象期間 |
| `point_in_time` | 時点値 | 時点値 |

タイムゾーン: 指標が別途示さない限り、集計の境界は UTC とする。

## 4. 表示規約

- すべての KPI ラベルは `MetricLabel` で描画する。指標名、**定義・計算式・窓・単位・出典・フィルター可否・注意点を列挙するツールチップ付きの情報アイコン**、および可視の**窓チップ** (色だけに頼らずテキストで示す) を表示する。
- 対象 KPI コンポーネント: 概要カード (`KpiSummaryCards`)、月次レポートカード (`MonthlyReportKpis`)、採用成熟度・Agent アクティビティ・クレジットの各ビューの KPI カード。
- カタログに無い KPI は表示できない。`MetricId` はカタログから導出した型であり、`src/tests/metric-catalog.test.ts` は、KPI コンポーネントがカタログに無い id を参照した場合、`MetricLabel` を使わなくなった場合、カタログ項目がどこにも表示されない場合に失敗する。

## 5. 個人指標

ユーザー別の指標 (ユーザー明細テーブル、ドリルダウン、ユーザー推移) は、社内限定の前提で画面に表示する。これらは**閲覧権限のある社員向けの改善支援情報**であり、人事評価やランキングには使わない。ユーザー明細テーブルはこの旨を画面に表示する (`PERSONAL_METRICS_NOTICE`)。identified / aggregate-only の二重ビルドは作らない。

## 6. カタログ v1 の項目

| id | 名称 | 単位 | 窓 | フィルター | 出典 |
|:--|:--|:--|:--|:--|:--|
| `total_spend` | 利用費用 | usd | scope | ○ | seats, pricing catalog |
| `active_rate` | アクティブ利用率 | ratio | scope | ○ | seats |
| `idle_waste` | 遊休コスト (削減可能) | usd | scope | ○ | seats, pricing catalog |
| `acceptance_rate` | Inline補完受諾率 | ratio | scope | × | metrics |
| `budget_utilization` | 予算消化率 | ratio | scope | ○ | billing, cost center budgets |
| `spend_forecast` | 月末着地予測 (費用) | usd | scope | × | daily trends |
| `credits_forecast` | 月末着地予測 (AI Credits) | credits | scope | × | daily trends |
| `report_gross_spend` | 利用費用 (総額) | usd | report_month | ○ | monthly usage report CSV |
| `report_net_spend` | 超過請求費用 | usd | report_month | ○ | monthly usage report CSV |
| `report_requests` | 総リクエスト / クレジット | count | report_month | ○ | monthly usage report CSV |
| `report_active_users` | レポート内アクティブ人数 | users | report_month | ○ | monthly usage report CSV |
| `report_top_model` | 最多利用 AI モデル | name | report_month | ○ | monthly usage report CSV |
| `report_top_sku` | 主契約 / SKU | name | report_month | ○ | monthly usage report CSV |
| `adoption_evaluated_users` | 評価対象ユーザー総数 | users | collection_period | ○ | agent metrics |
| `adoption_unclassified_users` | 判定不能ユーザー数 | users | collection_period | ○ | users-1-day report |
| `adoption_active_rate` | 全体活用定着率 | ratio | collection_period | ○ | agent metrics |
| `adoption_advanced_rate` | 高度活用率 | ratio | collection_period | ○ | agent metrics |
| `adoption_multi_agent_users` | 自律協調層ユーザー数 | users | collection_period | ○ | agent metrics |
| `agent_sessions` | 総 Agent セッション数 | count | collection_period | ○ | agent metrics |
| `agent_messages` | Agent メッセージ総数 | count | collection_period | ○ | agent metrics |
| `agent_active_users` | アクティブ Agent ユーザー | users | collection_period | ○ | agent metrics |
| `agent_adoption_rate` | Agent 浸透率 | ratio | collection_period | ○ | agent metrics |
| `credits_pool_used` | 組織プール総消費 | credits | collection_period | ○ | AI credits usage |
| `credits_cost` | AI Credits 換算費用 | usd | collection_period | ○ | AI credits usage, pricing catalog |
| `combined_cost` | 総合費用 (シート＋Credits) | usd | collection_period | ○ | seats, AI credits usage, pricing catalog |
| `pool_utilization` | プール消化率 | ratio | collection_period | ○ | AI credits usage, seats |
| `yoy_spend_change` | 利用費用 前年同月比 | usd | point_in_time | × | processed/monthly, trends/rolling-1year |
| `yoy_active_seats_change` | 利用中シート 前年同月比 | seats | point_in_time | × | processed/monthly, trends/rolling-1year |

定義・計算式・注意点の全文はカタログのソースにある。KPI を追加するときは、項目を追加し、`MetricLabel` で描画し、この表と英語版を同期する。この表は `METRIC_REGISTRY` の全 id (28 件) を載せ、この文書を更新するときにカタログのソースと id の集合を突き合わせる (P4-7)。

## 7. データ契約

指標カタログ (§1〜§6) は数値の意味を定める。データ契約は、その数値の計算元になるデータの形を定める。各契約は生成する場所で仕様化されており、この節はその索引である。

| 契約 | 版の定数 | 仕様の所在 |
|:--|:--|:--|
| 正準ファクト (`fact.usage_user_daily`、`fact.usage_user_feature_daily`、`fact.usage_org_daily`、`fact.seat_snapshot`、`fact.cost_line`)。JSON Schema は `docs/schemas/facts/` | `FACT_SCHEMA_VERSION` | SDD-05 §2.4 |
| Run Manifest | `RUN_MANIFEST_SCHEMA_VERSION` | SDD-05 §2.3 |
| データ品質レポート | `DATA_QUALITY_SCHEMA_VERSION` | SDD-05 §2.5、SDD-17 §2 |
| CSV 取込レポート | `CSV_IMPORT_REPORT_SCHEMA_VERSION` | SDD-09 |
| 月次締めスナップショットと改訂 | `MONTH_CLOSE_SCHEMA_VERSION` | SDD-05 §2.7、SDD-17 §3 |
| シート監査イベント | `SEAT_AUDIT_SCHEMA_VERSION` | SDD-05 §2.8、SDD-17 §4 |
| 請求突合 | `BILLING_RECONCILIATION_SCHEMA_VERSION` | SDD-05 §2.9、SDD-17 §5 |
| レポート定義 (`reports/*.yaml`) | `REPORT_DEFINITION_SCHEMA_VERSION` | SDD-17 §6 |
| 保持ログ | `RETENTION_LOG_SCHEMA_VERSION` | SDD-05 §2.11、SDD-17 §8 |

すべての契約に共通する規約:

- **版管理**: 各ファイルは `schema_version` を持ち、互換を壊す変更で版を上げる。現時点ではすべて版 1。
- **欠損は 0 ではない**: 値が無いときは `null` (ファクト) か、明示の `missing` / `estimated` の品質で表し、`0` で埋めない (SDD-06 §4.4)。カタログの `defaultQuality` (`measured` / `estimated`) は、ファクトの `quality` (`measured` / `estimated` / `missing` / `demo`、SDD-07 §2.14a) の表示側の対応物である。
- **取込層で API の変更を吸収する**: API の形の変更は取込層に閉じ込め、契約テストと週次のスキーマドリフト検知で検出する (SDD-08 §1)。
- **パスごとのプライバシー階層**: 保存するすべてのパスは、公開プロファイルで階層と Pages への公開可否を宣言する (SDD-17 §7.2)。
- **カタログ・ファクト・ビューを揃える**: KPI はカタログで 1 回だけ定義し、上記の契約から計算し、`MetricLabel` で表示する。
