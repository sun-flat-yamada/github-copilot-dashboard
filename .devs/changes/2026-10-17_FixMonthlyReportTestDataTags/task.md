# Task: 月次レポート選択時にテストデータでTagが表示されない問題の修正 (#389)

- [x] Phase 1: Issue Definition & Scoping <!-- id: 0 -->
- [x] Phase 2: Implementation Plan formulated & committed <!-- id: 1 -->
- [ ] Phase 3: Sibling Worktree Provisioning & Implementation <!-- id: 2 -->
  - [ ] Sibling worktree provisioned (`../github-copilot-dashboard-worktrees/fix/389-monthly-report-test-data-tags`)
  - [ ] `auto-collected-data-fixtures.ts` に `MonthlyReportAggregatedData` 生成関数およびデータ追加
  - [ ] `test-harness.ts` の `buildFileMap` に `reports/${month}.json` を追加
  - [ ] `DataSelectionModal.tsx` での `localReportMonth` 未初期化時フォールバックの強化
  - [ ] テストデータ環境での月次レポート Tag 抽出・UIテストの追加
- [ ] Phase 4: Local Quality Gate & Specification Sync <!-- id: 3 -->
- [ ] Phase 5: Walkthrough Artifact Generation & Evidence Sealing <!-- id: 4 -->
- [ ] Phase 6: Rebase onto Base & Create PR <!-- id: 5 -->
- [ ] Phase 7: Rebase & Merge and Worktree Cleanup (auto when `CHG_DEV_AUTO_PILOT=true`) <!-- id: 6 -->
