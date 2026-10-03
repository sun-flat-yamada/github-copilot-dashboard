# Walkthrough: ダッシュボード改善 Phase 1 / PR A（P1-1 Usage Metrics Reports API）

- **Issue**: [sun-flat-yamada/github-copilot-dashboard#163](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/163)
- **親計画**: [../2026-10-01_DashboardReviewAndImprovementPlan/implementation_plan.md](../2026-10-01_DashboardReviewAndImprovementPlan/implementation_plan.md)

## 1. 変更の要点

| 領域 | 内容 | 主なファイル |
| :--- | :--- | :--- |
| 取得 | `users-1-day`（署名付き URL → NDJSON）を Enterprise と各 Org で取得し、`user_id` で重複排除（Enterprise の行を採る）。旧 `/copilot/metrics` を削除 | `src/adapters/github-api/usage-reports/*`、`GitHubApiCopilotDataSource.ts` |
| HTTP | 許可ステータス・204、署名付き URL は認証ヘッダーなし・https のみ・サイズ上限、4xx は再試行しない | `RawApiFetcher.ts` |
| 写像 | 行 → 日次メトリクス / ユーザー別プロファイル（補完は `code_completion` のみ。PR 概要数は null） | `user-report-mapper.ts`、`src/domain/entities/copilot.ts`、`metrics-aggregator.ts` |
| プロファイル | シートと属性マッピングで属性を補う（匿名化モードでは仮名） | `src/processor/profile-enricher.ts`、`PipelineOrchestrator.ts` |
| シート | Enterprise と Org の和集合（ログイン名で 1 席） | `GitHubApiCopilotDataSource.ts` |
| 公開範囲ガード | **Phase 0 の不具合を修正**（下記 2） | `PipelineOrchestrator.ts`、`scripts/verify-fork-health.ts` |

## 2. Phase 0 の不具合の修正（fork:verify の誤検知）

Phase 0 の `privacy.contains_user_level_data` は、取り込んだ月次レポート（CSV）の有無だけで true になり、前回の true も引き継いでいた。その結果、本家（公開リポジトリ、見本の CSV のみ）の `copilot-data` の index が `true` になり、`fork:verify` が失敗する状態だった（定期ワークフローの事前検査で止まる）。

- ライブ収集したデータ（シート・プロファイル）だけで `contains_user_level_data` を決め、CSV は別の `contains_imported_reports` に分けた。
- `fork:verify` は、公開された index にレポートがあれば失敗ではなく**警告**にする（見本か実データかは判別できない）。旧形式の「シートも日次実績もない true」は、ユーザー単位のデータとみなさない（過去の index で検査が止まる循環を避ける）。
- 本家での確認: 修正前は失敗 1 件、修正後は失敗 0 件・警告（見本のレポートが公開されている旨）。

## 3. 品質ゲート

`fork:verify`（0 Failure）、`typecheck`、`lint`、`test`（674 件）、`secret-scan`、`build`、`pipeline:mock` が成功。

## 4. 未検証・残課題

- **実際の Enterprise への呼び出しは未実施**（トークンがない）。エンドポイント・スキーマ・スコープは GitHub の REST API description（一次情報）に基づき、契約テスト（P1-4）で固定する。
- 取得日の窓は 30 日（当月の月初まで遡る）。初回の長期バックフィルは P1-2（Raw Landing）で扱う。
- 提供されない指標: PR 概要数（null）、チャットのコピー / 挿入、エージェントのセッション数。集計レポート（PR の `pull_requests` など）の利用は後続。
- 旧 `normalizers/metrics-2026-03-10.ts` とスキーマは、チーム別メトリクス（旧 API）と zod テストが参照しているため残している。
- GitHub App での実動作は未検証（PAT のみの決定は維持）。


---

# Walkthrough: Phase 1 / PR B（P1-6 価格カタログ v1 と為替カタログ）

- **コミット**: `8fc56c3`（#165）

## 変更の要点

| 領域 | 内容 | 主なファイル |
| :--- | :--- | :--- |
| 為替 | 固定値の「公式」月次表とブラウザの外部取得を撤去。カタログ（保存済みの月次レート）だけを参照する。直前月の引き継ぎ、レートが無ければ換算を出さない | `PublicExchangeRatesService.ts`、`CurrencyContext.tsx` |
| 取得 | ECB 月次平均を確定月のみ取得。上書きしない・失敗時は既存を保持。出典と取得日を保存 | `ExchangeRateCatalogUpdater.ts`、`scripts/update-exchange-rates.ts`（`npm run catalog:fx`） |
| 保存・配信 | `catalog/<name>.json` の保存と読み込み、`pages:stage` の許可リストへ追加 | `fork-safe-storage.ts`、`pages-staging.ts`、ワークフロー |
| 価格 | 価格カタログのバージョンに「GitHub 一次情報と未照合」を明記 | `pricing-catalog.ts` |

## 未検証

- ECB への実接続（作業環境から到達不可。パーサーはフィクスチャのみで検証）
- 価格の GitHub 公式ドキュメントとの照合

---

# Walkthrough: Phase 1 / PR C（P1-2 Raw Landing + Run Manifest + 再処理）

## 1. 変更の要点

| 領域 | 内容 | 主なファイル |
| :--- | :--- | :--- |
| 取得の契約 | `RawApiClient` を抽出し、ソースアダプタ・`UsageReportsClient` はこれだけに依存する | `RawApiClient.ts` |
| 記録 | `RecordingFetcher` が応答を内容ハッシュで不変保存し、run の台帳（Run Manifest）を最後に 1 回書く。署名付き URL の署名は保存しない | `raw-landing/RecordingFetcher.ts`、`RawLandingStore.ts`、`request-key.ts` |
| 再生 | `ReplayFetcher` が manifest の応答を返す。記録された失敗は同じ失敗として再生、未記録の要求は `ReplayMissError` | `raw-landing/ReplayFetcher.ts` |
| 結線 | 収集は録画、`createReprocessApp` は manifest の設定（Enterprise / Org / レポート日 / API バージョン）で同じデータソースとオーケストレーターを動かす。`index.json` に `run` | `composition-root.ts`、`PipelineOrchestrator.ts`、`cli/reprocess-pipeline.ts` |
| 個人情報 | 匿名化モード・モックでは保存しない | `composition-root.ts` |

## 2. 検証

- `RawLanding.test.ts`（9 件）: 記録 → 成果物を削除 → 再生で、全 JSON 成果物が時刻・ID を除いて同一。再生中の通信は 0 回（`fetch` を例外にして確認）。署名は Raw のどこにも残らない。録画済みの失敗の再現。manifest の上書き禁止。パス脱出の拒否。匿名化では保存しない。
- 品質ゲート: `fork:verify`（0 Failure）、`typecheck`、`lint`、`test`（728 件）、`secret-scan`、`build`、`pipeline:mock` が成功。

## 3. 未検証・残課題

- 実際の Enterprise での記録・再処理（トークンが必要）。
- 複数 run を結合した長期バックフィル、保持期間（60 か月）の削除処理、正準ファクト（`schema_version`）の再生成は後続（P1-3 / Phase 4）。
- 実運用での Raw Landing の容量（重複排除の効果）は未測定。
