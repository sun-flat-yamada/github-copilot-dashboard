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
   - GitHub Pages sites are **public by default, even when the repository is private** (access-controlled Pages require GitHub Enterprise Cloud). A private repository does not make the dashboard private.
4. **Deployment Premise: Internal Use Only**:
   - This dashboard is designed for a company's **GitHub Enterprise environment**: a **private or internal** repository, **access-controlled GitHub Pages** (GitHub Enterprise Cloud), and **employees only** as viewers. Within that boundary the dashboard shows identified data (real names, departments, per-user usage and diagnostics).
   - **Publishing real data publicly is unsupported.** Never make the repository or the Pages site public once real data is collected. The upstream repository is public but contains demo data only.
   - Everything below explains why this boundary matters and how the automated guard and the optional pseudonymization work.
5. **Public Exposure of Collected Data (the `copilot-data` branch and the Pages site)**:
   - Zero-leakage for `COPILOT_USER_MAPPING` protects the **`main` branch** only. The collected data lives on the **`copilot-data` branch**, and the dashboard publishes a copy of the processed data on **GitHub Pages**. In a **public repository the `copilot-data` branch is public too**, and it holds raw API responses (logins, assignment dates, last activity, Cost Center members) and per-user figures; resolved display names and departments are in the processed data.
   - Therefore the repository **and** the Pages site must be restricted to enterprise members. If either is publicly readable, do not collect real data; fix the visibility. Only if you knowingly accept a wider audience, as an extra measure, publish **pseudonymized data only**: set the variable `ANONYMIZE_USERS=true` and the secret `ANONYMIZE_SECRET` (a random key of at least 16 characters, e.g. `openssl rand -hex 32`). Logins, names, departments, teams and projects are replaced by keyed HMAC-SHA256 pseudonyms; avatar URLs, numeric user IDs and original CSVs are not published; raw seat data and Cost Center members are redacted. Without the key the pseudonyms cannot be reversed by a dictionary of GitHub logins. **If `ANONYMIZE_USERS=true` is set without a valid `ANONYMIZE_SECRET`, the run stops and publishes nothing.** Keep the key secret; rotating it changes every pseudonym (and breaks continuity with what was published before).
   - Pseudonymization is not anonymization in the legal sense: anyone who knows the key (or who can already correlate usage patterns with outside information) may still re-identify people. Treat the key like a credential and decide about publishing personal-level usage with your privacy / works-council stakeholders.
6. **Automated Exposure Check (`npm run fork:verify`)** — the guard for the premise above:
   - Before collecting real data, the scheduled workflow runs `npm run fork:verify`. It makes anonymous requests to the repository API, the raw `copilot-data` branch index and the Pages index, and **fails** when real, non-anonymized user-level data is (or is about to be, with live collection configured) publicly readable. A demo-only repository (for example the upstream project itself) passes.
   - If the probes cannot reach GitHub (offline, rate limited) the check only warns. To knowingly accept a public deployment set the variable `COPILOT_ALLOW_PUBLIC_DATA=true` (the failure is downgraded to a warning). `COPILOT_PAGES_URL` tells the check where a custom-domain site lives.
   - The Pages artifact is also verified before upload (`npm run pages:verify`): only an allow-list of processed files is published, and raw data, original CSVs and the encrypted mapping must never appear in it.

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
