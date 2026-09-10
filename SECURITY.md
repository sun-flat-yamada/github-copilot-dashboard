# Security Policy

## Supported Versions

| Version | Supported          | Security Fixes |
| ------- | ------------------ | -------------- |
| 1.x (2026.09 LTS) | :white_check_mark: | Active         |
| < 1.0.0 | :x:                | End of Life    |

---

## Reporting a Vulnerability

We take the security and privacy of **github-copilot-dashboard** very seriously.

If you believe you have discovered a security vulnerability or credential leak issue in this repository:

1. **DO NOT** create a public GitHub Issue.
2. Please report the security concern via **GitHub Private Vulnerability Reporting** by navigating to the **Security** tab of this repository and clicking **Report a vulnerability**.
3. Alternatively, contact the maintainers directly via security advisory channels.

### Information to Include
- Detailed steps to reproduce the issue.
- Impact assessment (e.g., potential unauthorized access, data leakage).
- Remediation suggestions or proof of concept (if available).

We will acknowledge receipt of your vulnerability report within 48 hours and provide a timeline for resolution.

---

## Security Best Practices for Deployments

1. **User Attribute Mapping (`COPILOT_USER_MAPPING`)**:
   - Never commit user mapping tables, personal names, or corporate organizational charts directly into the Git repository.
   - Always configure them via **GitHub Actions Repository Variables** (`VARS.COPILOT_USER_MAPPING`) or **Secrets** (`SECRETS.COPILOT_USER_MAPPING`).
2. **Access Tokens (`COPILOT_READ_TOKEN`)**:
   - Use Fine-grained Personal Access Tokens (PAT) or GitHub Apps with minimal required permissions (`copilot:read`, `billing:read`).
   - Rotate access tokens on a regular schedule.
3. **GitHub Pages Visibility**:
   - For enterprise use, ensure your repository and its associated GitHub Pages are configured as **Private Pages** within GitHub Enterprise Cloud / Server if internal user names or metrics should not be publicly accessible.

---

## Multi-Layered Secret & PII Protection Architecture (Defense-in-Depth)

This repository implements a 4-layered defense-in-depth security model based on industry best practices (GitHub Secret Scanning, Google Antigravity Agent Rules, GitGuardian, OWASP API Security):

1. **Layer 1: Agent Guardrails & Behavioral Rules (`.agents/rules/`, `GEMINI.md`, `AGENTS.md`)**:
   - Autonomous AI coding assistants are bound by always-on directives prohibiting hardcoded secrets, API tokens, and internal PII in code and chat context.
2. **Layer 2: Local & Git Exclusion Hygiene (`.gitignore`)**:
   - Comprehensive OWASP-compliant exclusion covering private keys (`*.pem`, `id_rsa`), certificates, cloud credentials (`.aws/`, `.gcp/`), `.env*`, and vault dumps.
3. **Layer 3: Autonomous Agent Audit Skill (`skills/secret-guard/`) & Local Scanner (`npm run secret-scan`)**:
   - High-performance regex and pattern scanner (`scripts/scan-secrets.ts`) that verifies 0 violations before any commit or PR.
4. **Layer 4: Automated CI/CD Enforcement (`.github/workflows/secret-scan.yml`)**:
   - Dual-engine scanning (Built-in scanner + Gitleaks Action) running on every pull request and push to enforce zero-leakage branch protection.
