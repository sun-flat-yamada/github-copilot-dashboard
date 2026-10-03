---
title: "Naming Rules"
description: "File and directory naming conventions for agents, rules, skills and docs."
category: "rules"
type: "specification"
status: "active"
date: 2026-10-03
updated: 2026-10-03
lang: "en"
tags:
  - "rules"
  - "naming-conventions"
alwaysApply: true
---

# File & Directory Naming Rules (`naming-rules-general`)

1. **Agent definitions** (`.agents/*.agent.md`): MUST end with `.agent.md`; MUST NEVER use an `agent-` prefix. Lowercase kebab-case name (e.g. `change-dev.agent.md`, `fork-sync.agent.md`).
2. **Rules** (`.agents/rules/`): lowercase kebab-case `.md`. New rules should follow `<category>-rules-<scope>.md` (e.g. `git-rules-commit.md`). Legacy files (`development-workflow.md`, `model-benchmark-management.md`, `security-zero-leakage.md`, `storage-and-data-routing.md`) keep their names to avoid breaking references.
3. **Skills** (`.agents/skills/<name>/SKILL.md`): lowercase kebab-case directory with a `SKILL.md` entrypoint.
4. **Branches**: see `git-rules-commit.md`.

## Frontmatter Convention
Every Markdown file under `.agents/rules/` and the root agent instruction files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) carries YAML frontmatter:

```yaml
---
title: "..."
description: "..."
category: "rules"      # rules | meta
type: "specification"  # specification | configuration
status: "active"
date: YYYY-MM-DD
updated: YYYY-MM-DD    # bump on every substantive edit
lang: "en"
tags:
  - "..."
---
```
