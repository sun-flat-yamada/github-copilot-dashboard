# Support Policy

Thank you for using **github-copilot-dashboard**!

## How to Get Help

### 1. Documentation & Specifications
Before asking for support, please review:
- [Documentation Portal](docs/README.md): Central hub for specifications, setup manuals, and model pricing.
- [README.md](README.md): Overview and 4-step quick start guide.
- [SDD Specifications](docs/specifications/README.md): Detailed architectural designs, billing models, and data storage specifications.

### 2. Frequently Asked Questions (FAQ)

**Q: Do I need a paid external database or server?**  
A: No. The platform is 100% serverless, operating purely within GitHub Actions (cron jobs) and GitHub Pages (SPA hosting).

**Q: Will our employee names and departments be exposed in Git commits?**  
A: No. All user attribute mapping is injected via GitHub Actions Variables or Secrets, and raw mappings are never committed to Git.

**Q: Does syncing forks from upstream cause Git merge conflicts?**  
A: No. The repository uses an isolated orphan data branch (`copilot-data`) and append-only daily partitions. The `main` branch contains zero data files.

### 3. Reporting Bugs or Requesting Features
- To report a bug: [Open a Bug Report](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/new?template=bug_report.yml)
- To suggest an enhancement: [Open a Feature Request](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/new?template=feature_request.yml)
