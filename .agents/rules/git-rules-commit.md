---
title: "Git Commit & Branch Rules"
description: "Conventional Commits, branch naming and pre-commit verification."
category: "rules"
type: "specification"
status: "active"
date: 2026-10-03
updated: 2026-10-03
lang: "en"
tags:
  - "rules"
  - "git"
  - "commits"
alwaysApply: true
---

# Git Commit & Branching Rules (`git-rules-commit`)

## 1. Conventional Commits
```text
<type>(<optional-scope>): <short imperative description>

[optional body: motivation and trade-offs]

[optional footer(s): Closes #123, BREAKING CHANGE: ...]
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## 2. Branch Naming
- `feat/<short-description>`, `fix/<short-description>`, `docs/<short-description>`, `refactor/<short-description>`, `chore/<short-description>`.
- Kebab-case only. Sibling worktrees live at `../<repo>-worktrees/<branch>` (see `development-workflow.md`).
- Direct commits/pushes to `main` on upstream are forbidden (see `development-workflow.md`).

## 3. Language of Commits and Pull Requests
See [`language-rules-output.md`](language-rules-output.md): commit messages in English, PR titles keep the English Conventional Commits prefix, PR descriptions in Japanese.

## 4. Pre-Commit Verification
Before committing, run the quality gate defined in [`quality-rules-gate.md`](quality-rules-gate.md). `npm run secret-scan` is mandatory.
