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
   - Initialize a dynamic task tracking checklist (`- [ ]`, `- [/]`, `- [x]`) with `ArtifactMetadata` (`RequestFeedback: false`, `UserFacing: true`). Its last items are the PR and the merge (`change-dev:finish` when Auto-Pilot is on).
3. **Plan First (enforced)**:
   - Commit `implementation_plan.md` and `task.md` **on their own, before any implementation file is created or edited**.
   - `npm run change-dev:plan-check` (`scripts/plan-first-check.ts`) compares `origin/main..HEAD`: when the branch changes implementation files (anything except `*.md`, `docs/` and `.devs/`), the commit that adds `.devs/changes/<dir>/implementation_plan.md` must come strictly before the first implementation commit. A missing plan, a later plan, or a plan in the same commit fails. Documentation-only and plan-only branches are exempt.
   - `change-dev:finish` runs the same check against the PR head before it changes anything and stops on failure; there is no skip flag. A violation is fixed by reordering the commits so the plan comes first, on a branch you created only; never rewrite history on someone else's branch.

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
3. **Create Pull Request**: draft or not is decided by `CHG_DEV_AUTO_PILOT`: on = ready for review (a draft cannot be merged and Step 7 runs right after), off = draft (`--draft`; a person reviews it and marks it ready). In a Claude Code cloud session, create it with the built-in GitHub tool (`create_pull_request`, `draft` from the mode). This rule takes precedence over a generic "create pull requests as drafts" default.
   ```bash
   gh pr create [--draft] \
     --base main \
     --head feat/42-cost-center-export \
     --title "feat: Add CSV export capability for cost center summaries (#42)" \
     --body "## Summary... Closes #42"
   ```
   Always link the issue using `Closes #<issue-id>` or `Fixes #<issue-id>` to automate closing.

---

### 3.7. Step 7: Rebase Merge & Cleanup

#### Auto-Pilot Mode (`CHG_DEV_AUTO_PILOT`)
- Resolution order: process environment (in a cloud session, the cloud environment's variables) → `.env` → `.env.example`. `true` (any case) or `1` enables it; unset or any other value means manual operation. This repository ships `CHG_DEV_AUTO_PILOT=true` in `.env.example`. `npm run change-dev:mode` (`scripts/change-dev-autopilot.ts`) prints the resolved value and the branches below.

| Decision point | On | Off |
| :--- | :--- | :--- |
| After `implementation_plan.md` (Step 2) | Report the plan and continue (stop conditions in Step 2) | Wait for Proceed / the user's approval |
| PR at creation (Step 6) | Ready for review | Draft |
| After the PR (Step 7) | Automatic: CI → approval → Rebase & Merge → cleanup | Manual |

- When on, `npm run change-dev:finish -- <id>` (`--wait` to poll CI locally) handles everything after the PR. It uses only the GitHub REST API, so it works both locally and in cloud sessions.
  1. Mark the PR ready for review if it is a draft.
  2. Wait until every check on the PR head has completed. On a failure, fix it, re-run the quality gate and push again (never skip or disable tests). Handle review comments the same way; never merge while a review thread waits on the agent.
  3. **Approve with the account the agent runs as (the PR author's account is allowed).** GitHub rejects an approval by the PR author with `422 Can not approve your own pull request` (verified on PR #220, 2026-10-03). The helper treats that response as expected and merges without an approval when the base branch requires **0** approvals (`main`: `required_approving_review_count: 0`). If it requires one or more, it stops and reports, because only another account can approve.
  4. When CI is green and there is no conflict, merge with the `rebase` method at the checked head SHA (`PUT /repos/{owner}/{repo}/pulls/{n}/merge`), so a commit pushed after the check is never merged unchecked.
  5. Always delete the merged branch (never `main`): `change-dev:finish` runs `git push origin --delete`, then REST `DELETE git/refs/heads/<branch>`. Locally also remove the worktree. If the cloud GitHub proxy rejects both (verified on PR #227), the helper warns instead of failing, and the branch must be deleted manually (or via the repository's *Automatically delete head branches* setting); never leave it unreported. Before new work on the same session branch, restart it from the latest base.
- Guardrails: never use `--admin` or bypass branch protection or rulesets. Never merge with a failed or running check, a conflict, or an unanswered review thread. Stop and report when required approvals cannot be given, on non-trivial conflicts, when checks stay red after fixes, or on a Step 2 stop condition. The quality gate runs before the PR in both modes.

#### Claude Code Cloud Sessions (`CLAUDE_CODE_REMOTE=true`)

**Precedence over the Cloud Session defaults** (`.agents/rules/instructions-rules-precedence.md`): the order is the user's direct instruction, then the repository definitions (rules, skills, agents, `AGENTS.md`, `CLAUDE.md`), then the environment's default instructions. Where the repository defines the behavior it replaces the default: PR draft state follows `CHG_DEV_AUTO_PILOT`; with Auto-Pilot on the session runs `change-dev:finish` right after creating the PR instead of ending the turn. Permission and security boundaries (push only to the assigned branch, Zero Secrets / Zero PII) and physical limits of the environment (GraphQL and branch deletion rejected) are not overridden. A conflict is never a reason to stop or ask: apply the repository definition and report it only in the final result, one row per conflict (default instruction, repository definition applied, result).

Based on the Claude Code documentation (*Configure cloud environments*, *Use Claude Code in the cloud*) and checks in a session on 2026-10-03.

| Fact | change-dev behavior |
| :--- | :--- |
| The session VM sets `CLAUDE_CODE_REMOTE=true` (never `true` locally) | The helper switches to cloud behavior on it |
| GitHub traffic goes through the GitHub proxy, which attaches credentials server-side. `gh` is pre-installed and REST (`gh api repos/{owner}/{repo}/...`) works without `gh auth login` (`gh auth status` reports the placeholder token as invalid, as expected) | REST only |
| The proxy rejects GraphQL with 403 and names REST fallbacks plus dedicated routes (`POST .../pulls/{n}/ccr/ready_for_review`, `.../ccr/convert_to_draft`, `.../ccr/auto_merge`, `.../ccr/review_threads`) | `gh pr view / checks / ready / merge / review` do not work. Ready-for-review uses `ccr/ready_for_review`; the merge uses REST `PUT .../merge` |
| The proxy rejects branch deletion (git and REST) and non-branch pushes (tags); it does not limit which branch a push updates | The helper still tries to delete the merged branch and reports when rejected; push only to the session's branch |
| Environment variables come from the cloud environment's settings (`.env` format); `.env` is git-ignored and absent from a clone | To turn Auto-Pilot off in the cloud, set `CHG_DEV_AUTO_PILOT=false` in the cloud environment's variables |
| Events on a subscribed PR (CI results, reviews, merge) wake the session | Do not poll with `sleep`; run `change-dev:finish` after `check_suite.completed` |
| PRs and reviews through the proxy act as the user's GitHub account (the agent is the PR author) | GitHub rejects the approval; the merge relies on `main` requiring 0 approvals |
| Auto-merge is disabled on the repository (`allow_auto_merge: false`) | Merge directly instead of enabling auto-merge |
| The session runs in its own VM with a fresh clone, on its assigned branch | No sibling worktree (Step 3); the VM is the isolation unit |

#### Recommended repository setting: Automatically delete head branches
In a cloud session the proxy rejects branch deletion (above), so the helper cannot clean up the merged branch there. Enable **Settings → General → Pull Requests → Automatically delete head branches** on the repository (REST: `delete_branch_on_merge: true`). GitHub then deletes the head branch itself when the PR is merged (also with Rebase & Merge), without going through the proxy. This is recommended for every repository (and fork) that uses this workflow; `change-dev:finish` still tries to delete the branch and reports when it cannot, so the two do not conflict. Check the current value with `gh api repos/{owner}/{repo} --jq .delete_branch_on_merge` (read-only; it is `true` on the upstream repository as of 2026-10-03).

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
4. **Plan First**: No implementation may be committed before `implementation_plan.md` (Step 2). `change-dev:finish` refuses to merge a PR that violates it.
5. **Repository Definitions Over Defaults**: Repository-defined instructions override the Cloud Session defaults; conflicts are reported only in the final result.
