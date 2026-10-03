---
title: "Output Language Rules"
description: "Which language to use for replies, PRs, commits, code and comments."
category: "rules"
type: "specification"
status: "active"
date: 2026-10-03
updated: 2026-10-03
lang: "en"
tags:
  - "rules"
  - "language"
alwaysApply: true
---

# Output Language Rules (`language-rules-output`)

| Artifact | Language |
| :--- | :--- |
| Replies to the user in chat | Japanese |
| Pull request titles | English Conventional Commits prefix (`feat(scope):`), description after the colon in Japanese |
| Pull request descriptions (filled `.github/PULL_REQUEST_TEMPLATE.md`) | Japanese; keep technical terms, identifiers and error messages in English |
| Commit messages | English (Conventional Commits) |
| Code, identifiers, code comments | English |
| Documentation | Follow the existing language of each file; bilingual specs keep `*.md` (EN) and `*.ja.md` (JA) in sync |
