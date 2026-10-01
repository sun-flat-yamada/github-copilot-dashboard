# Walkthrough: Secret scan coverage for change-dev artifacts (`.devs/changes/`)

## Summary

`npm run secret-scan` now scans the change-dev artifacts under `.devs/changes/`, so a secret in `implementation_plan.md`, `task.md` or `walkthrough.md` fails the scan locally and in CI. Dot-directories are still skipped by default. The only exception is a repo-root-relative allowlist (`SCANNED_DOT_PATHS = ['.devs/changes']`), and `.devs/` is traversed only on the way to it. A regression test covers the file walk and the end-to-end result, and the change-dev skill now states what the scan covers.

## Changes Made

### Secret scanner
- [scripts/scan-secrets.ts](../../../scripts/scan-secrets.ts):
  - `SCANNED_DOT_PATHS` allowlist.
  - `walkDir` checks dot-directories against the allowlist: an allowlisted path is walked normally, a dot-directory leading to one (`.devs/`) is walked in pass-through mode (only toward the allowlisted path, no files collected), and any other dot-directory is skipped as before.
  - `toRepoPath` builds the root-relative path with `/` separators, so the match does not depend on the OS.
  - `collectScanTargets(rootDir)` is exported, and `runSecretScan` takes an optional `rootDir` (default `process.cwd()`). Existing callers are unchanged.
  - The output names each allowlisted dot-path and how many files it contributed.

### Tests
- [src/tests/scripts/scan-secrets.test.ts](../../../src/tests/scripts/scan-secrets.test.ts): 4 tests in 2 suites.
  - The file walk includes `.devs/changes/<dir>/implementation_plan.md` and a regular file, and excludes `.devs/other/x.md`, `.devs/notes.md`, `.agents/rules/x.md` and `.github/workflows/x.yml`.
  - `runSecretScan` fails when an artifact under `.devs/changes/` contains a private-key header. The header is built at runtime so that the test source stays clean.

### Agent skill
- [.agents/skills/change-dev/SKILL.md](../../../.agents/skills/change-dev/SKILL.md): the artifact rule says that `npm run secret-scan` covers `.devs/changes/` (not the rest of `.devs/` or other dot-directories), and that PII and absolute paths need a review because the scanner only matches secret patterns.

### change-dev artifacts
- [implementation_plan.md](./implementation_plan.md), [task.md](./task.md) and this walkthrough. One verification step of the plan was corrected during execution: the expected scan total now comes from comparing the pre-change and new scanners on the same tree, because the new test file is scanned as well.

## Verification Results

### Automated Quality Gates

Run in the sibling worktree on the final commit. Baseline on `bee5e8b` before the change: all 5 stages passed, 118 tests, 353 files scanned.

| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Exit 0 (4 passed, 0 failures; 1 warning because the branch is not `main`, as in the baseline) |
| TypeScript Check | `npm run typecheck` | ✅ Exit 0 |
| Unit & Integration Tests | `npm test` | ✅ 122/122 pass, 38 suites (baseline: 118 tests, 36 suites) |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 findings (Exit 0). 359 files scanned, 5 of them in `.devs/changes/` |
| Production Build | `npm run build` | ✅ Built in 1.47s |

### New Test
- `npx tsx --test src/tests/scripts/scan-secrets.test.ts`: 4/4 pass.
- `npm test` with the current glob runs the new file: both suites appear in the output.
- Mutation check. The scanner was edited temporarily for each row and then restored byte for byte:

| Mutation | Failing tests |
| :--- | :--- |
| Empty allowlist (behavior before this change: all of `.devs/` skipped) | 3 of 4: inclusion, exact file set, end-to-end |
| Files in pass-through directories are collected | 2 of 4: rest of `.devs/`, exact file set |
| Pass-through directories are walked as normal directories | 2 of 4: rest of `.devs/`, exact file set |

### Manual Verification

| Check | Result |
| :--- | :--- |
| `npm run secret-scan` in the worktree | Prints `📂 Dot-paths scanned: .devs/changes/ (5 files). Other dot-directories are skipped.` and scans 359 files. The pre-change scanner reports 354 files on the same tree, so the difference is exactly the 5 artifacts. |
| Scratch tree outside the repository, private-key header in `.devs/changes/<dir>/implementation_plan.md` | Exit 1, with the finding at `.devs/changes/2026-10-01_Example/implementation_plan.md:3`. The pre-change scanner reports the same tree as clean (Exit 0). |
| Scratch tree, the same line only in `.devs/other/x.md` and `.agents/x.md` | Exit 0. 2 files scanned (the artifact and a regular file). |
| `src/tests/upstream-contribution-audit.test.ts` (calls the scanner through `runSecretScan()`; run directly because the current `npm test` glob does not reach it) | 13/13 pass |
