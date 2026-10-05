# Implementation Plan: Detect email addresses and machine-specific absolute paths in `secret-scan` (Issue #206)

The change-dev rules forbid secrets, PII and machine-specific absolute paths in the committed artifacts (`.devs/changes/`), and `AGENTS.md` Core Rule 2 forbids email addresses in every file. `npm run secret-scan` (`scripts/scan-secrets.ts`) only matches secret patterns, so PII and absolute paths are checked by eye, while SDD-12 / SDD-14 describe the scan as a "secret/PII audit". The change-dev templates themselves also ask for `file:///` absolute links, and `.agents/` contains links into one Windows user profile.

- **Base**: `main` @ `78d30b5`.
- **Issue**: [#206](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/206). Precedent: [#159](https://github.com/sun-flat-yamada/github-copilot-dashboard/pull/159) and [2026-10-01_SecretScanChangeDevArtifacts](../2026-10-01_SecretScanChangeDevArtifacts/implementation_plan.md).
- **Branch**: `feat/206-scan-emails-and-absolute-paths` (cloud session; the session branch replaces the sibling worktree).

## User Review Required

> [!IMPORTANT]
> The Issue's recommended option is adopted for each decision.
>
> | # | Decision | Adopted |
> | :-- | :-- | :-- |
> | 1 | Scope of the absolute-path rule | `.devs/changes/` only (the rule is about artifacts) |
> | 2 | Scope of the email rule | Every scanned file (Zero PII covers all files) |
> | 3 | Link format of artifacts | Committed artifacts use repository-relative links. An Antigravity working copy may keep `file:///` links; the finished copy placed in `.devs/changes/` is rewritten with relative links |
> | 4 | Scanning `.agents/` | Stays out of scope (#159). The existing absolute links in `.agents/` are fixed by hand in this change |
> | 5 | Real names, departments, GitHub logins | Out of scope (not detectable by regex) |
>
> - **Value-level allowlists**: the new rules do not use `isSafePlaceholder(line)` (a line containing `test` / `example` would hide every finding on it). Each matched value is checked against its own allowlist, and every match on a line is checked, so an allowed value does not hide a disallowed one.
> - **Redacted output**: for PII and path findings the matched value is replaced by its category (`<email>`, `<abs-path>`) instead of the 4+2 character mask. The same redaction is applied to every printed line, so a secret finding on a line that also holds an email does not leak it. `npm run upstream:audit` calls `runSecretScan()` and gets the same output.
> - **CLI categories**: findings are labelled `secret` / `PII` / `path`, and the summary line counts each category.

> [!WARNING]
> - The email rule now applies to every scanned file, including tests. Fixtures are built at runtime (for example `['alice', 'corp.co.jp'].join('@')`).
> - Path patterns use a negative lookbehind so that a relative path such as `views/users/View.tsx` or `Overview/Users/...` does not match; `/Users/` is matched case-sensitively.
> - A bare mention of the scheme `file:///` (no path after it) is not a finding, so the rules and docs can name it; `file:///<placeholder>/...` is allowed too.

## Proposed Changes

### Scanner

#### [MODIFY] [scripts/scan-secrets.ts](../../../scripts/scan-secrets.ts)
- Rule model: `category` (`secret` / `pii` / `path`) and `scope` (`all` / `artifacts`); scope is decided with `toRepoPath` (`.devs/changes/`).
- Email rule (`pii`, all files). Allowlist: `example.com` / `example.org` / `example.net` and their subdomains, TLDs `.example` / `.test` / `.invalid`, `github.com`, `users.noreply.github.com`, local part `noreply` / `no-reply`. npm specifiers (`pkg@1.2.3`) and `uses: x@v7` do not match (the TLD must be alphabetic).
- Absolute-path rule (`path`, artifacts only): home directories (`/home/<name>/`, `/Users/<name>/`, `<drive>:\Users\<name>\` and its `/` form, `/root/`), `/tmp/`, and `file:///` URIs. Allowlist: angle-bracket placeholders (`<user>`) and `/home/runner/`.
- `.git` added to `IGNORED_FILES` (the worktree `.git` file holds `gitdir: <absolute path>`).
- Redacted snippets and categorized CLI messages.

### Tests

#### [MODIFY] [src/tests/scripts/scan-secrets.test.ts](../../../src/tests/scripts/scan-secrets.test.ts)
- Fails for a non-allowlisted email and each path form (`\` and `/` separators, `file:///`, `/root/`, `/tmp/`) in an artifact.
- Passes when the same paths are only in a regular source file; fails for an email in a regular file.
- Passes for allowlisted values (reserved domains, `git@github.com`, `users.noreply.github.com`, `noreply`, `<user>`, `/home/runner/`), npm / Actions version specifiers and relative `users/` paths.
- A `.git` file with `gitdir: <absolute path>` is not a scan target.
- `console.error` is captured; no part of the local part or user name appears in the output.

### change-dev skill, agent and specs

#### [MODIFY] [.agents/skills/change-dev/SKILL.md](../../../.agents/skills/change-dev/SKILL.md)
- Templates, Phase 2 step and self-check list use repository-relative links.
- Repository Reference Links: relative links; the five links into local Antigravity built-in files are replaced by the official documentation URLs listed in the same file.
- Scope description: emails and absolute paths are detected; real names and departments still need review.

#### [MODIFY] [.agents/change-dev.agent.md](../../../.agents/change-dev.agent.md)
- Relative links.

#### [MODIFY] SDD-14 ([EN](../../../docs/specifications/14_development_workflow_and_git_ops_spec.md) / [JA](../../../docs/specifications/14_development_workflow_and_git_ops_spec.ja.md)) and SDD-12 ([EN](../../../docs/specifications/12_fork_sync_and_customization_ops_spec.md) / [JA](../../../docs/specifications/12_fork_sync_and_customization_ops_spec.ja.md))
- Link format and scan coverage text match the implementation.

### change-dev artifacts
- [implementation_plan.md](./implementation_plan.md), [task.md](./task.md), `walkthrough.md` (after the gate).

## Verification Plan

### Automated Tests
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` (plus `npm run lint`).
- `npx tsx --test src/tests/scripts/scan-secrets.test.ts`.

### Manual Verification
- `npm run secret-scan` passes on the repository from this worktree (where `.git` is a file).
- Mutation check: disabling the email allowlist or the `.git` exclusion makes the matching tests fail.
