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
  - Personal Access Token (PAT) or GitHub App Private Key with administrative read permissions for GitHub Enterprise or target Organizations.
  - Required Scopes:
    - Enterprise / Org: `Manage Copilot` (read)
    - Enterprise: `Billing` (read)
    - Org: `Members` (read)
  - *Note*: Optional when running in mock mode (`MOCK_MODE=true`).

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
