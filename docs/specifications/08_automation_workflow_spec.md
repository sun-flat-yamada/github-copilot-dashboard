[English](08_automation_workflow_spec.md) | [日本語](08_automation_workflow_spec.ja.md)

---

# SDD-08: Automation & CI/CD Workflow Specification

- **Document ID**: SPEC-COPILOT-008
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-10

---

## 1. Workflow Definitions

| Workflow Name | Trigger | Core Responsibilities |
|---|---|---|
| `copilot-analysis-cron.yml` | Scheduled (Daily UTC 00:00) / Manual (`workflow_dispatch`) | 1. Fetch latest API data<br>2. Inject mapping via Attribute Resolver<br>3. Multidimensional aggregation & billing calculation<br>4. Append commit to `copilot-data` branch<br>5. Build SPA and deploy to GitHub Pages |
| `test-and-preview.yml` | Pull Request / Push to `main` | TypeScript typecheck, unit tests, and build verification using mock datasets |

---

## 2. Required GitHub Actions Secrets & Variables

### 2.1 Secrets
- `COPILOT_READ_TOKEN`:
  - Personal Access Token (PAT) or GitHub App with administrative read permissions for GitHub Enterprise or target Organizations.
  - *Note*: Optional when running in mock mode (`MOCK_MODE=true`).

#### 2.1.1 Token Types and Permissions

Based on current GitHub specifications, you can use either a **Fine-grained Personal Access Token (recommended)** or a **Personal Access Token (classic)**.

##### A. Fine-grained Personal Access Token (Recommended / Least Privilege)
Enforces least privilege and is the most secure method.

1. **Navigation**: `Settings` > `Developer settings` > `Personal access tokens` > `Fine-grained tokens` > **Generate new token**
2. **Resource owner**: ⚠️ **Must select the target Organization, NOT your personal user account** (if personal account is selected, Organization Permissions will not be available).
3. **Repository access**: `Only select repositories` (or `Public Repositories (read-only)`). Source code permissions are not required.
4. **Organization permissions**:
   | Permission | Access Level | Purpose |
   | :--- | :--- | :--- |
   | **Copilot metrics** | **Read-only** | Daily code completions, chat events, and multi-model usage metrics |
   | **Members** | **Read-only** | Seat assignment list (`seats`) and activity timestamps |
   | **Organization administration** | **Read-only** | Organization metadata and status inspection (optional) |

##### B. Personal Access Token (classic)
1. **Navigation**: `Settings` > `Developer settings` > `Personal access tokens` > `Tokens (classic)` > **Generate new token (classic)**
2. **Select scopes**:
   | Scope | Purpose |
   | :--- | :--- |
   | **`manage_billing:copilot`** | Read Copilot usage, seat assignments, and billing data |
   | **`read:org`** | Read organization membership and member profiles |
   | **`read:enterprise`** | Enterprise environments only: Read enterprise billing and cost centers |

---

#### 2.1.2 Important Notes for Personal Free Accounts

When setting up or analyzing GitHub Copilot from a personal GitHub account (Free plan), keep in mind the following API constraints:

> [!WARNING]
> **No Metrics API exists for individual personal accounts (Copilot Individual / Free)**  
> The official GitHub Copilot Metrics API (`/copilot/metrics`) and Seats API (`/copilot/billing/seats`) are designed exclusively for **GitHub Organizations (Copilot Business)** and **GitHub Enterprises (Copilot Enterprise)**. There is no individual-level endpoint such as `/user/copilot/metrics`.

To analyze or evaluate this dashboard with a personal Free account:

1. **Create a Free GitHub Organization (Real Data Evaluation)**:
   - Create a free GitHub Organization under your personal account and link Copilot to it.
   - Follow section "2.1.1 A" above: create a Fine-grained PAT with the **Resource owner set to the Organization**, register it under Secrets as `COPILOT_READ_TOKEN`, and configure Variables with `COPILOT_ORGS=<org-name>`.
2. **Use Mock Mode (Zero-Cost Simulation / No Tokens Needed)**:
   - Without any token, simply set `MOCK_MODE=true` in GitHub Actions Variables.
   - All dashboard features (Claude 3.7 Sonnet, GPT-4o, Gemini 2.0 Flash trends, 38-model radar benchmark, FinOps cost allocation) will function immediately and deploy to GitHub Pages.

### 2.2 Variables
- `COPILOT_USER_MAPPING`:
  - JSON array string defining usernames, display names, departments, and cost center overrides.
  - Never committed to Git; configured via repository settings (**Settings** > **Secrets and variables** > **Actions** > **Variables**).
- `COPILOT_ENTERPRISE`: Enterprise slug (for enterprise-wide aggregation).
- `COPILOT_ORGS`: Comma-separated list of organization slugs (for multi-org setups).
- `MOCK_MODE`: Set to `true` to run pipelines using simulation data without live API tokens.

---

## 3. Automated Deployment & Permission Configuration (GitHub Pages)

In repository settings, configure GitHub Pages deployment source to **"GitHub Actions"**.

```yaml
permissions:
  contents: write      # Required for committing data to copilot-data branch
  pages: write         # Required for deploying to GitHub Pages
  id-token: write      # Required for GitHub Pages OIDC authentication
```

### Execution Steps:
1. Checkout repository (`main`).
2. Setup Node.js 20 & install dependencies (`npm ci`).
3. Fetch `copilot-data` branch history.
4. Execute data pipeline runner (`npm run pipeline:run`).
5. Push newly generated data files to `copilot-data` branch.
6. Build SPA dashboard (`npm run build`).
7. Upload static deployment artifact via `actions/upload-pages-artifact@v3`.
8. Publish to GitHub Pages via `actions/deploy-pages@v4`.
