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
   - **SWE-bench Verified**: Self-directed GitHub issue resolving rate (`swe_bench_verified`).
   - **LMSYS Chatbot Arena (Coding)**: Blind human ELO ratings (`arena_coding_elo`).
   - **Artificial Analysis**: Third-party speed (TPS), latency (TTFT), and pricing benchmarks (`output_speed_tps`).
   - **Frontier Technical Reports**: AIME 2024, GPQA Diamond, HumanEval+ scores.

---

## 📋 Required Model Metadata Schema

For each model added or updated in `scripts/update-benchmarks.ts`:
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
  capabilities?: {
    has_1m_context: boolean;
    has_configurable_reasoning: boolean;
    tier?: 'Powerful' | 'Versatile' | 'Lightweight';
  };
  raw_metrics: {
    swe_bench_verified: number;
    humaneval_plus: number;
    aime_2024: number;
    gpqa_diamond: number;
    arena_coding_elo: number;
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

1. Update `LATEST_BENCHMARK_RECORDS` in `scripts/update-benchmarks.ts`.
2. Ensure model ID normalization is compatible with `src/processor/benchmark-evaluator.ts`.
3. **Check Semiannual Flagship Snapshot Transition (上期・下期完了時点の旗艦4選追加ルール)**:
   - Existing period flagship snapshots (e.g., `flagship-2026`: `🌟 2026上 旗艦4選`) must be kept intact and immutable.
   - When a half-year period concludes (上期/下期完了時点), notify or collaborate with `preset-curator-agent` (`skills/preset-curator`) to **append** a new flagship 4 preset for the completed half (e.g. `flagship-2026-h2`: `🌟 2026下 旗艦4選`, or `flagship-2027-h1`: `🌟 2027上 旗艦4選`) to track generational frontier progress across time.
4. Run the update script:
   ```bash
   npm run benchmark:update
   ```
5. Verify dataset generation and model scores.
