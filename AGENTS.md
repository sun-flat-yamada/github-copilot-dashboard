# AI Agents Instruction & Security Guidelines (AGENTS.md)

This repository enforces strict security and zero-leakage standards for all autonomous AI agents.

## Core Rules
1. **Never Commit Secrets**: Any API key, token (`ghp_`, `AKIA`, `sk-`), private key, or password must not be written into source files.
2. **Zero PII**: Do not write real user names, emails, or internal department structures into files. Use `COPILOT_USER_MAPPING` via environment variables.
3. **Run Secret Scan**: Always run `npm run secret-scan` before committing or finalizing changes.
4. **Data Isolation**: Never place data files into `main` branch. Maintain fork-isolation on `copilot-data`.
5. **Quality Gate**: Ensure `npm run typecheck && npm test && npm run build` pass cleanly.
