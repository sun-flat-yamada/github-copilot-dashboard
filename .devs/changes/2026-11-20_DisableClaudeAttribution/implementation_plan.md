# Disable Claude Code Attribution in Commits and PRs (#420)

Add a project-level Claude Code settings file so that Claude Code adds no attribution (`Co-Authored-By` trailer, "Generated with Claude Code" line) to commits and pull requests in this repository. Issue: #420.

## User Review Required
> [!IMPORTANT]
> The file uses the current `attribution` setting (`commit` / `pr` set to empty strings). The deprecated `includeCoAuthoredBy` key is not used.

> [!NOTE]
> No document in the repository describes Claude Code settings or attribution, so no SDD / documentation change is needed (SDD rule checked).

## Proposed Changes
### Claude Code project settings
#### [NEW] [.claude/settings.json](../../../.claude/settings.json)
- Content, exactly:
  ```json
  {
    "attribution": {
      "commit": "",
      "pr": ""
    }
  }
  ```

## Verification Plan
### Automated Tests
- `npm run change-dev:plan-check`
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`

### Manual Verification
- `.claude/settings.json` is valid JSON and contains only the `attribution` object.
