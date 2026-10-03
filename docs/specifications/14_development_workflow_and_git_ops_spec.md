# SDD-14: Development Workflow & Git Ops Specification

## 1. Overview

This specification defines the change lifecycle for new feature development, bug fixes, refactoring, and documentation updates in `github-copilot-dashboard`.
In this repository, the operating model assumes that **multiple autonomous AI agents (Antigravity, Gemini, Claude Code, Cursor, etc.) work in parallel with human engineers**.

To eliminate file collision, untracked change leakage, and merge hazards between concurrent agents while preserving a pristine, auditable linear commit history, this specification formalizes the following core lifecycle:

```text
[Step 1: Issue Creation]
   │ (Define intent & acceptance criteria via gh issue create)
   ▼
[Step 2: Antigravity Implementation Plan & Task Orchestration]
   │ (implementation_plan.md / task.md artifacts with ArtifactMetadata, Proceed gate)
   ▼
[Step 3: Worktree Work Environment Provisioning]
   │ (Deploy isolated directory at peer sibling level: ../<repo>-worktrees/<branch>)
   ▼
[Step 4: SDD Definition, Implementation & Local Quality Gate]
   │ (Atomic Commits, Conventional Commits, 5-stage validation)
   ▼
[Step 5: Walkthrough Artifact Generation & Evidence Sealing]
   │ (walkthrough.md generation, test logs & diff evidence sealing)
   ▼
[Step 6: Rebase onto Latest Base & PR Creation]
   │ (git fetch && git rebase, Closes #<issue>, gh pr create)
   ▼
[Step 7: Rebase Merge & Worktree Cleanup]
   │ (Rebase and Merge, git worktree remove, branch prune)
   ▼
[Completed / Walkthrough Evidence Sealed & Pristine Linear History Preserved]
```


---

## 2. Commit & Push Permissions by Repository Type

Branch protection and direct push rules differ strictly between the **original upstream repository** and **downstream forks**:

| Target Repository | Direct Commit/Push to `main` | Direct Commit/Push to `fork/custom` | Enforced Workflow |
| :--- | :--- | :--- | :--- |
| **Original Upstream (`sun-flat-yamada`)** | 🚫 **Strictly Forbidden** | N/A (Branch does not exist) | **Full enforcement of this workflow (Issue -> Worktree -> PR -> Rebase Merge)** |
| **Downstream Fork** | ⚠️ **Permitted** if operationally required (not recommended) | ⚠️ **Permitted** if operationally required | **Worktree + PR strongly recommended** for multi-agent or feature work. Direct commits allowed for small setup tweaks. |

---

## 3. Step-by-Step Operational Protocol

### 3.1. Step 1: Issue Creation (Issue-Driven Development)
All changes start with a dedicated GitHub Issue.


1. **Clarify Objective and Scope**:
   - Problem statement / Why this change is needed
   - Desired behavior / What will be delivered
   - Acceptance Criteria
2. **CLI Creation Example (`gh` CLI)**:
   ```bash
   gh issue create \
     --title "feat: Add CSV export capability for cost center summaries" \
     --body "## Summary... ## Acceptance Criteria..." \
     --label "enhancement"
   ```
3. Use the generated Issue number (e.g. `#42`) in the branch identifier.

#### 3.1.1. Work-Unit Issue (one task = one Issue)
Every task a plan defines (a `task.md` item, a plan table row such as `P1-2`) is registered as **one Issue** sized for one Pull Request, so that a fresh agent session can start from the Issue number alone.

1. **Register**: fill in the `.github/ISSUE_TEMPLATE/work_unit.yml` sections (Why, What, Done condition, Acceptance Criteria, References, Prerequisites, **How to start**). Title: `[<task-id>] <imperative title>`.
2. **Group**: one parent (tracking) Issue per phase / epic (`[Phase N] <name> — tracking`) with each task Issue attached as a sub-issue. The parent carries shared context and the recommended order, and closes when all children are closed.
3. **Start from an Issue**: when the user says "Resolve Issue #N", the agent:
   1. Reads the Issue and its parent with the GitHub tool, plus `AGENTS.md` and everything under References.
   2. Checks the Prerequisites are merged; if not, stops and reports instead of working around them.
   3. Creates `.devs/changes/yyyy-mm-dd_<ChangeTitle>/` (`implementation_plan.md`, `task.md`) linking the Issue (lifecycle Step 2), then follows the normal lifecycle (worktree/branch → quality gate → walkthrough → PR).
   4. Opens the PR with `Closes #N`; the sub-issue closes on merge and the parent checklist follows.
4. **One Issue per session**: the Issue body is the hand-off. Anything a later session needs (decisions, unverified items, open questions) goes into the Issue or the plan documents, never only into chat.
5. **Scope discipline**: findings outside the Issue's scope become new Issues (parent linked), not extra changes in the PR.

---

### 3.2. Step 2: Antigravity Implementation Plan & Task Orchestration (Pre-Execution Gate)

Before provisioning worktrees or modifying code, autonomous agents must formulate an implementation plan conforming to Google Antigravity's artifact management architecture.

1. **`implementation_plan.md` Generation**:
   - Write to the change artifact directory under the original repository root (`.devs/changes/yyyy-mm-dd_<ChangeTitle>/implementation_plan.md`, never under `<appDataDir>`) using `write_to_file`.
   - Specify `ArtifactMetadata` with `{ "UserFacing": true, "RequestFeedback": true, "Summary": "..." }`.
   - **Whether to wait for plan review branches on `CHG_DEV_AUTO_PILOT`** (check with `npm run change-dev:mode`).
     - Auto-Pilot off: `RequestFeedback: true` instructs the Antigravity UI to render the interactive **Proceed** button, pausing execution until the user provides review and approval.
     - Auto-Pilot on: do not wait (`RequestFeedback: false` on Antigravity). Commit the plan, report a summary, and continue; the plan is reviewed again in the PR. Stop and ask only when a prerequisite is not merged, the Issue's scope is ambiguous, or a step is irreversible or destructive (data deletion, history rewrite, credential changes).
   - The plan details user reviews (`> [!IMPORTANT]`), proposed changes categorized by `[NEW]`, `[MODIFY]`, `[DELETE]` with clickable `file:///` links, and the automated/manual verification plan.
2. **`task.md` Initialization**:
   - Initialize a dynamic task tracking checklist (`- [ ]`, `- [/]`, `- [x]`) with `ArtifactMetadata` (`RequestFeedback: false`, `UserFacing: true`).

---

### 3.3. Step 3: Worktree Provisioning (Multi-Agent Isolation)

When multiple agents work on the same checkout, file locks, overwrite race conditions, and git index corruption occur.
Therefore, **direct work on the main working tree is forbidden; agents must provision a Worktree at the peer sibling level**.

#### Worktree Directory Placement Rule
Placing worktrees inside the repository root (`.worktrees/`) risks accidental scanning, build pollution, and untracked file clutter. Worktrees **MUST be placed in a sibling directory at the same hierarchy level as the repository**:

```text
📁 /path/to/workspace/
  ├── 📁 github-copilot-dashboard/          <-- Main repository (origin/main)
  └── 📁 github-copilot-dashboard-worktrees/ <-- Worktree container directory
        ├── 📁 feat-42-cost-center-export/   <-- Agent A isolated workspace
        └── 📁 fix-43-prorated-calc/         <-- Agent B isolated workspace
```

#### Conventional Branch Naming
- `feat/<issue-id>-<slug>` : New features
- `fix/<issue-id>-<slug>` : Bug fixes
- `docs/<issue-id>-<slug>` : Specification & documentation changes
- `refactor/<issue-id>-<slug>` : Code refactoring without behavioral change
- `test/<issue-id>-<slug>` : Test suite additions/enhancements
- `chore/<issue-id>-<slug>` : Maintenance and dependencies

#### Worktree Provisioning Commands
```bash
# 1. Fetch latest base
git fetch origin main

# 2. Provision worktree at sibling directory level
git worktree add ../github-copilot-dashboard-worktrees/feat-42-cost-center-export -b feat/42-cost-center-export origin/main

# 3. Enter the worktree
cd ../github-copilot-dashboard-worktrees/feat-42-cost-center-export

# 4. Install dependencies if necessary
npm ci
```
*(Tip: `npm run worktree:add feat/42-cost-center-export` provisions and initializes this workspace automatically).*

---

### 3.4. Step 4: SDD Definition, Implementation & Local Quality Gate

1. **Specification First (SDD Principle)**:
   - Update `docs/specifications/` before or alongside architectural additions.
2. **Atomic Commits & Conventional Commits**:
   - Keep commits small, isolated, and focused on one concern.
   - Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`.
3. **Task Checklist Tracking**:
   - As tasks complete, update items in `task.md` from `[/]` to `[x]`.
4. **Local Quality Gate (Mandatory)**:
   Run all validation checks within the worktree before opening a PR:
   ```bash
   npm run fork:verify   # Code-Data Decoupling (SDD-05) verification
   npm run typecheck     # TypeScript compiler checks
   npm test              # Vitest test suite
   npm run secret-scan   # Zero secrets & PII audit (Exit 0 mandatory)
   npm run build         # Production SPA build
   ```

---

### 3.5. Step 5: Walkthrough Artifact Generation & Evidence Sealing

Once all local quality gates pass cleanly (Exit Code 0), seal the implementation evidence before submitting the PR:

1. **`walkthrough.md` Generation**:
   - Write to `.devs/changes/yyyy-mm-dd_<ChangeTitle>/walkthrough.md` under the original repository root using `write_to_file`. When running on Google Antigravity, place a finished copy of all artifacts (`implementation_plan.md`, `task.md`, `walkthrough.md`) in this directory upon completion.
   - Specify `ArtifactMetadata` with `{ "UserFacing": true, "RequestFeedback": false, "Summary": "..." }`.
   - Document the concise summary, modified file listings with diff indicators, and the complete 5-stage quality gate verification results table.

---

### 3.6. Step 6: Rebase onto Latest Base & PR Creation

1. **Rebase onto Upstream Base**:
   ```bash
   git fetch origin main
   git rebase origin/main
   ```
   If conflicts occur, resolve them, re-run the quality gate, and proceed with `git add <file>` followed by `git rebase --continue`.
2. **Push to Remote**:
   ```bash
   # Initial push
   git push -u origin feat/42-cost-center-export

   # Push after rebase
   git push --force-with-lease origin feat/42-cost-center-export
   ```
3. **Create Pull Request (`gh` CLI)**:
   ```bash
   gh pr create \
     --base main \
     --head feat/42-cost-center-export \
     --title "feat: Add CSV export capability for cost center summaries (#42)" \
     --body "## Summary... Closes #42"
   ```
   Always link the issue using `Closes #<issue-id>` or `Fixes #<issue-id>` to automate closing.

---

### 3.7. Step 7: Rebase Merge & Cleanup

#### Auto-Pilot Mode (`CHG_DEV_AUTO_PILOT`)
- Setting `CHG_DEV_AUTO_PILOT=true` makes the agent carry the PR from creation to Rebase & Merge automatically: `gh pr checks <id> --watch` → fix and re-push on failures (re-running the quality gate) → approve when permitted (never self-approve) → `gh pr merge <id> --rebase --delete-branch` → worktree cleanup.
- Resolution order: process environment → `.env` → `.env.example`. This repository ships `CHG_DEV_AUTO_PILOT=true`. Any other value or unset means manual operation.
- Guardrails: the Step 2 "Proceed" gate still applies; never use `--admin` or bypass branch protection; stop and report when approval by another person is required and unavailable, on non-trivial conflicts, or when checks stay red after fixes.

#### Why Rebase & Merge?
- **Linear History**: Eliminates noisy `Merge branch 'main' into ...` commits, creating a clean chronological progression.
- **Reliable `git bisect`**: Zero merge bubbles guarantee quick and accurate root-cause regression hunting.
- **Seamless Fork Sync**: Prevents divergent history conflicts when downstream forks sync with `upstream/main`.

#### Merge Execution (`gh` CLI)
```bash
gh pr merge 42 --rebase --delete-branch
```

#### Worktree & Local Branch Cleanup
```bash
# 1. Return to the primary repository
cd ../../github-copilot-dashboard

# 2. Update local main
git checkout main
git pull --ff-only origin main

# 3. Remove the worktree
git worktree remove ../github-copilot-dashboard-worktrees/feat-42-cost-center-export

# 4. Prune the local branch
git branch -d feat/42-cost-center-export
```
*(Tip: `npm run worktree:clean feat/42-cost-center-export` automates worktree removal and branch deletion).*

---

## 4. Safeguards for Autonomous AI Agents

1. **Main Working Tree Protection**: AI agents must not modify files directly on the primary root working tree. Always create a dedicated sibling worktree.
2. **Data Isolation (SDD-05)**: No agent may generate or commit files inside `data/` or `dashboard/public/data/` within a worktree.
3. **Zero Secret Leakage**: No PR may be submitted if `npm run secret-scan` fails or yields any detected secrets.
