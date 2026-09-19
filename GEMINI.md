# Project Guardrails & Instructions for AI Agents (Antigravity / Gemini)

Welcome to `github-copilot-dashboard`.
All AI coding assistants (Antigravity, Gemini, Claude Code, Cursor, Copilot Workspace) working in this repository must strictly follow these core directives:

---

## 🔒 1. Strict Security & Zero-Leakage Policy
- **NO Hardcoded Secrets**: Under no circumstances should real API tokens (GitHub PATs, AWS/GCP keys, OpenAI/Anthropic keys) be added to any file or output in chat logs.
- **NO PII Leakage**: Real employee identities, emails, or internal organization charts must not be committed to Git. All user mappings are dynamically injected via `COPILOT_USER_MAPPING` in GitHub Secrets/Variables.
- **Pre-Commit Verification**: Run `npm run secret-scan` before proposing any changes. Any scan failure must be fixed immediately.

---

## 🌿 2. Fork-Safe Storage Architecture
- **Data Isolation**: Never commit metric or seat data to `main`. Data lives exclusively in the `copilot-data` orphan branch.
- **Zero Conflicts**: Upstream `main` must remain 100% clean code so downstream forks can run `Sync Fork` without merge conflicts.

---

## 📐 3. Specification-Driven Development (SDD)
- All architectural decisions and features must align with specifications under `docs/specifications/`.
- If requirements change, update the relevant SDD document in tandem.

---

## 🧪 4. Quality Standard
- Every pull request must pass:
  - `npm run fork:verify`
  - `npm run typecheck`
  - `npm test`
  - `npm run secret-scan`
  - `npm run build`

---

## 🔄 5. Multi-Agent Worktree & Change Workflow
- **Multi-Agent Isolation**: Never edit directly on the root workspace. Always provision an isolated sibling worktree (`../github-copilot-dashboard-worktrees/<branch>`) to prevent concurrency race conditions.
- **Strict Lifecycle**: `Issue -> Sibling Worktree -> Local Quality Gate -> PR -> Rebase Merge -> Clean`.
- **Permission Boundary**: Direct commits/pushes to `main` are strictly forbidden on upstream (`sun-flat-yamada`). On downstream forks, direct commits are permitted when operationally necessary.
- **Reference**: See `.agents/rules/development-workflow.md` and `docs/specifications/14_development_workflow_and_git_ops_spec.md`.

---

## 🎯 6. Antigravity Two-Phase Governance & Deterministic Proceed Button
- **Two-Phase Enforcement**: For non-trivial code modifications in Google Antigravity, agents must execute the two-phase consensus: `Pre-Execution Plan Consensus -> Post-Execution Walkthrough Sealing`.
- **4 Golden Rules for Proceed Button**: When generating `implementation_plan.md`, agents **MUST 100% strictly comply** with the following to guarantee the Antigravity UI parser renders the `[Proceed]` button:
  1. **Canonical brain Path**: `<appDataDir>\brain\<conversation-id>/implementation_plan.md`.
  2. **Canonical English Headings**: Retain exact English headings (`# [Goal Description]`, `## User Review Required`, `## Open Questions`, `## Proposed Changes`, `## Verification Plan`, etc.). Never translate into Japanese or substitute with custom heading phrases.
  3. **ArtifactMetadata**: Always set `RequestFeedback: true`, `UserFacing: true`, and `Summary`. Never invoke `ask_question` concurrently.
  4. **Zero Code Edits, Official File Links & Immediate Turn End**: Never edit source code in the planning turn (`modifiedFileUris === 0` required by UI engine). Provide clickable `file:///` links for instant user review. Note that `[Proceed]` renders inside the artifact card. Conclude turn immediately without further tool calls.
- **Reference**: Follow [.agents/skills/antigravity-two-phase-governance/SKILL.md](.agents/skills/antigravity-two-phase-governance/SKILL.md).

