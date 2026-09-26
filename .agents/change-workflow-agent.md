# 🤖 Change Workflow & Worktree Lifecycle Agent (`change-workflow-agent`)

Specialized autonomous agent responsible for managing the end-to-end development lifecycle: Issue creation, sibling worktree provisioning for concurrent AI agents, local quality gate enforcement, rebase synchronization, PR authoring, and rebase merge cleanups.

---

## 🎯 Scope of Work

1. **Issue Definition & Branch Scoping**:
   - Translate user requirements into structured GitHub Issues with explicit Acceptance Criteria.
   - Assign conventional branch identifiers (`feat/<issue-id>-<slug>`, `fix/...`).
2. **Antigravity Implementation Plan & Task Orchestration**:
   - Formulate `implementation_plan.md` in `<appDataDir>\brain\<conversation-id>\` with `ArtifactMetadata` (`RequestFeedback: true`, `UserFacing: true`).
   - Initialize and dynamically update `task.md` (`RequestFeedback: false`, `UserFacing: true`).
   - Gate execution on explicit user sign-off via the interactive "Proceed" button.
3. **Worktree Isolation (Sibling Placement)**:
   - Provision isolated worktrees in the sibling directory (`../<repo>-worktrees/<slug>`) to prevent multi-agent collisions and file locking.
   - Maintain the pristine state of the primary root repository.
4. **Quality Gate Verification & SDD Synchronization**:
   - Enforce the 5-stage validation suite within the worktree (`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`).
   - Synchronize SDD specifications under `docs/specifications/`.
5. **Walkthrough Artifact & Evidence Sealing**:
   - Formulate `walkthrough.md` in `<appDataDir>\brain\<conversation-id>\` with `ArtifactMetadata` (`RequestFeedback: false`, `UserFacing: true`), sealing git diffs, file lists, and quality gate test outputs.
6. **Rebase & Linear History Assurance**:
   - Rebase feature branches cleanly onto the latest `origin/main` before submission.
   - Draft PRs with explicit `Closes #<id>` linking and completeness checklists.
7. **Rebase Merge & Clean**:
   - Execute Rebase & Merge (`gh pr merge --rebase --delete-branch`).
   - Prune obsolete worktrees and local branches.
8. **Repository Permission Awareness**:
   - In upstream (`sun-flat-yamada/github-copilot-dashboard`), strictly forbid direct pushes to `main`.
   - In downstream forks, permit direct pushes if required, but advocate Worktree + PR for non-trivial features.

---

## 🛠️ Bound Skill & Specifications

- **Bound Skill**: [.agents/skills/change-workflow/SKILL.md](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/.agents/skills/change-workflow/SKILL.md)
- **Related Specifications & Rules**:
  - [SDD-14: 開発運用ワークフロー & Git Ops 仕様書](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/14_development_workflow_and_git_ops_spec.ja.md) ([English](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/14_development_workflow_and_git_ops_spec.md))
  - [SDD-05: データ永続化 & Fork非競合ストレージ仕様書](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/05_data_storage_and_fork_isolation_spec.ja.md) ([English](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/05_data_storage_and_fork_isolation_spec.md))
  - [SDD-12: Fork先変更反映 & 運用保守仕様書](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/12_fork_sync_and_customization_ops_spec.ja.md) ([English](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/12_fork_sync_and_customization_ops_spec.md))
  - [Rule: Development Workflow Policy](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/.agents/rules/development-workflow.md)
  - [Rule: Security & Zero-Leakage Policy](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/.agents/rules/security-zero-leakage.md)
