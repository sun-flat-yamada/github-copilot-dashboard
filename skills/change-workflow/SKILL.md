---
name: change-workflow
description: End-to-end development lifecycle using sibling Git worktrees for concurrent AI agents. Covers Issue creation, sibling worktree provisioning, local quality gates, rebase synchronization, PR authoring, rebase merge, and workspace cleanup.
---

# 🔄 Change Workflow & Multi-Agent Worktree Skill (`change-workflow`)

Use this skill when making code, documentation, or architectural changes to the repository, particularly when multiple AI agents or parallel tasks operate simultaneously.

---

## 🧭 Repository Permission Guard

Before executing changes, identify whether this workspace is:
1. **Upstream Original (`sun-flat-yamada/github-copilot-dashboard`)**:
   - 🚫 **Direct commit/push to `main` is strictly prohibited.**
   - Must use: `Issue -> Sibling Worktree -> Quality Gate -> PR -> Rebase & Merge`.
2. **Downstream Fork**:
   - ⚠️ Direct commit/push to `main` / `fork/custom` is **permitted** when operationally needed.
   - For non-trivial changes or multi-agent collaboration, use this Worktree + PR workflow.

---

## 🛠️ Execution Lifecycle

### Step 1: Issue Definition & Scoping

Create or reference a GitHub Issue with clear intent and Acceptance Criteria:

```bash
gh issue create \
  --title "feat: <Short imperative description>" \
  --body "## 概要 / Overview\n\n## 変更理由 / Why\n\n## 受け入れ基準 / Acceptance Criteria\n- [ ] ..." \
  --label "enhancement"
```
Record the Issue number (e.g. `#42`).

---

### Step 2: Sibling Worktree Provisioning

To prevent multi-agent race conditions, file locking, and git index collisions, **never edit directly in the root working tree**. Worktrees are always provisioned in a **sibling directory** (`../<repo>-worktrees/<slug>`):

```bash
# Automated via helper script:
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

### Step 3: Implementation & Local Quality Gate

In the isolated worktree directory:
1. Update relevant specifications in `docs/specifications/` if behavior or architecture is modified.
2. Implement changes with atomic, [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
3. Run the 5-stage quality gate:
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

### Step 4: Rebase onto Base & Create Pull Request

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
     --body "## Summary\n\nCloses #42\n\n## Checklist\n- [x] Quality gates passed\n- [x] Rebased onto latest base\n- [x] Zero secrets/PII verified"
   ```

---

### Step 5: Rebase & Merge

Merge using **Rebase & Merge** to preserve a clean linear history:

```bash
# Verify PR CI status
gh pr checks 42

# Merge with Rebase and delete remote branch
gh pr merge 42 --rebase --delete-branch
```

---

### Step 6: Worktree & Local Branch Cleanup

Return to the main repository directory and clean up:

```bash
# Automated via helper script:
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

Check active worktrees at any time:
```bash
npm run worktree:list
# or: git worktree list
```
