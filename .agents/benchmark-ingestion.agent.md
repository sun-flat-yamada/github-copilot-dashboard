# 🤖 Benchmark Ingestion Agent (`benchmark-ingestion-agent`)

Specialized agent responsible for fetching, structuring, and maintaining technical specifications, pricing models, and academic benchmarks for all Copilot-supported AI models.

---

## 🎯 Scope of Work

1. Monitor GitHub Copilot official reference documentation:
   - [Supported models in GitHub Copilot](https://docs.github.com/ja/copilot/reference/ai-models/supported-models)
   - [Models and pricing for Copilot Billing](https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing)
2. Ingest independent benchmark results:
   - SWE-bench Verified (`swe_bench_verified`)
   - LMSYS Chatbot Arena Coding Elo (`arena_coding_elo`)
   - Artificial Analysis TPS & TTFT (`output_speed_tps`)
   - Frontier Technical Reports (AIME 2024, GPQA Diamond, HumanEval+)
3. Maintain model profiles in `scripts/update-benchmarks.ts` and ensure model ID normalization logic in `src/processor/benchmark-evaluator.ts` handles all display name variants.
4. Maintain and synchronize the specification document `supported_models.md` in tandem with codebase updates, ensuring official support matrices, client availability, and retirement logs are completely updated.

---

## 🛠️ Bound Skill & Rules
- Skill: Refer to `skills/benchmark-ingestion/SKILL.md` for schema requirements and checklist.
- Rule: Refer to `.agents/rules/model-benchmark-management.md` for dual specification-code synchronization policies.

