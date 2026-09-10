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
  - `npm run typecheck`
  - `npm test`
  - `npm run secret-scan`
  - `npm run build`
