[English](11_deep_analysis_view_spec.md) | [日本語](11_deep_analysis_view_spec.ja.md)

---

# SDD-11: Deep Analytics View Specification

- **Document ID**: SPEC-COPILOT-011
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-12 (revised 2026-10-01: profile sources in §2.1 and the data-sufficiency rules in §6; revised 2026-10-03: diagnostic v2 in §7; revised 2026-10-04: adoption maturity v2 in §8)

---

## 1. Overview & Design Philosophy

To delve deeper into GitHub Copilot utilization patterns and empower organizational productivity and optimization, this specification defines the dedicated **Deep Analytics View**.

### 1.1 Background & Purpose
Standard dashboard views (Auto-collected Data, Monthly Report, Model Radar) focus on macro-level summaries across organizations, cost centers, and models. The Deep Analytics View addresses micro-level challenges:
- **Micro-Level Behavioral Diagnostics**: Early detection of anti-patterns where individual developers struggle to benefit from AI assistance or waste engineering time.
- **Continuous Analytical Extensibility**: A pluggable, registry-based architecture accommodating modular diagnostic engines (e.g., prompt churn, model efficiency matrices, peer gap benchmarks).

---

## 2. Feature Placement & Invocation (UI / UX Architecture)

### 2.1 Global Navigation (`ViewNavigation`) & Active Data Source Integration
- Adds the dedicated **"Deep Analytics"** (`deep_analysis`) view to the top `ViewNavigation` bar.
- Icon: `BrainCircuit`. One-click transition to the deep analytics hub.
- **Active Data Source Integration**:
  - **Auto-collected Data**: Analyzes granular telemetry (prompt frequency, suggestions, acceptances, and daily history) for the currently selected scope.
  - **Monthly Usage Report**: Uses the stored monthly deep-analysis archive (`data/processed/deep-analysis/{YYYY-MM}.json`) when it exists (measured telemetry). A monthly CSV carries no per-user daily telemetry, so without an archive the view states "monthly aggregate only — daily diagnosis not available" and why; **no per-user profile is synthesized from the CSV** (the former `adaptReportToProfiles` was removed, see §6.4).
  - **User Upload**: An uploaded CSV is a monthly aggregate as well and gets the same "monthly aggregate only" notice instead of an estimated diagnosis.
  - **Tag AND Filtering**: Synchronizes with global tag filters to restrict the diagnostic cohort to matching developers.
  - Displays a persistent Active Source Status Indicator (Confirmed Telemetry vs. monthly aggregate only / diagnosis unavailable) with the number of target users.

### 2.2 Contextual Deep-Links
- **User Detail & Ranking Table (`UserDetailTable`)**: "Deep Analysis" action button in each user row opens the view with that user preselected.
- **User Detail Table (`UserDetailTable`, monthly report source)**: Action button in each user row allows direct navigation to Deep Analysis from monthly usage report tables.
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
- Per-user profiles (`UserUsageProfile`) come from Auto-collected Data `user_profiles` or from the stored `deep-analysis/{YYYY-MM}.json` archive. They are resolved by the pure function `resolveDeepAnalysisProfiles`.
- A monthly report (CSV) and an uploaded CSV are aggregates without per-user daily telemetry. They yield **no profiles**; the source indicator reads "月次集計のみ・日次診断不可" with the explanation "月次レポート (CSV) にはユーザー別の日次利用実績が含まれないため…". The former synthesis of daily histories from a monthly total (and its estimated "pro-rated" mode) was removed.
- When Auto-collected Data has seats but no collected per-user daily history yet, the view says so instead of showing an empty diagnosis.

### 6.5 Peer benchmark
Peer averages (pooled acceptance rate, daily acceptances, reasoning-heavy model ratio; see §7.4) are computed from the actual profiles in the selected scope. With no comparable profile the benchmark is **omitted** (`peerBenchmarks` absent), never a fixed "typical" value.

## 7. Diagnostic v2: Transparent Signals, Team-Level Default, Data Sufficiency (P3-4)

Diagnostic v2 answers findings B-11 (hardcoded 2025 model IDs), B-12 (statistical validity) and D-04 (individual scoring of an uncalibrated metric). Implementation: `src/processor/diagnostic-config.ts`, `model-classification.ts`, `diagnostic-signals.ts`, `inefficiency-rules.ts`, `inefficiency-diagnostic.ts`.

### 7.1 Model classification catalog
- A model ID is normalized (lowercase, separators unified to `-`) and classified by family rules into a tier: `reasoning_heavy` (e.g. `o1`, `o3`, `*-opus-*`), `heavy` (`*-sonnet-*`, `gemini-*-pro`, `gpt-5`), `standard` (`gpt-4o`, `gpt-4.1`), `light` (`*-flash`, `*-haiku`, `*-mini`, `*-nano`) or `unknown`. A newly released model of a known family needs no code change.
- `overkill_model_addiction` and `model_cost_mismatch` use tier ratios (heavy = `reasoning_heavy` + `heavy`). An `unknown` model counts as neither heavy nor light, and its estimated cost is flagged as assumed. `MODEL_ESTIMATED_CHAT_COST` is kept only as a deprecated table derived from the catalog.

### 7.2 Transparent signals
- Every pattern result carries `evidence[]`: for each rule the **input name, observed value, threshold, rationale** and whether it contributed (`met` / `not_met` / `reference`). The drill-down shows them as "入力値 / しきい値 / 根拠".
- "Probability" is renamed **signal strength** (`signalStrengthPercent`, 0–100): a heuristic rule score, **not a probability**. It is shown as a band (`none` < 15 ≤ `weak` < 40 ≤ `medium` < 70 ≤ `strong`, configurable) plus the 0–100 value. `probabilityPercent` is kept as a deprecated alias with the same value.
- The former "healthy bonus when the acceptance rate is 28% or more" is removed: it contradicted the Acceptance Rate Paradox policy (SDD-06 §4.2).

### 7.3 Data sufficiency control
- Each sample-based pattern has minimums in `DiagnosticConfig.minimums` (defaults: tab spamming ≥ 30 suggestions and ≥ 3 active days; overkill / context-blind chat ≥ 15 chats and ≥ 3 active days; model cost mismatch ≥ 10 chats and ≥ 3 active days; off-hours ≥ 30 actions and ≥ 3 active days; passive seat needs a window of ≥ 7 days). Boundary: `observed >= required` is sufficient.
- Below the minimum the pattern is **not evaluable** (§6): no strength, `signalBand: 'unknown'`, and a reason such as "稼働日数: 2 / 必要 3 以上". `dataSufficiency.checks` lists each requirement with the observed and required values. Fixed small-sample values (such as 12%) are no longer shown.

### 7.4 Window end, time zone and calendar
- The analysis window ends on the **organization's latest data date** (or the `referenceDate` option), not on each user's last history day. A user who stopped working weeks ago therefore shows few active days instead of looking active.
- The weekday of `YYYY-MM-DD` is computed as a UTC calendar date, so it does not depend on the time zone of the machine (`new Date('2026-09-05').getDay()` is Saturday in JST but Friday in America/Los_Angeles). Non-working days = non-working weekdays (default Saturday and Sunday) + the holiday calendar (default: Japanese national holidays of 2026). `timezone` (default `Asia/Tokyo`) resolves "today" when no data decides the window end.
- The metric is "non-working-day activity" computed from **daily** data; it does not claim to detect hours of the day.
- Peer averages use the same definition as the overall KPI: the pooled ratio (sum of acceptances / sum of suggestions), not the mean of individual rates.

### 7.5 Team-level default, individual view and audience
- The default view is **team level** (`diagnoseTeam`): per pattern, the number of members in each signal band and the share with a medium or strong signal. It contains no login, name or per-person value.
- A team with fewer than `minTeamSize` members (default **5**) is not diagnosed ("構成員が 5 人未満…"), and a pattern cell with fewer than `minTeamSize` evaluated members is suppressed, so a small distribution cannot identify a person.
- The **individual view stays** (decision #2 of the improvement plan) behind a toggle. It is for **in-company use only, by employees authorised to view it** (the deployment premise of SDD-01 §1.1), for coaching and support of the person; it must not be used for personnel evaluation or ranking. The view states this.

### 7.6 Configuration and calibration plan
- All thresholds (minimums, band boundaries, minimum team size, holidays, working weekdays, time zone) are in `DiagnosticConfig`; `resolveDiagnosticConfig(overrides)` merges overrides and falls back to the defaults for invalid values. The rule thresholds inside each pattern function are still code constants.
- Status: **uncalibrated** (`calibration.status`, shown in the view). Calibration plan (`CALIBRATION_PLAN`): (1) collect ≥ 6 months of measurements and review the metric distributions per role/team; (2) collect ≥ 50 reviewer labels (valid / false positive / missed); (3) compare precision and recall while moving thresholds and update `DiagnosticConfig`; (4) after calibration, show the observed hit rate per band and switch the status to `calibrated`.

## 8. Adoption Maturity v2: Measured, Window-Based, Team Cells k >= 5 (P3-5)

Adoption maturity v2 answers finding B-06 (the cohort was computed from proxy values and the team breakdown was a company-wide ratio times the head count). Implementation: `src/domain/rules/AdoptionPhaseRule.ts` (`ADOPTION_RULE_V2`, `AdoptionPhaseRule.evaluate`), `src/adapters/github-api/usage-reports/user-report-mapper.ts` (inputs), `src/processor/metrics-aggregator.ts` (distribution), `src/adapters/presenters/AdoptionPresenter.ts` (teams).

### 8.1 Window and inputs
- Window: the last **28 days ending at the organization's latest data day** (not each user's last day). Inputs per user come from the users-1-day report (SDD-03): number of days with any activity, completion (`code_completion` suggestions), chat (`chat_*` interactions or `used_chat`), agent (`used_agent`) and CLI (`copilot_cli` or `used_cli`). They are stored on the profile as `adoption_inputs`, so the applied inputs are inspectable.
- `observedDays` is the number of window days covered by the collected data (dataset-wide). MCP invocations and distinct agent counts are not in the user report, so v1's "MCP / multiple agents" criteria are dropped instead of being estimated.

### 8.2 Rule (uncalibrated heuristics, one place: `ADOPTION_RULE_V2`)
| Phase | Criteria |
| :--- | :--- |
| Multi-Agent | agent days >= 8 and >= 3 surfaces used (completion / chat / agent / CLI) |
| Agent First | agent days >= 3, or chat days >= 8 |
| Code First | some usage, below the Agent First criteria (includes completion-centered use) |
| No Cohort | no activity in the window (only when sufficiently observed) |

Boundaries are inclusive (`>=`). An administrator-defined `overridePhase` wins.

### 8.3 Data sufficiency (no judgement without data)
- `observedDays < 7`: nobody is classified ("観測日数が 7 日未満 …").
- The report carries no agent flag (`agentDays = null`, unknown, never 0): a user is classified only when the chat criterion alone proves Agent First; otherwise the user is **not classified** with a reason, because a lower phase could hide agent usage.
- Unclassified users are **not counted as No Cohort**. They are reported as `unclassified_users` (metric `adoption_unclassified_users`); the evaluated count and every rate use classified users only. The seat count is never substituted for the evaluated count.

### 8.4 Team breakdown (real head count, k >= 5)
- Teams are aggregated from the **classified members** of the selected scope. The company-wide ratio is never apportioned.
- A team with fewer than **5** classified members (`minTeamSize`, same k as SDD-11 §7.5) is merged into one "少人数チーム (合算)" row. If the merged row still has fewer than 5, the distribution is withheld and only the reason and the number of teams are shown. Per-team unclassified counts are shown only for teams that meet k.
- Residual risk: company-wide totals minus the shown teams could still reveal a small merged group when the merged row is withheld. The individual view is available only to authorised employees (§7.5), so this is accepted; the withheld row never shows a person count.
- The screen shows the rule version, window, criteria and unclassified reasons ("判定基準"). Individual classification is for in-company use by authorised employees only.

### 8.5 Calibration
Thresholds are not calibrated. Plan: reuse the reviewer-label procedure of SDD-11 §7.6 for adoption phases (>= 6 months of data, reviewer labels, threshold comparison) and record the calibration status before presenting phases as targets.
