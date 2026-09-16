[English](12_fork_sync_and_customization_ops_spec.md) | [日本語](12_fork_sync_and_customization_ops_spec.ja.md)

---

# SDD-12: Fork Synchronization & Operations Specification

- **Document Number**: SPEC-COPILOT-012
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-16
- **Related Specs**: [SDD-05 (Data Storage & Fork Isolation Spec)](05_data_storage_and_fork_isolation_spec.md), [SDD-08 (Automation Workflow Spec)](08_automation_workflow_spec.md)

---

## 1. Overview & Core Principles

### 1.1 Background
`github-copilot-dashboard` is forked and operated across many enterprise organizations and GitHub Enterprise environments as an internal Copilot utilization analytics and FinOps cost allocation platform.
The upstream repository (`sun-flat-yamada/github-copilot-dashboard`) continuously releases enhancements including support for frontier AI models (Claude Sonnet 5, GPT-6, Gemini 3.x), benchmark score updates, FinOps logic improvements, dashboard UI/UX refinements, and security patches.

This specification establishes standard operating procedures and guidelines for downstream fork maintainers to safely, cleanly, and continuously incorporate upstream updates without disrupting daily batch runs or accumulated historical metrics.

### 1.2 Four Core Principles

```mermaid
flowchart TD
    subgraph Principles["Four Pillars of Fork Operations"]
        P1["1. Code-Data Decoupling\n(main has code only / copilot-data stores metrics)"]
        P2["2. Zero-Code Customization\n(Configurations kept in Variables/Secrets)"]
        P3["3. Fast-Forward First\n(Keep main commit history pristine)"]
        P4["4. Continuous Health Verification\n(Automated pre/post sync diagnostics)"]
    end
```

1. **Code-Data Decoupling**:
   - The `main` branch contains source code only. No runtime data files (`data/`) are ever committed to `main` (per SDD-05).
   - All collected and aggregated metrics reside exclusively in the dedicated orphan branch (`copilot-data`), physically eliminating merge conflicts during code synchronization.
2. **Zero-Code Customization (Configuration as Data)**:
   - Organization names, Enterprise slugs, user attribute mappings, and credentials must be injected dynamically via GitHub Actions Variables and Secrets.
   - Preserving zero diffs on tracked Git files allows 100% conflict-free upstream synchronization.
3. **Fast-Forward First**:
   - Downstream forks maintain a `main` branch whose commit history mirrors upstream `main` via fast-forward merges.
4. **Continuous Health Verification**:
   - Maintainers and agents run automated health checks (`npm run fork:verify`) before and after synchronization to validate Git remotes, data isolation, and security hygiene.

---

## 2. Configuration & Customization Strategy for Downstream Forks

### 2.1 Standard: Zero-Code Customization (Recommended)
Organization-specific details are registered as GitHub Actions Variables or Secrets rather than hardcoded in Git commits:

| Category | Name | Configuration Location | Purpose |
|---|---|---|---|
| **Secret** | `COPILOT_READ_TOKEN` | Settings > Secrets > Actions | Fine-grained PAT or GitHub App token with Copilot metrics/seats read permissions |
| **Variable** | `COPILOT_USER_MAPPING` | Settings > Variables > Actions | JSON array mapping logins to display names, departments, and cost center overrides |
| **Variable** | `COPILOT_ORGS` | Settings > Variables > Actions | Target organization slugs (comma-separated) |
| **Variable** | `COPILOT_ENTERPRISE` | Settings > Variables > Actions | Target Enterprise slug (for enterprise-wide aggregation) |
| **Variable** | `MOCK_MODE` | Settings > Variables > Actions | Set to `true` to test full UI/pipeline with simulated 2026 data without API tokens |

With Zero-Code Customization, the fork's `main` branch has zero file diffs against upstream, enabling 1-click updates.

---

### 2.2 Dual-Branch Strategy for Code-Level Customizations
When internal enterprise requirements demand custom frontend changes (custom branding, internal headers, proprietary SSO wrappers), maintain a **Clean `main` + Customization Branch** topology:

```text
[Upstream: sun-flat-yamada/github-copilot-dashboard]
  main ───●───●───● (New Features, Bug Fixes)
          │   │   │ (Fast-Forward Sync)
          ▼   ▼   ▼
[Fork: my-org/github-copilot-dashboard]
  main ───●───●───● (100% Mirror of Upstream)
          │       │
          │       └────────┐ (merge main)
          ▼                ▼
  fork/custom ───■───■────▲ (Internal Customizations)
```

- **`main` Branch**: Never contains internal commits; always synchronized cleanly with upstream.
- **`fork/custom` Branch**: Branched from `main` to hold internal commits.
- **Synchronization Flow**:
  1. Fast-forward `main` to latest `upstream/main`.
  2. Switch to `fork/custom` and run `git merge main`.
  3. Deploy GitHub Pages from `fork/custom` if needed.

---

## 3. Upstream Synchronization Procedures

### 3.1 Approach A: GitHub Web UI (1-Click Sync Fork)
Ideal for standard forks using Zero-Code Customization:

1. Open your fork repository on GitHub (`https://github.com/<your-org>/github-copilot-dashboard`).
2. Ensure the active branch is `main`.
3. Click the **"Sync fork"** dropdown above the file browser.
4. Click **"Update branch"**.
   - If there are no divergent commits, GitHub automatically fast-forwards or merges upstream changes.
5. Review the **Actions** tab to ensure the CI validation workflow (`test-and-preview.yml`) succeeds.

---

### 3.2 Approach B: Git CLI Standard Operator Runbook
Recommended for engineers, DevOps pipelines, and AI coding agents (`fork-sync-agent`):

#### Step 1: Verify Remote Configuration
```bash
git remote -v
```
If `upstream` is missing, configure it:
```bash
git remote add upstream https://github.com/sun-flat-yamada/github-copilot-dashboard.git
```

#### Step 2: Pre-flight Health Check
Inspect the repository health and verify working tree cleanliness:
```bash
npm run fork:verify
```

#### Step 3: Fetch Upstream & Review Diffs
```bash
git fetch upstream main

# Review incoming commit summary
git log HEAD..upstream/main --oneline

# Review changed files
git diff HEAD..upstream/main --stat
```

#### Step 4: Fast-Forward Merge
```bash
git checkout main
git merge upstream/main --ff-only
```

#### Step 5: Update Dependencies & Execute Quality Gates
```bash
npm ci
npm run typecheck
npm test
npm run secret-scan
npm run build
```

#### Step 6: Push to Fork Remote
```bash
git push origin main
```

#### Step 7: Trigger Pipeline Verification
Validate workflow execution via GitHub CLI or the GitHub Web UI:
```bash
gh workflow run copilot-analysis-cron.yml
gh run watch
```

---

### 3.3 Approach C: Scheduled Automatic Sync (GitHub Actions)
For continuous hands-off synchronization, an automated workflow can run weekly:

```yaml
name: Scheduled Upstream Sync

on:
  schedule:
    - cron: '0 1 * * 1'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout main
        uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git remote add upstream https://github.com/sun-flat-yamada/github-copilot-dashboard.git

      - name: Sync and Fast-Forward
        run: |
          git fetch upstream main
          if git merge-base --is-ancestor upstream/main HEAD; then
            echo "✅ Already up-to-date with upstream."
            exit 0
          fi
          git merge upstream/main --ff-only
          git push origin main
          echo "✅ Successfully synced and pushed upstream updates."
```

---

## 4. Post-Sync Health Check Checklist

Maintainers should verify these 5 checkpoints following synchronization:

```text
[Post-Sync Verification Checklist]
☐ 1. Data Integrity: Historical data in copilot-data orphan branch is intact and unbroken.
☐ 2. Security & Zero-Leakage: npm run secret-scan exits with code 0 (zero leaks).
☐ 3. Type Safety & Tests: npm run typecheck && npm test all pass cleanly.
☐ 4. Pipeline Execution: copilot-analysis-cron.yml finishes with green status.
☐ 5. GitHub Pages Deployment: Live URL correctly displays updated UI and recent metrics.
```

Execute all checks at once with:
```bash
npm run fork:verify
```

---

## 5. Troubleshooting & Remediation

### Case 1: Data Files Accidentally Committed to `main`
- **Symptom**: `data/` or `dashboard/public/data/` files appear in `main` git status, causing conflicts during upstream merge.
- **Cause**: Manual local run of data pipeline without clean `.gitignore` enforcement.
- **Remediation**:
  ```bash
  git rm -r --cached data/ dashboard/public/data/ 2>/dev/null || true
  git checkout upstream/main -- .gitignore
  git commit -m "fix: untrack data files from main branch (restore fork isolation)"
  ```

---

### Case 2: Diverged `main` Prevents Fast-Forward Merge
- **Symptom**: `fatal: Not possible to fast-forward, aborting.`
- **Cause**: Unintended direct commits exist on the fork's local/remote `main`.
- **Remediation**:
  1. If no local changes need to be preserved:
     ```bash
     git fetch upstream
     git reset --hard upstream/main
     git push origin main --force-with-lease
     ```
  2. If local changes must be preserved:
     ```bash
     git branch fork/custom-backup
     git reset --hard upstream/main
     git push origin main --force-with-lease
     git checkout -b fork/custom fork/custom-backup
     ```

---

### Case 3: GitHub Actions Push Permission Error (403 Forbidden)
- **Symptom**: `copilot-analysis-cron.yml` fails on "Commit and Push to 'copilot-data' branch" step with HTTP 403.
- **Cause**: Default Actions write permissions are disabled in fork settings.
- **Remediation**:
  1. Go to repository **Settings** > **Actions** > **General**.
  2. Under **Workflow permissions**, select **"Read and write permissions"**.
  3. Check **"Allow GitHub Actions to create and approve pull requests"**.
  4. Click **Save**.

---

### Case 4: GitHub Pages 404 or Outdated Content
- **Symptom**: Visiting the dashboard URL returns 404 or shows stale pre-sync UI.
- **Remediation**:
  1. Go to **Settings** > **Pages**.
  2. Under **Build and deployment** > **Source**, verify it is set to **"GitHub Actions"**.
  3. In the **Actions** tab, manually trigger `copilot-analysis-cron.yml` via "Run workflow".

---

## 6. Contributing Back to Upstream

When submitting upstream contributions (general bug fixes, new model benchmarks, analytics features):

1. **Create Clean Topic Branch**:
   ```bash
   git checkout -b feature/my-improvement upstream/main
   ```
2. **Zero-PII & Secret Audit**:
   - Ensure no real employee names, emails, or tokens are included in code or test fixtures.
   - Run `npm run secret-scan` (must exit 0).
3. **Open Pull Request**:
   ```bash
   git push origin feature/my-improvement
   ```
   Open a PR targeting `sun-flat-yamada/github-copilot-dashboard:main`.
