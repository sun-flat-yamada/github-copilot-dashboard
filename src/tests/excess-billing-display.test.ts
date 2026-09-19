import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MetricsAggregator } from '../processor/metrics-aggregator.js';
import { ReportParser } from '../processor/report-parser.js';
import { CostCenterBudget, EnrichedUserSeat } from '../types/copilot.js';

describe('Excess Billing Display & Limit Settings Contract Tests', () => {
  it('MetricsAggregator attaches total_net_billable_usd and total_spending_limit_usd to overview and by_cost_center', () => {
    const dummySeats: EnrichedUserSeat[] = [
      {
        login: 'user-a',
        display_name: 'User A',
        avatar_url: '',
        department: 'Dept-Engineering',
        cost_center: 'CC-Dev',
        organization: 'Org-Alpha',
        plan_type: 'enterprise',
        monthly_cost_usd: 39.0,
        prorated_daily_cost_usd: 1.3,
        created_at: '2026-01-01',
        last_activity_at: '2026-09-10',
        last_activity_editor: 'vscode',
        days_inactive: 0,
        status: 'active',
      },
    ];

    const dummyBudgets: CostCenterBudget[] = [
      {
        cost_center_id: 'cc-001',
        cost_center_name: 'CC-Dev',
        cost_center_code: 'DEV-01',
        spending_limit_usd: 500.0,
        free_tier_budget_usd: 50.0,
        current_spend_usd: 39.0,
        net_billable_spend_usd: 0.0, // 39 - 50 <= 0
        remaining_budget_usd: 500.0,
        budget_utilization_percent: 0.0,
        status: 'normal',
      },
    ];

    const aggregator = new MetricsAggregator();
    const result = aggregator.aggregateScope(
      'monthly',
      '2026-09',
      [],
      dummySeats,
      { start: '2026-09-01', end: '2026-09-30', days_count: 30 },
      [],
      dummyBudgets,
      []
    );

    // 1. Overview の合計値
    assert.strictEqual(result.overview.total_spend_usd, 39.0);
    assert.strictEqual(result.overview.total_net_billable_usd, 0.0);
    assert.strictEqual(result.overview.total_spending_limit_usd, 500.0);

    // 2. Cost Center 軸サマリーの付加情報
    const ccDev = result.by_cost_center['CC-Dev'];
    assert.ok(ccDev);
    assert.strictEqual(ccDev.total_cost_usd, 39.0);
    assert.strictEqual(ccDev.net_cost_usd, 0.0);
    assert.strictEqual(ccDev.spending_limit_usd, 500.0);
  });

  it('ReportParser populates gross_spend_usd and net_spend_usd in ReportUserDetail and GroupSummary', () => {
    const csvContent = [
      'date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,organization,cost_center_name',
      '2026-09-05,kenji-sato,copilot,copilot_usage,Claude 3.7 Sonnet,10,requests,0.04,0.40,0.10,0.30,proud-corp,CC-Platform',
      '2026-09-06,kenji-sato,copilot,copilot_usage,GPT-4o,20,requests,0.03,0.60,0.00,0.60,proud-corp,CC-Platform',
    ].join('\n');

    const parser = new ReportParser();
    const records = parser.parseRecords(csvContent);
    const aggregated = parser.aggregate(records, '2026-09', 'test.csv');

    assert.strictEqual(aggregated.overview.total_gross_spend_usd, 1.00);
    assert.strictEqual(aggregated.overview.total_net_spend_usd, 0.90);
    assert.strictEqual(aggregated.overview.total_discount_usd, 0.10);

    // ユーザー明細
    const user = aggregated.user_details.find((u) => u.login === 'kenji-sato');
    assert.ok(user);
    assert.strictEqual(user.gross_spend_usd, 1.00);
    assert.strictEqual(user.net_spend_usd, 0.90);
    assert.strictEqual(user.total_spend_usd, 1.00); // 利用費用が主値

    // グループサマリー
    const ccSummary = aggregated.by_cost_center['CC-Platform'];
    assert.ok(ccSummary);
    assert.strictEqual(ccSummary.total_cost_usd, 1.00);
    assert.strictEqual(ccSummary.net_cost_usd, 0.90);
  });
});
