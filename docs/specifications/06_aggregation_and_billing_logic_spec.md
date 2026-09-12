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

### 1.2 Cost Center Budget Management Model
Calculates the following financial indicators against each Cost Center budget defined in GitHub Enterprise Billing:
1. **Budget Limit ($B_{\text{limit}}$)**: Configured spending cap for the period or month.
2. **Free Budget ($B_{\text{free}}$)**: Complimentary credit or bundled tier allowance.
3. **Current Usage ($S_{\text{current}}$)**: Total consumption by all seats belonging to the Cost Center.
4. **Billable Usage ($S_{\text{billable}}$)**:
   $$S_{\text{billable}} = \max(0, S_{\text{current}} - B_{\text{free}})$$
5. **Remaining Budget ($B_{\text{remaining}}$)**:
   $$B_{\text{remaining}} = \max(0, B_{\text{limit}} - S_{\text{billable}})$$
6. **Budget Consumption Ratio ($U_{\%}$)**:
   $$U_{\%} = \frac{S_{\text{billable}}}{B_{\text{limit}}} \times 100\%$$
   - $U_{\%} < 80\%$: Normal (`normal`)
   - $80\% \le U_{\%} < 100\%$: Warning threshold (`warning`)
   - $U_{\%} \ge 100\%$: Exceeded threshold (`exceeded`)

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

| Status | Condition | Recommended Action |
|---|---|---|
| **Active** | Last activity within past 14 days (`now - last_activity_at <= 14d`) | Retain assignment |
| **Low Active** | Last activity between 15 and 30 days ago (`14d < now - last_activity_at <= 30d`) | Adoption inquiry & follow-up |
| **Idle** | Last activity more than 30 days ago (`now - last_activity_at > 30d`) | **Reclaim or cancel license** |
| **Never Used** | `last_activity_at == null` and assigned $\ge 7$ days | **Immediate license reclamation** |

### Potential Monthly Savings Calculation
$$\text{Potential Monthly Savings} = \sum_{u \in \text{Idle} \cup \text{NeverUsed}} \text{Price}(u.\text{plan})$$

---

## 4. Usage Metrics & Productivity Indicators

1. **Acceptance Rate**:
   $$\text{Acceptance Rate} = \frac{\text{Total Code Acceptances}}{\text{Total Code Suggestions}} \times 100\%$$
2. **Lines Accepted Contribution**:
   Ratio of total lines accepted versus total lines suggested.
3. **Chat Engagement**:
   Session volume across IDE Chat, Dotcom Chat, CLI, and model breakdown (Claude 3.7 Sonnet, GPT-4o, o1, Gemini 2.0 Flash).
4. **Active Seat Ratio**:
   $$\text{Active Ratio} = \frac{\text{Total Active Users in Period}}{\text{Total Assigned Seats}} \times 100\%$$
