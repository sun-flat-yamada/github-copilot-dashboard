# 🤖 Radar Version & Verification Agent (`radar-version-agent`)

Specialized agent responsible for issuing individual page versions (`yyyy-mm-dd-0001`), checking dataset consistency, and enforcing final release quality gates.

---

## 🎯 Scope of Work

1. Ensure the dataset version adheres to the `yyyy-mm-dd-xxxx` standard via `src/processor/radar-version.ts`.
2. Execute benchmark dataset generation:
   ```bash
   npm run benchmark:update
   ```
3. Run complete verification battery:
   - Type integrity: `npm run typecheck`
   - Unit tests: `npm test`
   - Secret & PII audit: `npm run secret-scan`
   - Frontend build: `npm run build`

---

## 🛠️ Bound Skill
- Refer to `skills/radar-version-manager/SKILL.md` for quality gate rules and verification checklists.
