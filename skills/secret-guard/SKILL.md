---
name: secret-guard
description: Perform comprehensive security audit and self-review to detect and eliminate secrets, API keys, credentials, and internal PII from source files and git commits.
---

# 🛡️ Secret Guard & Privacy Audit Skill

Use this skill when auditing changes, reviewing PRs, or verifying that no credentials, tokens, or PII are exposed in the repository.

---

## Audit Workflow

### 1. Automated Secret Scan
Run the built-in multi-layered scanner:
```bash
npm run secret-scan
```
- **Exit code 0**: Repository is clean of known secret patterns and high-entropy anomalies.
- **Exit code 1**: Critical findings detected. Read the output report, locate the file and line, and remediate immediately.

### 2. Git Staging Hygiene Check
Inspect the current git status to confirm no ignored or sensitive files were accidentally staged:
```bash
git status -s
```
Ensure **NONE** of the following appear as tracked or untracked:
- `.env*` (except `.env.example`)
- `data/` or `dashboard/public/data/`
- Any `*.pem`, `*.key`, `*.json` containing real employee names or API tokens

### 3. Diff Inspection for High-Risk Patterns
If performing a git commit or review, run:
```bash
git diff --cached
```
Check for:
1. Hardcoded bearer tokens, passwords, or hashes.
2. Production URLs with embedded credentials (`https://user:pass@host`).
3. Real internal employee email addresses or org hierarchy in code/test mocks.

### 4. Remediation Steps
If a secret or PII was accidentally written:
1. Replace with a standard mocked placeholder:
   - GitHub PAT: `ghp_mocktoken00000000000000000000000000`
   - Secret Key: `mock_secret_key_0000000000000000000`
   - User Email: `developer@example.com`
2. If the secret was already committed to local git history, unstage/reset and prune it before pushing.
3. If a real credential was exposed to any remote, revoke and rotate the credential immediately.
