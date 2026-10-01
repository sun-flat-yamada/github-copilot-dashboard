[English](11_deep_analysis_view_spec.md) | [日本語](11_deep_analysis_view_spec.ja.md)

---

# SDD-11: Deep Analytics View Specification

- **Document ID**: SPEC-COPILOT-011
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-12 (revised 2026-10-01: profile sources in §2.1 and the data-sufficiency rules in §6)

---

## 1. Overview & Design Philosophy

To delve deeper into GitHub Copilot utilization patterns and empower organizational productivity and optimization, this specification defines the dedicated **Deep Analytics View**.

### 1.1 Background & Purpose
Standard dashboard views (Live Metrics, Monthly Report, Model Radar) focus on macro-level summaries across organizations, cost centers, and models. The Deep Analytics View addresses micro-level challenges:
- **Micro-Level Behavioral Diagnostics**: Early detection of anti-patterns where individual developers struggle to benefit from AI assistance or waste engineering time.
- **Continuous Analytical Extensibility**: A pluggable, registry-based architecture accommodating modular diagnostic engines (e.g., prompt churn, model efficiency matrices, peer gap benchmarks).

---

## 2. Feature Placement & Invocation (UI / UX Architecture)

### 2.1 Global Navigation (`ViewNavigation`) & Active Data Source Integration
- Adds the dedicated **"Deep Analytics"** (`deep_analysis`) view to the top `ViewNavigation` bar.
- Icon: `BrainCircuit`. One-click transition to the deep analytics hub.
- **Active Data Source Integration**:
  - **Live Metrics**: Analyzes granular telemetry (prompt frequency, suggestions, acceptances, and daily history) for the currently selected scope.
  - **Monthly Usage Report**: Uses the stored monthly deep-analysis archive (`data/processed/deep-analysis/{YYYY-MM}.json`) when it exists (measured telemetry). A monthly CSV carries no per-user daily telemetry, so without an archive the view states "monthly aggregate only — daily diagnosis not available" and why; **no per-user profile is synthesized from the CSV** (the former `adaptReportToProfiles` was removed, see §6.4).
  - **User Upload**: An uploaded CSV is a monthly aggregate as well and gets the same "monthly aggregate only" notice instead of an estimated diagnosis.
  - **Tag AND Filtering**: Synchronizes with global tag filters to restrict the diagnostic cohort to matching developers.
  - Displays a persistent Active Source Status Indicator (Confirmed Telemetry vs. monthly aggregate only / diagnosis unavailable) with the number of target users.

### 2.2 Contextual Deep-Links
- **User Detail & Ranking Table (`UserDetailTable`)**: "Deep Analysis" action button in each user row opens the view with that user preselected.
- **Monthly Report User Table (`MonthlyReportUserTable`)**: Action button in each user row allows direct navigation to Deep Analysis from monthly usage report tables.
- **User Trend Viewer (`UserTrendViewer`)**: "Deep Analyze this User" button in the profile header.

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
| `tab_spamming_roulette` | **Generation Roulette / Passive Tab Spamming** | High suggestion volume (>40/day) paired with extremely low inline completion acceptance (<15%). Indicates repetitive regeneration and blind tab-spamming.<br>**[CLI/Autopilot Compensation]**: For users actively utilizing Agent sessions or CLI/Chat workflows, manual inline completion acceptance rates are structurally depressed (Acceptance Rate Paradox). The diagnostic automatically suppresses penalty to Healthy/Low. | Prob $\ge 70\%$: High<br>40–69%: Medium<br>*Suppressed to Healthy/Low for Agent/CLI users* |
| `overkill_model_addiction` | **Overkill Heavy Model Addiction** | Heavy reasoning models (e.g., o1) exceed 70% of routine interactions without utilizing lightweight models (e.g., Gemini Flash). | Prob $\ge 70\%$: High<br>40–69%: Medium |
| `context_blind_chat_churn` | **Context-Blind Chat Churn** | Excessive chat turns (>15/day) with negligible code adoption. Excludes high-yield inline pair-programming ($\ge 20$ lines/prompt). | Prob $\ge 70\%$: High<br>40–69%: Medium |
| `passive_seat_disengaged` | **Disengaged / Abandoned Seat Candidate** | Active days under 20% of the period, or nominal usage indicating lack of workflow onboarding. | Prob $\ge 70\%$: High<br>40–69%: Medium |
| `off_hours_workload_spike` | **Off-Hours Overload / Smart Offload** | Cross-references weekend/holiday activity ($\ge 20\%$) with Autonomy Depth. Autonomous delegation to reasoning models qualifies as **"🌟 Smart Offload (Healthy)"**. Only repetitive manual bursts flag "Firefighting Struggle (High)". | Firefighting: $\ge 70\%$ (High)<br>Smart Offload: $\le 15\%$ (Healthy) |

Four further patterns added after the initial specification — `credit_burn_overdrive`, `agent_abandonment`, `model_cost_mismatch`, `review_bypass` — are defined in `src/processor/inefficiency-rules.ts`. Those that depend on credit, Agent-session or PR measurements are subject to the evaluability rules of §6.

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
   - **Daily Activity Trends**: Chronological suggestions, acceptances, inline completion rates, and chats.
   - **Model Balance & Cost Breakdown**: Consumption split and estimated costs.
   - **Peer Benchmarking**: Variances from the averages of the actual profiles in the selected scope (omitted when there are none, §6.5).
   - **Personalized Prescriptions**: Actionable engineering tips copyable in one click.

---

## 5. Extensibility Architecture

To register a new diagnostic method:
1. Define method ID and I/O contracts in `src/types/deep-analysis.ts`.
2. Implement computational logic in `src/processor/`.
3. Register the definition object in `ANALYSIS_METHODS_REGISTRY`.
4. The UI selector automatically includes the new method, dynamically rendering its custom component.

---

## 6. Data Sufficiency & No-Fabrication Rules (P0-4)

The diagnostic engine judges behaviour; a judgement made from invented inputs is worse than none, because "no sign of a problem" is read as reassurance. Every pattern is therefore evaluated **only from measured values**.

### 6.1 Principle
- A pattern whose required measurements are missing is returned as **not evaluable**: `evaluable: false`, `probabilityPercent: 0` (meaningless), `riskLevel: healthy` (neutral placeholder) and an `insufficientDataReason` that tells the user what is missing.
- Missing inputs are **never replaced by constants**. Removed assumptions: a 3,900-credit default baseline, "25% of sessions are short / 70% are completed", "agent PRs = 10% of sessions", a 60-minute merge time and 0 unreviewed PRs.

### 6.2 Conditions that make a pattern not evaluable
| Pattern | Not evaluable when | Reason shown |
|:--|:--|:--|
| `credit_burn_overdrive` | the monthly credit baseline (individual limit or the plan's included credits) cannot be determined | "月間クレジットの基準値 (個人上限またはプラン別の包含量) を特定できません。" |
| `agent_abandonment` | the total session count is missing, or both the completed and the short-session counts are missing | "Agent セッションの完了数・短時間中断数が取得できていません。" |
| `review_bypass` | the number of agent-created PRs or of unreviewed PRs is missing | "Agent が作成した PR の件数・未レビュー件数が取得できていません。" |

### 6.3 Health score and coverage
- `healthScore` is computed from the **evaluated** patterns only (a not-evaluable pattern adds no penalty). `UserDiagnosticResult` carries `evaluatedPatternCount` and `patternCount`.
- When `evaluatedPatternCount = 0` the score is **not shown** ("—", "判定に必要な実測値が揃っていないため、スコアを算出できません"): "all patterns unjudgeable" is never displayed as "healthy, 100". When coverage is partial the meter shows "評価できたパターン N / M (判定不能のパターンはスコアに含まれません)".
- A not-evaluable pattern card shows "判定不能 (データ不足)" and the reason instead of a probability, and it is excluded from the "N 件 要注意" (patterns needing attention) counts in `HealthScoreCard` and the drill-down panel.

### 6.4 Profiles come from measurements only
- Per-user profiles (`UserUsageProfile`) come from Live Metrics `user_profiles` or from the stored `deep-analysis/{YYYY-MM}.json` archive. They are resolved by the pure function `resolveDeepAnalysisProfiles`.
- A monthly report (CSV) and an uploaded CSV are aggregates without per-user daily telemetry. They yield **no profiles**; the source indicator reads "月次集計のみ・日次診断不可" with the explanation "月次レポート (CSV) にはユーザー別の日次利用実績が含まれないため…". The former synthesis of daily histories from a monthly total (and its estimated "pro-rated" mode) was removed.
- When Live Metrics has seats but no collected per-user daily history yet, the view says so instead of showing an empty diagnosis.

### 6.5 Peer benchmark
Peer averages (acceptance rate, daily acceptances, heavy-model ratio) are computed from the actual profiles in the selected scope. With no comparable profile the benchmark is **omitted** (`peerBenchmarks` absent), never a fixed "typical" value.
