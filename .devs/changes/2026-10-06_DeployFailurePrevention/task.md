# Tasks: Deployment Failure Detection & Prevention

- [x] Configure GitHub Branch Protection required status checks on main (Completed) <!-- id: 0 -->
- [x] Add failure alert step to `.github/workflows/copilot-analysis-cron.yml` <!-- id: 1 -->
- [x] Implement `scripts/check-pages-deployment.ts` and add `pages:status` to `package.json` <!-- id: 2 -->
- [x] Implement `scripts/setup-git-hooks.ts` and update local `.git/hooks/pre-push` <!-- id: 3 -->
- [x] Update SDD-14 specification with post-merge deployment verification rules <!-- id: 4 -->
- [x] Run full quality gate (`typecheck`, `build`, `test`, `secret-scan`, `pages:status`) <!-- id: 5 -->
- [/] Create PR, verify required checks, and merge <!-- id: 6 -->
