---
title: "AI Agent Instructions & Security Guidelines"
description: "Cross-tool summary of mandatory rules for autonomous AI agents; detailed rules live in .agents/rules/."
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

# AI Agents Instruction & Security Guidelines (AGENTS.md)

This repository enforces strict security and zero-leakage standards for all autonomous AI agents. Each rule below is a summary; the **authoritative text lives in `.agents/rules/`**.

## Core Rules
1. **Never Commit Secrets**: Any API key, token (`ghp_`, `AKIA`, `sk-`), private key, or password must not be written into source files. → [`security-zero-leakage.md`](.agents/rules/security-zero-leakage.md)
2. **Zero PII**: Do not write real user names, emails, or internal department structures into files. Use `COPILOT_USER_MAPPING` via environment variables. → [`security-zero-leakage.md`](.agents/rules/security-zero-leakage.md)
3. **Run Secret Scan**: Always run `npm run secret-scan` before committing or finalizing changes. → [`quality-rules-gate.md`](.agents/rules/quality-rules-gate.md)
4. **Data Isolation**: Never place data files into `main` branch. Maintain fork-isolation on `copilot-data`. Verify with `npm run fork:verify`. → [`storage-and-data-routing.md`](.agents/rules/storage-and-data-routing.md)
5. **Quality Gate**: `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` must pass cleanly. → [`quality-rules-gate.md`](.agents/rules/quality-rules-gate.md)
6. **Change Workflow & Worktree Isolation**: Never edit directly on the root workspace; use a sibling worktree (`../<repo>-worktrees/<branch>`). Lifecycle: `Issue -> Sibling Worktree -> Quality Gate -> PR -> Rebase Merge`. Direct push to upstream `main` is strictly forbidden. Auto-Pilot (`CHG_DEV_AUTO_PILOT=true`, enabled in this repo) automates post-PR approval/Rebase Merge without bypassing branch protection. → [`development-workflow.md`](.agents/rules/development-workflow.md), `docs/specifications/14_development_workflow_and_git_ops_spec.md`
7. **Data Routing & Staging Convention**: Persistent storage (`copilot-data` with `processed/`) differs from SPA distribution (`dashboard/public/data/` flat root). In CI, stage root metadata and unnest `processed/*` to the public root. In frontend fetches, use `resolveDataPath` and `getCandidateDataUrls`. → [`storage-and-data-routing.md`](.agents/rules/storage-and-data-routing.md), SDD-05 Section 2.2
8. **Model & Benchmark Dual-Sync**: Keep `supported_models.md` in sync with `scripts/update-benchmarks.ts` and `dashboard/src/data/models.ts`. → [`model-benchmark-management.md`](.agents/rules/model-benchmark-management.md)
9. **Git & Language Conventions**: Conventional Commits and branch naming ([`git-rules-commit.md`](.agents/rules/git-rules-commit.md)); reply and PR descriptions in Japanese, commits/code/comments in English ([`language-rules-output.md`](.agents/rules/language-rules-output.md)); file naming ([`naming-rules-general.md`](.agents/rules/naming-rules-general.md)).
