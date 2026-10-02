# Task: ユーザー明細への使用量可視化の追加

- [/] Phase 1: Issue Definition & Scoping — Issue は未作成（作業環境から GitHub の GraphQL に到達できず、`gh issue create` が使えない。PR 本文に概要を記載）
- [x] Phase 2: Implementation Plan 承認済み（2026-10-02、判断 1〜3 に回答）
  - [x] 判断 1: 公式の Billing reports reference を確認（AI usage report に input/output/cache_read/cache_write）
  - [x] 判断 2: 兆候として出す（表現は「確認を推奨」程度）
  - [x] 判断 3: 組織内の相対値を既定にする
- [/] Phase 3: Implementation
  - [x] U0: 取り込みとデータ契約（token 4 列、`usage_insight` 型、AI usage 行の単位、デモ CSV）
  - [x] U1: 計算の純関数と定義、テスト
  - [ ] U1': 実 CSV での閾値の分布確認（実ファイルが必要）
  - [x] U2: 月次レポートの明細テーブル（列・バッジ・フィルター・並べ替え・CSV・使用量と効率パネル）
  - [ ] U2': ライブ経路（`UserDetailTable`）への同列追加、実ブラウザでの確認
  - [x] U3: 仕様書（SDD-03 / 06 / 07 / 09、英日）の同期
- [x] Phase 4: Local Quality Gate (`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`)
- [x] Phase 5: Walkthrough
- [/] Phase 6: PR / [ ] Phase 7: Rebase & Merge
