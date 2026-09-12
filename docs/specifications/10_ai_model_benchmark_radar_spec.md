[English](10_ai_model_benchmark_radar_spec.md) | [日本語](10_ai_model_benchmark_radar_spec.ja.md)

---

# SDD-10: AI Model Benchmark Radar Specification

- **Document ID**: SPEC-COPILOT-010
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-12

---

## 1. Overview & Objectives

Defines the **AI Model Benchmark Radar (AI Model Radar & Benchmark)** subsystem of the GitHub Copilot Analytics Dashboard. This subsystem visualizes the technical capabilities and characteristics of available AI models across a 6-axis radar chart, assisting teams in selecting optimal models for diverse engineering tasks.

In full compliance with official GitHub Copilot documentation, it comprehensively covers supported models (OpenAI, Anthropic, Google, Microsoft, xAI, Moonshot AI), detailing standard/1M **context windows** and **pricing per 1M tokens (Input / Output / Prompt Caching / Long Context)**. It also persistently provides reference citations to official documentation ([supported-models](https://docs.github.com/en/copilot/reference/ai-models/supported-models) and [models-and-pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)).

By integrating prominent industry benchmarks (SWE-bench Verified, AIME 2024, LMSYS Chatbot Arena, Artificial Analysis, etc.), the engine normalizes scores on a 0–100 scale, assigning suitability tags, best-practice recommendations, and developer community observations (*with community sentiment disclaimer*).

---

## 2. Architecture & Layout

### 2.1 Dashboard Integration Modes
- **App Modes (`DashboardAppMode`)**:
  - `'live_metrics'`: API live metrics mode
  - `'monthly_report'`: Monthly Usage Report CSV analytics mode
  - `'model_radar'`: **AI Model Benchmark Radar & Evaluation Mode**
  - `'deep_analysis'`: Deep Analytics View mode
- **Navigation**:
  - One-click switching via header `ModeSwitcher`.
  - Contextual jumps from the Live Metrics tab bar and the model legend in `UserTrendViewer`.

### 2.2 Data Flow
```mermaid
flowchart TD
    subgraph Sources["Industry Benchmark Sources"]
        SWE["SWE-bench Verified (70%+ SOTA)"]
        Arena["LMSYS Chatbot Arena Coding"]
        AA["Artificial Analysis (TPS, TTFT)"]
        Paper["Frontier Tech Reports (AIME, GPQA)"]
    end

    subgraph Evaluator["Evaluation Engine (src/processor/benchmark-evaluator.ts)"]
        Norm["6-Axis Normalization Algorithm (0 - 100)"]
        Tag["Suitability Tags & Composite Grade Assignment"]
        Guide["Copilot Engineering Guidance Generation"]
    end

    subgraph Storage["Dataset (dashboard/public/data/model-benchmarks.json)"]
        JSON["JSON Dataset (v2026.09)"]
    end

    subgraph UI["Frontend (dashboard/src/components/ModelRadarView.tsx)"]
        Chart["Recharts Radar Chart (Up to 4 Overlaid Models)"]
        Cards["Model Diagnostics & Guidance Cards"]
        Table["Raw Benchmark Details Table (Sortable)"]
        Preset["Comparison Presets (Flagship / High-Value / Powerful / Fast)"]
    end

    Sources --> Evaluator
    Evaluator --> Storage
    Storage --> UI
```

### 2.3 Knowledge Model Retention & 0% Share Rendering
- **Persistent Knowledge Retention**:
  Even when analyzed datasets (Live Metrics or Monthly CSV) contain zero requests for a given model, all knowledge-base models remain selectable and visible across model chips, presets, and comparison tables.
- **0% Share for Unused Models**:
  Models with zero internal request volume display an enterprise share of **`0%` (0 req)**, labeled with an "Exploratory / Evaluation Knowledge" badge to guide trial adoption.
- **Identifier Normalization (`normalizeModelId`)**:
  Normalizes label variations (e.g., `Claude 3.7 Sonnet`, `GPT-4o mini`, `o1 (Reasoning)`, `Gemini 2.0 Flash`) to standard knowledge IDs (`claude-3-7-sonnet`, `gpt-4o-mini`, `o1`, `gemini-2-0-flash`).

### 2.4 Quick Navigation in Model Details Card
- **Top Placement**: Positioned at the very top of the card widget above the header.
- **Step Navigation**: `<` and `>` buttons enable swift cycling between selected models (disabled when only 1 model is active).
- **Dropdown Jump**: Clicking the model title reveals a dropdown menu with theme colors, tiers, grades, and an active index counter (e.g., `1 / 4`).

### 2.5 Standard Comparison Presets (`PRESETS`)
- **🌟 2026 Flagship 4 (`flagship-2026`)**: Claude Sonnet 5 / GPT-6 Astra / Gemini 3.8 Flash / Kimi K3
- **💡 Practical High-Value (`practical-high-value`)**: Claude Sonnet 5 / Gemini 3.8 Flash / GPT-5.6 Luna / Kimi K2.7 Code
- **⚡ Powerful Reasoning (`tier-powerful`)**: GPT-6 Astra / Claude Opus 5 / GPT-5.6 Sol / Kimi K3
- **🛠️ Versatile Engineering (`tier-versatile`)**: Claude Sonnet 5 / GPT-5.6 Terra / Gemini 3.8 Flash / Grok 4.6
- **🚀 Lightweight & Fast (`tier-lightweight`)**: GPT-5.6 Luna / Gemini 3.5 Flash / MAI-Code-1.1-Flash / GPT-5.4 mini
- **🟠 Anthropic Suite (`vendor-anthropic`)**: Claude Sonnet 5 / Claude Opus 5 / Claude Fable 5.1 / Claude Haiku 4.5
- **🟢 OpenAI Suite (`vendor-openai`)**: GPT-6 Astra / GPT-5.6 Sol / GPT-5.6 Terra / GPT-5.6 Luna
- **🔵 Google Gemini 3.x (`vendor-google`)**: Gemini 3.8 Flash / Gemini 3.7 Flash / Gemini 3.6 Flash / Gemini 3.5 Flash

---

## 3. Radar Chart 6-Axis Evaluation Metrics

| Metric Key | Display Label | Weight | Reference Benchmarks | Logic & Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `coding_swe` | Coding & SWE | 25% | SWE-bench Verified (85%), HumanEval+ (15%) | Autonomous issue resolution and PR creation; normalized against 75% peak. |
| `reasoning_logic` | Reasoning & Logic | 25% | AIME 2024 (65%), GPQA Diamond (35%) | Chain-of-thought mathematical rigor, complex algorithmic reasoning, edge-case coverage. |
| `arena_elo` | Community & Elo | 15% | LMSYS Chatbot Arena (Coding) | Blind user preference rating (normalized between 1220 and 1460). |
| `speed_latency` | Speed & Latency | 10% | Tokens / sec (TPS), TTFT | Output generation velocity (30 to 180+ TPS piecewise log scaling). |
| `cost_efficiency` | Cost Efficiency | 10% | Pricing per 1M tokens (In/Out) | Inverse evaluation of blended token rates; lower cost yields higher scores. |
| `architecture_design` | Architecture & Context | 15% | Context Window (128K–2M), SWE multi-file | Repository-wide codebase comprehension and multi-file refactoring aptitude. |

---

## 4. Suitability Tags & Model Roster (2026 LTS)

### 4.1 Suitability Tag Criteria
- **`Complex Refactoring`**: `swe_bench_verified >= 62%` or `architecture_design >= 85`
- **`Algorithm Specialist`**: `reasoning_logic >= 85` or `aime_2024 >= 75%`
- **`Fast Inline Suggestion`**: `speed_latency >= 80` or `output_speed_tps >= 100 tps`
- **`Cost Saver`**: `cost_efficiency >= 80`
- **`Ultra-Long Context`**: `context_window_k >= 1000K (1M tokens)`
- **`High-Precision Coding`**: `coding_swe >= 85`
- **`Agent & Multi-Turn`**: `arena_elo >= 85`

### 4.2 GitHub Copilot Supported Models Roster (September 2026)

#### 1. OpenAI (10 Models)
| Model ID | Name | Tier | Status | Context | In / 1M | Out / 1M | Cache Read | Highlights |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `gpt-6-astra` | GPT-6 Astra | Powerful | GA | 272K (1M) | $10.00 | $50.00 | $2.50 | 2026 premier deep-reasoning flagship |
| `gpt-5-6-sol` | GPT-5.6 Sol | Powerful | GA | 272K | $4.00 | $20.00 | $1.00 | GPT-5.6 workhorse for complex tasks |
| `gpt-5-6-terra` | GPT-5.6 Terra | Versatile | GA | 128K | $2.00 | $12.00 | $0.50 | High-speed versatile generalist |
| `gpt-5-6-luna` | GPT-5.6 Luna | Lightweight | GA | 128K | $0.20 | $1.20 | $0.05 | Ultra-fast low-cost inline completions |
| `gpt-5-5` | GPT-5.5 | Powerful | GA | 200K | $5.00 | $30.00 | $1.25 | Frontier reasoning model |
| `gpt-5-4` | GPT-5.4 | Versatile | GA | 128K | $2.50 | $15.00 | $0.62 | Balanced engineering model |
| `gpt-5-4-mini` | GPT-5.4 mini | Versatile | GA | 128K | $0.75 | $4.50 | $0.18 | High speed and value |
| `gpt-5-4-nano` | GPT-5.4 nano | Lightweight | GA | 128K | $0.20 | $1.25 | $0.05 | Ultra-lightweight inline assistant |
| `gpt-5-3-codex` | GPT-5.3-Codex | Versatile | LTS | 128K | $1.75 | $14.00 | $0.43 | Long-term support code specialist |
| `gpt-5-mini` | GPT-5 mini | Lightweight | GA | 128K | $0.25 | $2.00 | $0.06 | Established fast completion model |

#### 2. Anthropic (10 Models)
| Model ID | Name | Tier | Status | Context | In / 1M | Out / 1M | Cache Read/Write | Highlights |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `claude-sonnet-5` | Claude Sonnet 5 | Powerful | GA | 200K (1M) | $2.00 | $10.00 | $0.20 / $2.50 | The standard flagship enterprise driver |
| `claude-opus-5` | Claude Opus 5 | Powerful | GA | 200K (1M) | $5.00 | $25.00 | $0.50 / $6.25 | Deep architectural design & reasoning |
| `claude-fable-5-1` | Claude Fable 5.1 | Powerful | GA | 200K (1M) | $10.00 | $50.00 | $1.00 / $12.50 | EFS/ZDR enterprise security tier |
| `claude-fable-5` | Claude Fable 5 | Powerful | GA | 200K (1M) | $10.00 | $50.00 | $1.00 / $12.50 | Enterprise high-assurance reasoning |
| `claude-opus-4-8` | Claude Opus 4.8 | Powerful | GA | 200K | $5.00 | $25.00 | $0.50 / $6.25 | Deep analytical reasoning |
| `claude-opus-4-8-fast` | Claude Opus 4.8 Fast | Powerful | GA | 200K | $10.00 | $50.00 | $1.00 / $12.50 | Fast-mode Opus |
| `claude-opus-4-7` | Claude Opus 4.7 | Powerful | GA | 200K | $5.00 | $25.00 | $0.50 / $6.25 | Advanced reasoning |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 | Versatile | GA | 200K | $3.00 | $15.00 | $0.30 / $3.75 | Versatile balanced coding |
| `claude-sonnet-4` | Claude Sonnet 4 | Versatile | GA | 200K | $3.00 | $15.00 | $0.30 / $3.75 | Reliable code completion |
| `claude-haiku-4-5` | Claude Haiku 4.5 | Lightweight | GA | 200K | $1.00 | $5.00 | $0.10 / $1.25 | Ultra-lightweight and responsive |

#### 3. Google (4 Models)
| Model ID | Name | Tier | Status | Context | In / 1M | Out / 1M | Highlights |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `gemini-3-8-flash` | Gemini 3.8 Flash | Versatile | GA | 1M Tok | $0.75 | $3.75 | Latest Flash (promotional rate) / 1M tokens |
| `gemini-3-7-flash` | Gemini 3.7 Flash | Versatile | GA | 1M Tok | $0.75 | $3.75 | CoT reasoning & high-velocity coding |
| `gemini-3-6-flash` | Gemini 3.6 Flash | Versatile | GA | 1M Tok | $0.75 | $3.75 | 1M long-context generalist |
| `gemini-3-5-flash` | Gemini 3.5 Flash | Versatile | GA | 1M Tok | $1.50 | $9.00 | Proven Flash workhorse |

#### 4. Microsoft / xAI / Moonshot AI (5 Models)
| Model ID | Name | Provider | Tier | Status | Context | In / Out / 1M | Highlights |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mai-code-1-1-flash` | MAI-Code-1.1-Flash | Microsoft | Lightweight | GA | 128K | $0.20 / $1.20 | Microsoft ultra-fast code specialist |
| `grok-4-6` | Grok 4.6 | xAI | Versatile | GA | 200K | $2.00 / $6.00 | High-accuracy practical coding |
| `grok-4-5` | Grok 4.5 | xAI | Versatile | GA | 200K | $2.00 / $6.00 | Versatile code completion |
| `kimi-k3` | Kimi K3 | Moonshot AI | Powerful | GA | 1M | $3.00 / $15.00 | 1M long-context reasoning |
| `kimi-k2-7-code` | Kimi K2.7 Code | Moonshot AI | Versatile | GA | 256K | $0.95 / $4.00 | 256K code specialist, high value |

#### 5. Classic & External Comparison Reference Models
Claude 3.7 Sonnet, Claude 3.5 Sonnet, GPT-4o, GPT-4o mini, o1, o3-mini, Gemini 2.0 Flash, Gemini 2.5 Pro, DeepSeek R1.

### 4.3 Official Citations
- 📘 **Supported AI Models in Copilot**: `https://docs.github.com/en/copilot/reference/ai-models/supported-models`
- 💳 **Copilot Models & Pricing**: `https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing`

---

## 5. Benchmark Source Explanations & Community Observations

### 5.1 Source Descriptions
1. **SWE-bench Verified Leaderboard**: Real-world open-source issues (Django, SymPy); measures autonomous patch generation.
2. **LMSYS Chatbot Arena (Coding)**: Blind head-to-head evaluation by real developers; reflects human programmer satisfaction.
3. **Artificial Analysis**: Measured tokens-per-second (TPS), time-to-first-token (TTFT), and true blended pricing.
4. **Frontier Technical Reports (AIME / GPQA / HumanEval+)**: Complex Olympiad-level mathematics and scientific reasoning.

### 5.2 Community Observations Disclaimer
All community observations, tips, and quirks featured in model detail cards must prominently display a disclaimer badge: `* Community Sentiment & Developer Rumor`.

---

## 6. CLI Commands & Verification

- **Update Benchmarks**:
  ```bash
  npm run benchmark:update
  ```
- **Quality Gate**:
  ```bash
  npm run typecheck && npm test && npm run secret-scan && npm run build
  ```
