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

### Deployment premise: internal use only (repository / Pages visibility)
This dashboard is for a company's **GitHub Enterprise environment** and is viewed **only by its employees** (identified display of names, departments and per-user usage is allowed). Before enabling real-data collection, make sure only enterprise members can read the result:
- Use a **private or internal** repository, and set the Pages site to **access-controlled** (GitHub Enterprise Cloud). Collect the **Enterprise and its Organizations together** (`COPILOT_ENTERPRISE` and `COPILOT_ORGS`).
- A **public repository** also publishes its **`copilot-data` branch** (raw API responses, per-user figures, resolved names and departments).
- A **GitHub Pages site is public by default, even for a private repository** (access-controlled Pages need GitHub Enterprise Cloud).
- Public deployment of real data is **unsupported**. As an optional extra measure you can publish pseudonymized data: set the variable `ANONYMIZE_USERS=true` and the secret `ANONYMIZE_SECRET` (a random key of at least 16 characters, e.g. `openssl rand -hex 32`); with `ANONYMIZE_USERS=true` and no valid key the run stops without publishing anything.
- The scheduled workflow runs `npm run fork:verify` before collecting; it **fails** when real, non-anonymized user-level data is (or would be) publicly readable. Set `COPILOT_PAGES_URL` if the site is served from a custom domain, and `COPILOT_ALLOW_PUBLIC_DATA=true` only if you knowingly accept a public deployment. See [SECURITY.md](../SECURITY.md) and [SDD-04 §5](specifications/04_user_attribute_mapping_spec.md).

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
- Viewers can dynamically switch the secondary sub-currency (USD Only / USD + EA-USD / USD + EA-JPY / USD + EA-EUR) using the Currency Selector in the header, with preferences preserved in browser `localStorage`.

### 5.1 Configuration Placement & Priority
You can configure billing and currency settings via either environment variable or static configuration file. If both are defined, **GitHub Actions Variable / Secret (`COPILOT_BILLING_CONFIG`) takes precedence**:

1. **GitHub Actions Variable / Secret (Recommended for CI/CD)**:
   - **Settings** > **Secrets and variables** > **Actions** > **Variables** (or Secrets).
   - Variable Name: `COPILOT_BILLING_CONFIG`
   - Value: Minified or formatted JSON string.
2. **Static Configuration File (For local development or dedicated branch)**:
   - File Path: `data/config/billing.json` (or refer to `examples/config/billing.example.json` template)
   - When running locally or during pipeline build, the loader automatically searches `data/config/billing.json` if `COPILOT_BILLING_CONFIG` is not set.

---

### 5.2 Concrete Configuration Examples by Use Case

#### [Example 1] Simple Enterprise Agreement (EA) Volume Discount
Applies an EA discount (e.g. 15% off) to standard catalog prices, while converting to Japanese Yen (JPY) at an agreed fixed exchange rate:
```json
{
  "subCurrency": {
    "code": "JPY",
    "symbol": "¥",
    "exchangeRateFromUSD": 155.0,
    "displayDecimals": 0
  },
  "discountPercent": 15
}
```

#### [Example 2] Fixed Local Currency Contract (Direct JPY Pricing)
Used when your Microsoft EA contract stipulates fixed JPY prices directly (e.g., Enterprise ¥5,000/mo, Business ¥2,500/mo, AI Credit ¥1.273/AIC):
```json
{
  "subCurrency": {
    "code": "JPY",
    "symbol": "¥",
    "exchangeRateFromUSD": 150.0,
    "displayDecimals": 0
  },
  "customPricePerCredit": 1.273,
  "customSeatPricing": {
    "enterpriseMonthly": 5000,
    "businessMonthly": 2500,
    "currency": "JPY"
  }
}
```

#### [Example 3] Period-Based Contract Cycles (Annual Revision / Multi-Period EA)
Designed for enterprise environments where discount rates, unit pricing, or currency exchange rates are renegotiated annually or across fiscal cycles.
Define periods (`startMonth` to `endMonth`) in the `periods` array. **Any month outside configured periods automatically falls back to default values (GitHub catalog list prices and base configurations)**:
```json
{
  "currency": { "code": "USD", "symbol": "$", "exchangeRateFromUSD": 1.0, "displayDecimals": 2 },
  "subCurrency": { "code": "JPY", "symbol": "¥", "exchangeRateFromUSD": 150.0, "displayDecimals": 0 },
  "discountPercent": 10,
  "periods": [
    {
      "startMonth": "2025-04",
      "endMonth": "2026-03",
      "discountPercent": 20,
      "seatPricing": {
        "enterprise": 4800,
        "business": 2400,
        "currency": "JPY"
      },
      "creditPricing": {
        "pricePerCredit": 1.25,
        "currency": "JPY"
      },
      "exchangeRates": {
        "JPY": 155.0,
        "EUR": 0.92
      }
    },
    {
      "startMonth": "2026-04",
      "endMonth": "2027-03",
      "discountPercent": 15,
      "seatPricing": {
        "enterprise": 5000,
        "business": 2500,
        "currency": "JPY"
      },
      "creditPricing": {
        "pricePerCredit": 1.273,
        "currency": "JPY"
      },
      "exchangeRateFromUSD": 148.0
    }
  ]
}
```

---

### 5.3 Parameter Specifications & Flexible Alias Normalization
The configuration loader (`BillingConfigLoader`) automatically normalizes and standardizes intuitive property naming conventions:

| Parameter | Type | Default | Allowed Aliases / Description |
|---|---|---|---|
| `subCurrency` | `object` | `null` | Secondary sub-currency settings (`code`: 'JPY', `symbol`: '¥', `exchangeRateFromUSD`: 155.0, `displayDecimals`: 0) |
| `discountPercent` | `number` | `0` | Enterprise Agreement (EA) volume discount percentage (0 to 100%) |
| `seatPricing` | `object` | 19 / 39 USD | Seat prices. Accepts `{ enterprise, business, currency }`, `{ enterpriseMonthly, businessMonthly }`, or `{ enterpriseMonthlyUSD, businessMonthlyUSD }`. Specifying non-USD currency marks it as custom contractual pricing. |
| `creditPricing` | `object` / `number` | 0.01 USD | AI Credit unit pricing. Accepts `{ pricePerCredit: 1.273, currency: "JPY" }` or direct `customPricePerCredit: 1.273`. |
| `exchangeRates` | `object` | Auto-derived | Map of USD to target currencies (e.g. `{ "JPY": 155.0, "EUR": 0.92 }`). Single `exchangeRateFromUSD` is also accepted. |
| `periods` | `array` | `[]` | List of period configurations (`startMonth`, `endMonth`, plan pricing, unit rates, discount, exchange rate overrides). |

> [!NOTE]
> - **USD is "GitHub Catalog Price (USD)"**: The primary USD metrics across the dashboard represent the official GitHub catalog list price (Enterprise: \$39/month, Business: \$19/month, Credits: \$0.01/AIC). Selecting **"EA-USD ($)", "EA-JPY (¥)", or "EA-EUR (€)"** as the secondary currency allows comparing catalog list price with negotiated effective EA contract prices (e.g., `$39.00 ($33.15 EA)`, `$39.00 (¥4,973)`, `$39.00 (€30.50)`).
> - **Out-of-Period Fallback**: Any month outside the `startMonth` to `endMonth` range of `periods` automatically falls back to default values.
> - **Public Exchange Rate Auto-Calculation**: For periods or months without explicit exchange rate overrides, rates (USD/JPY, USD/EUR, etc.) are automatically derived from trusted public statistics (European Central Bank / Bank of Japan).

---

## 6. Authentication & Ingestion Scopes

### Fine-grained PAT Setup
Generate a Personal Access Token (PAT) with the following scopes and register it as secret `COPILOT_READ_TOKEN`:
- `manage_billing:copilot` (or Copilot Business/Enterprise Read access)
- `read:org`
- `read:enterprise` (Enterprise-level metrics reports and seats; `manage_billing:copilot` also works)

Collection uses the **Enterprise and its Organizations together**: set `COPILOT_ENTERPRISE` and `COPILOT_ORGS`. A user who appears in more than one scope is counted once. The token's owner must be an enterprise owner / billing manager (Enterprise reports) and an organization owner (Organization reports) — see [SDD-08 §2.1.1](specifications/08_automation_workflow_spec.md) for the scope per endpoint.

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
- **Graceful Degradation**: If Copilot Metrics credentials are temporarily unavailable or permissions are restricted, the pipeline automatically proceeds with seat data or monthly CSV reports without failing the workflow. Each source (usage metrics / seats / Cost Centers) is collected independently and its status (`ok` / `partial` / `failed` / `skipped`) is shown in the dashboard's data-status banner. A failed source never replaces earlier good data with "zero": the last successful values are carried over and labelled, and demo data is never substituted.
- **Optional pipeline settings** (Variables unless noted): `ANONYMIZE_USERS` (+ secret `ANONYMIZE_SECRET`), `GITHUB_API_VERSION` (default `2026-03-10`), `COPILOT_BILLING_CONFIG` (see §5), `COPILOT_COST_CENTER_BUDGETS`, `COPILOT_ALLOW_PUBLIC_DATA`, `COPILOT_PAGES_URL`.

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
- **`fork:verify` fails with a public-exposure error**: the repository or the Pages site is publicly readable while real, non-anonymized user data is (or would be) published. Make the repository and Pages private, or enable pseudonymization (`ANONYMIZE_USERS=true` + `ANONYMIZE_SECRET`). The check only warns when GitHub cannot be reached.
- **The run stops with "ANONYMIZE_USERS is enabled but ANONYMIZE_SECRET is not set / too short"**: register a random secret of at least 16 characters as the `ANONYMIZE_SECRET` Actions secret. (Fail-closed by design.)
- **The dashboard shows a red/yellow banner or "—" instead of numbers**: a source failed or was only partly retrieved (banner), or the value is genuinely unmeasured ("—" with the reason). Open the anomaly modal / `error-log.json` for the cause. "Previous value" badges mean the latest collection of that source failed and the last successful values are shown.
- **The dashboard shows an amber "demo" banner**: demo (fictional) data is displayed because it was selected explicitly, or the data declares `is_mock_mode`. Use "実データを表示" or open the dashboard without `?demo=true`.
- **Secret Scan Failure**: Run `npm run secret-scan` locally to locate high-entropy strings or hardcoded tokens before committing.
- **Upstream Contribution Leak Check**: Run `npm run upstream:audit` before opening a pull request to upstream to guarantee that no local usage CSV or customer data is included.
