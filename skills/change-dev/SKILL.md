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
3. Open the Pull Request. **Draft or not is decided by `CHG_DEV_AUTO_PILOT`** (`npm run change-dev:mode`): Auto-Pilot on = ready for review, off = draft (`--draft`). In a Claude Code cloud session use the built-in GitHub tool (`create_pull_request` with `draft` from the mode); this rule takes precedence over a generic "create pull requests as drafts" default.
   ```bash
   gh pr create [--draft] \
     --base main \
     --head feat/42-new-feature \
     --title "feat: Add new feature (#42)" \
     --body "## Summary\n\nCloses #42\n\n## Checklist\n- [x] Quality gates passed\n- [x] Rebased onto latest base\n- [x] Zero secrets/PII verified"
   ```

---

### Step 5: Rebase & Merge

Merge using **Rebase & Merge** to preserve a clean linear history. The helper works locally and in Claude Code cloud sessions (REST only):

```bash
npm run change-dev:finish -- 42          # ready if draft -> CI check -> approve -> rebase merge
npm run change-dev:finish -- 42 --wait   # local: poll CI instead of exiting with 2
```

Manual equivalent (local only; `gh pr` subcommands use GraphQL, which the cloud GitHub proxy rejects):

```bash
gh pr checks 42
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

> Phase numbers below refer to the full lifecycle in `.agents/skills/change-dev/SKILL.md` (Phase 2 = implementation plan, Phase 6 = PR creation = Step 4 here, Phase 7 = merge = Step 5 here).

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
6. **Cleanup**: locally, delete the remote branch and remove the worktree (Phase 7 step 2). In a cloud session the remote branch is kept (the GitHub proxy rejects branch deletion) and the VM is discarded with the session.
7. **Next task on the same session branch**: after the merge, restart the branch from the latest base (`git fetch origin main && git checkout -B <branch> origin/main`) before new work; never stack new commits on merged history.

### Guardrails (never relaxed by Auto-Pilot)

- Never use `--admin`, never bypass branch protection or rulesets, never push to `main` directly.
- Never merge with a failed or still-running check, a merge conflict, or an unanswered review thread.
- Stop and report to the user when: the base branch requires approvals the agent's account cannot give, a rebase conflict is non-trivial, checks stay red after fixes, or a Phase 2 blocking case appears.
- The 5-stage quality gate always runs before the PR, in both modes.

---

## ☁️ Claude Code Cloud Sessions (`CLAUDE_CODE_REMOTE=true`)

Facts about the cloud environment (Claude Code docs *Configure cloud environments* and *Use Claude Code in the cloud*; checked in a session on 2026-10-03) and what this skill does about each:

| Fact | Consequence for change-dev |
| :--- | :--- |
| The session VM sets `CLAUDE_CODE_REMOTE=true`; it is never `true` locally. | The helper switches to the cloud behavior on it. |
| GitHub traffic goes through the **GitHub proxy**, which attaches the user's credential server-side. `gh` is pre-installed and REST calls (`gh api repos/{owner}/{repo}/...`) work without `gh auth login`; `gh auth status` reports the placeholder token as invalid, which is expected. | Use REST only. The helper calls `gh api`. |
| The proxy **rejects GraphQL** (HTTP 403) and names REST fallbacks plus routes for what REST lacks: `POST /repos/{o}/{r}/pulls/{n}/ccr/ready_for_review`, `POST .../ccr/convert_to_draft`, `PUT`/`DELETE .../ccr/auto_merge`, `GET .../ccr/review_threads`. | `gh pr view / checks / ready / merge / review` do not work. Ready-for-review uses `ccr/ready_for_review`; the merge uses REST `PUT .../merge`. |
| The proxy **rejects branch deletion** and non-branch pushes (tags); it does not limit which branch a push updates. | No `--delete-branch` in the cloud. Push only to the session's branch. |
| Environment variables come from the cloud environment's settings (`.env` format). `.env` is git-ignored and absent from a fresh clone. | Resolution stays environment setting, then `.env`, then `.env.example` (`true` here). To turn Auto-Pilot off for cloud sessions, set `CHG_DEV_AUTO_PILOT=false` in the cloud environment's variables. |
| PR events (CI results, reviews, merge) wake a subscribed session. | Wait for `check_suite.completed`, then run `change-dev:finish`; do not poll with `sleep`. |
| PRs and reviews created through the proxy act as the user's GitHub account, so the agent is the PR author. | GitHub rejects the approval (Behavior step 4); the merge relies on `main` requiring 0 approvals. |
| The repository has auto-merge disabled (`allow_auto_merge: false`). | The helper merges directly instead of enabling auto-merge. |
