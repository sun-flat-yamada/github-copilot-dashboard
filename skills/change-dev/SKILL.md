---
name: change-dev
description: End-to-end development lifecycle using sibling Git worktrees for concurrent AI agents. Covers Issue creation, sibling worktree provisioning, local quality gates, rebase synchronization, PR authoring, rebase merge, and workspace cleanup.
---

# 🔄 Change Dev & Multi-Agent Worktree Skill (`change-dev`)

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

---

## 🚀 Auto-Pilot Mode (`CHG-DEV-AUTO-PILOT`)

Opt-in mode that carries a change from **PR creation to Rebase & Merge completion** without manual intervention.

### Activation

| Item | Value |
| :--- | :--- |
| Key | `CHG-DEV-AUTO-PILOT` |
| Enabled when | value is `true` (case-insensitive) or `1` |
| Disabled when | unset or any other value (default: manual) |
| Resolution order | process environment → `.env` → `.env.example` (repository default) |
| This repository | **enabled** (`CHG-DEV-AUTO-PILOT=true` in `.env.example`) |

> [!NOTE]
> The key contains hyphens, so POSIX shells cannot `export` it. Provide it via `.env` / the agent runtime's environment settings, or per command: `env 'CHG-DEV-AUTO-PILOT=true' <cmd>`.

### Behavior (after Phase 6 PR creation)

1. **Wait for CI**: `gh pr checks <id> --watch` until all required checks complete.
2. **Self-heal**: if a check fails, fix in the worktree, re-run the 5-stage quality gate, push, and watch again. Never skip/disable tests.
3. **Approval**: when a review approval is required, request it; approve with `gh pr review <id> --approve` only when the authenticated account is not the PR author (GitHub forbids self-approval).
4. **Rebase & Merge**: once CI is green, there are no conflicts and no unresolved review threads, run `gh pr merge <id> --rebase --delete-branch` (or `--auto --rebase` while required checks are still pending).
5. **Cleanup**: remove the worktree and local branch (Phase 7 step 2).

### Guardrails (never relaxed by Auto-Pilot)

- The Phase 2 implementation plan **Proceed** gate still applies.
- Never use `--admin`, never bypass branch protection or required reviews, never push to `main` directly.
- Stop and report to the user when: approval by another person is required and unavailable, a rebase conflict is non-trivial, or checks stay red after fixes.
