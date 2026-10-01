# Implementation Plan: ダッシュボード改善 Phase 1（取得基盤）

- **親計画**: [../2026-10-01_DashboardReviewAndImprovementPlan/implementation_plan.md](../2026-10-01_DashboardReviewAndImprovementPlan/implementation_plan.md)（Phase 1: P1-1〜P1-7）
- **Issue**: [sun-flat-yamada/github-copilot-dashboard#163](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/163)
- **判断結果**: 親計画の「判断結果」を参照（Enterprise と Org を併用、認証は PAT のみ、運用は社内限定）。

## 進め方

Phase 1 は大きいため、PR を分ける。完了条件は親計画の P1-1〜P1-7 を正とする。

| PR | 内容 | 状態 |
| :--- | :--- | :--- |
| A | P1-1 Usage Metrics Reports API アダプタ（`users-1-day`、Enterprise + Org、重複排除、プロファイル、旧 `/copilot/metrics` の削除） | 本 PR |
| B | P1-6 価格カタログ v1 と為替カタログ | 未着手 |
| C 以降 | P1-2 Raw Landing / Run Manifest、P1-3 正準ファクト、P1-4 契約テスト・ドリフト検知、P1-5 AI Credits API / CSV プロファイル、P1-7 データ品質レポート | 未着手 |

## PR A の設計

| 論点 | 方針 |
| :--- | :--- |
| 取得するレポート | `users-1-day` のみ。全体の値は、重複排除したユーザー行から導出する（集計レポートは使わない。PR 概要数など一部の指標は提供されないため null） |
| スコープ | Enterprise を先頭に、各 Org を併用。同じ日・同じユーザー（`user_id`）は 1 件（Enterprise の行を採る）。シートも和集合（ログイン名で 1 席） |
| 取得日 | 昨日までの 30 日（当月の月初のほうが早ければ月初まで）。3 並列。最新日の 404 / 204 は障害にしない |
| 署名付き URL | `Authorization` なし・https のみ・サイズ上限 |
| 状態 | 全日 `ok` / 一部失敗・隔離 `partial` / 1 件も読めない `failed`（必要なスコープを示す issue） |
| 検証 | 行ごとに zod で検証、不正行は隔離。未知の feature / model は保持 |
| プロファイル | 行から実測で作り、シートと属性マッピングで属性を補う（`enrichUserProfiles`）。匿名化モードでは仮名のログイン名 |

## 作業環境

Phase 0 と同様、単一エージェントの使い捨てコンテナでプライマリ作業ツリーを使う。
