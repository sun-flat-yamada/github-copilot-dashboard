---
title: "Gemini / Antigravity Configuration for github-copilot-dashboard"
description: "Context rules, command shortcuts and directives for Gemini CLI and Antigravity."
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

# Project Guardrails & Instructions for AI Agents (Antigravity / Gemini)

Welcome to `github-copilot-dashboard`. All AI coding assistants (Antigravity, Gemini, Claude Code, Cursor, Copilot Workspace) must follow these directives. Detailed rules are imported from `.agents/rules/`.

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
- `/plan`: Write an implementation plan before any significant code change.

## Directives
- **Zero Secrets / Zero PII**: Never output or commit real API tokens or real user identities; user mappings are injected via `COPILOT_USER_MAPPING`.
- **Fork-Safe Storage**: Metric/seat data lives only in the `copilot-data` orphan branch; upstream `main` stays 100% clean code.
- **SDD**: Align architectural decisions with `docs/specifications/` and update them in tandem.
- **Quality Gate**: Run `/gate` before proposing changes.
- **Output Language**: Reply and write PR descriptions in Japanese; commits, code and comments in English.
- **Naming**: `*.agent.md` suffix for agent definitions; no `agent-` prefix.
