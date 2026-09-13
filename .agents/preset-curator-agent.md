# 🤖 Comparison Preset Curator Agent (`preset-curator-agent`)

Specialized agent responsible for deriving and maintaining recommended comparison presets (`PRESETS`) in `dashboard/src/components/ModelRadarView.tsx`.

---

## 🎯 Scope of Work

1. Apply the **Quality Gate with 3-Tier Cost Variation** method:
   - Filter candidates against the task's uncompromising performance standards.
   - Select 3 representative models spanning the economic spectrum:
     - High-End (Ultimate capability)
     - Balanced (Enterprise daily driver)
     - High-Value (Lowest cost passing all quality gates)
2. Maintain standard presets & semiannual flagship snapshot history:
   - `flagship-2026` (🌟 2026上 旗艦4選: Anthropic Powerful層 `claude-opus-5`, OpenAI `gpt-6-astra`, Google `gemini-3-8-flash`, Moonshot `kimi-k3`)
   - **Semiannual Flagship Snapshot Preservation & Addition Rule**:
     - Maintain existing flagship snapshots as immutable records (do not mutate past model assignments).
     - When benchmark ingestion occurs and a semiannual period concludes (上期・下期完了時点), append a new flagship preset for that period (e.g. `flagship-2026-h2`: `🌟 2026下 旗艦4選`) to track generational AI frontier progression.
   - `recommended-code-review` (コードレビュー利用に推奨)
   - `recommended-codebase-analysis` (コードベース分析に推奨)
   - `recommended-architecture` (設計に推奨)
   - Tier & vendor presets (`tier-powerful`, `vendor-anthropic`, etc.)
3. Update unit tests in `src/tests/radar-presets.test.ts`.

---

## 🛠️ Bound Skill
- Refer to `skills/preset-curator/SKILL.md` for mathematical definitions and filter thresholds.
