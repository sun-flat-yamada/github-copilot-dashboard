# Walkthrough: Detect email addresses and absolute paths in secret-scan (#206)

## Summary
`npm run secret-scan` now enforces the Zero PII rule for email addresses in every scanned file and the change-dev rule against machine-specific absolute paths in `.devs/changes/`. The change-dev skill, agent and SDD-14 no longer ask for `file:///` links, and the links into one user profile are gone from `.agents/`. Decisions 1-5 of the Issue were adopted as recommended (see [implementation_plan.md](./implementation_plan.md)).

## Changes Made

### Scanner
- [scripts/scan-secrets.ts](../../../scripts/scan-secrets.ts):
  - Privacy rules with a category (`pii` / `path`) and a scope (`all` / `artifacts`), next to the existing secret rules.
  - Email rule (all files) with a value-level allowlist: `example.com` / `.org` / `.net` and subdomains, TLDs `.example` / `.test` / `.invalid`, `github.com`, `users.noreply.github.com`, local parts `noreply` / `no-reply`. The TLD must be alphabetic, so `pkg@1.2.3` and `x@v7` do not match.
  - Absolute-path rule (`.devs/changes/` only): `<drive>:\Users\<name>` (both separators), `/home/<name>`, `/Users/<name>`, `/root/<entry>`, `/tmp/<entry>`, `file:///<path>`. Allowed: `<placeholder>` segments and `/home/runner`. A lookbehind keeps relative paths (`views/users/...`, `Overview/Users/...`) out; a bare `/tmp/` or `file:///` naming the directory or scheme is not a finding.
  - Every match on a line is checked, so an allowed value does not hide a disallowed one; the line-wide `isSafePlaceholder` is used only for the secret rules, as before.
  - Output: findings are labelled `[secret]` / `[PII]` / `[path]`, the summary counts each category, and every printed line has disallowed privacy values replaced by `<email>` / `<abs-path>`. `npm run upstream:audit` calls `runSecretScan()` and prints the same.
  - `.git` added to `IGNORED_FILES` (worktree `gitdir:` file).

### Tests
- [src/tests/scripts/scan-secrets.test.ts](../../../src/tests/scripts/scan-secrets.test.ts): 21 new cases. Each absolute-path form fails in an artifact and passes in a regular file; emails fail in both; allowlisted values, version specifiers, placeholders and relative `users/` paths pass; an allowed value does not hide a disallowed one; the captured `console.error` output contains no 3-character fragment of a detected local part or user name; a `.git` file is not collected. All fixture values are built at runtime.

### change-dev and specifications
- [.agents/skills/change-dev/SKILL.md](../../../.agents/skills/change-dev/SKILL.md): templates, Phase 2 step and self-check use repository-relative links; Repository Reference Links are relative; the five links into local Antigravity built-in files are replaced by the official documentation URLs; scan coverage text matches the scanner.
- [.agents/change-dev.agent.md](../../../.agents/change-dev.agent.md): relative links.
- SDD-14 ([EN](../../../docs/specifications/14_development_workflow_and_git_ops_spec.md) / [JA](../../../docs/specifications/14_development_workflow_and_git_ops_spec.ja.md)): link format and scan coverage.
- SDD-12 ([EN](../../../docs/specifications/12_fork_sync_and_customization_ops_spec.md) / [JA](../../../docs/specifications/12_fork_sync_and_customization_ops_spec.ja.md)): scan coverage in the contribution checklist and the audit section.

## Verification Results

### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | Exit 0 (0 failures; warnings are branch / working tree / public exposure notices) |
| TypeScript Check | `npm run typecheck` | Exit 0 |
| Unit & Integration Tests | `npm test` | 1150 / 1150 pass (after rebase onto `4814754`) |
| Secret / PII / Path Scan | `npm run secret-scan` | Exit 0 (637 files, 128 under `.devs/changes/`) |
| Production Build | `npm run build` | Exit 0 (main chunk within budget) |
| Lint | `npm run lint` | Exit 0 |

### Manual Verification
- The scan was run from a linked worktree whose `.git` is a file: clean.
- Mutation check: disabling the GitHub domain allowlist, the `/home/runner` allowance and the `.git` exclusion made the allowlist test and the `.git` collection test fail (2 failures); restoring them made all 25 scanner tests pass.
- `grep` over the repository finds no remaining `file:///` link into a user profile and no Antigravity built-in file link.
