---
name: benchmark-ingestion
description: Ingest and update official AI model specifications, benchmark scores, context window sizes, and pricing structures for the Copilot Analytics Dashboard.
---

# 📥 AI Model Benchmark Ingestion Skill

Use this skill when fetching, parsing, and updating official AI model technical specifications and benchmark scores for `scripts/update-benchmarks.ts` and `dashboard/public/data/model-benchmarks.json`.

---

## 🌐 Primary Data Sources

1. **GitHub Copilot Official Documentation**:
   - [Supported models in GitHub Copilot](https://docs.github.com/ja/copilot/reference/ai-models/supported-models)
   - [Models and pricing for Copilot Billing](https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing)
2. **Prominent Benchmark Sources**:
   - **Terminal-Bench 4.0**: agent + model resolution rate on terminal tasks (`terminal_bench_4`, %), https://www.tbench.ai/leaderboard/terminal-bench/4.0 (client-rendered; read via the BenchLM snapshot https://benchlm.ai/benchmarks/terminal-bench-4 when needed).
   - **Artificial Analysis Intelligence Index v4.3**: independent composite intelligence index (`aa_intelligence_index`), https://artificialanalysis.ai/leaderboards/models (per model `https://artificialanalysis.ai/models/<slug>`). Values AA marks "Estimated", or models with only a non-reasoning variant, are not verified.
   - **Arena Code Arena | WebDev** (formerly LMArena / LMSYS): blind human Elo ratings (`arena_webdev_elo`), https://arena.ai/leaderboard/webdev.
   - **Artificial Analysis**: Third-party speed (TPS), latency (TTFT), and pricing benchmarks (`output_speed_tps`).
   - Use the highest listed reasoning / harness variant per model. Dropped in 2026-10 and not to be re-added: SWE-bench Verified, LMSYS Chatbot Arena Coding, AIME 2024 / GPQA Diamond / HumanEval+ (reasons in SDD-10 §3.1.1).

---

## 📋 Required Model Metadata Schema

For each model added or updated in `scripts/benchmark-data/benchmark-records.json` (and its alias in `src/processor/model-catalog.ts`):
```typescript
interface RawModelEntry {
  id: string; // e.g. 'claude-sonnet-5', 'gpt-6-astra'
  name: string; // Display name
  vendor: ModelVendor; // 'OpenAI' | 'Anthropic' | 'Google' | 'Microsoft' | 'xAI' | 'Moonshot AI'
  model_family: string;
  color: string; // Hex color code
  is_copilot_native: boolean;
  release_date: string; // 'yyyy-mm-dd'
  release_status: ModelReleaseStatus; // 'GA' | 'Preview' | 'LTS' | 'Utility' | 'Retired'
  // Raw metrics without a verified source (estimates, shown as 推測値 per value). See SDD-10 §3.1.2.
  estimated_metrics?: BenchmarkMetricKey[]; // e.g. ['terminal_bench_4', 'arena_webdev_elo']
  capabilities?: {
    has_1m_context: boolean;
    has_configurable_reasoning: boolean;
    tier?: 'Powerful' | 'Versatile' | 'Lightweight';
  };
  raw_metrics: {
    terminal_bench_4: number; // Terminal-Bench 4.0 (%)
    aa_intelligence_index: number; // AA Intelligence Index v4.3 (points)
    arena_webdev_elo: number; // Arena WebDev Elo
    output_speed_tps: number;
    input_cost_per_m: number;
    output_cost_per_m: number;
    cached_input_cost_per_m?: number;
    context_window_k: number;
    context_window_display?: string;
  };
}
```

---

## 🔄 Execution Workflow

1. Update the records in `scripts/benchmark-data/benchmark-records.json` (externalised JSON data) and add the model aliases to `src/processor/model-catalog.ts`.
2. Ensure model ID normalization is compatible with `src/processor/benchmark-evaluator.ts`.
3. **Synchronize Specification (`supported_models.md`)**:
   - In accordance with `.agents/rules/model-benchmark-management.md`, update all relevant tables in `supported_models.md` (Table 1 Copilot Models, Table 2 Auto Selection, Table 3 Extensions, Table 4 Clients, Table 5 Min IDE, Table 6 Plans, and Table 11 Retirement History).
4. **Check Semiannual Flagship Snapshot Transition (上期・下期完了時点の旗艦4選追加ルール)**:
   - Existing period flagship snapshots (e.g., `flagship-2026`: `🌟 2026上 旗艦4選`) must be kept intact and immutable.
   - When a half-year period concludes (上期/下期完了時点), notify or collaborate with `preset-curator-agent` (`skills/preset-curator`) to **append** a new flagship 4 preset for the completed half (e.g. `flagship-2026-h2`: `🌟 2026下 旗艦4選`, or `flagship-2027-h1`: `🌟 2027上 旗艦4選`) to track generational frontier progress across time.
5. Run the update script:
   ```bash
   npm run benchmark:update
   ```
6. Verify dataset generation and model scores.

