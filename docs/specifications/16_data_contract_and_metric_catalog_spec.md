[English](16_data_contract_and_metric_catalog_spec.md) | [日本語](16_data_contract_and_metric_catalog_spec.ja.md)

---

# SDD-16: Data Contract & Metric Catalog Specification

- **Document ID**: SPEC-COPILOT-016
- **Status**: Approved / Active
- **Target Version**: 2026.10
- **Date**: 2026-10-03 (P3-1 / #188: metric catalog v1)
- **Related**: [SDD-06 Aggregation & Billing Logic](06_aggregation_and_billing_logic_spec.md), [SDD-07 Dashboard UI/UX §2.14a](07_dashboard_ui_ux_spec.md), [SDD-15 Data-Centric Reactivity](15_data_centric_reactivity_design_spec.md)

---

## 1. Purpose

The same metric name used to mean different things on different screens, and neither the definition, the aggregation window nor the source was visible. The **metric catalog** declares every KPI shown by the dashboard in one place (`src/domain/metrics/metric-registry.ts`, the Metric Registry of SDD-07 §2.14a). The UI, the tooltips and the tests share that single definition.

## 2. Catalog Entry (`MetricDefinition`)

| Field | Meaning |
|:--|:--|
| `id` | Stable identifier (the key of `METRIC_REGISTRY`) |
| `label` | Display name (`ja` / `en`) |
| `definition` | What the value counts (`ja` / `en`) |
| `formula` | Human-readable formula |
| `unit` | `usd` / `ratio` / `count` / `seats` / `users` / `credits` / `name` |
| `window` | Aggregation window (§3) |
| `filterable` | Whether the value is re-aggregated when a filter is active (`false` = organisation-wide value, shown with the "全社値 (フィルター非対応)" badge) |
| `sources` | Data sets / APIs the value comes from |
| `caveats` | Optional reading notes |
| `defaultQuality` | `measured` / `estimated` (SDD-07 §2.14a quality attributes) |

## 3. Windows

| `window` | Meaning | Display |
|:--|:--|:--|
| `scope` | The selected scope (daily / monthly / custom period) | Follows the scope type: 当日 (日次スコープ) / 当月 (月次スコープ) / 選択期間 |
| `report_month` | The month of the selected monthly usage report | 選択した月次レポートの月 |
| `collection_period` | The period covered by the collected usage-metrics data | 収集データの対象期間 |
| `point_in_time` | A point-in-time value | 時点値 |

Time zone: aggregation boundaries are UTC unless a metric states otherwise.

## 4. Display Rules

- Every KPI label is rendered by `MetricLabel`: the name, an **info icon whose tooltip lists definition, formula, window, unit, source, filter support and caveats**, and a visible **window chip** (text, never colour alone).
- The KPI components covered: overview cards (`KpiSummaryCards`), monthly report cards (`MonthlyReportKpis`), and the KPI cards of the adoption maturity, agent activity and credits views.
- A KPI that is not in the catalog cannot be displayed: `MetricId` is a type derived from the catalog, and `src/tests/metric-catalog.test.ts` fails when a KPI component references an id that is missing from the catalog, when a KPI component stops using `MetricLabel`, or when a catalog entry is not displayed anywhere.

## 5. Personal Metrics

Per-user metrics (the user detail table, the drill-down panel, user trends) are shown on screen on the premise that the dashboard is internal. They are **improvement-support information for employees who are authorised to view them**; they are not used for personnel evaluation or ranking. The user detail table states this on screen (`PERSONAL_METRICS_NOTICE`). No separate identified / aggregate-only build is produced.

## 6. Catalog v1 Entries

| id | Name | Unit | Window | Filterable | Sources |
|:--|:--|:--|:--|:--|:--|
| `total_spend` | Total spend | usd | scope | yes | seats, pricing catalog |
| `active_rate` | Active seat rate | ratio | scope | yes | seats |
| `idle_waste` | Idle cost (potential savings) | usd | scope | yes | seats, pricing catalog |
| `acceptance_rate` | Inline completion acceptance rate | ratio | scope | no | metrics |
| `report_gross_spend` | Gross spend | usd | report_month | yes | monthly usage report CSV |
| `report_net_spend` | Net billable spend | usd | report_month | yes | monthly usage report CSV |
| `report_requests` | Total requests / credits | count | report_month | yes | monthly usage report CSV |
| `report_active_users` | Active users in report | users | report_month | yes | monthly usage report CSV |
| `report_top_model` | Most used AI model | name | report_month | yes | monthly usage report CSV |
| `report_top_sku` | Primary SKU | name | report_month | yes | monthly usage report CSV |
| `adoption_evaluated_users` | Evaluated users | users | collection_period | yes | agent metrics |
| `adoption_active_rate` | Overall adoption rate | ratio | collection_period | yes | agent metrics |
| `adoption_advanced_rate` | Advanced adoption rate | ratio | collection_period | yes | agent metrics |
| `adoption_multi_agent_users` | Multi-agent users | users | collection_period | yes | agent metrics |
| `agent_sessions` | Total agent sessions | count | collection_period | yes | agent metrics |
| `agent_messages` | Total agent messages | count | collection_period | yes | agent metrics |
| `agent_active_users` | Active agent users | users | collection_period | yes | agent metrics |
| `agent_adoption_rate` | Agent adoption rate | ratio | collection_period | yes | agent metrics |
| `credits_pool_used` | Organization pool consumption | credits | collection_period | yes | AI credits usage |
| `credits_cost` | AI Credits cost | usd | collection_period | yes | AI credits usage, pricing catalog |
| `combined_cost` | Combined cost (seats + credits) | usd | collection_period | yes | seats, AI credits usage, pricing catalog |
| `pool_utilization` | Pool utilization | ratio | collection_period | yes | AI credits usage, seats |

The full definition, formula and caveats are in the catalog source. Adding a KPI means: add the entry, render it with `MetricLabel`, and keep this table and its Japanese counterpart in sync.
