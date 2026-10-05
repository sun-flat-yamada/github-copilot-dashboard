# Deployment Failure Detection & Prevention Plan

## Context
When primary model column names were updated, an unused import (`formatTopModels`) caused TypeScript `tsc` build errors during CI and GitHub Pages deployment. Because:
1. GitHub Branch Protection lacked `required_status_checks`, allowing auto-merge to bypass failing CI.
2. The deployment workflow (`copilot-analysis-cron.yml`) had no failure alerting mechanism, failing silently.
3. Local verification relied on `npx vite build` (skipping `tsc`) instead of `npm run build`.
4. There was no verification step for post-merge Pages deployment status.

## Changes
1. **GitHub Branch Protection**: Enabled `required_status_checks` on `main` (Already applied via GitHub REST API).
2. **Workflow Failure Alerting**:
   - Update `.github/workflows/copilot-analysis-cron.yml` with an automated alert step (`Alert on deployment or sync failure`) that files/comments on an issue when the workflow fails.
3. **Deployment Status Verification CLI**:
   - Create `scripts/check-pages-deployment.ts` (`npm run pages:status`) to check the live GitHub Pages deployment status.
4. **Git Pre-Push Hook Setup**:
   - Create `scripts/setup-git-hooks.ts` (`npm run setup:hooks`) to install enhanced pre-push hook running `npm run typecheck` and `npm run secret-scan` prior to pushing.
5. **Documentation (SDD-14)**:
   - Update `docs/specifications/14_development_workflow_and_git_ops_spec.ja.md` and `.md` with Step 8: Deployment Verification and explicit rules against partial build checks.

## Verification
- Run `npm run typecheck`
- Run `npm run build`
- Run `npm run pages:status`
- Run `npm run secret-scan`
- Run `npm test`
