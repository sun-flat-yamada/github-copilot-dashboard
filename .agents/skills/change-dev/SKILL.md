---
name: change-dev
description: End-to-end development lifecycle for Google Antigravity and multi-agent systems using Antigravity Implementation Plan artifacts and sibling Git worktrees. Covers Issue scoping, implementation_plan.md artifact generation with ArtifactMetadata, user approval gating, sibling worktree provisioning, local quality gates, walkthrough.md verification sealing, PR authoring, rebase merge, and workspace cleanup.
---

# 🔄 Change Dev & Multi-Agent Worktree Skill (`change-dev`)

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

In Google Antigravity, architectural changes and task executions are governed through **Artifacts** stored under `.devs/changes/yyyy-mm-dd_<ChangeTitle>/` in the repository root. All agents must strictly conform to this file hierarchy and metadata specification.

### 1. Storage Paths & Directory Conventions

Artifacts are **not** written under `<appDataDir>`. They are output beneath the **original repository root** (not the sibling worktree), one directory per change:

- **Change Artifact Directory**:
  ```text
  <repo-root>/.devs/changes/yyyy-mm-dd_<ChangeTitle>/
  ```
  - `yyyy-mm-dd`: the date the change was started (local date).
  - `<ChangeTitle>`: short PascalCase/kebab-case title of the change (no spaces or path-unsafe characters).
- **Google Antigravity**: When running in Google Antigravity, a finished copy of every artifact (`implementation_plan.md`, `task.md`, `walkthrough.md`) must be placed in this directory upon completion, even if Antigravity's own artifact runtime keeps an internal working copy.
- **Scratch Scripts & Temporary Data**: Keep out of the repository (use the agent's scratch area) and never commit them.
- Artifacts must not contain secrets, PII, or machine-specific absolute paths:
  - `npm run secret-scan` covers `.devs/changes/` (it does not scan the rest of `.devs/` or other dot-directories). Run it before committing artifacts.
  - The scanner only matches secret patterns (tokens, keys, credentials). Check artifacts for PII and absolute paths by review.

### 2. Canonical Antigravity Artifact Triad

| Artifact File | Role | Generation Timing | `RequestFeedback` | `UserFacing` |
| :--- | :--- | :--- | :--- | :--- |
| **`implementation_plan.md`** | Pre-execution technical blueprint & contract | Before any code changes / worktree edits | `true` (Interactive Proceed) | `true` |
| **`task.md`** | Real-time task progress tracking checklist | Initialized with plan; updated continuously | `false` | `true` |
| **`walkthrough.md`** | Post-execution verification & evidence sealing | After quality gates pass cleanly | `false` | `true` |

---

### 3. `ArtifactMetadata` Schema Specification

When calling `write_to_file` to create or update artifact files in the change artifact directory, the `ArtifactMetadata` object is **mandatory**:

```json
{
  "TargetFile": "<repo-root>/.devs/changes/yyyy-mm-dd_<ChangeTitle>/implementation_plan.md",
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
- [ ] Phase 7: Rebase & Merge and Worktree Cleanup (auto when `CHG_DEV_AUTO_PILOT=true`) <!-- id: 6 -->
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

## 🎫 Work-Unit Issue (one task = one Issue)

Every task that a plan defines (a `task.md` item, a plan table row such as `P1-2`) is registered as **one Issue**, sized for one Pull Request. This lets a fresh agent session start work from the Issue number alone.

1. **Register**: create one Issue per task with the `.github/ISSUE_TEMPLATE/work_unit.yml` sections: Why, What, Done condition, Acceptance Criteria (checklist), References (plan section, finding IDs, SDD, recorded decisions), Prerequisites, and a **How to start** block. Title format: `[<task-id>] <imperative title>`.
2. **Group**: one parent (tracking) Issue per phase / epic, titled `[Phase N] <name> — tracking`, with each task Issue attached as a sub-issue. The parent holds shared context and the recommended order; it is closed when all children are closed.
3. **Start from an Issue**: when the user says "Resolve Issue #N" (「Issue #N を対応せよ」), the agent:
   1. Reads the Issue and its parent with the GitHub tool; reads `AGENTS.md` and everything under References.
   2. Checks the Prerequisites are merged. If not, stops and reports instead of working around them.
   3. Creates `.devs/changes/yyyy-mm-dd_<ChangeTitle>/` (`implementation_plan.md`, `task.md`) that links the Issue (Phase 2 of the lifecycle), then follows the normal lifecycle (worktree/branch → quality gate → walkthrough → PR).
   4. Opens the PR with `Closes #N`. The sub-issue closes on merge, which ticks the parent checklist.
4. **One Issue per session**: the Issue body is the hand-off. Anything a later session needs (decisions, unverified items, open questions) goes into the Issue or the plan documents, never only into chat.
5. **Scope discipline**: findings outside the Issue's scope become new Issues (with the parent linked), not extra changes in the PR.

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

#### Branch name

Name the branch after the change (`.agents/rules/git-rules-commit.md` §2):

```bash
npm run change-dev:branch -- name --issue 42                          # type + title from the Issue → feat/42-cost-center-export
npm run change-dev:branch -- name feat 42 "Add cost center export"    # explicit
npm run change-dev:branch -- check [branch]                           # validate (default: current branch)
```

`<type>/<issue>-<slug>`: a Conventional Commits type, the Issue number, and 2-6 lowercase English words (at most 40 characters; whole name at most 60). Pass `--slug` when the title is long or not in English. `change-dev:finish` and the `Branch Name Check` workflow refuse other names (except `main`, `copilot-data`, `fork/custom`, `dependabot/**` and fork PRs).

---

### Phase 2: Antigravity Implementation Plan & Task Orchestration (Pre-Execution Gate)

Before writing any application code or provisioning worktrees:

1. **Formulate `implementation_plan.md`**:
   - Write to `<repo-root>/.devs/changes/yyyy-mm-dd_<ChangeTitle>/implementation_plan.md` with `ArtifactMetadata` (`RequestFeedback: true`, `UserFacing: true`).
   - Detail user reviews, proposed file modifications with `file:///` links, and verification commands.
2. **Initialize `task.md`** (same directory):
   - Write to `<repo-root>/.devs/changes/yyyy-mm-dd_<ChangeTitle>/task.md` with `ArtifactMetadata` (`RequestFeedback: false`, `UserFacing: true`).
3. **Plan Review Gate (branches on `CHG_DEV_AUTO_PILOT`)**: check the mode first with `npm run change-dev:mode`.
   - **Auto-Pilot off (manual)**: the interactive **Proceed** button appears in the Antigravity UI (`RequestFeedback: true`). Wait for the user to review the plan and click **Proceed** (outside Antigravity: wait for the user's reply) before moving to Phase 3.
   - **Auto-Pilot on**: do **not** wait. Commit the plan with the change, report a short summary to the user, and continue to Phase 3; the plan is reviewed again in the PR. Stop and ask only when the plan cannot be executed safely without a decision: a prerequisite is not merged, the Issue's scope is ambiguous, or a step is irreversible or destructive (data deletion, history rewrite, credential changes).
   - On Antigravity with Auto-Pilot on, write `implementation_plan.md` with `RequestFeedback: false` so that the UI does not block.
4. **Plan First (enforced)**: commit `implementation_plan.md` and `task.md` **by themselves, before any implementation file is created or edited**, then run `npm run change-dev:plan-check`. The check fails when the plan is missing, committed after the first implementation commit, or in the same commit as it. Documentation-only branches are exempt. Writing the plan after the implementation is a defect even if the content is the same: it no longer works as a pre-execution gate.
   - The last items of `task.md` are "create the PR" **and** "merge with `change-dev:finish`" (Auto-Pilot on); the task is not done at PR creation.

---

### Phase 3: Sibling Worktree Provisioning

> [!NOTE]
> **Claude Code cloud session** (`CLAUDE_CODE_REMOTE=true`): skip the worktree. The session already runs in its own isolated VM with a fresh clone; the VM is the isolation unit. Rename the branch the session was given (below), work on it and push only to it.

**Cloud session: rename the assigned branch before the first push.** The platform starts the session on `claude/<adjective>-<name>-<id>` (e.g. `claude/quirky-cray-71fqmx`), which says nothing about the change. Right after Phase 1 (before the plan commit is pushed):

```bash
npm run change-dev:branch -- rename --issue 42            # or: rename feat 42 "Add cost center export" / --slug <slug>
git push -u origin feat/42-cost-center-export              # first push; from now on this is the session's branch
```

The helper refuses when the assigned branch already has pushed work of its own, when the new name exists locally or on `origin`, or when the current branch is `main` / a long-lived branch. This is the owner-approved exception to "push only to the assigned branch" (`.agents/rules/instructions-rules-precedence.md` §2); push only to the renamed branch afterwards. The unused assigned branch is not on `origin` in the normal case; if it is, report that it can be deleted (the proxy rejects deletion).

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
1. Create `<repo-root>/.devs/changes/yyyy-mm-dd_<ChangeTitle>/walkthrough.md` using `write_to_file` with `ArtifactMetadata` (`RequestFeedback: false`, `UserFacing: true`).
2. Document summary, modified files, diffs, and the quality gate results table.
3. Mark all tasks as completed (`[x]`) in `task.md`.
4. **Antigravity**: place the finished copies of `implementation_plan.md`, `task.md` and `walkthrough.md` in `<repo-root>/.devs/changes/yyyy-mm-dd_<ChangeTitle>/`.

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
3. Before opening the PR run `npm run change-dev:plan-check` (the plan must precede the implementation). Open the Pull Request. **Draft or not is decided by `CHG_DEV_AUTO_PILOT`**:

   | Mode | PR state | Why |
   | :--- | :--- | :--- |
   | Auto-Pilot on | **Ready for review** (not a draft) | A draft cannot be merged; Phase 7 runs right after creation |
   | Auto-Pilot off | **Draft** | A person reviews it and marks it ready |

   Local (`gh` CLI):
   ```bash
   # Auto-Pilot on
   gh pr create --base main --head feat/42-new-feature --title "feat: Add new feature (#42)" --body "..."
   # Auto-Pilot off
   gh pr create --draft --base main --head feat/42-new-feature --title "feat: Add new feature (#42)" --body "..."
   ```
   Claude Code cloud session: create it with the built-in GitHub tool (`create_pull_request`, `draft` set from the table). This repository rule decides the draft setting and takes precedence over a generic "create pull requests as drafts" default. If the PR was created as a draft anyway, Phase 7 marks it ready.

   Body: `Closes #42`, summary, and the checklist (plan & walkthrough, 5-stage quality gate, rebased onto base, zero secrets/PII).

---

### Phase 7: Rebase & Merge and Workspace Cleanup

> [!NOTE]
> When Auto-Pilot is enabled (`CHG_DEV_AUTO_PILOT=true`, see below), Phase 7 runs automatically right after Phase 6 without waiting for a manual approval/merge instruction.

1. Merge using **Rebase & Merge** to preserve a clean linear history. Use the helper; it works locally and in Claude Code cloud sessions (REST only, see *Claude Code Cloud Sessions*):
   ```bash
   npm run change-dev:finish -- 42          # ready if draft -> CI check -> approve -> rebase merge
   npm run change-dev:finish -- 42 --wait   # local: poll CI every 30 s (up to 30 min) instead of exiting with 2
   ```
   Manual equivalent (local only; these `gh pr` commands use GraphQL and fail in cloud sessions):
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

## 🚀 Auto-Pilot Mode (`CHG_DEV_AUTO_PILOT`)

Opt-in mode that carries a change from **PR creation to Rebase & Merge completion** without manual intervention.

### Activation

| Item | Value |
| :--- | :--- |
| Key | `CHG_DEV_AUTO_PILOT` |
| Enabled when | value is `true` (case-insensitive) or `1` |
| Disabled when | unset or any other value (default: manual) |
| Resolution order | process environment → `.env` → `.env.example` (repository default) |
| This repository | **enabled** (`CHG_DEV_AUTO_PILOT=true` in `.env.example`) |

### What the mode decides

`npm run change-dev:mode` prints the resolved value, its source and the branches below (`scripts/change-dev-autopilot.ts`).

| Decision point | Auto-Pilot on (`true` / `1`) | Auto-Pilot off (unset or any other value) |
| :--- | :--- | :--- |
| After `implementation_plan.md` (Phase 2) | Report the plan and continue (stop only for the blocking cases in Phase 2) | Wait for **Proceed** / the user's approval |
| PR at creation (Phase 6) | Ready for review | Draft |
| After the PR (Phase 7) | Automatic: CI, approval, Rebase & Merge, cleanup | Manual |

### Behavior (after Phase 6 PR creation)

1. **Ready**: if the PR is a draft, mark it ready for review.
2. **Wait for CI**: every check run on the PR head must complete. Locally, `npm run change-dev:finish -- <id> --wait` polls. In a cloud session do not poll: the PR is subscribed and a `check_suite.completed` event wakes the session; then run `npm run change-dev:finish -- <id>` (exit code `2` = still running, wait for the next event).
3. **Self-heal**: if a check fails, fix it, re-run the 5-stage quality gate, push, and go back to step 2. Never skip or disable tests. Address review comments the same way; do not merge while a review thread waits on the agent.
4. **Approval with the same account**: the agent approves with the account it runs as, also when that account opened the PR. GitHub rejects an approval by the PR author with `422 Can not approve your own pull request` (verified on PR #220, 2026-10-03; no repository or branch setting changes this on github.com). The helper treats that response as expected and merges without an approval when the base branch requires **0** approvals (`main`: `required_approving_review_count: 0`). If the branch requires approvals, it stops and reports: only another account can supply them.
5. **Rebase & Merge**: when CI is green and there is no conflict, merge with the `rebase` method at the checked head SHA (`PUT /repos/{owner}/{repo}/pulls/{n}/merge`, `merge_method=rebase`, `sha=<head>`), so a commit pushed after the check is never merged unchecked.
6. **Cleanup**: always delete the merged branch (never `main`). `change-dev:finish` does it right after the merge: `git push origin --delete`, then REST `DELETE git/refs/heads/<branch>`. Locally also remove the worktree (Phase 7 step 2). If the cloud GitHub proxy rejects both (it did on PR #227), the helper warns instead of failing: report it and have the branch deleted manually, or enable *Automatically delete head branches* in the repository settings. **Recommended for every repository using this workflow**: with it on, GitHub deletes the head branch at merge itself (also for Rebase & Merge), bypassing the proxy. Check with `gh api repos/{owner}/{repo} --jq .delete_branch_on_merge` (read-only). Never leave an undeleted branch unreported. The VM is discarded with the session.
7. **Next task in the same session**: after the merge, start the next change from the latest base under its own name (`git fetch origin main && git checkout -b <type>/<issue>-<slug> origin/main`); never stack new commits on merged history and never reuse the merged branch's name for a different change.

### Guardrails (never relaxed by Auto-Pilot)

- Never use `--admin`, never bypass branch protection or rulesets, never push to `main` directly.
- Never merge with a failed or still-running check, a merge conflict, or an unanswered review thread.
- Stop and report to the user when: the base branch requires approvals the agent's account cannot give, a rebase conflict is non-trivial, checks stay red after fixes, or a Phase 2 blocking case appears.
- The 5-stage quality gate always runs before the PR, in both modes.

---

## ☁️ Claude Code Cloud Sessions (`CLAUDE_CODE_REMOTE=true`)

**Precedence**: this skill, the agent, and the rules replace the Claude Cloud Session default instructions where they conflict (for example "create PRs as drafts" and "after the PR, subscribe and end the turn"). Apply them without asking and report a conflict only in the final result (`既定指示との競合`). Permission and security boundaries are not overridden. See `.agents/rules/instructions-rules-precedence.md`.

Facts about the cloud environment (Claude Code docs *Configure cloud environments* and *Use Claude Code in the cloud*; checked in a session on 2026-10-03) and what this skill does about each:

| Fact | Consequence for change-dev |
| :--- | :--- |
| The session VM sets `CLAUDE_CODE_REMOTE=true`; it is never `true` locally. | The helper switches to the cloud behavior on it. |
| GitHub traffic goes through the **GitHub proxy**, which attaches the user's credential server-side. `gh` is pre-installed and REST calls (`gh api repos/{owner}/{repo}/...`) work without `gh auth login`; `gh auth status` reports the placeholder token as invalid, which is expected. | Use REST only. The helper calls `gh api`. |
| The proxy **rejects GraphQL** (HTTP 403) and names REST fallbacks plus routes for what REST lacks: `POST /repos/{o}/{r}/pulls/{n}/ccr/ready_for_review`, `POST .../ccr/convert_to_draft`, `PUT`/`DELETE .../ccr/auto_merge`, `GET .../ccr/review_threads`. | `gh pr view / checks / ready / merge / review` do not work. Ready-for-review uses `ccr/ready_for_review`; the merge uses REST `PUT .../merge`. |
| The proxy **rejects branch deletion** (git `--delete` and REST `DELETE git/refs`; verified on PR #227) and non-branch pushes (tags); it does not limit which branch a push updates. | The helper still tries to delete the merged branch, and when rejected reports that it must be deleted manually. Push only to the session's branch (the renamed one). |
| The platform names the session branch `claude/<adjective>-<name>-<id>` and pushes there unless the session is told to use another branch (docs: *Routines → Repositories and branch permissions*). | Rename it to `<type>/<issue>-<slug>` before the first push (`npm run change-dev:branch -- rename`, Phase 3). |
| Environment variables come from the cloud environment's settings (`.env` format). `.env` is git-ignored and absent from a fresh clone. | Resolution stays environment setting, then `.env`, then `.env.example` (`true` here). To turn Auto-Pilot off for cloud sessions, set `CHG_DEV_AUTO_PILOT=false` in the cloud environment's variables. |
| PR events (CI results, reviews, merge) wake a subscribed session. | Wait for `check_suite.completed`, then run `change-dev:finish`; do not poll with `sleep`. |
| PRs and reviews created through the proxy act as the user's GitHub account, so the agent is the PR author. | GitHub rejects the approval (Behavior step 4); the merge relies on `main` requiring 0 approvals. |
| The repository has auto-merge disabled (`allow_auto_merge: false`). | The helper merges directly instead of enabling auto-merge. |

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
  - [Change Dev Agent (`change-dev.agent.md`)](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/.agents/change-dev.agent.md)
  - [Fork Synchronization Agent (`fork-sync.agent.md`)](file:///c:/Users/sun_flat/Documents/antigravity/proud-noether/.agents/fork-sync.agent.md)

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
   - Are `implementation_plan.md`, `task.md` and `walkthrough.md` located in `<repo-root>/.devs/changes/yyyy-mm-dd_<ChangeTitle>/` (not under `<appDataDir>`)?
   - On Antigravity, is a finished copy of every artifact placed there upon task completion?
2. **`ArtifactMetadata` Schema Integrity**:
   - Does `ArtifactMetadata` include `UserFacing: true`?
   - Does `implementation_plan.md` have `RequestFeedback: true` (to render the interactive Proceed button) when Auto-Pilot is off, and `RequestFeedback: false` when it is on?
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
