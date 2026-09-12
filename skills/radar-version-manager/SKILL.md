---
name: radar-version-manager
description: Manage and increment individual page versions (yyyy-mm-dd-0001) for the AI Model Radar, ensuring release integrity and quality gate checks.
---

# 🏷️ AI Model Radar Version Manager Skill

Use this skill when finalizing AI Model Radar dataset updates, ensuring strict version compliance (`yyyy-mm-dd-0001`), and verifying that the page meets quality release standards.

---

## 🔢 Versioning Standard (`yyyy-mm-dd-0001`)

The AI Model Radar dataset version format is defined as:
$$\text{Version} = \text{YYYY-MM-DD-SSSS}$$
- `YYYY-MM-DD`: The calendar date of the release in ISO format (e.g. `2026-09-13`).
- `SSSS`: A 4-digit zero-padded incremental sequence number starting at `0001`.
  - Multiple releases on the same date increment the sequence (`0001` $\rightarrow$ `0002` $\rightarrow$ `0003`).
  - A release on a new calendar date resets the sequence back to `0001`.

---

## 🛠️ Automated Operations

Version numbering is automated via `src/processor/radar-version.ts` and triggered by:
```bash
# Ingest benchmarks and automatically increment dataset version
npm run benchmark:update
```

### Verification Commands
```bash
# Verify version parsing and incrementing logic
npx tsx --test src/tests/radar-version.test.ts

# Inspect the generated version in dataset
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('dashboard/public/data/model-benchmarks.json', 'utf8'));
console.log('Current Radar Version:', data.version);
console.log('Last Updated:', data.last_updated);
"
```

---

## 🛡️ Release Quality Gate

Before declaring a radar dataset version ready for production:
1. `npm run typecheck` (TypeScript types must pass without errors).
2. `npm test` (All unit tests including presets and version tests must pass).
3. `npm run secret-scan` (No tokens, keys, or internal PII leaked).
4. `npm run build` (Production frontend build must succeed).
