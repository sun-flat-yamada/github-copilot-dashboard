---
name: security-zero-leakage
description: Enforce zero-leakage security guardrails preventing AI agents from outputting or committing secrets, credentials, and internal PII.
trigger: always_on
---

# 🔒 Security & Zero-Leakage Policy for AI Agents

You are pair programming in an enterprise-grade repository with strict security, privacy, and compliance requirements.
All AI agents operating in this workspace **MUST** adhere to the following non-negotiable rules.

---

## 1. Zero Secrets in Source Code & Artifacts

1. **NEVER Hardcode Real Secrets**:
   - Do NOT write or commit any real API keys, Personal Access Tokens (PAT), passwords, SSH keys, TLS private certificates, or cloud service account keys.
   - Prohibited patterns include GitHub tokens (`ghp_`, `github_pat_`, `gho_`), AWS keys (`AKIA...`), OpenAI (`sk-...`), Anthropic (`sk-ant-...`), Google API keys (`AIza...`), Slack webhooks, and private key headers (`BEGIN PRIVATE KEY`).
2. **Mock & Testing Credentials**:
   - If mock tokens or test data are required, you **MUST** use explicitly fake placeholders (e.g., `ghp_mocktoken00000000000000000000000000`, `sk-mock-00000000000000000000000000000000`).
   - Never use strings that resemble real entropy tokens.
3. **Safe Credentials Protocol**:
   - Never print `.env` or secret files to stdout or read full `.env` files into LLM context.
   - Use `grep -sq` to check presence only without outputting the value.

---

## 2. Zero PII Leakage (User Attribute Mapping)

1. **User Identity Isolation**:
   - Real employee names, internal departments, personal email addresses, and organizational structures **MUST NEVER** be committed to the Git repository.
   - All mapping between GitHub logins and internal identities must be supplied dynamically via environment variables (`COPILOT_USER_MAPPING`) stored in GitHub Actions Secrets/Variables.
2. **Commit Sanitization**:
   - Before executing any `git commit`, `git add`, or editing files intended for version control, ensure that no local `user_mapping.json`, `.env`, or real user data is tracked or included in diffs.

---

## 3. Storage & Branch Isolation (Fork-Safe)

1. **Data Files in Main Branch Prohibited**:
   - Never commit raw or processed metric data files (`data/raw/`, `data/processed/`, `index.json`) to the `main` branch.
   - All data persistence must be directed to the dedicated orphan branch (`copilot-data`) using isolated temporary work directories.

---

## 4. Mandatory Pre-Commit / Pre-PR Self-Review

Before concluding any implementation or proposing commits:
1. Run the local automated secret scanner:
   ```bash
   npm run secret-scan
   ```
2. Verify that the scan exits with code `0` (Clean).
3. If any secret or suspicious high-entropy string is flagged, remediate it immediately before presenting your response to the user.
