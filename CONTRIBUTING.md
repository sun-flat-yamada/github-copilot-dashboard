# Contributing to github-copilot-dashboard

Thank you for your interest in improving **github-copilot-dashboard**! We welcome contributions from the community.

---

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

---

## Development Workflow

### 1. Prerequisites
- **Node.js**: v20.x or v22.x+ (Recommended: LTS)
- **npm**: v10.x+
- **Git**

### 2. Setup
```bash
# Fork & clone the repository
git clone https://github.com/your-username/github-copilot-dashboard.git
cd github-copilot-dashboard

# Install dependencies
npm install

# Run TypeScript typecheck
npm run typecheck

# Run unit tests
npm test

# Generate simulated 2026.09 Copilot test partitions
npm run pipeline:mock

# Start local interactive dashboard
npm run dev
# Open http://localhost:3000 in your browser
```

---

## Branching & Commit Guidelines

### Branch Naming
- `feat/feature-name` (New features)
- `fix/bug-fix-name` (Bug fixes)
- `docs/doc-updates` (Documentation changes)
- `refactor/clean-up` (Refactoring without functional change)

### Commit Message Format (Conventional Commits)
We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat: add model breakdown timeline for individual users`
- `fix: correct prorated daily billing formula for leap years`
- `docs: update setup steps for GitHub Actions Variables`
- `test: add unit test for Cost Center budget threshold`

---

## Pull Request Guidelines

1. Ensure all TypeScript checks pass: `npm run typecheck`
2. Ensure all unit tests pass: `npm test`
3. Ensure production SPA build succeeds: `npm run build`
4. Submit your Pull Request against the `main` branch.
5. Fill out the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md) completely.
