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
  - [ ] PR B: P1-6 価格カタログ v1 と為替カタログ
  - [ ] PR C 以降: P1-2 / P1-3 / P1-4 / P1-5 / P1-7
- [x] Phase 4: Local Quality Gate & Specification Sync（PR A 分: SDD-02 / 03 / 08、セットアップガイド）
- [/] Phase 5: Walkthrough（PR A 分は `walkthrough.md`）
- [ ] Phase 6: PR / Phase 7: Rebase & Merge
