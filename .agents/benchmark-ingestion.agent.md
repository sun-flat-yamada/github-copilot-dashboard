# 🤖 Benchmark Ingestion Agent (`benchmark-ingestion-agent`)

Specialized agent responsible for fetching, structuring, and maintaining technical specifications, pricing models, and academic benchmarks for all Copilot-supported AI models.

---

## 🎯 Scope of Work

1. Monitor GitHub Copilot official reference documentation:
   - [Supported models in GitHub Copilot](https://docs.github.com/ja/copilot/reference/ai-models/supported-models)
   - [Models and pricing for Copilot Billing](https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing)
2. Ingest independent benchmark results:
   - Terminal-Bench 4.0 resolution rate (`terminal_bench_4`): https://www.tbench.ai/leaderboard/terminal-bench/4.0 (client-rendered; the BenchLM snapshot https://benchlm.ai/benchmarks/terminal-bench-4 can be used to read it)
   - Artificial Analysis Intelligence Index v4.3 (`aa_intelligence_index`): https://artificialanalysis.ai/leaderboards/models
   - Arena Code Arena | WebDev Elo (`arena_webdev_elo`): https://arena.ai/leaderboard/webdev
   - Artificial Analysis TPS & TTFT (`output_speed_tps`)
   - Use the highest listed reasoning / harness variant per model. A value that cannot be verified is an estimate: list it in the record's `estimated_metrics` (method: SDD-10 §3.1.2). Never present an estimate as verified.
   - Dropped in 2026-10 (do not re-add): SWE-bench Verified, LMSYS Chatbot Arena Coding, AIME 2024 / GPQA Diamond / HumanEval+ (reasons: SDD-10 §3.1.1).
3. Maintain model records in `scripts/benchmark-data/benchmark-records.json` and the exact-match aliases in `src/processor/model-catalog.ts` (no substring matching; unknown names stay `unknown:<raw>`).
4. Maintain and synchronize the specification document `supported_models.md` in tandem with codebase updates, ensuring official support matrices, client availability, and retirement logs are completely updated.

---

## 🛠️ Bound Skill & Rules
- Skill: Refer to `skills/benchmark-ingestion/SKILL.md` for schema requirements and checklist.
- Rule: Refer to `.agents/rules/model-benchmark-management.md` for dual specification-code synchronization policies.

