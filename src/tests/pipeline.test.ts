import test from 'node:test';
import assert from 'node:assert';
import { AttributeResolver } from '../collector/attribute-resolver.js';
import { BillingCalculator } from '../processor/billing-calculator.js';
import { MetricsAggregator } from '../processor/metrics-aggregator.js';
import { MockDataGenerator } from '../collector/mock-generator.js';

test('AttributeResolver parses JSON mapping and fallbacks correctly', () => {
  const jsonMapping = JSON.stringify([
    {
      github_user: 'alice-dev',
      display_name: 'Alice Cooper',
      department: 'Payments-Core',
      cost_center_override: 'CC-FIN-01',
    },
  ]);

  const resolver = new AttributeResolver(jsonMapping);
  assert.strictEqual(resolver.getMappingCount(), 1);

  // マッピングされているユーザー
  const mapped = resolver.resolve('ALICE-DEV'); // 大文字小文字の区別なし
  assert.strictEqual(mapped.displayName, 'Alice Cooper');
  assert.strictEqual(mapped.department, 'Payments-Core');
  assert.strictEqual(mapped.costCenterOverride, 'CC-FIN-01');

  // 未登録のユーザー
  const fallback = resolver.resolve('bob-unknown');
  assert.strictEqual(fallback.displayName, 'bob-unknown');
  assert.strictEqual(fallback.department, '未分類 (Unassigned)');
  assert.strictEqual(fallback.costCenterOverride, undefined);
});

test('BillingCalculator computes prorated costs and detects idle seats', () => {
  const resolver = new AttributeResolver();
  const costCenters = [
    {
      id: 'cc-1',
      name: 'Infra-Team',
      cost_center_code: 'INFRA',
      resources: [{ type: 'Org' as const, name: 'org-cloud' }],
    },
  ];

  const calc = new BillingCalculator(resolver, costCenters, '2026-09-10');

  // Active seat (3日前アクティブ, Enterprise: $39)
  const activeSeat = {
    assignee: { login: 'dev1', id: 1, avatar_url: '', html_url: '', type: 'User' },
    plan_type: 'enterprise' as const,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    pending_cancellation_date: null,
    last_activity_at: '2026-09-07T12:00:00Z',
    last_activity_editor: 'vscode',
    organization: { login: 'org-cloud', id: 10 },
  };

  const enrichedActive = calc.enrichSeat(activeSeat, 30);
  assert.strictEqual(enrichedActive.cost_center, 'Infra-Team');
  assert.strictEqual(enrichedActive.status, 'active');
  assert.strictEqual(enrichedActive.monthly_cost_usd, 39.0);
  assert.strictEqual(enrichedActive.prorated_daily_cost_usd, 1.3);

  // Idle seat (40日前アクティブ, Business: $19)
  const idleSeat = {
    assignee: { login: 'dev2', id: 2, avatar_url: '', html_url: '', type: 'User' },
    plan_type: 'business' as const,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    pending_cancellation_date: null,
    last_activity_at: '2026-08-01T12:00:00Z',
    last_activity_editor: 'vscode',
    organization: { login: 'org-other', id: 20 },
  };

  const enrichedIdle = calc.enrichSeat(idleSeat, 30);
  assert.strictEqual(enrichedIdle.status, 'idle');
  assert.strictEqual(enrichedIdle.monthly_cost_usd, 19.0);
  assert.strictEqual(enrichedIdle.cost_center, 'Default-CostCenter');
});

test('MetricsAggregator calculates multi-axis group summaries and handles issues', () => {
  const generator = new MockDataGenerator('2026-09-10');
  const bundle = generator.generateBundle(7, 20);

  const resolver = new AttributeResolver(JSON.stringify(bundle.sampleUserMappings));
  const calc = new BillingCalculator(resolver, bundle.costCenters, '2026-09-10');
  const enrichedSeats = calc.enrichAllSeats(bundle.seats, 30);

  const testIssues = [
    {
      id: 'test-1',
      timestamp: new Date().toISOString(),
      severity: 'error' as const,
      category: 'api_auth' as const,
      target: 'org:proud-internal-sys',
      message: 'Access Denied',
      affected_fields: ['copilot_ide_chat'],
    },
  ];

  const aggregator = new MetricsAggregator();
  const aggregated = aggregator.aggregateScope(
    'monthly',
    '2026-09',
    bundle.metrics,
    enrichedSeats,
    { start: '2026-09-01', end: '2026-09-10', days_count: 30 },
    testIssues,
    bundle.costCenterBudgets,
    bundle.userProfiles
  );

  assert.strictEqual(aggregated.overview.total_seats, 20);
  assert.ok(aggregated.overview.total_spend_usd > 0);
  assert.ok(Object.keys(aggregated.by_department).length > 0);
  assert.ok(Object.keys(aggregated.by_cost_center).length > 0);
  assert.ok(Object.keys(aggregated.by_organization).length > 0);
  assert.ok(aggregated.daily_trends.length === 7);
  assert.ok(aggregated.top_languages.length > 0);
  assert.strictEqual(aggregated.issues?.length, 1);
  assert.deepStrictEqual(aggregated.overview.missing_metrics, ['copilot_ide_chat']);

  // BudgetとUserProfileのアサーション
  assert.ok(aggregated.cost_center_budgets && aggregated.cost_center_budgets.length > 0);
  assert.ok(aggregated.cost_center_budgets[0].spending_limit_usd > 0);
  assert.ok(aggregated.cost_center_budgets[0].free_tier_budget_usd > 0);
  assert.ok(aggregated.user_profiles && aggregated.user_profiles.length > 0);
  assert.ok(aggregated.user_profiles[0].daily_history.length > 0);
  assert.ok('claude-3-7-sonnet' in aggregated.user_profiles[0].model_usage_totals);
});
