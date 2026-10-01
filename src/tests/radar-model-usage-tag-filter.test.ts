import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_FILTER_CRITERIA, MonthlyReportAggregatedData, ReportUserDetail } from '../types/copilot.js';
import { buildFilteredModelBreakdown } from '../../dashboard/src/utils/reportModelBreakdown.js';
import { applyFilterCriteriaToMonthlyReport } from '../../dashboard/src/utils/filterEngine.js';

describe('モデル特性レーダー: Tag選択によるモデル利用割合(%)の再集計', () => {
  const baseUsers: ReportUserDetail[] = [
    {
      login: 'dev-alice',
      display_name: 'Alice Dev',
      department: 'Frontend Engineering',
      cost_center: 'CC-DEV-101',
      organization: 'proud-org',
      total_requests: 300,
      total_spend_usd: 15.0,
      primary_model: 'Claude 3.7 Sonnet',
      tags: ['Frontend'],
    },
    {
      login: 'dev-bob',
      display_name: 'Bob Infra',
      department: 'Infrastructure',
      cost_center: 'CC-INFRA-202',
      organization: 'proud-org',
      total_requests: 100,
      total_spend_usd: 5.0,
      primary_model: 'o1',
      tags: ['Infra'],
    },
    {
      login: 'dev-carol',
      display_name: 'Carol Frontend',
      department: 'Frontend Engineering',
      cost_center: 'CC-DEV-101',
      organization: 'proud-org',
      total_requests: 100,
      total_spend_usd: 5.0,
      primary_model: 'o1',
      tags: ['Frontend'],
    },
  ];

  it('verifies buildFilteredModelBreakdown aggregates by primary_model with correct percentage/active_users', () => {
    const result = buildFilteredModelBreakdown(baseUsers);
    const claude = result.find((m) => m.model_name === 'Claude 3.7 Sonnet');
    const o1 = result.find((m) => m.model_name === 'o1');

    assert.ok(claude, 'Claude 3.7 Sonnet entry must exist');
    assert.strictEqual(claude!.total_requests, 300);
    assert.strictEqual(claude!.active_users, 1);
    assert.strictEqual(claude!.percentage, 60.0); // 300 / 500

    assert.ok(o1, 'o1 entry must exist');
    assert.strictEqual(o1!.total_requests, 200); // Bob(100) + Carol(100)
    assert.strictEqual(o1!.active_users, 2);
    assert.strictEqual(o1!.percentage, 40.0); // 200 / 500
  });

  it('verifies breakdown changes when the user set is narrowed by a tag filter (Frontend only)', () => {
    // Frontend タグでの絞り込みを模した部分集合 (Bob=Infra は除外)
    const frontendOnly = baseUsers.filter((u) => u.tags!.includes('Frontend'));
    const result = buildFilteredModelBreakdown(frontendOnly);

    const claude = result.find((m) => m.model_name === 'Claude 3.7 Sonnet');
    const o1 = result.find((m) => m.model_name === 'o1');

    assert.ok(claude);
    assert.strictEqual(claude!.total_requests, 300);
    assert.strictEqual(claude!.percentage, 75.0); // 300 / 400 (Bob's 100 excluded)

    assert.ok(o1);
    assert.strictEqual(o1!.total_requests, 100); // only Carol remains
    assert.strictEqual(o1!.active_users, 1);
    assert.strictEqual(o1!.percentage, 25.0);
  });

  it('verifies an empty filtered user set yields an empty breakdown without division errors', () => {
    const result = buildFilteredModelBreakdown([]);
    assert.deepStrictEqual(result, []);
  });

  describe('フィルター適用後のレポート再集計 (applyFilterCriteriaToMonthlyReport)', () => {
    // 全社の (絞り込み前の) モデル内訳は、フィルター後に残ってはならない値として 'STALE' を使う
    const baseReport = {
      report_month: '2026-09',
      overview: {
        total_net_spend_usd: 25,
        total_gross_spend_usd: 25,
        total_discount_usd: 0,
        total_requests: 500,
        total_active_users: 3,
        top_model: 'STALE',
        top_sku: 'copilot',
      },
      by_department: {},
      by_cost_center: {},
      by_organization: {},
      model_breakdown: [
        { model_name: 'STALE', total_requests: 500, total_spend_usd: 25, percentage: 100, active_users: 3 },
      ],
      sku_breakdown: [],
      daily_trends: [],
      user_details: baseUsers,
    } as unknown as MonthlyReportAggregatedData;

    it('recomputes model_breakdown and overview.top_model from the tag-filtered user subset', () => {
      const filtered = applyFilterCriteriaToMonthlyReport(baseReport, { ...DEFAULT_FILTER_CRITERIA, tags: ['Frontend'] });

      assert.strictEqual(filtered.user_details.length, 2);
      assert.strictEqual(filtered.overview.top_model, 'Claude 3.7 Sonnet');
      const claude = filtered.model_breakdown.find((m) => m.model_name === 'Claude 3.7 Sonnet');
      assert.ok(claude);
      assert.strictEqual(claude!.percentage, 75.0);
      assert.ok(!filtered.model_breakdown.some((m) => m.model_name === 'STALE'), 'stale org-wide breakdown must not remain');
    });

    it('recomputes for non-tag conditions too (cost center only) — the hook used to depend on tags only', () => {
      const filtered = applyFilterCriteriaToMonthlyReport(baseReport, { ...DEFAULT_FILTER_CRITERIA, costCenter: 'CC-INFRA-202' });

      assert.deepStrictEqual(filtered.user_details.map((u) => u.login), ['dev-bob']);
      assert.strictEqual(filtered.overview.total_requests, 100);
      assert.strictEqual(filtered.overview.top_model, 'o1');
    });

    it('returns the original (parse-time accurate) report unmodified when no filter is active', () => {
      assert.strictEqual(applyFilterCriteriaToMonthlyReport(baseReport, DEFAULT_FILTER_CRITERIA), baseReport);
    });

    it('marks the sections that cannot be re-aggregated per user (daily trend / SKU) as unfiltered', () => {
      const filtered = applyFilterCriteriaToMonthlyReport(baseReport, { ...DEFAULT_FILTER_CRITERIA, tags: ['Frontend'] });
      assert.ok(filtered.filter_notice, 'filter_notice must be set while a filter is applied');
      assert.ok(filtered.filter_notice!.unfiltered_sections.length > 0);
    });
  });

  it('verifies useDashboardData.ts delegates the report re-aggregation to filterEngine and depends on the whole filterCriteria', () => {
    const hookFilePath = path.resolve(process.cwd(), 'dashboard/src/hooks/useDashboardData.ts');
    const hookContent = fs.readFileSync(hookFilePath, 'utf-8');

    // 以前は依存配列が [activeReportData, selectedTags] (タグだけ) で、Cost Center / Org / 部署 / ユーザー条件を
    // 変えてもレポートの KPI・明細が再計算されなかった
    assert.match(
      hookContent,
      /const filteredActiveReportData = useMemo<MonthlyReportAggregatedData \| null>\(\(\) => \{[\s\S]*?applyFilterCriteriaToMonthlyReport\(activeReportData, filterCriteria\);[\s\S]*?\}, \[activeReportData, filterCriteria\]\);/,
      'filteredActiveReportData must call the shared filterEngine function and list the whole filterCriteria as a dependency'
    );
    assert.ok(
      !hookContent.includes('[activeReportData, selectedTags]'),
      'the report filter memo must not depend on tags only'
    );
  });
});
