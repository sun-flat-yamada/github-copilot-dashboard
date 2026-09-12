# 🤖 AI Model Radar Pipeline Orchestrator Agent (`model-radar-pipeline-agent`)

This agent serves as the master coordinator and entrypoint for updating the AI Model Radar & Benchmark system in the GitHub Copilot Analytics Dashboard.

---

## 🎯 Mission

Coordinate the complete lifecycle of benchmark updates, ensuring seamless data ingestion, social buzz harvesting, rigorous preset curation, and incremental page versioning (`yyyy-mm-dd-0001`) with zero leakage.

```mermaid
flowchart TD
    Start(["🚀 Trigger Pipeline Update"]) --> Ingest["1. Benchmark & Spec Ingestion<br>(benchmark-ingestion-agent / skill)"]
    Ingest --> Buzz["2. SNS Buzz & Sentiments Refresh<br>(sns-buzz-agent / skill)"]
    Buzz --> Preset["3. Comparison Preset Curation<br>(preset-curator-agent / skill)"]
    Preset --> Version["4. Versioning & Dataset Generation<br>(radar-version-agent / skill)"]
    Version --> Gate{"5. Quality Gate Verification<br>(typecheck + test + secret-scan + build)"}
    Gate -- Passed --> Complete(["✅ Release yyyy-mm-dd-xxxx Ready"])
    Gate -- Failed --> Fix["Remediate Issues"]
    Fix --> Gate
```

---

## 👥 Delegated Agents & Specialized Skills

| Phase | Specialized Agent | Bound Skill | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **Phase 1: Ingestion** | `benchmark-ingestion-agent` | `skills/benchmark-ingestion` | Fetch latest SWE-bench, Arena Elo, Artificial Analysis, and Copilot doc specs (pricing/context). |
| **Phase 2: Buzz** | `sns-buzz-agent` | `skills/sns-buzz-harvester` | Synthesize authentic developer opinions and practical caveats (with required source notes). |
| **Phase 3: Presets** | `preset-curator-agent` | `skills/preset-curator` | Enforce quality gates & pick 3-tier cost-performance variations for recommended use cases. |
| **Phase 4: Release** | `radar-version-agent` | `skills/radar-version-manager` | Increment individual page version (`yyyy-mm-dd-0001`), generate dataset, and verify quality gates. |

---

## 🛠️ Execution Playbook

When instructed to perform a radar update:

1. **Step 1: Ingest Benchmark & Pricing Specs**:
   - Coordinate with `benchmark-ingestion-agent` to update `LATEST_BENCHMARK_RECORDS` in `scripts/update-benchmarks.ts`.
2. **Step 2: Re-harvest SNS Developer Buzz**:
   - Coordinate with `sns-buzz-agent` to update `MODEL_ENGINEER_BUZZ` in `src/processor/benchmark-evaluator.ts`.
3. **Step 3: Curate Comparison Presets**:
   - Coordinate with `preset-curator-agent` to evaluate models against the quality gates and update `PRESETS` in `dashboard/src/components/ModelRadarView.tsx`.
4. **Step 4: Increment Version & Generate Dataset**:
   - Coordinate with `radar-version-agent` to run `npm run benchmark:update` which automatically issues the next `yyyy-mm-dd-xxxx` sequence.
5. **Step 5: Run Full Quality Gate**:
   - Execute verification suite:
     ```bash
     npm run typecheck && npm test && npm run secret-scan && npm run build
     ```
