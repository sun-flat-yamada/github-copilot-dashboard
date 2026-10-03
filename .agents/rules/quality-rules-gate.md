---
title: "Quality Gate Rules"
description: "Mandatory verification gate and specification-driven development alignment."
category: "rules"
type: "specification"
status: "active"
date: 2026-10-03
updated: 2026-10-03
lang: "en"
tags:
  - "rules"
  - "quality"
  - "sdd"
alwaysApply: true
---

# Quality Gate Rules (`quality-rules-gate`)

## 1. Mandatory Gate
Every change must pass cleanly before commit/PR:

```bash
npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build
```

`npm run secret-scan` must always be run before committing or finalizing changes.

## 2. Specification-Driven Development (SDD)
- Architectural decisions and features must align with `docs/specifications/`.
- When requirements change, update the relevant SDD document in the same change.
