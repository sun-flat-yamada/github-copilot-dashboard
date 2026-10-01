[English](04_user_attribute_mapping_spec.md) | [日本語](04_user_attribute_mapping_spec.ja.md)

---

# SDD-04: User Attribute Mapping & Zero-Leakage Privacy Specification

- **Document ID**: SPEC-COPILOT-004
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-10

---

## 1. Objectives & Security Principles

When associating GitHub Copilot users with internal "Departments", "Projects", "Cost Groups", or human-readable "Display Names", guaranteeing **Zero Leakage in Git History** of personal identities and internal org charts is an absolute requirement.

> [!WARNING]
> This guarantee covers the **`main` (source) branch only**. The `copilot-data` branch and the GitHub Pages artifact necessarily hold the *resolved* names, departments, tags and per-user usage. Whether those are publicly readable depends on the repository / Pages visibility. See Section 5 (public exposure, pseudonymization) before publishing real data from a public repository.

---

## 2. Runtime Injection Mechanism (GitHub Actions Variables / Secrets)

The system automatically recognizes the following configuration sources configured at the Repository or Organization level:

1. **Priority 1: `COPILOT_USER_MAPPING_FILE` (Local file path, optional)**
   - Points to a JSON/CSV file on the local filesystem.
   - Used at runtime by the **GPG encryption workaround** (see Section 6) for mappings that exceed
     GitHub Secrets/Variables' 48KB size limit.
   - If the specified file does not exist, a warning is logged and the resolver automatically falls back
     to Priority 2 and below.
2. **Priority 2: `COPILOT_USER_MAPPING` (GitHub Secret or Variable)**
   - JSON string or CSV string configured in GitHub Actions `Variables` or `Secrets`.
   - **Important**: individual Secret/Variable values are capped at **48 KB (49,152 bytes)**
     (see [GitHub docs: Storing large secrets](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions#storing-large-secrets) and
     [Variables reference: Limits for configuration variables](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#limits-for-configuration-variables)).
     For larger employee rosters, use the GPG workaround described in Section 6.
3. **Priority 3: `COPILOT_USER_MAPPING_BASE64` (Optional)**
   - Base64-encoded string to avoid formatting corruptions caused by newlines or special characters. Also subject to the 48KB limit.
4. **Priority 4: Fallback when unconfigured**
   - Users without custom mapping default to their GitHub login handle as display name, with their custom accounting group set to `"Unassigned"`.

---

## 3. Mapping Data Schema

### 3.1 JSON Format (Recommended)

```json
[
  {
    "github_user": "tanaka-taro",
    "display_name": "Taro Tanaka",
    "department": "Core Platform Division",
    "cost_center_override": "Platform-Engineering",
    "notes": "Tech Lead / Full-time"
  },
  {
    "github_user": "sato-hanako",
    "display_name": "Hanako Sato",
    "department": "Data Science Promotion Dept",
    "cost_center_override": "AI-and-Data-Platform",
    "notes": "ML Engineer"
  },
  {
    "github_user": "suzuki-ken",
    "display_name": "Ken Suzuki (Partner)",
    "department": "Frontend Platform Group",
    "cost_center_override": "Platform-Engineering",
    "notes": "Contractor",
    "tags": ["Contractor", "Remote"]
  }
]
```

### 3.2 CSV Format (Simplified Setup)

CSVs with standard header rows are also automatically detected and parsed:

```csv
github_user,display_name,department,cost_center_override,notes,tags
tanaka-taro,Taro Tanaka,Core Platform Division,Platform-Engineering,Full-time,
sato-hanako,Hanako Sato,Data Science Promotion Dept,AI-and-Data-Platform,ML Engineer,
suzuki-ken,Ken Suzuki (Partner),Frontend Platform Group,Platform-Engineering,Contractor,Contractor;Remote
```

Since the `tags` column stores multiple values in a single cell, it uses a **semicolon (`;`) separator**
to avoid colliding with the comma used as the column delimiter (e.g., `Contractor;Remote` →
`["Contractor", "Remote"]`). Leave the cell blank when no tags apply.

---

## 4. Field Definitions

| Field Name | Type | Required | Description | Default Value |
|---|---|---|---|---|
| `github_user` | string | Yes | GitHub login handle (case-insensitive) | - |
| `display_name` | string | No | Display name rendered in dashboard | Same as `github_user` |
| `department` | string | No | Custom allocation group, department, or project code | `"Unassigned"` |
| `cost_center_override` | string | No | Custom override for GitHub API Cost Center | API Cost Center if present; else `"Default-Cost-Center"` |
| `notes` | string | No | Employment type, contract status, or notes | `""` |
| `tags` | string[] | No | Freeform multi-value labels (e.g., `["Contractor", "Remote"]`). Array in JSON; single `;`-separated cell in CSV | Unset (`undefined`) |

---

## 5. Deployment Premise, Exposure Guard & Pseudonymization (E-05)

> **Premise (SDD-01 §1.1)**: the dashboard runs in a company's GitHub Enterprise environment, in a **private or internal** repository with **access-controlled Pages**, and only the company's employees view it. Identified data (names, departments, per-user usage) may therefore be shown. **Public deployment of real data is unsupported.** The mechanisms below are (a) a guard that detects a deployment that breaks the premise and (b) an optional pseudonymization measure.

### 5.1 What is exposed where

| Location | Contents | Visibility |
|---|---|---|
| `main` branch | Source code only (no data, no mapping) | Repository visibility |
| `copilot-data` branch (same repository) | `processed/*` (resolved display names, departments, tags, per-user usage and diagnostics), `raw/*` (seat assignments with GitHub login, numeric user ID, avatar URL), imported report CSVs | **Same as the repository.** A public repository publishes this branch. |
| GitHub Pages artifact | `index.json`, `processed/*` flattened into the site root | **Public by default even when the repository is private**, unless access-controlled Pages (GitHub Enterprise Cloud) is used |

Treat the repository **and** the Pages site as the publication boundary of the data: under the premise both are restricted to enterprise members (internal / private repository; access-controlled Pages).

### 5.2 Pseudonymization mode (`ANONYMIZE_USERS=true`)

Optional under the premise. Enable it to reduce what even an internal audience sees, or if you knowingly accept a wider audience than the premise describes:

- Variable `ANONYMIZE_USERS=true` and secret **`ANONYMIZE_SECRET`** (a random value of at least 16 characters, e.g. `openssl rand -hex 32`). **Without a sufficiently long secret the pipeline stops before writing anything** (fail closed): an anonymization without a secret key is reversible and must not be published.
- Algorithm: **HMAC-SHA256** keyed with `ANONYMIZE_SECRET` over `<kind>\0<lower-cased, trimmed value>` (`kind` = `login` / `name` / `department` / `team` / `project`, which separates the domains). The previous implementation was a 32-bit unkeyed hash that anyone could invert with a dictionary of GitHub logins.
- Output formats (deterministic for the same key, so month-over-month trends and joins keep working):

| Field | Pseudonym |
|---|---|
| `github_user` / login | `dev_<16 hex>` (64 bits) |
| `display_name` | `User-<8 hex>` |
| `department` | `Group-<8 hex>` (the unassigned label is kept) |
| team / project | `Team-<8 hex>` / `Project-<8 hex>` |

- **Removed from every output**: `avatar_url` (it embeds the numeric GitHub user ID and resolves to the person through the public API), numeric user IDs and profile URLs in the raw seat partitions, and the free-text `notes` field. In the raw partitions, user resources of Cost Centers and team names are pseudonymized as well. The original CSV of an imported monthly report is **not saved or pushed** (only the pseudonymized aggregate is stored; `--push` is ignored).
- **Not changed**: tags, Cost Center names, organization logins and `role` (they describe the organization structure, not a person). Keep the repository private if that structure is sensitive.
- `index.json` declares `privacy: { anonymized, contains_user_level_data }` so that tools (and `fork:verify`) can tell whether published data identifies people. `contains_user_level_data` is `false` for demo data.
- **Limits**: pseudonymization is not anonymization. Pseudonyms are stable identifiers; combined with department / Cost Center / activity dates, individuals in small groups can still be re-identified. Rotating `ANONYMIZE_SECRET` changes every pseudonym (old and new data can no longer be joined); losing the key makes re-linking impossible. Treat pseudonymized output as personal data under your privacy regulations. Previously published data (under the old hash) remains in the branch history until it is removed.

### 5.3 Exposure check (`npm run fork:verify`)

`fork:verify` is the guard for the premise. It asks, anonymously (no `Authorization` header), whether real user-level data is readable by anyone, which would mean the repository or Pages is not restricted to the enterprise:

1. `GET https://api.github.com/repos/{owner}/{repo}` → `200`: the repository is public.
2. `GET https://raw.githubusercontent.com/{owner}/{repo}/copilot-data/data/index.json` → `200`: the data branch is readable.
3. `GET {Pages URL}/data/index.json` → `200`: the deployed site serves the data (`COPILOT_PAGES_URL` overrides `https://{owner}.github.io/{repo}/` for custom domains).

It **fails** when something is publicly readable (or the repository is public) **and** real, non-anonymized user-level data is published (`index.json` privacy attributes; legacy indexes: seats or daily data present) or is about to be collected (`COPILOT_READ_TOKEN` with `COPILOT_ENTERPRISE` / `COPILOT_ORGS` configured, or a local `data/index.json` with real data) without a complete pseudonymization setup. Demo-only and pseudonymized deployments pass. If the network is unreachable or rate-limited the result is a **warning** (never a failure), so offline runs keep working. `COPILOT_ALLOW_PUBLIC_DATA=true` downgrades the failure to a warning (an explicit, documented acceptance of the risk; not recommended). `--quick` skips the network check.

The scheduled workflow runs `npm run fork:verify` **before** collecting data, so a public repository cannot start publishing non-anonymized data.

---

## 6. GPG Encryption Workaround for Mappings Exceeding 48KB (Optional)

### 6.1 Background

As noted in Section 2, GitHub Secrets/Variables cap individual values at **48 KB (49,152 bytes)**.
A full company-scale roster (hundreds to thousands of employees) mapped in the recommended JSON format
can easily exceed this limit. This workaround adapts
[GitHub's officially documented technique](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions#storing-large-secrets)
(GPG-encrypt the file, commit it to the repository, and store only the passphrase as a Secret) to fit
this project's **Zero-Leakage architecture** (the code branch must never contain data). The encrypted
blob is committed only to the **data-only `copilot-data` orphan branch**, never to code branches such as
`main` / `fork/custom`.

> 💡 With this approach, the 48KB payload limit is effectively removed: only a small passphrase is stored
> as a GitHub Secret, while the (encrypted) mapping payload itself lives as a Git object on the
> `copilot-data` branch. This means the recommended JSON format can be encrypted as-is, with no need
> to slim it down to a minimal CSV.

### 6.2 Supported File Formats

GPG encryption/decryption itself operates on arbitrary bytes, so **the encryption layer imposes no format
restriction**. However, the decrypted output file is ultimately passed as `COPILOT_USER_MAPPING_FILE` to
`AttributeResolver` (`src/collector/attribute-resolver.ts`) at runtime, so **the decrypted content** must
conform to one of the schemas defined in Section 3:

| Format | Details | Notes |
|---|---|---|
| JSON | Section 3.1 (array of `UserAttributeMapping` objects) | Recommended |
| CSV | Section 3.2 (header row: `github_user,display_name,department,cost_center_override,notes,tags`) | Simplified setup |

`scripts/encrypt-user-mapping.ts` (before encryption) and `scripts/decrypt-user-mapping.ts` (after
decryption) each perform a lightweight inspection of the file content and print the detected format,
record count, and whether a `tags` field is present. This is an advisory preview only — the authoritative
parser is `AttributeResolver` itself. If the content cannot be recognized as either format, a warning is
printed, but encryption/decryption still proceeds (since the GPG layer is format-agnostic).

### 6.3 Setup Steps

1. **Prepare the mapping file locally** (JSON format from Section 3 is recommended).
2. **Encrypt it with GPG**:
   ```bash
   npm run mapping:encrypt -- <input-file> [output-file] [--push] [--passphrase-env <VAR>]
   # Example:
   npm run mapping:encrypt -- _sensitive-data/copilot-user-mapping.draft.json
   ```
   By default, GnuPG will interactively prompt you to set a passphrase (symmetric encryption / AES256).
   Remember this passphrase — it is required in Step 4.
   Adding `--push` automatically commits and pushes the encrypted file as
   `data/config/<filename>.gpg` to the `copilot-data` branch (skipping Step 3).
   For non-interactive/CI use, pass `--passphrase-env <ENV_VAR_NAME>` to supply the passphrase from an
   environment variable instead of an interactive prompt (mirrors `mapping:decrypt`'s existing option).
3. **(If not using `--push`) Commit the encrypted file to the `copilot-data` branch only.**
   **Never commit it to code branches** such as `main` / `fork/custom`.
   ```bash
   npm run mapping:decrypt -- <encrypted-file.gpg> ./verify.json   # Optional: verify decryption locally
   ```
4. **Register the passphrase as a repository Secret** (its small size is well under the 48KB limit):
   ```bash
   gh secret set COPILOT_USER_MAPPING_PASSPHRASE
   ```
5. On every run, the workflow (`.github/workflows/copilot-analysis-cron.yml`) automatically:
   - Restores `data/config/copilot-user-mapping.json.gpg` from the `copilot-data` branch
   - Decrypts it into `$RUNNER_TEMP` using `COPILOT_USER_MAPPING_PASSPHRASE` (never written to the repository)
   - Sets the `COPILOT_USER_MAPPING_FILE` environment variable and passes it to the pipeline

### 6.4 Related Commands

| Command | Purpose |
|---|---|
| `npm run mapping:encrypt -- <input> [output] [--push] [--passphrase-env <VAR>]` | GPG-encrypt a mapping file (optionally auto-commit & push to `copilot-data`; non-interactive CI mode available) |
| `npm run mapping:decrypt -- <input.gpg> <output> [--passphrase-env <VAR>]` | Decrypt an encrypted file (non-interactive CI mode, or interactive local verification) |

### 6.5 Security Notes

- **Never commit** the encrypted `.gpg` file to any branch other than `copilot-data`.
- The decrypted plaintext is written only to `$RUNNER_TEMP` (a temporary area discarded when the runner
  is torn down at the end of the job) and is never persisted to the repository or uploaded as an artifact.
- Store the passphrase only as a Secret named `COPILOT_USER_MAPPING_PASSPHRASE`; never log or hardcode it
  in source code.

---

## 7. DEMO Environment Encrypted Mapping Fixture (DEMO Mapping Fixture)

### 7.1 Objective and Background
To allow full inspection and validation of multi-axis breakdowns (Department, CostCenter, Organization, and tags) during DEMO / Mock executions and downstream fork evaluations without exposing any real employee PII.

### 7.2 Architecture and Specification
1. **In-Repository Fixture**:
   - `fixtures/demo/copilot-user-mapping.demo.json.gpg`
   - Encrypts 94 synthetic mock user profiles (85 Live Metrics users + Monthly Usage Report users).
   - AES256 GPG symmetric encryption (default passphrase: `copilot-demo-secret-passphrase-2026`).
2. **Automated Deployment**:
   - When `scripts/generate-demo-data.ts` runs, the encrypted fixture is deployed to both `data/demo/config/` and `dashboard/public/data/demo/config/`.
3. **Automatic Fallback Loader**:
   - When running `--mock` or `MOCK_DATA=true`, if `COPILOT_USER_MAPPING` or `COPILOT_USER_MAPPING_FILE` is not set, `src/cli/run-pipeline.ts` invokes `loadDemoUserMapping()` from `src/collector/demo-mapping-loader.ts`.
   - A temporary plaintext mapping file is generated under the system temp directory and supplied to `AttributeResolver`, preventing demo metrics from falling back to `未分類 (Unassigned)`.

