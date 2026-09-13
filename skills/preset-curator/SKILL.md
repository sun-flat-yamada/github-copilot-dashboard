---
name: preset-curator
description: Evaluate AI model benchmarks and curate comparison presets ensuring top-tier performance standards while providing a 3-tier cost-performance variation.
---

# 🎯 AI Model Radar Preset Curator Skill

Use this skill when defining, reviewing, or updating comparison presets (`PRESETS`) in the AI Model Radar (`ModelRadarView.tsx`).
It establishes a rigorous, reproducible methodology for selecting optimal model subsets according to real-world engineering use cases.

---

## 🏛️ Core Principle: Top-Tier Quality Gate with 3-Tier Cost Variation

When curating recommendation presets (e.g., Code Review, Codebase Analysis, Architecture & Design):
1. **Never Compromise on Top-Tier Quality (Quality Gate)**:
   - First filter candidate models against the strict quality thresholds required for the specific engineering task.
   - Do NOT lower standards to include cheap models that fail to meet task requirements.
2. **Select Top 3 Models Spanning the Cost-Performance Spectrum**:
   - From the models passing the quality gate, select exactly 3 models representing:
     - **Tier 1 (High-End / Extreme Frontier)**: SOTA reasoning & intelligence, regardless of premium pricing.
     - **Tier 2 (Balanced / Standard Workhorse)**: SOTA or near-SOTA performance with balanced, sustainable enterprise pricing.
     - **Tier 3 (High-Value / High-Efficiency)**: Passes all quality gates while offering dramatically lower token pricing and fast throughput.

---

## 📊 Quality Gate & Cost Metric Calculations

### 1. Blended Cost Formula
To evaluate true operational token economics:
$$\text{Blended Cost} = (\text{Input Cost per 1M} \times 0.4) + (\text{Output Cost per 1M} \times 0.6)$$
*For long context tasks (>200K tokens), also evaluate prompt caching read/write rates.*

### 2. Standard Quality Gates by Use Case

| Use Case | Required Quality Gate (All must pass) | Evaluation Focus |
| :--- | :--- | :--- |
| **🔍 コードレビュー利用に推奨** (`recommended-code-review`) | • `swe_bench_verified >= 70.0%`<br>• `reasoning_logic >= 95`<br>• `arena_coding_elo >= 1420` | Depth of reasoning to catch subtle bugs, logic flaws, and regressions in PR diffs without hallucinations. |
| **📂 コードベース分析に推奨** (`recommended-codebase-analysis`) | • `context_window_k >= 1000` (1M+ tokens)<br>• `architecture_design >= 92`<br>• `swe_bench_verified >= 70.0%` | Large context repository ingestion, multi-file dependency graph analysis, and cross-module refactoring. |
| **🏛️ 設計に推奨** (`recommended-architecture`) | • `reasoning_logic >= 95`<br>• `architecture_design >= 90`<br>• `swe_bench_verified >= 70.0%` | High-level system design, schema modeling, API contract definition, and edge-case architectural trade-offs. |

### 3. Flagship 4 Semiannual Snapshot Policy & Selection Criteria (`flagship-2026`, etc.)
To maintain historical reproducibility and track generational AI model progression:
- **Snapshot Preservation Rule**:
  - Existing period flagship presets (e.g., `flagship-2026`: `🌟 2026上 旗艦4選`) **MUST BE PRESERVED AS IMMUTABLE SNAPSHOTS**. Never overwrite or alter past models in preserved snapshots.
  - Initial snapshot: `flagship-2026` (`🌟 2026上 旗艦4選` representing Claude Opus 5, GPT-6 Astra, Gemini 3.8 Flash, Kimi K3).
- **Semiannual Benchmark Ingestion & Preset Addition Rule**:
  - When benchmark updates occur and a half-year period concludes (上期・下期完了時点):
    - At the end of the first half (上期完了時点), retain `flagship-YYYY-h1` (e.g., `2026上 旗艦4選`).
    - At the end of the second half (下期完了時点), **ADD a new flagship preset** for the completed period (e.g., `flagship-2026-h2`: `🌟 2026下 旗艦4選`, or `flagship-2027-h1`: `🌟 2027上 旗艦4選`) without overwriting previous period snapshots.
- **Flagship 4 Selection Criteria (per vendor)**:
  For any flagship comparison preset, select exactly 4 models representing the premier frontier models of major AI vendors at that period:
  - **Anthropic**: Must select the **Powerful** reasoning tier flagship (`claude-opus-5`, SWE 81.0%, In: $5 / Out: $25) rather than Versatile tier (`claude-sonnet-5`), ensuring top-of-the-line deep reasoning representation.
  - **OpenAI**: Frontier reasoning flagship (`gpt-6-astra`, SWE 82.4%, In: $10 / Out: $50).
  - **Google**: Frontier 1M-context flagship (`gemini-3-8-flash`, SWE 71.0%, In: $0.75 / Out: $3.75).
  - **Moonshot AI / Alternative Frontier**: Frontier reasoning flagship (`kimi-k3`, SWE 73.5%, In: $0.80 / Out: $4.00).

---

## 🛠️ Step-by-Step Preset Update Procedure

When new benchmarks are ingested or new models are released:

1. **Load Current Benchmark Dataset**:
   ```bash
   node -e "
   const fs = require('fs');
   const data = JSON.parse(fs.readFileSync('dashboard/public/data/model-benchmarks.json', 'utf8'));
   console.log('Total models:', data.models.length);
   "
   ```

2. **Filter Qualified Candidates for Target Use Case**:
   - Run a filter script evaluating candidates against the specific use case quality gate.

3. **Rank Candidates by Blended Cost**:
   - Sort qualified candidates from highest cost to lowest cost.

4. **Select Top 3 Representatives**:
   - Pick the top-performing flagship (High-End).
   - Pick the enterprise sweet-spot model (Balanced).
   - Pick the lowest-cost model that still passed the quality gate (High-Value).

5. **Update Preset Definition**:
   - Modify `PRESETS` array in `dashboard/src/components/ModelRadarView.tsx`.
   - Update `src/tests/radar-presets.test.ts` to assert the 3 selected models.
   - Run tests: `npm test`.
