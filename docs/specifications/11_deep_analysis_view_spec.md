[English](11_deep_analysis_view_spec.md) | [日本語](11_deep_analysis_view_spec.ja.md)

---

# SDD-11: Deep Analytics View Specification

- **Document ID**: SPEC-COPILOT-011
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-12

---

## 1. Overview & Design Philosophy

To delve deeper into GitHub Copilot utilization patterns and empower organizational productivity and optimization, this specification defines the dedicated **Deep Analytics View**.

### 1.1 Background & Purpose
Standard dashboard views (Live Metrics, Monthly Report, Model Radar) focus on macro-level summaries across organizations, cost centers, and models. The Deep Analytics View addresses micro-level challenges:
- **Micro-Level Behavioral Diagnostics**: Early detection of anti-patterns where individual developers struggle to benefit from AI assistance or waste engineering time.
- **Continuous Analytical Extensibility**: A pluggable, registry-based architecture accommodating modular diagnostic engines (e.g., prompt churn, model efficiency matrices, peer gap benchmarks).

---

## 2. Feature Placement & Invocation (UI / UX Architecture)

### 2.1 Global Navigation (`ModeSwitcher`)
- Adds the 4th mode **"Deep Analytics"** (`deep_analysis`) to the header `ModeSwitcher`.
- Icon: `BrainCircuit`. One-click transition to the deep analytics hub.

### 2.2 Contextual Deep-Links
- **User Detail Table (`UserDetailTable`)**: "Deep Analysis" action button in each user row opens the view with that user preselected.
- **User Trend Viewer (`UserTrendViewer`)**: "Deep Analyze this User" button in the profile header.
- **Group Usage Rankings (`GroupUsageRanking`)**: Row click or direct action link transitions straight to deep diagnostics.

### 2.3 Analysis Method Selector
A modular selector at the top switches between diagnostic engines:
1. **Inefficient AI Pattern Diagnostic** [Active / Current Release]
2. **Model Cost-Efficiency Matrix** [Coming Soon]
3. **Prompt Churn & Iteration Loop** [Coming Soon]
4. **Peer Gap Benchmark** [Coming Soon]

---

## 3. Initial Diagnostic Engine: Inefficient AI Pattern Diagnostic

### 3.1 Scope & Date Filtering
- **Target**: Selected user usage records (`UserUsageProfile.daily_history`).
- **Date Filter Presets**:
  - `[Past Month]` (Default: rolling 30 days)
  - `[Today]` (Most recent day)
  - `[Past Week]` (Rolling 7 days)
  - `[Custom Date Range]`: Arbitrary start and end dates via `<input type="date">` inputs.

### 3.2 Anti-Pattern Definitions & Probability Models

Evaluates 5 prevalent AI coding anti-patterns:

| Pattern ID | Pattern Name | Indicators & Evaluation Rationale | Risk Thresholds |
| :--- | :--- | :--- | :--- |
| `tab_spamming_roulette` | **Generation Roulette / Passive Tab Spamming** | High suggestion volume (>40/day) paired with extremely low acceptance (<15%). Indicates repetitive regeneration and blind tab-spamming. | Prob $\ge 70\%$: High<br>40–69%: Medium |
| `overkill_model_addiction` | **Overkill Heavy Model Addiction** | Heavy reasoning models (e.g., o1) exceed 70% of routine interactions without utilizing lightweight models (e.g., Gemini Flash). | Prob $\ge 70\%$: High<br>40–69%: Medium |
| `context_blind_chat_churn` | **Context-Blind Chat Churn** | Excessive chat turns (>15/day) with negligible code adoption. Excludes high-yield inline pair-programming ($\ge 20$ lines/prompt). | Prob $\ge 70\%$: High<br>40–69%: Medium |
| `passive_seat_disengaged` | **Disengaged / Abandoned Seat Candidate** | Active days under 20% of the period, or nominal usage indicating lack of workflow onboarding. | Prob $\ge 70\%$: High<br>40–69%: Medium |
| `off_hours_workload_spike` | **Off-Hours Overload / Smart Offload** | Cross-references weekend/holiday activity ($\ge 20\%$) with Autonomy Depth. Autonomous delegation to reasoning models qualifies as **"🌟 Smart Offload (Healthy)"**. Only repetitive manual bursts flag "Firefighting Struggle (High)". | Firefighting: $\ge 70\%$ (High)<br>Smart Offload: $\le 15\%$ (Healthy) |

### 3.3 Autonomy Depth & the "Time Window $\times$ Autonomy" Matrix

Reflecting the evolution of AI coding from line completions to autonomous agents, the engine computes **Autonomous Execution Duration per Prompt (AEDP)**.

```
                  【Autonomous Execution Duration per Prompt (AEDP)】
                                  Long Autonomy
                                       ▲
                                       │
           ③ Background Async Worker   │ ① Smart Offload (Weekend Agent)
           ────────────────────────────┼────────────────────────────
           - Heavy tasks delegated     │ - Agent executes tasks overnight/weekend
             during business hours     │ - Human engagement is minimal
           - Human focuses on reviews  │ - [Rating: High-efficiency, Healthy]
           - [Rating: Exemplary model] │
                                       │
On-Hours ──────────────────────────────┼────────────────────────────── Off-Hours
                                       │
           ④ Inline Flow Pair-Prog     │ ② Weekend Firefighting Struggle
           ────────────────────────────┼────────────────────────────
           - Routine inline completion │ - Repetitive manual prompts on weekend
           - High concentration flow   │ - Battling hallucinations/regressions
           - [Rating: Healthy routine] │ - [Rating: High Risk Overload]
                                       ▼
                             Short Micro-bursts
```

#### Autonomy Depth Score (0–100) Factors:
1. **Reasoning Model Gravity**: Share of deep reasoning models (o1, o3-mini, Claude 3.7 Thinking, Gemini 2.5 Pro).
2. **Yield per Prompt**: Accepted lines per chat (`lines_accepted / total_chats`). File-level generation ($\ge 25$ lines) qualifies as extended autonomy.
3. **Prompt Sparsity**: Concentrated delegation vs. rapid-fire manual prompt micro-bursts.

#### Diagnostic Branching:
- **Smart Offload**: Users with high weekend activity but Autonomy Depth $\ge 50$ pt receive zero overload penalties, plus a +5 pt health bonus.
- **Firefighting Struggle**: High weekend activity with Autonomy Depth $< 40$ pt flags a "High Risk Overload" warning.
- **Inline Flow Pair-Programming**: Frequent on-hours chats with adequate code yield reduce Context-Blind Churn probability by up to 60%.

---

## 4. Visual Layout Specifications
1. **AI Usage Health Score Meter**: 0–100 scale (Healthy: 80+ [green], Caution: 60–79 [yellow], Needs Improvement: $\le 59$ [red]).
2. **Anti-Pattern Diagnostic Cards**:
   - Prominent probability percentage display.
   - Risk level badges (High / Medium / Low / Healthy).
   - Contributing factor comparisons against baseline thresholds.
   - Expandable drill-down panels.
3. **Drill-Down Analytics Panels**:
   - **Daily Activity Trends**: Chronological suggestions, acceptances, rates, and chats.
   - **Model Balance & Cost Breakdown**: Consumption split and estimated costs.
   - **Peer Benchmarking**: Variances from organization/department averages.
   - **Personalized Prescriptions**: Actionable engineering tips copyable in one click.

---

## 5. Extensibility Architecture

To register a new diagnostic method:
1. Define method ID and I/O contracts in `src/types/deep-analysis.ts`.
2. Implement computational logic in `src/processor/`.
3. Register the definition object in `ANALYSIS_METHODS_REGISTRY`.
4. The UI selector automatically includes the new method, dynamically rendering its custom component.
