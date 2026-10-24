# Task: Fix Radar Sidebar Overlapping and Table Header/Footer Z-Index (#361)

- [x] Phase 1: Issue Definition & Scoping <!-- id: 0 -->
- [x] Phase 2: Implementation Plan formulated & approved <!-- id: 1 -->
- [x] Phase 3: Sibling Worktree Provisioning & Plan Commit <!-- id: 2 -->
  - [x] Sibling worktree provisioned (`fix-361-fix-radar-sidebar-overlap-and-table-z`)
  - [x] Implementation plan & task committed first
  - [x] Plan check verified (`npm run change-dev:plan-check`)
- [x] Phase 4: Implementation, SDD Sync & Local Quality Gate <!-- id: 3 -->
  - [x] Update layout to `flex-row` and add `isolate` in `ModelRadarView.tsx`
  - [x] Adjust footer z-index to `z-20` in `ModelRadarView.tsx`
  - [x] Adjust sticky position in `ModelSelectorSidebar.tsx`
  - [x] Update specification in `docs/specifications/10_ai_model_benchmark_radar_spec.ja.md`
  - [x] Add unit test `src/tests/radar-sidebar-layout.test.ts`
  - [x] Run full 5-stage quality gate
- [x] Phase 5: Walkthrough Artifact Generation & Evidence Sealing <!-- id: 4 -->
- [ ] Phase 6: Rebase onto Base & Create PR <!-- id: 5 -->
- [ ] Phase 7: Rebase & Merge and Worktree Cleanup (Auto-Pilot) <!-- id: 6 -->
