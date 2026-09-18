---
name: fork-sync-ops
description: Inspect downstream fork status, safely synchronize code updates from upstream (sun-flat-yamada/github-copilot-dashboard), enforce fork-safe storage rules, keep the fork's upstream identity visible without conflicting with main, guard against upstream data leaks, and verify quality gates and deployment health.
---

# 🔄 Fork Synchronization & Maintenance Skill (`fork-sync-ops`)

Use this skill when auditing a downstream fork repository, fetching new releases/features from the upstream repository (`sun-flat-yamada/github-copilot-dashboard`), safely merging changes without data conflicts, contributing generic improvements back upstream, or diagnosing synchronization issues.

---

## 🧭 Steady-State Branch Topology (read this first)

This fork runs a **dual-branch** model, not a single-`main` model:

```text
main         = 100% pure mirror of upstream/main (fast-forward/reset only, NEVER any local commits)
fork/custom  = repository Default Branch + GitHub Pages deployment source
               (main's history + this fork's own customizations, merged in)
```

- **`main`**: only ever moves via `git merge upstream/main --ff-only` (or, if it ever drifts, `git reset --hard upstream/main`). It must never carry a commit that doesn't also exist in `upstream/main`. Never add fork-only content here — not even a README banner or a doc tweak.
- **`fork/custom`**: the branch Actions workflows (`push`/`schedule`/Pages) actually target. New upstream changes reach it by merging `main` into it (never the other way around) — this is the step that can produce real conflicts, since `fork/custom` may touch the same files upstream also changed (common hotspots: `.github/workflows/copilot-analysis-cron.yml`, `docs/specifications/08_automation_workflow_spec.md` (+`.ja.md`)).
- Both branches independently satisfy Code-Data Decoupling (SDD-05) — no runtime data on either.

See `docs/specifications/12_fork_sync_and_customization_ops_spec.md` §2.2 ("Dual-Branch Strategy for Code-Level Customizations") for the full rationale, and its §2.3 ("Operational Checklist for fork/custom Deployments") for the 4-part checklist (workflow trigger refs, repository Default Branch, Pages environment branch policy, new env vars) that must move together whenever `fork/custom` gains new code-level customizations.

---

## 📋 Core Principles to Enforce

1. **Zero Data on Either Branch**: Source code only on `main` and `fork/custom`. All metric data stays isolated in the `copilot-data` (real) / `copilot-data-mock` (mock/demo) orphan branches (SDD-05), and the two must never mix.
2. **Zero Hardcoded Secrets / PII**: Company names, user mappings, and tokens must only be supplied via GitHub Actions Variables / Secrets (`COPILOT_USER_MAPPING`, `COPILOT_READ_TOKEN`, `COPILOT_ORGS`, `COPILOT_ENTERPRISE`). The app must degrade gracefully (empty/zero state) when any of these are absent — never crash, and never fall back to mock data silently.
3. **`main` Stays a Pure Mirror**: `main` is fast-forward-only against `upstream/main`. All fork-specific code, docs, and workflow retargeting live exclusively on `fork/custom`.
4. **Visible-but-Non-Conflicting Fork Identity**: this repo is a mirror-based duplicate, not a native GitHub fork (`isFork: false`, no fork network), so its upstream relationship is made discoverable via repo description/topics and a `fork/custom`-only README banner — never by touching `main` (see "Keeping the Fork Identity Visible" below).
5. **No Org Data Ever Reaches Upstream**: any branch destined for a push into the upstream repository must pass `npm run upstream:audit` (see "Contributing Back to Upstream" below) — zero exceptions.
6. **Continuous Health Verification**: run `npm run fork:verify` before and after any sync or branch surgery.

---

## 🛠️ Execution Workflow

### Step 1: Pre-Flight Health Audit
```bash
npm run fork:verify
```
- `Working Tree Cleanliness` warnings → run `git status -s`, stash/commit/clean before proceeding.
- `Code-Data Decoupling` failures → run `git rm -r --cached data/ dashboard/public/data/` immediately.
- An `Active Branch` warning while on `fork/custom` is **expected** in this repo's steady state (the check's generic advice assumes a single-`main` topology) — it is not something to "fix".

### Step 2: Ensure Upstream Remote is Configured
Check existing remotes:
```bash
git remote -v
```
If `upstream` is missing:
```bash
git remote add upstream https://github.com/sun-flat-yamada/github-copilot-dashboard.git
```

### Step 3: Fetch Upstream & Analyze Inbound Changes
```bash
git fetch upstream main

# Review incoming commits
git log HEAD..upstream/main --oneline -n 20

# Review affected files
git diff HEAD..upstream/main --stat
```
Check if any architectural changes, new environment variables, or new models/dependencies were introduced.

### Step 4: Fast-Forward `main`, Then Merge Into `fork/custom`
```bash
# 1. main always fast-forwards cleanly — it only ever contains upstream commits
git checkout main
git merge upstream/main --ff-only
git push origin main

# 2. Bring those changes into the deployment branch (this is where real conflicts can occur)
git checkout fork/custom
git merge main
# resolve any conflicts by hand, then continue
```
- **If step 1's `--ff-only` fails**: this should not happen in steady state — it means a commit landed directly on `main` outside this flow. Investigate before force-pushing anything. If local-only commits must be preserved, branch them off first (`git branch backup/main-before-reset`), then `git reset --hard upstream/main` and fold the preserved branch into `fork/custom` instead.
- **Before any branch-pointer surgery** (force-push, Default Branch change, resetting `main`): `gh workflow disable <id>` on the daily cron/deploy workflow first, do all git surgery, verify with `gh run list` that nothing fired during the disabled window, then `gh workflow enable <id>`. This avoids a stale/incompatible workflow definition executing mid-transition.

### Step 5: Full Quality & Security Gate (run on `fork/custom`)
```bash
npm ci
npm run typecheck
npm test
npm run secret-scan
npm run build
npm run fork:verify
```
All must pass cleanly (secret-scan exits 0 with zero leaks) before pushing.

### Step 6: Push the Deployment Branch
```bash
git push origin fork/custom
```
`fork/custom` is this repository's **Default Branch** — pushing it is what actually reaches production/Pages (`main` was already pushed in Step 4).

### Step 7: Post-Sync Health Verification
1. Re-run health check:
   ```bash
   npm run fork:verify
   ```
2. Verify that GitHub Actions (`copilot-analysis-cron.yml`) triggers and runs cleanly on `fork/custom` (`gh run list --branch fork/custom --limit 3`).
3. Confirm that `copilot-data` continues to record real daily partitions and `copilot-data-mock` stays untouched by real runs (and vice versa).
4. Verify that the GitHub Pages site displays the latest features and radar benchmarks.

---

## 🪪 Keeping the Fork Identity Visible (without touching `main`)

Because this repo is a mirror-based duplicate (`isFork: false`, no native fork network), none of GitHub's built-in "forked from" UI applies here. Make the relationship discoverable using only these two mechanisms, both scoped to `fork/custom`/repo metadata — **never** `main`:

1. **Repo description & topics** (zero git risk — server-side metadata, not a file):
   ```bash
   gh repo edit <owner>/<repo> --description "Downstream deployment of sun-flat-yamada/github-copilot-dashboard (mirror-based fork)." --add-topic fork
   ```
2. **README banner on `fork/custom` only**: a short blockquote inserted between the language-switcher line and the title in `README.md`/`README.ja.md`, naming the upstream repository and pointing to SDD-12/SDD-13 for the dual-branch model.

Full rationale and exact wording guidance: `docs/specifications/13_fork_restricted_environment_setup_guide.md` §7 ("Making the Mirror's Upstream Relationship Visible").

---

## 🚫 Contributing Back to Upstream (org-data leak prevention)

When a fork-side improvement is generic enough to belong upstream:

1. Build a clean topic branch off **`upstream/main`** (not `fork/custom` directly — this keeps org-specific retargeting commits out of the diff):
   ```bash
   git checkout -b feature/my-improvement upstream/main
   # cherry-pick or hand-port only the generic commits/changes
   ```
2. **Run both audits — both must exit 0, no exceptions**:
   ```bash
   npm run secret-scan
   npm run upstream:audit -- upstream/main feature/my-improvement
   ```
   `upstream:audit` (`scripts/audit-upstream-contribution.ts`) diffs the candidate branch against `upstream/main` and fails if any changed path matches a real-data pattern (`AIUsageReport*.csv`, `*<yyyymm>.csv`, `data/`, `dashboard/public/data/`, user-mapping/org-chart dumps, secrets/credential filenames), and also re-runs the content-level secret scan. Treat any non-zero exit as a hard blocker. See `docs/specifications/12_fork_sync_and_customization_ops_spec.md` §6.1 for the full rule list.
3. **Push and open the PR.** This repo is not fork-network-linked to upstream, so a conventional cross-repo PR isn't available — push directly into the upstream repository using the `sun-flat-yamada` identity (which has write access there), then open a same-repository PR:
   ```bash
   gh auth switch --user sun-flat-yamada
   git push <upstream-remote> feature/my-improvement
   gh pr create --repo sun-flat-yamada/github-copilot-dashboard \
     --base main --head feature/my-improvement --title "..." --body "..."
   gh auth switch --user <normal-fork-side-identity>
   ```
   Switch back to the normal fork-side identity immediately after opening the PR. Do not merge it yourself — leave it for upstream review.

Full procedure: `docs/specifications/12_fork_sync_and_customization_ops_spec.md` §6 ("Contributing Back to Upstream").
