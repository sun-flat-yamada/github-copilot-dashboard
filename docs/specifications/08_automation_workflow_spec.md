[English](08_automation_workflow_spec.md) | [日本語](08_automation_workflow_spec.ja.md)

---

# SDD-08: Automation & CI/CD Workflow Specification

- **Document ID**: SPEC-COPILOT-008
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-10 (revised 2026-10-01: exposure pre-flight, staging/verification steps, new secrets/variables, per-source degradation)

---

## 1. Workflow Definitions

| Workflow Name | Trigger | Core Responsibilities |
|---|---|---|
| `copilot-analysis-cron.yml` | Scheduled (Daily UTC 00:00) / Manual (`workflow_dispatch`) | 1. **Exposure pre-flight** (`npm run fork:verify`, real-data runs only): fail before collecting anything when a public repository or public Pages would expose real, non-anonymized user-level data<br>2. Fetch latest API data per source (or continue gracefully with zero live data if credentials are absent/insufficiently privileged, recording each source's status)<br>3. Inject mapping via Attribute Resolver (pseudonymize when `ANONYMIZE_USERS=true`)<br>4. Multidimensional aggregation & billing calculation<br>5. Append commit to `copilot-data` (real data) or force-reset `copilot-data-mock` (simulated data) branch, depending on `MOCK_MODE`<br>6. Stage the allow-listed processed data (`pages:stage`), build the SPA, **verify the built artifact** (`pages:verify`) and deploy to GitHub Pages (real-data runs only; mock runs stop after step 5) |
| `test-and-preview.yml` | Pull Request / Push to `main` | TypeScript typecheck, ESLint (React Hooks rules, SDD-15 §6), unit tests, and build verification using mock datasets |

**Raw landing and reprocessing (P1-2)**: the daily run also lands the raw API responses under `data/raw/landing/` (Run Manifest + content-addressed objects, SDD-05 §2.3); they are committed to `copilot-data` together with the rest of `data/` and never staged to Pages. To regenerate the artifacts from a stored run without calling the API (after a logic fix), run `npm run pipeline:reprocess [-- --run <run_id>]` on a checkout of `copilot-data`; it needs no token. Nothing is landed when `ANONYMIZE_USERS=true`.

---

## 2. Required GitHub Actions Secrets & Variables

### 2.1 Secrets
- `COPILOT_READ_TOKEN`:
  - Personal Access Token (PAT) or GitHub App with administrative read permissions for GitHub Enterprise or target Organizations.
  - *Note*: Optional when running in mock mode (`MOCK_MODE=true`). Also optional for real-data mode: if `COPILOT_ENTERPRISE`/`COPILOT_ORGS` are unset the live sources are `skipped`, and if the token is missing or the credential lacks Enterprise Owner/Org Admin permission they are recorded as `failed`; the pipeline no longer aborts in either case — see [Section 2.3](#23-graceful-operation-without-copilot-metricsseats-credentials) below.
- `ANONYMIZE_SECRET` (**required when `ANONYMIZE_USERS=true`**):
  - Secret key (random, at least 16 characters, e.g. `openssl rand -hex 32`) for the keyed HMAC-SHA256 pseudonymization. With `ANONYMIZE_USERS=true` and no (or too short a) secret the pipeline stops without publishing anything (fail closed). Changing the key changes every pseudonym. See [SDD-04 Section 5](04_user_attribute_mapping_spec.md#5-public-exposure--pseudonymization-e-05).
- `COPILOT_USER_MAPPING_PASSPHRASE` (Optional):
  - Passphrase for the GPG encryption workaround used when a large user mapping exceeds `COPILOT_USER_MAPPING`'s 48KB size limit.
  - Used only to decrypt `data/config/copilot-user-mapping.json.gpg` from the `copilot-data` branch. If unset, or if that file does not exist, this decryption step is simply skipped and the pipeline falls back to `COPILOT_USER_MAPPING`/`COPILOT_USER_MAPPING_BASE64` as usual.
  - See [SDD-04 Section 6: GPG Encryption Workaround](04_user_attribute_mapping_spec.md#6-gpg-encryption-workaround-for-mappings-exceeding-48kb-optional) for details.

#### 2.1.1 Token Types and Permissions

> **Decision (2026-10-01, by the project owner): authentication stays PAT-only; a GitHub App is not adopted.**
>
> **Correction (2026-10-01)**: the first rationale recorded here — that the enterprise Copilot seat-assignment endpoint does not support App tokens — came from search summaries and is **contradicted by GitHub's own REST API description** (`ghec`, `2026-03-10`), which flags the enterprise seats, enterprise billing / cost-center and the metrics report endpoints as `enabledForGitHubApps: true` (the endpoint text itself documents only PAT scopes). Whether an App installation token really works end to end for each endpoint is **unverified** (it needs a call against a real enterprise). The decision stands as an owner's decision; revisit it with a real test call if PAT management becomes a burden.

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
> Scopes by endpoint (from the REST API description): Enterprise metrics reports and Enterprise seats — `manage_billing:copilot` or `read:enterprise`; Organization metrics reports — `read:org`; Organization seats — `manage_billing:copilot` or `read:org`; Enterprise Cost Centers / billing — an enterprise owner or billing manager.
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
   - Without any token, simply set `MOCK_MODE=true` (as a repository/organization Actions Variable, or via the `workflow_dispatch` `mock_mode` checkbox).
   - All dashboard features (Claude 3.7 Sonnet, GPT-4o, Gemini 2.0 Flash trends, 43-model radar benchmark, FinOps cost allocation) will function immediately using simulated data written to the dedicated `copilot-data-mock` branch — fully isolated from real data on `copilot-data` (see [SDD-05 Section 1.3](05_data_storage_and_fork_isolation_spec.md#13-mockreal-data-branch-separation)).
   - **Mock runs no longer build or deploy to GitHub Pages.** This keeps the live, production-facing dashboard 100% free of simulated data at all times; mock mode is purely for generating/inspecting a simulated dataset (e.g., for local preview via `git checkout copilot-data-mock`), not for publishing it.

### 2.3 Graceful Operation Without Copilot Metrics/Seats Credentials

When running in real-data mode (`MOCK_MODE` unset or `false`) without `COPILOT_ENTERPRISE`/`COPILOT_ORGS` configured — or when the configured credential lacks Enterprise Owner/Org Admin permission — the pipeline **no longer aborts**. Instead:
- Each live source (`metrics`, `seats`, `cost_centers`) records its own `SourceStatus` in `index.json` (`source_status[]`): `skipped` plus a `warning` issue when `COPILOT_ENTERPRISE`/`COPILOT_ORGS` are unset; `failed` plus an `error` issue naming the cause when the token is missing (`COPILOT_READ_TOKEN`) or the API call fails. Nothing silently fails or falls back to mock data, and a failed source keeps the previous successful values (SDD-02 §2.6). Issues are surfaced in `index.json`'s `issues[]` and `error-log.json`.
- `index.json` is still generated, with `available_months`, `available_days`, and `available_reports` reflecting only genuinely-available data (each is `[]` if no live metrics/reports exist — never fabricated placeholder values).
- Features that do **not** depend on live Copilot Metrics/Seats API access — the Monthly Usage Report CSV importer (`npm run import:report`), the AI Model Benchmark radar, and all Cost Center budget declarations — continue to work normally and are unaffected by missing Enterprise/Org credentials or insufficient permissions.
- The dashboard SPA detects the no-live-data condition and shows an informational banner (distinct from a genuine fetch-error banner) rather than a hardcoded fallback month/blank crash; failed sources appear in the data-status banner (SDD-07 §2.13). Neither case switches to demo data.

### 2.2 Variables
- `COPILOT_USER_MAPPING`:
  - JSON array string defining usernames, display names, departments, and cost center overrides.
  - Never committed to Git; configured via repository settings (**Settings** > **Secrets and variables** > **Actions** > **Variables**).
  - **48KB size limit**: GitHub rejects values larger than 48 KB (49,152 bytes). For company-wide rosters that exceed this limit, use the GPG encryption workaround described in [SDD-04 Section 6](04_user_attribute_mapping_spec.md#6-gpg-encryption-workaround-for-mappings-exceeding-48kb-optional) (`COPILOT_USER_MAPPING_PASSPHRASE` Secret + encrypted file distributed via the `copilot-data` branch). In that case, the workflow decrypts the mapping at runtime and internally sets `COPILOT_USER_MAPPING_FILE` (a local path under `$RUNNER_TEMP`) — administrators do not need to set this variable themselves.
- `COPILOT_ENTERPRISE`: Enterprise slug (for enterprise-wide aggregation).
- `COPILOT_ORGS`: Comma-separated list of organization slugs (for multi-org setups).
- `COPILOT_COST_CENTER_BUDGETS`: JSON array of `{ cost_center_id?, cost_center_name?, spending_limit_usd, free_tier_budget_usd }`. The GitHub API exposes no budget/spending-limit endpoint, so this must be declared manually to populate Cost Center budgets in real-data mode. Can be set as either a Variable or a Secret.
- `ANONYMIZE_USERS`: Optional (not needed under the internal-use premise of SDD-01 §1.1). Set to `true` to publish pseudonymized logins / names / departments instead of real ones (requires the `ANONYMIZE_SECRET` secret above).
- `COPILOT_BILLING_CONFIG`: JSON for enterprise contract pricing, exchange rates and discounts (`EnterpriseBillingConfig`, SDD-02 §4.3). Variable or Secret. Unset → the pricing catalog defaults; invalid JSON is recorded as an issue (visible in the header warning count) instead of being ignored.
- `GITHUB_API_VERSION`: Value of the `X-GitHub-Api-Version` header (default `2026-03-10`, SDD-03 §1.1).
- `COPILOT_ALLOW_PUBLIC_DATA` (Optional): `true` downgrades the exposure pre-flight failure to a warning. Use only when publishing the data publicly is an explicit, accepted decision.
- `COPILOT_PAGES_URL` (Optional): The public URL of the dashboard when it is served from a custom domain, so the exposure check probes the right address (default `https://<owner>.github.io/<repo>/`).
- `MOCK_MODE`: Set to `true` (or pass `mock_mode: true` to `workflow_dispatch`) to run the pipeline using simulation data without live API tokens. Simulated data is written only to the isolated `copilot-data-mock` branch (never `copilot-data`), and the workflow skips the SPA build and GitHub Pages deployment steps entirely — see [Section 2.1.2](#212-important-notes-for-personal-free-accounts) and [SDD-05 Section 1.3](05_data_storage_and_fork_isolation_spec.md#13-mockreal-data-branch-separation).

---

## 3. Automated Deployment & Permission Configuration (GitHub Pages)

In repository settings, configure GitHub Pages deployment source to **"GitHub Actions"**.

```yaml
permissions:
  contents: write      # Required for committing data to copilot-data branch
  pages: write         # Required for deploying to GitHub Pages
  id-token: write      # Required for GitHub Pages OIDC authentication
```

> [!NOTE]
> The `analyze-and-deploy` job carries a `github.repository == 'sun-flat-yamada/github-copilot-dashboard' || github.repository_id == '1364445722'` guard (the numeric repository ID is included as a rename/transfer-proof fallback, since `github.repository` changes if this repository is ever renamed or transferred to a different owner, while `github.repository_id` does not — see the [Contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)). Downstream forks that adopt the Dual-Branch Strategy ([SDD-12 Section 2.2](12_fork_sync_and_customization_ops_spec.md#22-dual-branch-strategy-for-code-level-customizations)) keep `main` as a permanently deploy-inert mirror and retarget the real pipeline to their own customization branch; without this guard, every `main` push in such a fork — including routine upstream fast-forward syncs — would still attempt this job under that fork's own repository and fail against its `github-pages` environment protection rules (see [SDD-12 Section 2.3](12_fork_sync_and_customization_ops_spec.md#23-operational-checklist-for-forkcustom-deployments)). The guard makes the job a clean no-op there instead, with no effect on this repository's own runs.

### Execution Steps:
1. Checkout repository (`main`).
2. Setup Node.js 22 & install dependencies (`npm ci`).
3. Restore prior data from the target branch (`copilot-data` for real runs; skipped for mock runs, since simulated data is fully regenerated each time).
4. *(Optional)* Decrypt a large user mapping via the GPG encryption workaround: runs only if both `data/config/copilot-user-mapping.json.gpg` and the `COPILOT_USER_MAPPING_PASSPHRASE` Secret are present, decrypting into `$RUNNER_TEMP` and setting `COPILOT_USER_MAPPING_FILE` automatically (see [SDD-04 Section 6](04_user_attribute_mapping_spec.md#6-gpg-encryption-workaround-for-mappings-exceeding-48kb-optional)).
5. *(Real-data runs only)* **Exposure pre-flight** (`npm run fork:verify`): anonymously probes the repository API, the raw `copilot-data` branch index and the Pages index; fails when real, non-anonymized user-level data is (or is about to be) publicly readable (SDD-04 §5.3). Offline / rate-limited probes only warn.
6. Execute data pipeline runner (`npm run pipeline:run`) — completes successfully even with zero Copilot Metrics/Seats credentials (see Section 2.3).
7. Push newly generated data to the target branch: incremental commit to `copilot-data` for real runs, or a force-pushed orphan reset of `copilot-data-mock` for mock runs (no historical accumulation of simulated data).
8. *(Real-data runs only)* Update the AI model benchmark dataset, then **stage the processed data** (`npm run pages:stage`): the allow-listed `index.json`, `error-log.json`, all `processed/*` months and the indexed daily files are copied to `dashboard/public/data/`; raw data, original CSVs and the encrypted mapping are never copied. The DEMO partition is staged separately under `data/demo/`.
9. *(Real-data runs only)* Build SPA dashboard (`npm run build`).
10. *(Real-data runs only)* **Verify the Pages artifact** (`npm run pages:verify`): every staged file (including past months) must be in `dist/data/` and nothing private (raw, config, original CSVs) may be in it (SDD-05 §2.2a).
11. *(Real-data runs only)* Upload static deployment artifact via `actions/upload-pages-artifact@v5`.
12. *(Real-data runs only)* Publish to GitHub Pages via `actions/deploy-pages@v5`.

> Mock runs (`MOCK_MODE=true`) intentionally stop after step 7: they never build or deploy the dashboard, so the production GitHub Pages site is never overwritten with simulated data.
