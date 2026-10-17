# Task: テスト用 DEMO データのタグ情報バリエーション拡充 (#378)

- [x] Phase 1: Issue Definition & Scoping <!-- id: 0 -->
- [x] Phase 2: Implementation Plan formulated <!-- id: 1 -->
- [/] Phase 3: Sibling Worktree Provisioning & Implementation <!-- id: 2 -->
  - [ ] Sibling worktree provisioned (`fix/378-enhance-demo-tags-for-filter-testing`)
  - [ ] `scripts/generate-demo-mapping-gpg.ts` に多軸タグバリエーションを実装
  - [ ] `src/collector/mock-generator.ts` にタグ定義・反映ロジックを実装
  - [ ] `fixtures/demo/copilot-user-mapping.demo.json.gpg` と DEMO データを再生成 (`npm run demo:generate`)
  - [ ] `src/tests/demo-data.test.ts` にタグバリエーション・AND絞り込み検証テストを追加
- [ ] Phase 4: Local Quality Gate & Specification Sync <!-- id: 3 -->
- [ ] Phase 5: Walkthrough Artifact Generation & Evidence Sealing <!-- id: 4 -->
- [ ] Phase 6: Rebase onto Base & Create PR <!-- id: 5 -->
- [ ] Phase 7: Rebase & Merge and Worktree Cleanup (auto when `CHG_DEV_AUTO_PILOT=true`) <!-- id: 6 -->
