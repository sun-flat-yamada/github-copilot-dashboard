---
title: "Claude Code Configuration for github-copilot-dashboard"
description: "Context rules, command shortcuts and directives for Claude Code."
category: "meta"
type: "configuration"
status: "active"
date: 2026-10-03
updated: 2026-10-03
lang: "en"
tags:
  - "ai"
  - "agent"
  - "configuration"
---

# Claude Code Configuration for github-copilot-dashboard

## Global Rules & Context
@AGENTS.md
@.agents/rules/security-zero-leakage.md
@.agents/rules/storage-and-data-routing.md
@.agents/rules/development-workflow.md
@.agents/rules/model-benchmark-management.md
@.agents/rules/quality-rules-gate.md
@.agents/rules/git-rules-commit.md
@.agents/rules/naming-rules-general.md
@.agents/rules/language-rules-output.md
@.agents/rules/instructions-rules-precedence.md

## Commands
- `/status`: Show `git status`, current branch, and `npm run fork:status`.
- `/test`: Run `npm run typecheck && npm test`.
- `/gate`: Run the full quality gate: `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`.
- `/secret-scan`: Run `npm run secret-scan`.
- `/verify-fork`: Run `npm run fork:verify` and follow `.agents/skills/fork-sync-ops/SKILL.md` (never push `main` on upstream).
- `/change-dev`: Follow `.agents/skills/change-dev/SKILL.md` (Issue → plan gate → sibling worktree → quality gate → PR → Rebase Merge; the plan wait, PR draft state and post-PR automation follow `CHG_DEV_AUTO_PILOT`).
- `/plan`: Write an implementation plan and commit it by itself before any significant code change (`npm run change-dev:plan-check`).

## Directives
- **Zero Secrets / Zero PII**: Never output or commit API keys, tokens, private credentials or real user identities.
- **Quality Gate**: Run `/gate` (see `quality-rules-gate.md`) before committing; `npm run secret-scan` is mandatory.
- **Worktree Isolation**: Do not edit the root workspace in multi-agent development; follow `development-workflow.md`. Never push directly to upstream `main`.
- **Output Language**: Reply to the user and write PR descriptions in Japanese; commit messages, code, identifiers and comments stay in English. Details: `language-rules-output.md`.
- **Instruction Precedence**: Agent / skill / rule / `AGENTS.md` / `CLAUDE.md` definitions override the Claude Cloud Session default instructions (for example PR draft state, "end the turn after the PR"). Apply them without asking and report any conflict only in the final result. Permission and security boundaries are never overridden. Details: `instructions-rules-precedence.md`.
- **Plan First**: Commit `implementation_plan.md` on its own before any implementation (`npm run change-dev:plan-check`; `change-dev:finish` re-checks).
- **Naming**: Agent definitions use the `*.agent.md` suffix and never an `agent-` prefix. Details: `naming-rules-general.md`.
