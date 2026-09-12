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

---

## 2. Runtime Injection Mechanism (GitHub Actions Variables / Secrets)

The system automatically recognizes the following configuration sources configured at the Repository or Organization level:

1. **Priority 1: `COPILOT_USER_MAPPING` (GitHub Secret or Variable)**
   - JSON string or CSV string configured in GitHub Actions `Variables` or `Secrets`.
2. **Priority 2: `COPILOT_USER_MAPPING_BASE64` (Optional)**
   - Base64-encoded string to avoid formatting corruptions caused by newlines or special characters.
3. **Priority 3: Fallback when unconfigured**
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
    "notes": "Contractor"
  }
]
```

### 3.2 CSV Format (Simplified Setup)

CSVs with standard header rows are also automatically detected and parsed:

```csv
github_user,display_name,department,cost_center_override,notes
tanaka-taro,Taro Tanaka,Core Platform Division,Platform-Engineering,Full-time
sato-hanako,Hanako Sato,Data Science Promotion Dept,AI-and-Data-Platform,ML Engineer
```

---

## 4. Field Definitions

| Field Name | Type | Required | Description | Default Value |
|---|---|---|---|---|
| `github_user` | string | Yes | GitHub login handle (case-insensitive) | - |
| `display_name` | string | No | Display name rendered in dashboard | Same as `github_user` |
| `department` | string | No | Custom allocation group, department, or project code | `"Unassigned"` |
| `cost_center_override` | string | No | Custom override for GitHub API Cost Center | API Cost Center if present; else `"Default-Cost-Center"` |
| `notes` | string | No | Employment type, contract status, or notes | `""` |

---

## 5. Anonymization & Privacy Preservation Mode

For publicly deployed GitHub Pages or environments with broad viewer access, enabling `ANONYMIZE_USERS=true` triggers privacy-preserving transformations:
- `github_user`: Salted hash (e.g., `user_a1b2c3`)
- `display_name`: Initialized string (e.g., `T. T.`)
- `department`: Retained as-is or replaced with group codes

This prevents the identification of individual employees even if the dashboard is accidentally accessed beyond intended boundaries.
