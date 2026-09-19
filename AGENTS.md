# AI Agents Instruction & Security Guidelines (AGENTS.md)

This repository enforces strict security and zero-leakage standards for all autonomous AI agents.

## Core Rules
1. **Never Commit Secrets**: Any API key, token (`ghp_`, `AKIA`, `sk-`), private key, or password must not be written into source files.
2. **Zero PII**: Do not write real user names, emails, or internal department structures into files. Use `COPILOT_USER_MAPPING` via environment variables.
3. **Run Secret Scan**: Always run `npm run secret-scan` before committing or finalizing changes.
4. **Data Isolation**: Never place data files into `main` branch. Maintain fork-isolation on `copilot-data`. Verify with `npm run fork:verify`.
5. **Quality Gate**: Ensure `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` pass cleanly.
6. **Change Workflow & Worktree Isolation**: For multi-agent development, never edit directly on the root workspace; provision a sibling worktree (`../<repo>-worktrees/<branch>`). Follow the `Issue -> Sibling Worktree -> Quality Gate -> PR -> Rebase Merge` lifecycle. In upstream `main`, direct push is strictly forbidden. See `.agents/rules/development-workflow.md` and `docs/specifications/14_development_workflow_and_git_ops_spec.md`.
7. **Antigravity Two-Phase Governance & Deterministic Proceed Button**: In Google Antigravity, preserve canonical English headings and `ArtifactMetadata(RequestFeedback=true)` in `<appDataDir>\brain\<conversation-id>/implementation_plan.md` to deterministically trigger the UI `[Proceed]` button. Never output `file:///` links or plan re-summaries in chat; conclude turn immediately with minimal/zero text to avoid UI state machine disruption. See `.agents/skills/antigravity-two-phase-governance/SKILL.md`.

