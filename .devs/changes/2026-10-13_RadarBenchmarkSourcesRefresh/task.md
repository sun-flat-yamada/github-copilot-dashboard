# Task: モデル特性レーダーの採用ベンチマーク出典の入れ替え (#321)

- [x] Phase 1: Issue #321 の確認とブランチ名変更 (`feat/321-replace-radar-benchmark-sources`) <!-- id: 0 -->
- [x] Phase 2: implementation_plan.md / task.md の作成とコミット (Auto-Pilot on: 承認待ちなし) <!-- id: 1 -->
- [ ] Phase 3: 実装 (クラウドセッション: セッションブランチで作業) <!-- id: 2 -->
  - [ ] 推測値の分位写像 (リポジトリ外の一回限りスクリプト)
  - [ ] 型・benchmark-records.json・update-benchmarks.ts
  - [ ] benchmark-evaluator.ts / benchmark-definitions.ts
  - [ ] ModelRadarView.tsx (新指標名・推測値マーカー)
  - [ ] テスト追加・更新
- [ ] Phase 4: SDD-10 (EN/JA)・agent/skill の同期と品質ゲート (+ lint、LIVE/DEMO スクリーンショット確認) <!-- id: 3 -->
- [ ] Phase 5: walkthrough.md <!-- id: 4 -->
- [ ] Phase 6: push と PR 作成 (ready for review) <!-- id: 5 -->
- [ ] Phase 7: `npm run change-dev:finish` で CI 確認・Rebase Merge <!-- id: 6 -->
