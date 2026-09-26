# 🚀 Complete Setup & Configuration Guide

[English](setup_guide.md) | [日本語](setup_guide.ja.md)

This comprehensive guide details how to install, configure, and operate **github-copilot-dashboard** in enterprise environments, including privacy-preserving user mappings, encryption workflows, authentication modes, and upstream synchronization.

---

## 📑 Table of Contents

1. [Prerequisites & Repository Setup](#1-prerequisites--repository-setup)
2. [GitHub Pages Zero-Cost Hosting](#2-github-pages-zero-cost-hosting)
3. [Workflow Permissions](#3-workflow-permissions)
4. [User Attribute Mapping Configuration](#4-user-attribute-mapping-configuration)
   - [Standard JSON Format](#standard-json-format)
   - [Flat CSV Format](#flat-csv-format)
   - [GPG Encryption & Payloads > 48KB](#gpg-encryption--payloads--48kb)
5. [Currency Display & Enterprise Billing Configuration (EA Contract / AI Credits)](#5-currency-display--enterprise-billing-configuration-ea-contract--ai-credits)
   - [Permanent USD Primary Display with Optional Sub-Currency](#permanent-usd-primary-display-with-optional-sub-currency)
   - [COPILOT_BILLING_CONFIG Setup](#copilot_billing_config-setup)
   - [Parameters & EA Contract Pricing Overrides](#parameters--ea-contract-pricing-overrides)
6. [Authentication & Ingestion Scopes](#6-authentication--ingestion-scopes)
   - [Fine-grained PAT Setup](#fine-grained-pat-setup)
   - [Enterprise vs. Organization Scope](#enterprise-vs-organization-scope)
   - [Mock Mode & Graceful Credentials](#mock-mode--graceful-credentials)
7. [Upstream Synchronization & Fork Maintenance](#7-upstream-synchronization--fork-maintenance)
8. [Operational Troubleshooting](#8-operational-troubleshooting)

---

## 1. Prerequisites & Repository Setup

### Option A: Standard GitHub Fork (Recommended)
Fork this repository directly into your enterprise organization:
1. Click the **Fork** button on the GitHub repository page.
2. Select your target enterprise organization and set the repository name.

### Option B: Fork-Restricted / EMU Mirror Duplication
If your enterprise uses Enterprise Managed Users (EMU) or organization policies restrict cross-organization forking:
- Follow the mirror-based procedure detailed in [SDD-13: Fork-Restricted Environment Setup Guide](specifications/13_fork_restricted_environment_setup_guide.md).

---

## 2. GitHub Pages Zero-Cost Hosting

1. In your repository, go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, choose **"GitHub Actions"**.
3. No static hosting server or Cloud infrastructure is needed; deployment is managed completely via `.github/workflows/copilot-analysis-cron.yml`.

---

## 3. Workflow Permissions

1. Navigate to **Settings** > **Actions** > **General**.
2. Under **Workflow permissions**, select **"Read and write permissions"**.
3. Check the option **"Allow GitHub Actions to create and approve pull requests"**.
4. Click **Save**.

---

## 4. User Attribute Mapping Configuration

The user attribute mapping connects GitHub logins to internal employee identities, departments, and custom cost centers without committing any personal identifiable information (PII) to Git history.

### Standard JSON Format
Set a GitHub Actions Variable or Secret named `COPILOT_USER_MAPPING`:

```json
[
  {
    "github_user": "octocat-lead",
    "display_name": "Taro Tanaka",
    "department": "Platform Engineering",
    "cost_center_override": "FinTech-Division",
    "notes": "Full-time / Lead"
  },
  {
    "github_user": "alice-dev",
    "display_name": "Alice Rivera",
    "department": "AI Applications",
    "cost_center_override": "Research-and-AI",
    "notes": "Contractor"
  }
]
```

### Flat CSV Format
Alternatively, you can provide the mapping in CSV format:

```csv
github_user,display_name,department,cost_center_override,notes
octocat-lead,Taro Tanaka,Platform Engineering,FinTech-Division,Full-time / Lead
alice-dev,Alice Rivera,AI Applications,Research-and-AI,Contractor
```

### GPG Encryption & Payloads > 48KB
GitHub Actions variables and secrets have a strict 48KB payload limit. For large enterprises with thousands of users:
1. Encrypt your local mapping file using the built-in CLI:
   ```bash
   # Interactive passphrase prompt:
   npm run mapping:encrypt -- --in local_mapping.json --out mapping.enc.json

   # Or using CI/CD passphrase environment variable:
   MAPPING_PASSPHRASE="your-secure-passphrase" npm run mapping:encrypt -- --in local_mapping.json --passphrase-env MAPPING_PASSPHRASE
   ```
2. Store the encrypted JSON or commit it to the isolated `copilot-data` branch.
3. Configure `MAPPING_PASSPHRASE` as a GitHub Secret for automatic decryption at pipeline execution time.
4. For complete specifications, refer to [SDD-04: User Attribute Mapping Specification](specifications/04_user_attribute_mapping_spec.md).

---

## 5. Currency Display & Enterprise Billing Configuration (EA Contract / AI Credits)

This dashboard adheres to global FinOps best practices by enforcing **permanent USD ($) primary display** while providing **optional secondary sub-currency display** (e.g. JPY `¥`, EUR `€`) tailored to your organization.

### Permanent USD Primary Display with Optional Sub-Currency
- **USD ($) is ALWAYS displayed as the primary currency** across all 9 analysis views, KPI summary cards, cost allocation charts, budget cards, and user detail tables.
- When a sub-currency is configured or selected, the localized secondary amount is appended in parentheses (e.g., `$2,975.00 (¥461,125)` or `$0.010 / AIC (¥1.273 / AIC)`).
- Viewers can dynamically switch the secondary sub-currency (USD Only / USD + JPY / USD + EUR) using the Currency Selector in the header, with preferences preserved in browser `localStorage`.

### COPILOT_BILLING_CONFIG Setup
Configure the environment variable under **Settings** > **Secrets and variables** > **Actions** > **Variables** (or Secrets) as `COPILOT_BILLING_CONFIG`, or place a static config file at `data/config/billing.json`:

```json
{
  "subCurrency": {
    "code": "JPY",
    "symbol": "¥",
    "exchangeRateFromUSD": 155.0,
    "displayDecimals": 0
  },
  "discountPercent": 15,
  "customPricePerCredit": 1.273,
  "customSeatPricing": {
    "enterpriseMonthly": 5000
  }
}
```

### Parameters & EA Contract Pricing Overrides
| Parameter | Type | Default | Description |
|---|---|---|---|
| `subCurrency` | `object` | `null` | Secondary sub-currency configuration (`code`: 'JPY', `symbol`: '¥', `exchangeRateFromUSD`: 155.0, `displayDecimals`: 0) |
| `discountPercent` | `number` | `0` | Enterprise Agreement (EA) volume discount percentage (0 to 100%) |
| `customPricePerCredit` | `number` | undefined | Direct contractual unit price per AI Credit in sub-currency (e.g., 1.273 JPY/AIC). Takes precedence over discount calculation. |
| `customSeatPricing` | `object` | undefined | Fixed contractual seat price overrides (`businessMonthly`, `enterpriseMonthly`) |
| `seatPricing` | `object` | 19 / 39 USD | Standard base seat list prices in USD |
| `creditsPricing` | `object` | 0.01 USD | Standard base AI Credit list price in USD per AIC |

---

## 6. Authentication & Ingestion Scopes

### Fine-grained PAT Setup
Generate a Personal Access Token (PAT) with the following scopes and register it as secret `COPILOT_READ_TOKEN`:
- `manage_billing:copilot` (or Copilot Business/Enterprise Read access)
- `read:org`

### Enterprise vs. Organization Scope
Configure either variable under **Settings** > **Secrets and variables** > **Actions** > **Variables**:
- `COPILOT_ENTERPRISE`: Set to your Enterprise slug (e.g. `my-enterprise-slug`).
- `COPILOT_ORGS`: Or specify a comma-separated list of organization names (e.g. `org-core,org-ai-labs`).

### Mock Mode & DEMO Data Setup for Forks
- **Instant DEMO Data Setup for Downstream Forks**: If you forked the repository with GitHub's default setting ("Copy the main branch only"), your fork will not initially include the `copilot-data` orphan branch. You can import the full 2026 LTS Live Metrics DEMO dataset with a single command:
  ```bash
  # Fetch and unpack DEMO data from upstream copilot-data
  npm run demo:setup

  # If you want to seed your fork's remote GitHub Pages / Actions with DEMO data (--push)
  npm run demo:setup -- --push
  ```
- **Mock Simulation Mode**: Set variable `MOCK_MODE=true` to instantly test and demonstrate dashboard capabilities using 2026 synthetic simulation data.
- **Graceful Degradation**: If Copilot Metrics credentials are temporarily unavailable or permissions are restricted, the pipeline automatically proceeds with seat data or monthly CSV reports without failing the workflow.

---

## 7. Upstream Synchronization & Fork Maintenance

To pull improvements and AI model updates from upstream:

```bash
# 1. Verify fork health and verify zero data contamination
npm run fork:verify

# 2. Fetch and fast-forward from upstream
git fetch upstream main
git merge upstream/main --ff-only

# 3. Verify quality gates
npm ci
npm run typecheck && npm test && npm run secret-scan && npm run build

# 4. Push updates to your fork
git push origin main
```

> [!TIP]
> For advanced multi-team environments with custom frontend styling, refer to the dual-branch strategy (`main` + `fork/custom`) documented in [SDD-12](specifications/12_fork_sync_and_customization_ops_spec.md).

---

## 8. Operational Troubleshooting

- **403 Rate Limit or Permission Denied**: Check the 80%×80% anomaly modal in the dashboard header or export `error-log.json` to inspect the failing API endpoint.
- **Secret Scan Failure**: Run `npm run secret-scan` locally to locate high-entropy strings or hardcoded tokens before committing.
- **Upstream Contribution Leak Check**: Run `npm run upstream:audit` before opening a pull request to upstream to guarantee that no local usage CSV or customer data is included.
