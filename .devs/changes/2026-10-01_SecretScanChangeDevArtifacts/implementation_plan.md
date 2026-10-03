# Secret Scan Coverage for change-dev Artifacts (`.devs/changes/`)

`npm run secret-scan` (`scripts/scan-secrets.ts`) skips every directory whose name starts with `.`. Because of that, the change-dev artifacts tracked under `.devs/changes/` (re-included by `!.devs/changes/` in `.gitignore`) are never scanned, although the change-dev skill tells agents to rely on `npm run secret-scan` for them. In the previous change the artifacts had to be scanned by hand, by running the scanner from inside the change directory. This change makes the scanner descend into `.devs/changes/` and keeps every other dot-directory, including the rest of `.devs/`, out of scope.

- **Base**: `main` @ `bee5e8b`.
- **Issue**: [#171](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/171), filed on 2026-10-03, after the merge, as a record of this fix. The change request (goal, context, what to change, done-when) defines the scope, as for `2026-10-01_DashboardReviewAndImprovementPlan`.
- **Branch / worktree**: `claude/wonderful-turing-1icdpq` in the sibling worktree `../github-copilot-dashboard-worktrees/claude-wonderful-turing-1icdpq`.

## User Review Required

> [!IMPORTANT]
> 1. **Allowlist instead of a broader scan**: dot-directories stay skipped by default. A list of repo-root-relative paths (`SCANNED_DOT_PATHS = ['.devs/changes']`) names the dot-paths that are scanned anyway. A dot-directory on the way to an allowlisted path (`.devs/`) is traversed only toward that path, so nothing else in it is collected. Dot-directories nested inside `.devs/changes/` stay skipped, as they are everywhere else.
> 2. **Test location**: the regression test goes to `src/tests/scripts/scan-secrets.test.ts`. The unquoted `npm test` glob (`src/tests/**/*.test.ts`) is expanded by `sh`, which only matches files exactly one directory below `src/tests/`; today it runs 23 of the 79 test files. The new location runs under the current glob and under a quoted one. Quoting the glob is task P0-1 of `2026-10-01_DashboardReviewAndImprovementPlan` and is left to that task, because it starts running the 56 test files that are skipped today.
> 3. **Small scanner API additions**: `collectScanTargets(rootDir)` is exported for the test, and `runSecretScan(rootDir = process.cwd())` takes an optional root. The existing callers (`npm run secret-scan`, `scripts/audit-upstream-contribution.ts`) call it without arguments and keep their behavior, apart from the added coverage.
> 4. **CLI output**: the scanner prints one more line before the result. It names each allowlisted dot-path with the number of files it contributed, so a run shows that `.devs/changes/` was covered.

> [!WARNING]
> - **The existing artifacts become part of the gate**: from now on a finding in `.devs/changes/` fails `npm run secret-scan`, locally and in CI (`secret-scan.yml`, `test-and-preview.yml`). Running the current scanner over copies of `.devs/changes/`, `.agents/` and `.github/` reported no findings, so the existing artifacts pass.
> - **Pattern coverage**: the scanner matches secret patterns (tokens, keys, private-key headers, hard-coded credentials). It has no rules for PII or machine-specific absolute paths, which the change-dev skill also forbids in artifacts, so those still need a manual check. The skill text is adjusted so that it does not suggest otherwise. Adding those rules is tracked in [#206](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/206).
> - **No broader scope**: `.agents/` and `.github/` are also clean today, but scanning them is a separate decision. Agent documents quote token prefixes as examples and can produce false positives as they change.

## Proposed Changes

### Secret scanner

#### [MODIFY] [scripts/scan-secrets.ts](../../../scripts/scan-secrets.ts)
- Add `SCANNED_DOT_PATHS = ['.devs/changes']` next to `IGNORED_DIRS`.
- `walkDir`: for a dot-directory, compare its repo-root-relative path (normalized to `/` separators, so it also matches on Windows) with the allowlist:
  - an allowlisted path is walked normally;
  - an ancestor of one (`.devs/`) is walked in pass-through mode, which follows only the directories that lead to the allowlisted path and collects no files;
  - any other dot-directory is skipped, as before.
- Export `collectScanTargets(rootDir)`, the file walk the scan uses, and give `runSecretScan` an optional `rootDir`.
- Print the coverage line, for example `.devs/changes/ (5 files)`.

### Tests

#### [NEW] [src/tests/scripts/scan-secrets.test.ts](../../../src/tests/scripts/scan-secrets.test.ts)
- Build a temporary tree with `.devs/changes/<dir>/implementation_plan.md`, `.devs/other/x.md`, `.devs/notes.md`, `.agents/rules/x.md`, `.github/workflows/x.yml` and a regular source file.
- Assert that `collectScanTargets` returns the artifact and the regular file, and none of the rest of `.devs/` or the other dot-directories.
- Assert end to end that `runSecretScan` fails when an artifact under `.devs/changes/` contains a secret-shaped line. The line is built at runtime so that the test source stays clean, and the scanner's console output is silenced.

### Agent skill

#### [MODIFY] [.agents/skills/change-dev/SKILL.md](../../../.agents/skills/change-dev/SKILL.md)
- In "Storage Paths & Directory Conventions", state that `npm run secret-scan` covers `.devs/changes/` (but not the rest of `.devs/` or other dot-directories), and that PII and absolute paths need a manual check because the scanner only matches secret patterns.

### change-dev artifacts

#### [NEW] [implementation_plan.md](./implementation_plan.md)
- This plan.

#### [NEW] [task.md](./task.md)
- Execution checklist.

#### [NEW] [walkthrough.md](./walkthrough.md)
- Verification record, written after the quality gate passes.

### Not changed
- `docs/specifications/`: no SDD describes which paths the scanner covers (SDD-12 and SDD-14 only call `npm run secret-scan`), so there is nothing to synchronize.
- `package.json` test glob: see item 2 of User Review Required.

## Verification Plan

### Automated Tests
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
- New test file only: `npx tsx --test src/tests/scripts/scan-secrets.test.ts`
- `npm test` with the current glob runs the new file: its tests appear in the output and the total rises above the baseline of 118.

### Manual Verification
- `npm run secret-scan` in the repository: the coverage line reports the files under `.devs/changes/` (this change's artifacts and the earlier plan), and the pre-change scanner, run on the same tree, reports exactly that many files fewer.
- A scratch tree outside the repository: a secret-shaped line in `.devs/changes/<dir>/implementation_plan.md` makes the CLI exit with 1 and name that file. The same line only in `.devs/other/x.md` or `.agents/x.md` leaves the scan clean (exit 0).
