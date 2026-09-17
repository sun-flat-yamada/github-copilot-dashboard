import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ReportParser } from '../processor/report-parser.js';
import { AttributeResolver } from '../collector/attribute-resolver.js';

describe('ReportParser (Monthly Usage Report CSV)', () => {
  it('parses Detailed Usage Report CSV with quoted fields and calculates 3-axis allocation', () => {
    const mockMapping = JSON.stringify([
      { github_user: 'dev_alice', display_name: 'Alice A.', department: 'Frontend Unit' },
      { github_user: 'dev_bob', display_name: 'Bob B.', department: 'Platform Core' },
    ]);
    const resolver = new AttributeResolver(mockMapping);
    const parser = new ReportParser(resolver);

    const csvText = `date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,organization,cost_center_name
2026-08-01,dev_alice,copilot,copilot_premium_request,"Claude 3.7 Sonnet",10,requests,0.04,0.40,0.00,0.40,proud-org,CC-DEV-101
2026-08-02,dev_alice,copilot,copilot_premium_request,GPT-4o,5,requests,0.03,0.15,0.00,0.15,proud-org,CC-DEV-101
2026-08-01,dev_bob,copilot,copilot_premium_request,o1,4,requests,0.05,0.20,0.00,0.20,proud-org,CC-INFRA-202
2026-08-03,dev_charlie,copilot,copilot_business,,1,seats,19.00,19.00,0.00,19.00,proud-org,CC-DEV-101
`;

    const records = parser.parseRecords(csvText);
    assert.strictEqual(records.length, 4);

    const aggregated = parser.aggregate(records, '2026-08', 'test-report.csv');

    assert.strictEqual(aggregated.report_month, '2026-08');
    assert.strictEqual(aggregated.overview.total_active_users, 3);
    assert.strictEqual(aggregated.overview.total_net_spend_usd, 19.75); // 0.40 + 0.15 + 0.20 + 19.00
    assert.strictEqual(aggregated.overview.total_requests, 20); // 10 + 5 + 4 + 1

    // 3軸集計の検証
    assert.ok(aggregated.by_department['Frontend Unit']);
    assert.strictEqual(aggregated.by_department['Frontend Unit'].total_seats, 1);
    assert.strictEqual(aggregated.by_department['Frontend Unit'].total_cost_usd, 0.55);

    assert.ok(aggregated.by_department['Platform Core']);
    assert.strictEqual(aggregated.by_department['Platform Core'].total_seats, 1);
    assert.strictEqual(aggregated.by_department['Platform Core'].total_cost_usd, 0.2);

    // 未設定ユーザーのフォールバック
    assert.ok(aggregated.by_department['未分類 (Unassigned)']);
    assert.strictEqual(aggregated.by_department['未分類 (Unassigned)'].total_seats, 1);
    assert.strictEqual(aggregated.by_department['未分類 (Unassigned)'].total_cost_usd, 19.0);

    // モデル別集計の検証
    assert.strictEqual(aggregated.model_breakdown.length, 4);
    const claude = aggregated.model_breakdown.find((m) => m.model_name === 'Claude 3.7 Sonnet');
    assert.ok(claude);
    assert.strictEqual(claude?.total_requests, 10);
    assert.strictEqual(claude?.total_spend_usd, 0.4);

    // ユーザー別明細
    assert.strictEqual(aggregated.user_details.length, 3);
    const alice = aggregated.user_details.find((u) => u.login === 'dev_alice');
    assert.ok(alice);
    assert.strictEqual(alice?.display_name, 'Alice A.');
    assert.strictEqual(alice?.department, 'Frontend Unit');
    assert.strictEqual(alice?.primary_model, 'Claude 3.7 Sonnet');
    assert.strictEqual(alice?.total_requests, 15);
  });

  it('handles Activity Report style CSV with fallbacks', () => {
    const parser = new ReportParser();
    const csv = `report_time,login,last_authenticated_at,last_activity_at,last_surface_used
2026-08-15T10:00:00Z,user_alpha,2026-08-15T09:00:00Z,2026-08-15T09:30:00Z,VS Code 1.92.0
2026-08-15T10:00:00Z,user_beta,2026-08-14T09:00:00Z,2026-08-14T09:30:00Z,JetBrains IntelliJ
`;

    const records = parser.parseRecords(csv);
    assert.strictEqual(records.length, 2);
    assert.strictEqual(records[0].username, 'user_alpha');
    assert.strictEqual(records[0].date, '2026-08-15');
    assert.strictEqual(records[0].last_surface_used, 'VS Code 1.92.0');

    const agg = parser.aggregate(records, '2026-08', 'activity.csv');
    assert.strictEqual(agg.overview.total_active_users, 2);
    assert.strictEqual(agg.user_details.length, 2);
  });

  it('builds real UserUsageProfile[] from Monthly Usage Report CSV records (no fabricated fields)', () => {
    const mockMapping = JSON.stringify([
      { github_user: 'dev_alice', display_name: 'Alice A.', department: 'Frontend Unit' },
    ]);
    const resolver = new AttributeResolver(mockMapping);
    const parser = new ReportParser(resolver);

    const csvText = `date,username,product,sku,model,quantity,unit_type,net_amount,organization,cost_center_name
2026-08-01,dev_alice,copilot,copilot_premium_request,"Claude 3.7 Sonnet",10,requests,0.40,proud-org,CC-DEV-101
2026-08-01,dev_alice,copilot,copilot_premium_request,GPT-4o,3,requests,0.09,proud-org,CC-DEV-101
2026-08-02,dev_alice,copilot,copilot_premium_request,"Claude 3.7 Sonnet",6,requests,0.24,proud-org,CC-DEV-101
2026-08-01,dev_bob,copilot,copilot_premium_request,o1,4,requests,0.20,proud-org,CC-INFRA-202
`;
    const records = parser.parseRecords(csvText);
    const profiles = parser.buildUserProfiles(records);

    assert.strictEqual(profiles.length, 2);
    const alice = profiles.find((p) => p.login === 'dev_alice');
    assert.ok(alice);
    assert.strictEqual(alice?.display_name, 'Alice A.');
    assert.strictEqual(alice?.department, 'Frontend Unit');
    assert.strictEqual(alice?.daily_history.length, 2); // 2026-08-01, 2026-08-02
    assert.strictEqual(alice?.daily_history[0].date, '2026-08-01');
    assert.strictEqual(alice?.daily_history[1].date, '2026-08-02');

    // モデル名は他画面(UserTrendViewer等)と一致する正規化キー('claude-3-7-sonnet'形式)を使用する
    assert.strictEqual(alice?.daily_history[0].model_breakdown['claude-3-7-sonnet'], 10);
    assert.strictEqual(alice?.daily_history[0].model_breakdown['gpt-4o'], 3);
    assert.strictEqual(alice?.model_usage_totals['claude-3-7-sonnet'], 16); // 10 + 6

    // 実データに存在しない項目は捏造せず0固定
    assert.strictEqual(alice?.daily_history[0].suggestions, 0);
    assert.strictEqual(alice?.daily_history[0].acceptances, 0);
    assert.strictEqual(alice?.acceptance_rate, 0);

    // 実コスト(net_amount合計)は正確に反映される
    assert.strictEqual(alice?.total_cost_usd, 0.73); // 0.40 + 0.09 + 0.24
    assert.strictEqual(alice?.daily_history[0].daily_cost_usd, 0.49); // 0.40 + 0.09

    const bob = profiles.find((p) => p.login === 'dev_bob');
    assert.ok(bob);
    assert.strictEqual(bob?.daily_history[0].model_breakdown['o1'], 4);
  });

  it('returns an empty array when there are no records', () => {
    const parser = new ReportParser();
    assert.deepStrictEqual(parser.buildUserProfiles([]), []);
  });
});
