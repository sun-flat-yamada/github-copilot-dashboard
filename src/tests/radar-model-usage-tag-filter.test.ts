import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { ReportUserDetail } from '../types/copilot.js';
import { buildFilteredModelBreakdown } from '../../dashboard/src/utils/reportModelBreakdown.js';

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

  it('verifies useDashboardData.ts recomputes model_breakdown/top_model via buildFilteredModelBreakdown when tags are applied', () => {
    const hookFilePath = path.resolve(process.cwd(), 'dashboard/src/hooks/useDashboardData.ts');
    const hookContent = fs.readFileSync(hookFilePath, 'utf-8');

    assert.ok(
      hookContent.includes("import { buildFilteredModelBreakdown } from '../utils/reportModelBreakdown';"),
      'useDashboardData.ts must import buildFilteredModelBreakdown'
    );

    const memoMatch = hookContent.match(
      /const filteredActiveReportData = useMemo<MonthlyReportAggregatedData \| null>\(\(\) => \{([\s\S]*?)\n {2}\}, \[activeReportData, selectedTags\]\);/
    );
    assert.ok(memoMatch, 'filteredActiveReportData useMemo must exist with [activeReportData, selectedTags] deps');
    const memoBody = memoMatch![1];

    assert.match(
      memoBody,
      /const filteredModelBreakdown = buildFilteredModelBreakdown\(filteredDetails\);/,
      'filteredActiveReportData must recompute model_breakdown from the tag-filtered user subset'
    );
    assert.match(
      memoBody,
      /model_breakdown: filteredModelBreakdown,/,
      'filteredActiveReportData must return the recomputed model_breakdown (not the stale unfiltered org-wide one)'
    );
    assert.match(
      memoBody,
      /top_model: filteredModelBreakdown\[0\]\?\.model_name \|\| 'N\/A',/,
      'filteredActiveReportData must also refresh overview.top_model from the recomputed breakdown'
    );
  });

  it('verifies the untouched (no tag selected) branch still returns the original precise model_breakdown', () => {
    const hookFilePath = path.resolve(process.cwd(), 'dashboard/src/hooks/useDashboardData.ts');
    const hookContent = fs.readFileSync(hookFilePath, 'utf-8');

    assert.ok(
      hookContent.includes('if (selectedTags.length === 0) return activeReportData;'),
      'When no tags are selected, the original (parse-time accurate) activeReportData must be returned unmodified'
    );
  });
});
