# Task: 最後のデータ選択状態を次回表示時も維持できるようにする (#330)

- [x] Phase 1: Issue #330 の作成と Sibling Worktree (`feat/330-persist-last-data-selection`) のプロビジョニング <!-- id: 0 -->
- [x] Phase 2: `implementation_plan.md` / `task.md` の作成と先行コミット (`plan-first-check`) <!-- id: 1 -->
- [ ] Phase 3: 実装 <!-- id: 2 -->
  - [ ] `dashboard/src/utils/dataSelectionStorage.ts` の新規作成
  - [ ] `src/application/services/DemoModeService.ts` の更新（URL優先 + 保存済みDEMO状態復元）
  - [ ] `dashboard/src/hooks/useDashboardData.ts` の更新（初期復元・`loadIndex` 整合・変更時自動保存）
  - [ ] 単体テスト (`src/tests/data-selection-persistence.test.ts`) および RTL UI挙動テスト (`src/tests/ui/app-behavior.test.tsx`) の追加
- [ ] Phase 4: SDD-07 (JA/EN) の仕様同期と 5段階品質ゲート (`fork:verify`, `typecheck`, `test`, `secret-scan`, `build`, `lint`) <!-- id: 3 -->
- [ ] Phase 5: `walkthrough.md` の作成と `.devs/changes/2026-10-17_PersistLastDataSelection/` への証跡保存 <!-- id: 4 -->
- [ ] Phase 6: リモート push と Pull Request 作成 <!-- id: 5 -->
- [ ] Phase 7: `npm run change-dev:finish` による CI 確認・Rebase Merge・Worktree クリーンアップ <!-- id: 6 -->
