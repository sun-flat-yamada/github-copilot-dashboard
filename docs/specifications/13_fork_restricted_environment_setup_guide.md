[English](13_fork_restricted_environment_setup_guide.md) | [日本語](13_fork_restricted_environment_setup_guide.ja.md)

---

# SDD-13: Fork-Restricted Environment Setup Guide

- **Document ID**: SPEC-COPILOT-013
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-15

---

## 1. Purpose & Applicability

Some enterprises cannot use GitHub's native **Fork** button to bring this repository into their own GitHub Organization — most commonly because their GitHub accounts are provisioned as **Enterprise Managed Users (EMU)**, or because organization/enterprise policy blocks forking across account boundaries.

This guide provides a fork-free alternative procedure to obtain a fully independent, working copy of this dashboard, without relying on GitHub's fork network.

Use this guide if any of the following apply:
- Clicking **Fork** on this repository is greyed out, errors, or is silently rejected for your target Organization.
- Your GitHub username has the form `<name>_<enterprise-shortcode>` (the standard EMU account naming convention).
- Your organization is part of a GitHub Enterprise Cloud plan with Enterprise Managed Users enabled.

---

## 2. Root Cause Reference

| Symptom | Likely Cause | Admin-Configurable? | Diagnostic Command |
|---|---|---|---|
| Fork fails only for repositories **outside** your enterprise (e.g. this repository, owned by a personal account) | Your account is an **Enterprise Managed User (EMU)**. EMU accounts cannot fork, star, watch, or open issues/PRs on repositories outside their enterprise. This is a hard product limitation, not a togglable policy. | ❌ No — enforced by GitHub regardless of admin/owner role | `gh api user --jq .login` — EMU usernames end in `_<enterprise-shortcode>` |
| Fork fails for your **organization's own** private repositories being forked elsewhere | Organization "Repository forking" policy (Member privileges) disallows forking of the org's private repos | ✅ Yes — org owner can enable it | `gh api orgs/<org> --jq .members_can_fork_private_repositories` |
| Fork fails organization-wide for any inbound content | Organization disables repository creation, or restricts allowed visibility types | ✅ Yes — org owner can enable it | `gh api orgs/<org> --jq .members_can_create_repositories` |

> [!NOTE]
> Reference: [Abilities and restrictions of managed user accounts](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/understanding-iam-for-enterprises/abilities-and-restrictions-of-managed-user-accounts) — *"Managed user accounts cannot fork repositories from outside of the enterprise."*

---

## 3. Alternative Procedure: Mirror-Based Duplication (No Fork Required)

This procedure uses GitHub's officially documented [Duplicating a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/duplicating-a-repository) mirroring technique instead of the Fork feature. Because the result is a fully independent repository (not a fork-network member), it remains fully compatible with the Fork-Safe Storage architecture described in [SDD-05](05_data_storage_and_fork_isolation_spec.md) — the conflict-free guarantee there comes from being a *separate repository*, which a mirrored copy also is.

All commands below assume PowerShell (`pwsh`) and the [GitHub CLI](https://cli.github.com/) (`gh`), already authenticated (`gh auth status`).

### 3.1 Phase 1 — Duplicate the repository

```powershell
# Scratch working directory
cd $env:TEMP

# 1. Anonymous bare clone of the upstream repo (read-only, not subject to EMU/fork restrictions)
git clone --bare https://github.com/sun-flat-yamada/github-copilot-dashboard.git

# 2. Create an empty destination repository in your organization
gh repo create <YOUR-ORG>/github-copilot-dashboard --private

# 3. Mirror-push every branch and tag (includes main and copilot-data, history intact)
cd github-copilot-dashboard.git
git push --mirror https://github.com/<YOUR-ORG>/github-copilot-dashboard.git

# 4. Clean up the temporary bare clone
cd ..
Remove-Item -Recurse -Force github-copilot-dashboard.git
```

> [!TIP]
> The `copilot-data` branch is duplicated as-is. If it still contains the upstream maintainer's own sample/demo data, that is expected — it is safe to keep for evaluation, or you can delete and reinitialize it later once your own scheduled workflow run appends real partitions.

### 3.2 Phase 2 — Point your local clone at the new repository

If you already have a local clone of the upstream repository, re-point it instead of cloning again:

```powershell
cd <your-local-clone-path>

git remote rename origin upstream
git remote add origin https://github.com/<YOUR-ORG>/github-copilot-dashboard.git
git fetch origin
git branch --set-upstream-to=origin/main main

git remote -v
```

### 3.3 Phase 3 — Enable Actions & GitHub Pages

A mirrored repository is treated as brand new, so these must be configured manually (identical to what a true fork would also require):

```powershell
$repo = "<YOUR-ORG>/github-copilot-dashboard"

# Ensure GITHUB_TOKEN has write access (required to push to copilot-data)
gh api repos/$repo/actions/permissions/workflow
gh api --method PUT repos/$repo/actions/permissions/workflow `
  -f default_workflow_permissions=write `
  -F can_approve_pull_request_reviews=false

# Confirm Actions is enabled for the repository
gh api repos/$repo/actions/permissions

# Enable GitHub Pages with the "GitHub Actions" build source
gh api --method POST repos/$repo/pages `
  -f build_type=workflow
```

### 3.4 Phase 4 (Optional) — Connect live Copilot data

Skip this phase to keep running on the inherited demo data. Configure it when you're ready to pull real usage from your enterprise (see [SDD-08 §2](08_automation_workflow_spec.md#2-required-github-actions-secrets--variables) for full field definitions):

```powershell
gh variable set COPILOT_ENTERPRISE   --repo $repo --body "<enterprise-slug>"
gh variable set COPILOT_ORGS         --repo $repo --body "<org1,org2>"
gh secret   set COPILOT_READ_TOKEN   --repo $repo --body "<PAT>"
gh variable set COPILOT_USER_MAPPING --repo $repo --body '[{"github_user":"...", "display_name":"...", "department":"..."}]'
```

> [!IMPORTANT]
> Confirm the exact PAT scope/permission requirements against your enterprise's current GitHub Copilot API documentation — see [SDD-08 §2.1.1](08_automation_workflow_spec.md#211-token-types-and-permissions) for the two supported token types.

### 3.5 Phase 5 — Verify

```powershell
gh workflow run copilot-analysis-cron.yml --repo $repo -f mock_mode=true
gh run list --repo $repo --limit 3
gh api repos/$repo/pages --jq .html_url
```

---

## 4. Ongoing Upstream Sync (No "Sync Fork" Button)

Because this is not a fork-network repository, GitHub's one-click **Sync Fork** button is unavailable. Use the `upstream` remote registered in Phase 2 instead:

```powershell
git fetch upstream
git merge upstream/main
git push origin main
```

Per [SDD-05](05_data_storage_and_fork_isolation_spec.md), `main` never contains data files, so this merge is guaranteed conflict-free regardless of how long you defer syncing.

---

## 5. Known Limitations

| Limitation | Detail |
|---|---|
| No native "Sync Fork" UI | Use the manual `fetch` + `merge` + `push` flow in Section 4 |
| No fork-network PR flow to upstream | EMU accounts additionally cannot open issues/PRs on repositories outside their enterprise at all, independent of forking — a personal (non-EMU) GitHub identity is required to contribute back upstream |
| Inherited `copilot-data` content | The mirrored `copilot-data` branch carries over the upstream owner's existing data partitions until your own workflow run overwrites/appends to them |
| Manual Actions/Pages setup | Unlike a fork of a repository you already configured, a fresh mirror always starts with Actions/Pages unconfigured (Section 3.3) |

---

## 6. Alternatives Comparison

| Option | Preserves History | Bypasses EMU Restriction | Notes |
|---|---|---|---|
| **Mirror-based duplication (Section 3)** | ✅ Full | ✅ Yes | Recommended — officially documented GitHub procedure |
| GitHub Importer (`github.com/new/import`) | ✅ Full | ✅ Yes (same read/write boundary as mirroring) | UI-driven, no local git required; primarily documented for non-GitHub sources |
| Escalate to enterprise/organization admin | N/A | ❌ Usually no | Only helps if the block is an org-level forking policy (Section 2, row 2), not an EMU restriction |
| Fork via a personal (non-EMU) account, then transfer ownership | ✅ Full | ⚠️ Unconfirmed | Whether an EMU-managed organization accepts an inbound transfer from an external account is undocumented; lower reliability than mirroring |

---

## 7. Making the Mirror's Upstream Relationship Visible

Because a mirror-based duplication is a genuinely independent repository (`isFork: false`, `parent: null` in the GitHub API), none of GitHub's native fork UI — the "forked from" link under the repo name, the fork network graph, the `compare` view across forks — is available here. Without deliberate action, visitors (and future maintainers) have no way to discover that this repository tracks an upstream. Since none of these methods touch `main` (which must remain a byte-for-byte, fast-forward-only mirror per [SDD-12 §2.2](12_fork_sync_and_customization_ops_spec.md#22-dual-branch-strategy-for-code-level-customizations)), apply all fork-identification content exclusively on `fork/custom` (the repository's default/deployment branch) or via repository metadata:

1. **Repository description & topics** (zero git risk — server-side metadata, not a file):
   ```powershell
   gh repo edit <owner>/<repo> --description "Downstream deployment of <upstream-owner>/<upstream-repo> (mirror-based fork; see docs/specifications/13_fork_restricted_environment_setup_guide.md)." --add-topic fork
   ```
2. **README banner on `fork/custom` only**: add a short blockquote notice immediately below the language-switcher line at the top of `README.md`/`README.ja.md`, stating the upstream repository URL, the dual-branch model (`main` = mirror, `fork/custom` = customizations), and why `isFork` reads `false`. Keep it to a self-contained blockquote positioned between two rarely-changed anchor lines (language switcher and title) to minimize future merge-conflict surface when syncing upstream README changes into `fork/custom`.
3. **Do not** add fork-identification content to `main`. Any file touched on `main` beyond what upstream itself contains breaks the `git merge upstream/main --ff-only` invariant that Section 4's sync procedure (and [SDD-12](12_fork_sync_and_customization_ops_spec.md)) depend on.

This is purely a documentation/discoverability convention — it has no effect on git mechanics, Actions, or Pages behavior.
