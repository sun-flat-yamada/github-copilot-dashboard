---
name: change-workflow
description: End-to-end development lifecycle for Google Antigravity and multi-agent systems using Antigravity Implementation Plan artifacts and sibling Git worktrees. Covers Issue scoping, implementation_plan.md artifact generation with ArtifactMetadata, user approval gating, sibling worktree provisioning, local quality gates, walkthrough.md verification sealing, PR authoring, rebase merge, and workspace cleanup.
---

# 🔄 Change Workflow & Multi-Agent Worktree Skill (`change-workflow`)

Use this skill when proposing, planning, and making code, documentation, or architectural changes to the repository, particularly within **Google Antigravity** and multi-agent collaboration environments.

---

## 🧭 Repository Permission Guard

Before executing changes, identify whether this workspace is:
1. **Upstream Original (`sun-flat-yamada/github-copilot-dashboard`)**:
   - 🚫 **Direct commit/push to `main` is strictly prohibited.**
   - Must use: `Issue -> Implementation Plan (Artifact) -> Sibling Worktree -> Quality Gate -> Walkthrough (Artifact) -> PR -> Rebase & Merge`.
2. **Downstream Fork**:
   - ⚠️ Direct commit/push to `main` / `fork/custom` is **permitted** when operationally needed (e.g. configuration tweaks).
   - For non-trivial feature development or multi-agent collaboration, use this Worktree + PR + Artifact Plan workflow.

---

## 📐 Google Antigravity Artifact Architecture & File Hierarchy

In Google Antigravity, architectural changes and task executions are governed through **Artifacts** stored in the session's brain directory. All agents must strictly conform to this file hierarchy and metadata specification.

### 1. Storage Paths & Directory Conventions

Artifacts are isolated from the repository working tree and persist under the conversation's brain storage:

- **Brain Artifact Root Directory**:
  ```text
  <appDataDir>/brain/<conversation-id>/
  ```
  *(Example Windows path: `C:\Users\<user>\.gemini\antigravity\brain\<conversation-id>\`)*
- **Scratch Scripts & Temporary Data**:
  ```text
  <appDataDir>/brain/<conversation-id>/scratch/
  ```

### 2. Canonical Antigravity Artifact Triad

| Artifact File | Role | Generation Timing | `RequestFeedback` | `UserFacing` |
| :--- | :--- | :--- | :--- | :--- |
| **`implementation_plan.md`** | Pre-execution technical blueprint & contract | Before any code changes / worktree edits | `true` (Interactive Proceed) | `true` |
| **`task.md`** | Real-time task progress tracking checklist | Initialized with plan; updated continuously | `false` | `true` |
| **`walkthrough.md`** | Post-execution verification & evidence sealing | After quality gates pass cleanly | `false` | `true` |

---

### 3. `ArtifactMetadata` Schema Specification

When calling `write_to_file` to create or update files inside `<appDataDir>\brain\<conversation-id>\`, the `ArtifactMetadata` object is **mandatory**:

```json
{
  "TargetFile": "<appDataDir>\\brain\\<conversation-id>\\implementation_plan.md",
  "Overwrite": true,
  "ArtifactMetadata": {
    "UserFacing": true,
    "RequestFeedback": true,
    "Summary": "Implementation plan outlining changes for issue #42, including file additions, modifications, and quality gate verification."
  },
  "CodeContent": "# Title\n\n## User Review Required\n..."
}
```

> [!IMPORTANT]
> - **`RequestFeedback: true`**: Renders the interactive **Proceed** button in the Antigravity chat canvas. The agent must pause and await user feedback or approval before writing code.
> - **`RequestFeedback: false`**: Used for `task.md` and `walkthrough.md` where informational updates are rendered without blocking execution.
> - **Non-Artifact Files**: When editing repository code or documentation files (e.g. `src/`, `docs/`, `.agents/`), **never include `ArtifactMetadata`**.

---

### 4. Canonical Artifact Schemas

#### A. `implementation_plan.md` Structure
```markdown
# <Title: Feature / Refactoring Plan>

<Brief context and intent of the change.>

## User Review Required
> [!IMPORTANT]
> <Critical architectural decisions, breaking changes, or user confirmations needed.>

> [!WARNING]
> <Potential edge cases, dependency updates, or migration risks.>

## Proposed Changes
### <Component / Domain Area 1>
#### [NEW] [filepath](file:///absolute/path/to/file)
- Purpose and key functionality.

#### [MODIFY] [filepath](file:///absolute/path/to/file)
- Targeted changes and method additions.

#### [DELETE] [filepath](file:///absolute/path/to/file)
- Rationale for deletion.

## Verification Plan
### Automated Tests
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
- Specific unit test files: `npm test -- <test-file>`

### Manual Verification
- Step-by-step manual checks or UI inspections.
```

#### B. `task.md` Structure
```markdown
# Task: <Feature Name>

- [x] Phase 1: Issue Definition & Scoping <!-- id: 0 -->
- [x] Phase 2: Implementation Plan formulated & approved <!-- id: 1 -->
- [/] Phase 3: Sibling Worktree Provisioning & Implementation <!-- id: 2 -->
  - [x] Sibling worktree provisioned (`../github-copilot-dashboard-worktrees/feat-...`)
  - [/] Core logic implementation
  - [ ] Vitest test cases addition
- [ ] Phase 4: Local Quality Gate & Specification Sync <!-- id: 3 -->
- [ ] Phase 5: Walkthrough Artifact Generation & Evidence Sealing <!-- id: 4 -->
- [ ] Phase 6: Rebase onto Base & Create PR <!-- id: 5 -->
- [ ] Phase 7: Rebase & Merge and Worktree Cleanup <!-- id: 6 -->
```

#### C. `walkthrough.md` Structure
```markdown
# Walkthrough: <Feature Name>

## Summary
<Concise explanation of what was achieved and delivered.>

## Changes Made
### <Domain Area>
- [file.ts](file:///absolute/path/to/file): Description of modification.
`render_diffs(file:///absolute/path/to/file)`

## Verification Results
### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Clean (Exit 0) |
| TypeScript Check | `npm run typecheck` | ✅ Pass (Exit 0) |
| Unit & Integration Tests | `npm test` | ✅ 326/326 Pass |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 Leaks (Exit 0) |
| Production Build | `npm run build` | ✅ Built in 2.06s |
```

---

## 🛠️ The 7-Phase Execution Lifecycle

```text
[Phase 1: Issue Scoping] 
   └──> [Phase 2: Antigravity Implementation Plan & Task (Artifact Gate: Proceed)]
           └──> [Phase 3: Sibling Worktree Provisioning]
                   └──> [Phase 4: SDD Sync, Code Implementation & Quality Gate]
                           └──> [Phase 5: Walkthrough Artifact Generation (Sealing)]
                                   └──> [Phase 6: Rebase onto Base & PR Creation]
                                           └──> [Phase 7: Rebase Merge & Workspace Clean]
```

### Phase 1: Issue Definition & Scoping

Create or reference a GitHub Issue with clear intent and Acceptance Criteria:

```bash
gh issue create \
  --title "feat: <Short imperative description>" \
  --body "## 概要 / Overview\n\n## 変更理由 / Why\n\n## 受け入れ基準 / Acceptance Criteria\n- [ ] ..." \
  --label "enhancement"
```
Record the Issue number (e.g. `#42`).

---

### Phase 2: Antigravity Implementation Plan & Task Orchestration (Pre-Execution Gate)

Before writing any application code or provisioning worktrees:

1. **Formulate `implementation_plan.md`**:
   - Write to `<appDataDir>\brain\<conversation-id>\implementation_plan.md` with `ArtifactMetadata` (`RequestFeedback: true`, `UserFacing: true`).
   - Detail user reviews, proposed file modifications with `file:///` links, and verification commands.
2. **Initialize `task.md`**:
   - Write to `<appDataDir>\brain\<conversation-id>\task.md` with `ArtifactMetadata` (`RequestFeedback: false`, `UserFacing: true`).
3. **Await User Sign-Off**:
   - The interactive **Proceed** button appears in the Antigravity UI.
   - Wait for the user to review the plan and click **Proceed** before moving to Phase 3.

---

### Phase 3: Sibling Worktree Provisioning

To prevent multi-agent race conditions, file locking, and git index collisions, **never edit directly in the root working tree**. Worktrees are always provisioned in a **sibling directory** (`../<repo>-worktrees/<slug>`):

```bash
# Automated via repository helper script:
npm run worktree:add feat/42-new-feature
```

*(Manual Equivalent)*:
```bash
git fetch origin main
git worktree add ../github-copilot-dashboard-worktrees/feat-42-new-feature -b feat/42-new-feature origin/main
cd ../github-copilot-dashboard-worktrees/feat-42-new-feature
npm ci
```

---

### Phase 4: Implementation, SDD Synchronization & Local Quality Gate

In the isolated worktree directory:
1. Update relevant specifications in `docs/specifications/` if behavior or architecture is modified.
2. Implement changes with atomic, [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
3. Update `task.md` continuously to reflect progress.
4. Run the 5-stage quality gate:
   ```bash
   npm run fork:verify
   npm run typecheck
   npm test
   npm run secret-scan
   npm run build
   ```
   > [!IMPORTANT]
   > All checks must pass with exit code 0. Zero detected secrets or PII. Zero metric files in `data/`.

---

### Phase 5: Walkthrough Artifact Generation & Evidence Sealing

Once all checks pass cleanly:
1. Create `<appDataDir>\brain\<conversation-id>\walkthrough.md` using `write_to_file` with `ArtifactMetadata` (`RequestFeedback: false`, `UserFacing: true`).
2. Document summary, modified files, diffs, and the quality gate results table.
3. Mark all tasks as completed (`[x]`) in `task.md`.

---

### Phase 6: Rebase onto Base & Create Pull Request

1. Fetch latest base and rebase feature branch to ensure clean linear integration:
   ```bash
   git fetch origin main
   git rebase origin/main
   ```
   If conflicts arise:
   - Resolve conflict markers in affected files.
   - Re-run `npm run typecheck && npm test`.
   - Stage resolved files: `git add <file>`
   - Continue rebase: `git rebase --continue`
2. Push branch to remote:
   ```bash
   # First push:
   git push -u origin feat/42-new-feature
   # Subsequent pushes after rebase:
   git push --force-with-lease origin feat/42-new-feature
   ```
3. Open Pull Request using `gh` CLI:
   ```bash
   gh pr create \
     --base main \
     --head feat/42-new-feature \
     --title "feat: Add new feature (#42)" \
     --body "## Summary\n\nCloses #42\n\n## Checklist\n- [x] Antigravity implementation plan & walkthrough verified\n- [x] 5-stage quality gates passed\n- [x] Rebased onto latest base\n- [x] Zero secrets/PII verified"
   ```

---

### Phase 7: Rebase & Merge and Workspace Cleanup

1. Merge using **Rebase & Merge** to preserve a clean linear history:
   ```bash
   gh pr checks 42
   gh pr merge 42 --rebase --delete-branch
   ```
2. Return to the main repository directory and clean up:
   ```bash
   npm run worktree:clean feat/42-new-feature
   ```
   *(Manual Equivalent)*:
   ```bash
   cd ../../github-copilot-dashboard
   git checkout main
   git pull --ff-only origin main
   git worktree remove ../github-copilot-dashboard-worktrees/feat-42-new-feature
   git branch -d feat/42-new-feature
   ```

---

## 🔗 Repository Reference Links (リポジトリ参照先リンク)

Always reference and adhere to the repository's specifications and rule files:

- **System Specifications (`docs/specifications/`)**:
  - [SDD-14: 開発運用ワークフロー & Git Ops 仕様書](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/14_development_workflow_and_git_ops_spec.ja.md) ([English Specification](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/14_development_workflow_and_git_ops_spec.md))
  - [SDD-05: データ永続化 & Fork非競合ストレージ仕様書](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/05_data_storage_and_fork_isolation_spec.ja.md) ([English Specification](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/05_data_storage_and_fork_isolation_spec.md))
  - [SDD-12: Fork先変更反映 & 運用保守仕様書](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/12_fork_sync_and_customization_ops_spec.ja.md) ([English Specification](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/12_fork_sync_and_customization_ops_spec.md))
  - [SDD-13: 制限環境セットアップ手順書](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/13_fork_restricted_environment_setup_guide.ja.md) ([English Guide](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/docs/specifications/13_fork_restricted_environment_setup_guide.md))

- **Agent Guardrails & Operating Rules (`.agents/rules/`)**:
  - [Development Workflow Policy](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/.agents/rules/development-workflow.md)
  - [Security & Zero-Leakage Policy](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/.agents/rules/security-zero-leakage.md)
  - [Storage & Data Routing Policy](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/.agents/rules/storage-and-data-routing.md)

- **Autonomous Agent Personas (`.agents/`)**:
  - [Change Workflow Agent (`change-workflow-agent.md`)](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/.agents/change-workflow-agent.md)
  - [Fork Synchronization Agent (`fork-sync-agent.md`)](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/.agents/fork-sync-agent.md)

- **Antigravity Customization System & Built-in Guides**:
  - [Google Antigravity Guide Skill](file:///C:/Users/sun_flat/.gemini/antigravity/builtin/skills/antigravity_guide/SKILL.md)
  - [Antigravity Customizations Skill](file:///C:/Users/sun_flat/.gemini/antigravity/builtin/skills/agy-customizations/SKILL.md)
  - [Antigravity 2.0 Desktop Application Reference](file:///C:/Users/sun_flat/.gemini/antigravity/builtin/skills/antigravity_guide/references/app.md)
  - [Antigravity IDE Reference](file:///C:/Users/sun_flat/.gemini/antigravity/builtin/skills/antigravity_guide/references/ide.md)
  - [Antigravity CLI Reference](file:///C:/Users/sun_flat/.gemini/antigravity/builtin/skills/antigravity_guide/references/cli.md)

---

## 🔍 Web Search & Self-Verification Protocol (Web探索・自己検証プロトコル)

Autonomous AI agents operating in this repository must be able to self-verify their artifact compliance and API compatibility using live web searches and local automated assertions.

### 1. Authoritative Official Documentation Endpoints

When in doubt about updated Antigravity features, agent schemas, or slash commands, dynamically verify against:

- **Antigravity Documentation Home**: `https://antigravity.google/docs`
- **Antigravity Skills Reference**: `https://antigravity.google/docs/skills`
- **Antigravity Rules & Workflows**: `https://antigravity.google/docs/rules-workflows`
- **Antigravity Permissions & Security**: `https://antigravity.google/docs/permissions`
- **Antigravity CLI Features**: `https://antigravity.google/docs/cli/features`

### 2. Web Search Verification Queries

Agents should invoke `search_web` with targeted queries to verify artifact handling rules:

```json
{
  "query": "site:antigravity.google \"implementation_plan.md\" \"ArtifactMetadata\""
}
```

```json
{
  "query": "\"Google Antigravity\" \"RequestFeedback\" \"implementation_plan.md\""
}
```

```json
{
  "query": "site:antigravity.google \"ArtifactMetadata\" \"UserFacing\" \"Summary\""
}
```

### 3. Agent Self-Verification Checklist

Before finalizing any task or proposing changes, execute this verification checklist:

1. **Artifact Destination Check**:
   - Is `implementation_plan.md` created in `<appDataDir>\brain\<conversation-id>\`?
   - Is `task.md` created in `<appDataDir>\brain\<conversation-id>\`?
   - Is `walkthrough.md` created in `<appDataDir>\brain\<conversation-id>\` upon task completion?
2. **`ArtifactMetadata` Schema Integrity**:
   - Does `ArtifactMetadata` include `UserFacing: true`?
   - Does `implementation_plan.md` have `RequestFeedback: true` (to render the interactive Proceed button)?
   - Do `task.md` and `walkthrough.md` have `RequestFeedback: false`?
   - Are repository source files written without `ArtifactMetadata`?
3. **Link & Formatting Compliance**:
   - Are all file references formatted as clickable `file:///` markdown links (with forward slashes for Windows)?
   - Do alert blocks use standard GitHub Alert syntax (`> [!IMPORTANT]`, `> [!WARNING]`, `> [!NOTE]`)?
4. **Local Quality Gate Assertion**:
   - Run the 5-stage validation suite:
     ```bash
     npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build
     ```
   - Confirm exit code `0` for all 5 commands.
