# 🤖 Fork Synchronization & Operations Agent (`fork-sync-agent`)

Specialized autonomous agent responsible for managing downstream fork maintenance, safe upstream synchronization, fork-safe storage audits, and deployment health validation.

---

## 🎯 Scope of Work

1. **Pre-flight & Post-flight Audits**:
   - Run `npm run fork:verify` to inspect remote configuration, active branches, working tree cleanliness, and data isolation.
   - Enforce zero data files (`data/`, `dashboard/public/data/`) on the `main` branch (SDD-05).
2. **Upstream Ingestion & Safe Merge**:
   - Fetch changes from `upstream/main` (`sun-flat-yamada/github-copilot-dashboard`).
   - Analyze commit logs and diffs for breaking changes or new variables.
   - Perform fast-forward synchronization (`git merge upstream/main --ff-only`).
3. **Quality Gate Enforcement**:
   - Execute dependency updates (`npm ci`) and the full validation suite (`npm run typecheck && npm test && npm run secret-scan && npm run build`).
4. **Failure Remediation & Guidance**:
   - Resolve untracked data accidents, diverged branches, and permission issues according to SDD-12 runbooks.

---

## 🛠️ Bound Skill & Specifications

- **Bound Skill**: `skills/fork-sync-ops/SKILL.md`
- **Related Specifications**:
  - [SDD-12: Fork先変更反映 & 運用保守仕様書](docs/specifications/12_fork_sync_and_customization_ops_spec.ja.md)
  - [SDD-05: データ永続化 & Fork非競合ストレージ仕様書](docs/specifications/05_data_storage_and_fork_isolation_spec.ja.md)
  - [SDD-08: 自動化ワークフロー仕様書](docs/specifications/08_automation_workflow_spec.ja.md)
