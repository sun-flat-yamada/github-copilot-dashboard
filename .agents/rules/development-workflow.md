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

## 3. The 5-Step Change Lifecycle

```text
[Step 1: Issue] ──> [Step 2: Sibling Worktree] ──> [Step 3: Quality Gate] ──> [Step 4: PR (Rebased)] ──> [Step 5: Rebase Merge & Clean]
```

### Step 1: Issue Creation
- Every non-trivial change must correspond to an Issue specifying **Why**, **What**, and **Acceptance Criteria**.
- Create via GitHub Web or `gh issue create`. Record the Issue number (`#<id>`).

### Step 2: Sibling Worktree Provisioning
- Fetch latest base: `git fetch origin main`
- Create worktree at sibling level:
  ```bash
  git worktree add ../github-copilot-dashboard-worktrees/feat-<id>-<slug> -b feat/<id>-<slug> origin/main
  cd ../github-copilot-dashboard-worktrees/feat-<id>-<slug>
  ```
- Alternatively run helper: `npm run worktree:add feat/<id>-<slug>`

### Step 3: Implementation & Local Quality Gate
- Apply Specification-Driven Development (SDD): Update specs under `docs/specifications/` if architecture or behavior changes.
- Atomic & Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- Run the 5 mandatory checks within the worktree:
  ```bash
  npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build
  ```
  *(All checks must exit 0 cleanly with ZERO detected secrets or PII).*

### Step 4: Rebase onto Base & Pull Request
- Rebase onto updated base to resolve conflicts early:
  ```bash
  git fetch origin main
  git rebase origin/main
  git push -u origin feat/<id>-<slug>  # (or --force-with-lease)
  ```
- Open Pull Request linking the issue:
  ```bash
  gh pr create --base main --head feat/<id>-<slug> --title "feat: ... (#<id>)" --body "... Closes #<id>"
  ```

### Step 5: Rebase Merge & Pruning
- Merge using **Rebase & Merge** to maintain a linear commit history:
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
