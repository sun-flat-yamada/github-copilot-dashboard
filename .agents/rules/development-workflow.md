---
title: "Development Workflow & Worktree Policy"
description: "Issue to sibling worktree to quality gate to PR to rebase merge lifecycle and direct-push permissions."
category: "rules"
type: "specification"
status: "active"
date: 2026-10-03
updated: 2026-10-03
lang: "en"
tags:
  - "rules"
  - "workflow"
  - "git"
alwaysApply: true
---
# 🔄 Development Workflow & Multi-Agent Worktree Policy (.agents/rules/development-workflow.md)

All AI agents (Antigravity, Gemini, Claude Code, Cursor, Copilot Workspace, etc.) operating in this repository **MUST** adhere to this development lifecycle rule when making changes.

---

## 1. Direct Commit & Push Permissions by Repository Context

1. **Original Upstream Repository (`sun-flat-yamada/github-copilot-dashboard`)**:
   - **NO DIRECT COMMITS OR PUSHES TO `main`**: Autonomous AI agents must **NEVER** push directly to `main`.
   - All changes must strictly follow the **Issue -> Sibling Worktree -> Local Quality Gate -> Pull Request -> Rebase & Merge** lifecycle.
2. **Downstream Fork Repositories**:
   - Direct commits and pushes to `main` or `fork/custom` are **permitted** when operationally required (e.g., small configuration tweaks, emergency fixes).
   - However, for non-trivial feature development or when multiple agents run concurrently, the Worktree + PR process is **strongly recommended**.

---

## 2. Multi-Agent Isolation: Sibling Git Worktree Rule

When multiple AI agents work concurrently on the codebase:

1. **Never Contaminate the Primary Working Tree**:
   - Do NOT edit files or run long-running build commands directly in the root working tree of the repository.
   - Doing so causes git index locks, untracked file bleed, and destructive edit collisions between agents.
2. **Sibling Directory Placement**:
   - Worktrees must be placed at the **same hierarchy level as the repository** (sibling directory), NOT inside the repository tree:
     ```text
     ../github-copilot-dashboard-worktrees/<branch-slug>
     ```
   - Placing worktrees inside the repository root risks polluting secret scanners, Vitest runners, and git status.

---

## 3. The End-to-End Change Lifecycle

```text
[Step 1: Issue] ──> [Step 2: Antigravity Plan (Artifact)] ──> [Step 3: Sibling Worktree] ──> [Step 4: Quality Gate & SDD] ──> [Step 5: Walkthrough Evidence] ──> [Step 6: PR (Rebased)] ──> [Step 7: Rebase Merge & Clean]
```

### Step 1: Issue Creation

- Every non-trivial change must correspond to an Issue specifying **Why**, **What**, and **Acceptance Criteria**.
- Create via GitHub Web or `gh issue create`. Record the Issue number (`#<id>`).
- **One task = one Issue**: every task a plan defines is registered as a single Issue sized for one PR (template `.github/ISSUE_TEMPLATE/work_unit.yml`), grouped under a per-phase parent (tracking) Issue as sub-issues. The Issue body is the hand-off: a new session starts from "Resolve Issue #N", reads the Issue, its parent and the referenced documents, checks the Prerequisites are merged, and opens the PR with `Closes #N`. Findings outside the Issue's scope become new Issues. See `.agents/skills/change-dev/SKILL.md` (Work-Unit Issue) and SDD-14 §3.1.1.

### Step 2: Antigravity Implementation Plan & Task Orchestration (Pre-Execution Gate)

- Before provisioning worktrees or modifying code, autonomous agents must formulate an `implementation_plan.md` artifact in `.devs/changes/yyyy-mm-dd_<ChangeTitle>/` under the original repository root (never under `<appDataDir>`) using `write_to_file` with `ArtifactMetadata` (`RequestFeedback: true`, `UserFacing: true`).
- Initialize `task.md` (`RequestFeedback: false`, `UserFacing: true`) to track execution checklists.
- Plan review branches on `CHG_DEV_AUTO_PILOT` (`npm run change-dev:mode`):
  - **Off**: await user approval via the interactive **Proceed** button (outside Antigravity: the user's reply) before proceeding to worktree provisioning.
  - **On**: do not wait (`RequestFeedback: false` on Antigravity). Commit the plan, report a summary, and continue; the plan is reviewed again in the PR. Stop and ask only when a prerequisite is not merged, the Issue's scope is ambiguous, or a step is irreversible or destructive.
- Claude Code cloud session (`CLAUDE_CODE_REMOTE=true`): skip Step 3; the session VM and its assigned branch are the isolation unit.

### Step 3: Sibling Worktree Provisioning
- Fetch latest base: `git fetch origin main`
- Create worktree at sibling level:
  ```bash
  git worktree add ../github-copilot-dashboard-worktrees/feat-<id>-<slug> -b feat/<id>-<slug> origin/main
  cd ../github-copilot-dashboard-worktrees/feat-<id>-<slug>
  ```
- Alternatively run helper: `npm run worktree:add feat/<id>-<slug>`

### Step 4: Implementation & Local Quality Gate
- Apply Specification-Driven Development (SDD): Update specs under `docs/specifications/` if architecture or behavior changes.
- Atomic & Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- Update `task.md` continuously to reflect progress.
- Run the 5 mandatory checks within the worktree:
  ```bash
  npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build
  ```
  *(All checks must exit 0 cleanly with ZERO detected secrets or PII).*

### Step 5: Walkthrough Artifact Generation & Evidence Sealing
- Generate `walkthrough.md` in `.devs/changes/yyyy-mm-dd_<ChangeTitle>/` with `ArtifactMetadata` (`RequestFeedback: false`, `UserFacing: true`).
- Seal git diffs, file modifications, and the 5-stage quality gate verification results.
- On Google Antigravity, place a finished copy of all artifacts in `.devs/changes/yyyy-mm-dd_<ChangeTitle>/` of the repository upon completion.

### Step 6: Rebase onto Base & Pull Request
- Rebase onto updated base to resolve conflicts early:
  ```bash
  git fetch origin main
  git rebase origin/main
  git push -u origin feat/<id>-<slug>  # (or --force-with-lease)
  ```
- Open Pull Request linking the issue. Auto-Pilot on = ready for review; off = draft (`--draft`). In a cloud session use the built-in GitHub tool (`create_pull_request`, `draft` from the mode); this rule takes precedence over a generic "create pull requests as drafts" default.
  ```bash
  gh pr create [--draft] --base main --head feat/<id>-<slug> --title "feat: ... (#<id>)" --body "... Closes #<id>"
  ```

### Step 7: Rebase Merge & Pruning
- **Auto-Pilot (`CHG_DEV_AUTO_PILOT=true`)**: runs right after PR creation with `npm run change-dev:finish -- <id>` (REST only; works locally and in cloud sessions): ready for review → CI → fix failures → approve with the agent's account (GitHub returns 422 for the PR author; then merge proceeds only if the base requires 0 approvals) → rebase merge at the checked head SHA → delete the merged branch (reported if the cloud proxy rejects it) → prune. Resolution order: process env (cloud: the environment's variables) → `.env` → `.env.example` (enabled in this repository). Never use `--admin` or bypass branch protection; never merge with failed/running checks, conflicts or unanswered review threads; stop and report if required approvals cannot be given. See the `change-dev` skill and SDD-14 §3.7.
- Merge using **Rebase & Merge** to maintain a linear commit history (manual, local only; `gh pr` subcommands use GraphQL, which cloud sessions reject):
  ```bash
  gh pr merge <id> --rebase --delete-branch
  ```
- Return to the primary repo, pull `main`, and clean up the worktree:
  ```bash
  cd ../../github-copilot-dashboard
  git checkout main && git pull --ff-only origin main
  git worktree remove ../github-copilot-dashboard-worktrees/feat-<id>-<slug>
  git branch -d feat/<id>-<slug>
  ```
  *(Or run `npm run worktree:clean feat/<id>-<slug>`)*

---

## 4. Absolute Guardrails
- **Data Isolation**: Never place metric data files in `data/` or `dashboard/public/data/` within any branch or worktree (SDD-05).
- **Secret Zero Leakage**: Never bypass `npm run secret-scan`.
