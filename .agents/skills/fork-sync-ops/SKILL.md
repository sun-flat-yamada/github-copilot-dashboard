---
name: fork-sync-ops
description: Inspect downstream fork status, safely synchronize code updates from upstream (sun-flat-yamada/github-copilot-dashboard), enforce fork-safe storage rules, and verify quality gates and deployment health.
---

# 🔄 Fork Synchronization & Maintenance Skill (`fork-sync-ops`)

Use this skill when auditing a downstream fork repository, fetching new releases/features from the upstream repository (`sun-flat-yamada/github-copilot-dashboard`), safely merging changes without data conflicts, or diagnosing synchronization issues.

---

## 📋 Core Principles to Enforce

1. **Zero Data on `main`**: Source code only on `main`. All metric data must remain isolated in the `copilot-data` orphan branch (SDD-05).
2. **Zero Hardcoded Secrets / PII**: Company names, user mappings, and tokens must only be supplied via GitHub Actions Variables / Secrets (`COPILOT_USER_MAPPING`, `COPILOT_READ_TOKEN`).
3. **Fast-Forward First**: Always strive for `--ff-only` merges to keep the downstream `main` branch 100% clean and identical to upstream.

---

## 🛠️ Execution Workflow

### Step 1: Pre-Flight Health Audit
Run the automated diagnostic tool to inspect remotes, working tree cleanliness, and data isolation:
```bash
npm run fork:verify
```
- If `Working Tree Cleanliness` has warnings, run `git status -s` to inspect untracked/modified files. Stash or clean them before proceeding.
- If `Code-Data Decoupling` fails, run `git rm -r --cached data/ dashboard/public/data/` immediately.

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

### Step 4: Fast-Forward Synchronization
```bash
git checkout main
git merge upstream/main --ff-only
```
- **If `--ff-only` succeeds**: The fork is cleanly up to date!
- **If `--ff-only` fails**:
  - Check `git log upstream/main..HEAD --oneline` to see what local commits were made on `main`.
  - If they were accidental: `git reset --hard upstream/main`.
  - If they were custom internal extensions: branch them off (`git branch fork/custom`), reset `main` to `upstream/main`, and merge `main` into `fork/custom`.

### Step 5: Full Quality & Security Gate
Update dependencies and run the complete verification suite:
```bash
npm ci
npm run typecheck
npm test
npm run secret-scan
npm run build
```
Verify that all tests pass and secret-scan exits with code 0 (zero leaks).

### Step 6: Push Updates to Fork Remote (`origin`)
```bash
git push origin main
```

### Step 7: Post-Sync Health Verification
1. Re-run health check:
   ```bash
   npm run fork:verify
   ```
2. Verify that GitHub Actions (`copilot-analysis-cron.yml`) triggers and runs cleanly.
3. Confirm that the `copilot-data` branch continues to record daily partitions without conflict.
4. Verify that the GitHub Pages site displays the latest features and radar benchmarks.
