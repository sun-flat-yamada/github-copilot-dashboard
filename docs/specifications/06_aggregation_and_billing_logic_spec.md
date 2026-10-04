[English](06_aggregation_and_billing_logic_spec.md) | [日本語](06_aggregation_and_billing_logic_spec.ja.md)

---

# SDD-06: Aggregation & Billing Logic Specification

- **Document ID**: SPEC-COPILOT-006
- **Status**: Approved / Active
- **Target Version**: 2026.09-LTS
- **Date**: 2026-09-10

---

## 1. Cost Calculation Models

Supports two calculation methodologies based on the GitHub Copilot licensing model:

### 1.1 Monthly Flat Rate Calculation
Computes monthly license charges (Business: \$19/month, Enterprise: \$39/month) based on seat assignment duration or end-of-month assigned seats:
$$\text{Monthly Cost} = \sum_{\text{user} \in \text{Seats}} \text{Price}(\text{user.plan})$$

`Price(plan)` comes from the pricing catalog (SDD-03 §5.1) unless an Enterprise contract configuration overrides it. **A seat whose `plan_type` is missing or unrecognized (`unknown`) is not priced**: its cost is *unconfirmed* (`cost_unconfirmed: true`, monthly cost 0) instead of being assumed to be Enterprise (\$39). Unconfirmed seats are excluded from every cost total and counted in `overview.cost_unconfirmed_seats`; the UI shows "—" with the reason rather than \$0.00.

### 1.2 Cost Center Budget Management Model
Calculates the following financial indicators against each Cost Center budget defined in GitHub Enterprise Billing:
1. **Budget Limit ($B_{\text{limit}}$)**: Configured spending cap for the period or month.
2. **Free Budget ($B_{\text{free}}$)**: Complimentary credit or bundled tier allowance.
3. **Current Usage ($S_{\text{current}}$)**: Total consumption by all seats belonging to the Cost Center.
4. **Billable Usage ($S_{\text{billable}}$)**:
   $$S_{\text{billable}} = \max(0, S_{\text{current}} - B_{\text{free}})$$
5. **Remaining Budget ($B_{\text{remaining}}$)**:
6. **Adoption maturity** is derived from measured usage days in a 28-day window and shown per team only for groups of 5 or more classified members; users without enough data are reported as unclassified, never as No Cohort (SDD-11 §8).
   $$B_{\text{remaining}} = \max(0, B_{\text{limit}} - S_{\text{billable}})$$
6. **Budget Consumption Ratio ($U_{\%}$)**:
   $$U_{\%} = \frac{S_{\text{billable}}}{B_{\text{limit}}} \times 100\%$$
   - $U_{\%} < 80\%$: Normal (`normal`)
   - $80\% \le U_{\%} < 100\%$: Warning threshold (`warning`)
   - $U_{\%} \ge 100\%$: Exceeded threshold (`exceeded`)

**Definitions and the single implementation**
- *Gross* (`current_spend_usd`) is the consumption before the free tier; *net billable* (`net_billable_spend_usd`) is after it. The ratio is computed on the **net** value.
- `remaining` is never negative (clamped at 0). A limit of 0 or less means "no limit configured": utilization is 0 and the status is `normal`.
- `BudgetUtilizationRule` (`evaluateUsd`) is the **only** implementation. The pipeline (`BillingCalculator`), the client-side filter re-aggregation (`filterEngine`) and the monthly-report budgets (`App.tsx`) all call it, so the same inputs produce the same net / remaining / percent / status everywhere (money to 2 decimals, percentage to 1 decimal). Applying a filter re-evaluates `status` and `budget_utilization_percent`, not only the amounts.
- The Cost Center budget is a **monthly** frame, so the usage evaluated against it is always the monthly seat cost (the same basis as the pipeline), even when the dashboard shows a daily or custom scope.
- Limits and free tiers come only from the administrator's declaration (`COPILOT_COST_CENTER_BUDGETS`); GitHub's public API does not return them and nothing is generated or guessed. An unparsable declaration is recorded as a configuration issue.

### 1.3 Enterprise Agreement (EA) Contract Pricing, Period Configuration & Public Exchange Rate Auto-Calculation

#### 1.3.1 Baseline USD Definition (GitHub Catalog Price)
- The primary **USD values throughout the dashboard explicitly represent the "GitHub Catalog Price (USD)" (list price: Business \$19/month, Enterprise \$39/month, AI Credits \$0.01/AIC)**.
- KPI summary cards, table headers, and UI tooltips clearly denote this as GitHub Catalog Price (USD).
- Unified **"EA Contract Rate Sub-Currency Units (EA-USD, EA-JPY, EA-EUR)"** are provided, allowing side-by-side comparison between the catalog list price and user-configured EA contract rate effective prices (e.g. `$39.00 ($33.15 EA)`, `$39.00 (¥4,973)`, `$39.00 (€30.50)`). Options omit bracket descriptions and are unified under a top comment.

#### 1.3.2 Period-Based Parameter Configuration (`periods`)
To adapt to corporate fiscal years and contract cycles, parameters can be customized for specific date ranges from `startMonth` (YYYY-MM) to `endMonth` (YYYY-MM):
1. **Copilot Seat Pricing**: Monthly cost and currency unit for Enterprise and Business plans (e.g. `customSeatPricing: { businessMonthly: 2500, enterpriseMonthly: 5000, currency: "JPY" }`).
2. **AI Credit Unit Price**: Contractual unit price and currency unit (e.g. `customPricePerCredit: 1.273`, `customPricePerCreditCurrency: "JPY"`).
3. **EA Discount Percentage**: Volume discount rate (e.g. `discountPercent: 15`).
4. **USD to Target Currency Exchange Rate**: Contract exchange rate (e.g. `exchangeRateFromUSD: 155.0` or `exchangeRates: { JPY: 155.0, EUR: 0.92 }`).

**Default Fallback Rule**:
- Any month outside the configured `startMonth` to `endMonth` intervals automatically falls back to default baseline values (GitHub catalog price and global configuration).

#### 1.3.3 Exchange Rates for Unconfigured Months (Exchange-Rate Catalog)
- Months without an explicit exchange rate are converted with the **exchange-rate catalog** (`data/catalog/exchange-rates.json`) monthly averages.
- `npm run catalog:fx` (one step of the collection workflow) fetches the **ECB monthly averages** (`EXR/M.<currency>.EUR.SP00.A`), converts them to a USD base (1 USD = N units) and stores them with `source` / `source_url` / `fetched_at`.
- **Only completed months** are stored and a stored month is never overwritten, so a past month's conversion depends on neither the viewing date nor the update date (the browser no longer fetches live rates).
- A month missing from the catalog uses the **nearest earlier month's rate** (never a later month or a constant). With no earlier month either, there is no rate and the conversion options (EA-JPY / EA-EUR) are not offered. **The code holds no table of exchange rates.**
- A failed fetch leaves the existing catalog untouched and collection continues with a warning. Demo data has no catalog, so conversion is USD only.

### 1.4 Scope-Dependent Cost Units

The unit of a cost figure depends on the scope and is defined once, by `seatCostForScope`:

| Scope | Seat cost |
|---|---|
| `daily` | Prorated daily cost (`monthly / days in the month`) |
| `monthly` | Full monthly cost (not "month-to-date") |
| `custom` | Prorated daily cost × number of days in the period |

The pipeline aggregation and the client-side filter re-aggregation use the same function, so applying a filter never changes the unit (previously a daily scope turned into a monthly amount as soon as a filter was applied). Idle savings are always expressed **per month** (`monthlyIdleSavingsUsd`), regardless of the scope.

### 1.5 AI Credits Cost & Included Credits Pool

- Cost = credits × unit price. The unit price comes from the pricing catalog (\$0.01 per credit) or the contract configuration; there is no service-specific default (SDD-03 §5.1).
- Included credits are **plan-specific, period-specific and pooled per billing entity**: `pool = Σ includedCredits(plan of each seat)`; seats with an unknown plan are not counted and reported as "plan unconfirmed". An EA contract value (`creditsPricing.includedCreditsPerSeat`) overrides it for all plans.
- Pool utilization = used credits / pool × 100, **not capped at 100%** (an overrun is shown as such); it is absent when the pool is unknown or 0.
- Per-seat credits cost is a usage amount (credits × price). Because the included credits are pooled, an individual's overage cannot be derived and is not displayed as such.
- **AI credit usage API values** (P1-5, SDD-03 §4a) are kept per `unit_type` in `fact.cost_line`; credits (quantity) and amounts are never added across units, and no currency is assumed because the response does not state one. They are not yet consumed by the aggregation above (Phase 2).

---

## 2. 3-Axis Cost Allocation Algorithm

For each assigned user $u$, their reporting groups are identified in the following priority order and aggregated into distribution buckets:

```
[User u]
   │
   ├── 1. Organization Axis:
   │      u.organization.login (e.g., "corp-core-engineering")
   │
   ├── 2. Cost Center Axis:
   │      a) u.cost_center_override (Runtime user mapping table override)
   │      b) Cost Center associated via GitHub Enterprise Cost Centers API
   │      c) Fallback: "Default-Cost-Center"
   │
   └── 3. Arbitrary User Group Axis:
          a) u.department (Runtime user mapping table attribute)
          b) Fallback: "Unassigned"
```

---

## 3. Idle Seat Detection Logic

To optimize enterprise license costs, user seat activity is classified using the following criteria:

The classifier is `SeatClassificationRule` (thresholds: `SEAT_ONBOARDING_DAYS = 7`, `SEAT_LOW_ACTIVE_DAYS = 14`, `SEAT_IDLE_DAYS = 30`). "Unused since the grant" means there is no activity after the seat was granted (an activity on the grant day counts as use).

| Status | Condition | Counts as idle (savings)? | Recommended Action |
|---|---|---|---|
| **Onboarding** | Unused since the grant and granted **less than 7 days** ago | **No** | Wait (an unused new seat is expected) |
| **Never Used** | Unused since the grant and granted **7 days or more** ago | Yes | **Immediate license reclamation** |
| **Idle** | Last activity more than 30 days ago (`> 30d`), **or** more than 14 days ago with AI credits consumption known to be 0 in the last 28 days | Yes | **Reclaim or cancel license** |
| **Low Active** | Last activity more than 14 days and at most 30 days ago | No | Adoption inquiry & follow-up |
| **Active** | Last activity within the past 14 days | No | Retain assignment |

The screen labels derive from the same constants (`SEAT_IDLE_CRITERIA_TEXT`), so the displayed criteria always match the classifier. (The former label read "30 days or more unused" while the credit-linked 14-day rule also made seats idle, and a seat granted two days ago was reported as idle waste.)

### Potential Monthly Savings Calculation
$$\text{Potential Monthly Savings} = \sum_{u \in \text{Idle} \cup \text{NeverUsed}} \text{MonthlyPrice}(u.\text{plan})$$

Onboarding seats are excluded; seats with an unconfirmed plan contribute 0 and are called out. The value is per month in every scope (`monthlyIdleSavingsUsd`).

---

## 4. Usage Metrics & Analytical Guidelines

### 4.1 Fundamental Indicators
1. **Inline Completion Acceptance Rate**:
   $$\text{Inline Acceptance Rate} = \frac{\text{Total Code Acceptances}}{\text{Total Code Suggestions}} \times 100\%$$
   - **Scope**: In-editor inline completions (Ghost Text) only.
2. **Lines Accepted Contribution (Ratio)**:
   Ratio of total lines accepted versus total lines suggested ($\frac{\text{Lines Accepted}}{\text{Lines Suggested}} \times 100\%$).
3. **Chat & Agent Engagement**:
   Session volume across IDE Chat, Dotcom Chat, CLI, Agent sessions, and model breakdown (Claude 3.7 Sonnet, GPT-4o, o1, Gemini 2.0 Flash).
4. **Active Seat Ratio**:
   $$\text{Active Ratio} = \frac{\text{Total Active Users in Period}}{\text{Total Assigned Seats}} \times 100\%$$

### 4.2 The "Acceptance Rate Paradox" & Analysis Caveats

> [!WARNING]
> **Prohibition of Simplistic "Low Acceptance Rate = Low Adoption" Evaluations**
> Developers heavily leveraging GitHub Copilot CLI, Autopilot (`--allow-all` / `/yolo` mode), and autonomous agent workflows rarely type code manually to accept suggestions line-by-line via `Tab`.
> This workflow produces the following telemetry distortion:
> 1. **Mechanical Expansion of Denominator**: When inspecting agent-generated diffs or making slight edits, cursor navigation and keystrokes trigger ghost-text suggestions in the background, which are discarded upon switching windows (implicit rejections), rapidly inflating `total_code_suggestions`.
> 2. **Omission of Agent Output from Numerator**: Direct file modifications, tool calls, and shell commands applied by the CLI/Agent are never counted towards IDE `total_code_acceptances`.
> 3. **Apparent Plunge in Acceptance Rate**: The most proficient autonomous agent users may show Inline Completion acceptance rates under 10%–15%, creating an inverted metric ("Acceptance Rate Paradox").

### 4.3 Recommended Analytical Architecture (Surface Separation)
Organizations must not rely on Inline Completion Acceptance Rate as a solitary KPI for developer performance. Instead, enforce multi-surface evaluation:
- **Surface Separation**: Segregate evaluation across IDE Code Completions (typing assistance), Chat/CLI (interactive commands), and Autonomous Agents.
- **Outcome Metric Correlation**: Correlate with PR cycle time, PR summary creation (`total_pr_summaries_created`), and velocity rather than raw keystroke acceptance.
- **Workflow Segmentation**: Treat Inline Completion Acceptance Rate as a workflow classification parameter (manual completion-oriented vs. agentic-oriented) rather than a scalar metric of skill or productivity.

### 4.4 Missing Values, Estimates and Provenance (no fabrication)

1. **Missing is `null`, never 0 or a constant.** An unmeasured value is stored as `null` and the UI shows "—" with the reason ("unavailable: usage metrics could not be fetched"). Acceptance rate, suggestions, acceptances, chats and PR summaries are nullable; a 0 is only ever a measured zero.
2. **Provenance of usage metrics** (`usage_metrics.availability`): `live` (fetched in this run), `carried_over` (the last successful run's values, with `as_of`; shown with a "previous value" badge), `unavailable` (never fetched).
3. **Per-group usage metrics**: for live data, group figures are an *estimate* (the company-wide totals apportioned by seat ratio) and are flagged `is_estimated` / `estimation_method`; they are not measurements. For a monthly report (CSV), which contains no suggestions / acceptances / chats, these fields are `null` (the former fixed 35% acceptance rate and `requests × 0.35` / `× 0.2` derivations were removed).
4. **Not fabricated**: the 1-year trend is built month by month from the stored monthly aggregates (a month without stored data is simply absent; usage fields are `null` for months without measured usage); per-user profiles are never synthesized from an aggregated CSV; the adoption cohort is not derived from proxy values; agent / PR based diagnostics use measured fields only; peer averages are computed from the actual profiles or omitted; the surface of a CSV row stays empty when absent (no default "VS Code"); a missing included-credits basis is "unknown", not 3,900.
5. **Filters**: sections without per-user measurements (usage metrics, daily trend, languages, SKU breakdown) cannot be re-aggregated. While a filter is active they keep the company-wide values and are labelled "company-wide (not filterable)" (`filter_notice`).

### 4.5 Period Comparison and Month-End Forecast (P3-2 / D-02)

Implemented as pure functions in `src/domain/metrics/kpi-analysis.ts` (same input gives the same output; the current time is injected). Dates are UTC `YYYY-MM-DD`.

**Period comparison** (`compareToPrevious`): the comparison target is the previous month for a monthly scope and the previous day for a daily scope; a custom period has no defined target. The previous scope is loaded only when it is listed in `index.json` and is re-aggregated with the same filter as the current one. Output: difference (`current - previous`), change ratio (`/ previous`; **not shown when the previous value is 0**), direction. A missing previous value or target is "前月比 —（reason）"; it is never compared against 0. Ratios (active rate, budget utilization, acceptance rate) are differences in percentage points.

**Month-end forecast** (`forecastMonthEnd`), an *estimated* value (the "推定" badge):

```text
projected = actual_to_date + mean(last 7 observed days) * remaining_days
remaining_days = days_in_month - day of the last observed date
range     = actual_to_date + (mean +/- stdev) * remaining_days   (lower bound: actual_to_date)
```

| Condition | Result |
|:--|:--|
| Scope is not monthly | Not computed: "—（monthly scope only）" |
| Fewer than 7 observed days (start of month) | Not computed: "—（observed N days, fewer than 7）" |
| Observed days / elapsed days < 50% (many gaps) | Not computed: "—（many gaps）" |
| The month is past, or observed through the last day | **Closed month**: no forecast; the actual is shown |
| Otherwise | Forecast + range + confidence + formula |

Missing days (`null`) are not observed days and are never treated as 0. Confidence: **high** = 21+ observed days, coefficient of variation <= 0.2 and coverage >= 90%; **medium** = 14+ days, CV <= 0.5 and coverage >= 70%; otherwise **low**. Two series are forecast: daily seat cost (`daily_trends.daily_cost_usd`, `spend_forecast`) and AI Credits consumption (`daily_trends.ai_credits_used`, `credits_forecast`). Seat cost is prorated daily and nearly constant, so the forecast is informative mainly for AI Credits. `daily_trends` has no per-user measurements, so the forecast keeps the company-wide values while a filter is active and is labelled as such (§4.4-5).

### 4.6 1-Year Trend, Month Close and Year-over-Year (P3-6 / B-01)

Pure functions in `src/processor/yearly-trend.ts` (the current time is injected; dates are UTC).

**Month close rule.** A month is **closed (確定)** only when a **close snapshot** exists (monthly close, SDD-17 §3: figures frozen with a checksum on the **N-th business day of the next month**, default 5; the business calendar is configurable) and **provisional (暫定)** otherwise, including the current month and a month whose close job has not run. Passing the close day alone does not make a month closed. `points[].revision_count` shows revisions after the close. The declared rule (`close_rule`) is built by `buildYearlyTrendCloseRule(calendar)` and written into the dataset.

**Series.** 12 consecutive calendar months ending at the latest recorded month. A month with no stored aggregate is `missing` (null values), never 0. A month that exists but has no measured usage keeps `acceptance_rate` / `total_chats` as null.

**Year-over-year** compares a month with the same month of the previous year, per metric (`total_spend_usd`, `total_seats`, `active_seats`, `acceptance_rate`, `total_chats`, `total_ai_credits_used`): difference (`current - previous`; for ratios the difference in ratio) and change ratio (`/ previous`).

| Condition | Result |
|:--|:--|
| The month has no stored aggregate | "—（この月の保存済み集計がない）" |
| The month exists but the metric is not measured | "—（当月の指標を取得できていない）" |
| The previous-year month has no data | "—（前年同月のデータなし）"; never compared against 0 |
| The previous-year value is 0 | Difference only; no change ratio ("前年同月が 0 のため変化率は算出しない") |

The catalog entries are `yoy_spend_change` and `yoy_active_seats_change`.

---

## 5. Usage Insights per User (usage, tokens, unit cost, session-bloat signals)

Computed by the pure functions in `src/processor/usage-insight.ts`; thresholds and wording live in `src/processor/usage-insight-definitions.ts`. Attached to each monthly-report user row as `ReportUserDetail.usage_insight` (SDD-09 §3.5).

### 5.1 What can and cannot be measured
- **Measured**: requests, AI credits, cost, and — only when the report carries them — tokens (`input` / `output` / `cache_read` / `cache_write` of the GitHub *AI usage report*, which is grouped by `date × model × username`).
- **Not available from any source**: session ID, session length, number of turns, conversation content. The finest granularity is one day per user and model. The Reports API (SDD-03 §2.2) has no token fields.
- Therefore "a session is unusually long" or "several topics are mixed" is **never asserted**. Signals are estimates from daily aggregates and only suggest that a review of usage may be worthwhile. Conversation content is never read or stored (zero PII).

### 5.2 Indicators (measured, `null` when unavailable)
| Indicator | Definition |
|:--|:--|
| Usage | requests (requests-family rows only), credits (`ai_credits_consumed`, else `quantity` of credit rows), active days, per-active-day amount (requests, else credits), peak day |
| Tokens | sum of `input`, `output`, `cache_read`, `cache_write` (a legacy `token_count` is a total only, no breakdown); `coverage` = share of rows that carry tokens |
| Cost per 1M tokens | gross cost of rows that carry tokens ÷ their tokens × 10⁶. A blended figure (cache reads are cheaper per token) |
| Cost per request / per credit | gross cost of the requests rows ÷ requests / gross cost of the credit rows ÷ credits. **Seat (licence) rows are never included** |

Costs use the gross (list-price) amount: the net amount is 0 while included credits cover the usage, which would make every unit cost 0.

### 5.3 Signals (estimates)
Each signal has a level: `none` (特記なし), `watch` (参考), `review` (確認を推奨), or `insufficient` (データ不足). No score and no ranking. A user with fewer than **5 active days** — or without the required columns — is `insufficient`, never "healthy".

| ID | Signal | Definition | watch / review |
|:--|:--|:--|:--|
| S1 | Context carry-over | (input + cache_read) ÷ output, against the organisation median | ≥ 2× / ≥ 3× |
| S2 | High-token days | days whose total tokens ≥ 3× the organisation median day | ≥ 2 days / ≥ 3 days and ≥ 30 % of days |
| S3 | Per-active-day amount | requests (else credits) per active day, against the organisation median | ≥ 2× / ≥ 3× |
| S4 | Model switching | average number of distinct models used per day (a weak clue: using several models is normal) | avg ≥ 2.5 → watch only |
| S5 | Expensive model + carry-over | ≥ 50 % of tokens on models whose cost per 1M tokens is ≥ 2× the all-model median, while S1 ≥ watch | inherits S1's level |

Overall level: `review` if any valid signal is `review`; `watch` if two or more are `watch`, or one non-S4 signal is `watch`; `none` otherwise; `insufficient` if no signal could be evaluated. S4 alone never raises the overall level.

The organisation baseline (medians, model costs) is computed from **all users of the month before any display filter**, so applying a filter never changes a user's level.

### 5.4 Presentation rules
- Wording is a recommendation, never an accusation: "確認を推奨" / "参考", never "不当", "違反" or "問題".
- The screen always states that the signals are estimates from daily aggregates, that conversation content is not read, and that they are not a personal evaluation (`USAGE_INSIGHT_DISCLAIMER`).
- Advice for `review` stays tentative ("starting a new session per topic may reduce the context sent each time").

