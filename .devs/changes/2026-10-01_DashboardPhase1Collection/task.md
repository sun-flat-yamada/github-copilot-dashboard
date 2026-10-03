# Task: ダッシュボード改善 Phase 1（取得基盤）

- [x] Phase 1: Issue Definition & Scoping — [sun-flat-yamada/github-copilot-dashboard#163](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/163)
- [x] Phase 2: Implementation Plan — 親計画の Phase 1 を PR A / B / C… に分割
- [/] Phase 3: Implementation
  - [x] PR A: P1-1 Usage Metrics Reports API アダプタ
    - [x] `RawApiFetcher`: 許可ステータス・204、署名付き URL の認証なしダウンロード、4xx は再試行しない
    - [x] NDJSON パーサー、`users-1-day` 行のスキーマ、`UsageReportsClient`（並列・重複排除・取得日の窓）
    - [x] マッパー（日次メトリクス・ユーザー別プロファイル）、`enrichUserProfiles`、オーケストレーターへの結線
    - [x] 旧 `/copilot/metrics` の呼び出しを削除、シートを Enterprise + Org の和集合に
    - [x] テスト（`UsageReports.test.ts`、`pipeline-degradation.test.ts` の追加分）
  - [x] PR B: P1-6 価格カタログ v1 と為替カタログ
    - [x] `PublicExchangeRatesService` をカタログ専用に (固定値表・ブラウザ取得を撤去、直前月の引き継ぎ、レート無しは換算を出さない)
    - [x] `ExchangeRateCatalogUpdater` / `npm run catalog:fx` (ECB 月次平均、確定月のみ、上書きなし、失敗時は既存を保持)
    - [x] 保存 (`saveCatalog` / `loadCatalog`)、`pages:stage` 許可リスト、`CurrencyContext` のカタログ読み込み
    - [x] 価格カタログのバージョンに一次情報未照合を明記
    - 未実施: ECB への実接続 (作業環境から到達不可。パーサーはフィクスチャのみで検証)、価格の GitHub 公式ドキュメントとの照合
  - [x] PR C: P1-2 Raw Landing + Run Manifest + `pipeline:reprocess`
    - [x] `RawApiClient` 契約（`RawApiFetcher` / `RecordingFetcher` / `ReplayFetcher`）。ソースアダプタのロジックは変えず、取得層を録画・再生で差し替える
    - [x] `RawLandingStore`（内容ハッシュ名で不変保存、manifest は上書きしない）、署名付き URL の署名は保存しない
    - [x] 匿名化モード・モックでは保存しない。`index.json` の `run`（`run_id`、再処理は `reprocessed: true`）
    - [x] `npm run pipeline:reprocess [-- --run <id>]`（通信なし。既存の `raw/YYYY/MM` は書き換えない）
    - [x] テスト（`RawLanding.test.ts`: 記録 → 成果物を消して再生 → 同一の成果物、録画済みの失敗の再現、未記録の要求は失敗）
  - [ ] PR D 以降: P1-3 / P1-4 / P1-5 / P1-7
- [x] Phase 4: Local Quality Gate & Specification Sync（PR A 分: SDD-02 / 03 / 08、セットアップガイド。PR B 分: SDD-06、セットアップガイド。PR C 分: SDD-02 §2.8 / SDD-03 §1.1 / SDD-05 §2.3 / SDD-08 §1）
- [/] Phase 5: Walkthrough（PR A / B / C 分は `walkthrough.md`。以降の PR 分は各 PR で追記）
- [/] Phase 6: PR / Phase 7: Rebase & Merge
  - [x] PR A（#164）、PR B（#165）: 作成・マージ済み
  - [ ] PR C: 作成後、レビュー・マージ待ち
  - [ ] PR D 以降

## 持ち越し（実環境が必要で、作業環境からは検証できない）

- Reports API と PAT の実機検証（トークンが必要）。エンドポイント・スキーマ・スコープは GitHub の REST API description に基づく。契約テスト（P1-4）で固定する
- ECB への実接続（パーサーはフィクスチャのみで検証）と、価格の GitHub 公式ドキュメントとの照合
- Raw Landing の実運用での容量（内容ハッシュによる重複排除を前提とした見積もりは未実施）
