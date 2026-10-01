# Task: Secret scan coverage for change-dev artifacts (`.devs/changes/`)

- [x] Phase 1: Issue Definition & Scoping <!-- id: 0 -->
  - [x] Scope taken from the change request (goal, context, what to change, done-when); no issue filed
- [x] Phase 2: Implementation Plan formulated & approved <!-- id: 1 -->
  - [x] `implementation_plan.md` written
  - [x] No interactive Proceed gate in this environment: the change request fixes the scope, and the plan is reviewed with the PR
- [/] Phase 3: Sibling Worktree Provisioning & Implementation <!-- id: 2 -->
  - [x] Sibling worktree provisioned (`../github-copilot-dashboard-worktrees/claude-wonderful-turing-1icdpq`)
  - [x] Baseline quality gate on `bee5e8b`: all 5 stages pass (118 tests, 353 files scanned)
  - [ ] Scanner: allowlisted dot-path walk (`scripts/scan-secrets.ts`)
  - [ ] Regression test (`src/tests/scripts/scan-secrets.test.ts`)
  - [ ] change-dev skill note (`.agents/skills/change-dev/SKILL.md`)
- [ ] Phase 4: Local Quality Gate & Specification Sync <!-- id: 3 -->
- [ ] Phase 5: Walkthrough Artifact Generation & Evidence Sealing <!-- id: 4 -->
- [ ] Phase 6: Rebase onto Base & Create PR <!-- id: 5 -->
- [ ] Phase 7: Rebase & Merge and Worktree Cleanup <!-- id: 6 -->
