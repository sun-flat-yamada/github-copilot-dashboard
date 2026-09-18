import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { AttributeResolver } from '../collector/attribute-resolver.js';
import { BillingCalculator } from '../processor/billing-calculator.js';
import { ReportParser } from '../processor/report-parser.js';
import { ForkSafeStorage } from '../storage/fork-safe-storage.js';
import { ANALYSIS_VIEW_REGISTRY } from '../types/views.js';
import { CopilotSeatAssignment } from '../types/copilot.js';

describe('Site Reorganization & Tag Filtering Tests', () => {
  it('BillingCalculator propagates tags from AttributeResolver to EnrichedUserSeat', () => {
    const rawMapping = JSON.stringify([
      {
        github_user: 'dev-alice',
        display_name: 'Alice Smith',
        department: 'Core-Platform',
        tags: ['正社員', 'リモート', 'Backend'],
      },
      {
        github_user: 'dev-bob',
        display_name: 'Bob Johnson',
        department: 'Frontend-G',
        tags: ['業務委託', 'Frontend'],
      },
    ]);

    const resolver = new AttributeResolver(rawMapping);
    const calculator = new BillingCalculator(resolver, [], '2026-09-10');

    const mockSeat: CopilotSeatAssignment = {
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
      pending_cancellation_date: null,
      last_activity_at: '2026-09-09T12:00:00Z',
      last_activity_editor: 'vscode',
      plan_type: 'enterprise',
      assignee: {
        login: 'dev-alice',
        id: 1001,
        avatar_url: 'https://example.com/alice.png',
        html_url: 'https://github.com/dev-alice',
        type: 'User',
      },
      organization: {
        login: 'proud-org',
        id: 501,
      },
    };

    const enriched = calculator.enrichSeat(mockSeat, 30);
    assert.strictEqual(enriched.login, 'dev-alice');
    assert.deepStrictEqual(enriched.tags, ['正社員', 'リモート', 'Backend']);
  });

  it('ReportParser propagates tags to UserUsageProfile and ReportUserDetail', () => {
    const rawMapping = `github_user,display_name,department,cost_center_override,notes,tags
tanaka,Tanaka Taro,Engineering,CC-100,,正社員;AI推進
suzuki,Suzuki Ken,Design,CC-200,,業務委託;リモート`;

    const resolver = new AttributeResolver(rawMapping);
    const parser = new ReportParser(resolver);

    const csvContent = `date,username,model,quantity,unit_type,net_amount,organization,cost_center_name
2026-09-01,tanaka,Claude 3.7 Sonnet,15,requests,1.25,proud-org,CC-100
2026-09-01,suzuki,GPT-4o,8,requests,0.80,proud-org,CC-200`;

    const rawRecords = parser.parseRecords(csvContent);
    assert.strictEqual(rawRecords.length, 2);

    // 1. buildUserProfiles
    const profiles = parser.buildUserProfiles(rawRecords);
    assert.strictEqual(profiles.length, 2);

    const tanakaProfile = profiles.find((p) => p.login === 'tanaka');
    assert.ok(tanakaProfile);
    assert.deepStrictEqual(tanakaProfile.tags, ['正社員', 'AI推進']);

    const suzukiProfile = profiles.find((p) => p.login === 'suzuki');
    assert.ok(suzukiProfile);
    assert.deepStrictEqual(suzukiProfile.tags, ['業務委託', 'リモート']);

    // 2. aggregate
    const aggregated = parser.aggregate(rawRecords, '2026-09', 'test.csv', 'local_drop');
    const tanakaDetail = aggregated.user_details.find((u) => u.login === 'tanaka');
    assert.ok(tanakaDetail);
    assert.deepStrictEqual(tanakaDetail.tags, ['正社員', 'AI推進']);

    const suzukiDetail = aggregated.user_details.find((u) => u.login === 'suzuki');
    assert.ok(suzukiDetail);
    assert.deepStrictEqual(suzukiDetail.tags, ['業務委託', 'リモート']);
  });

  it('Verifies multi-tag AND filtering logic correctly filters users and profiles', () => {
    const users = [
      { login: 'user1', tags: ['業務委託', 'リモート'] },
      { login: 'user2', tags: ['業務委託', 'オンサイト'] },
      { login: 'user3', tags: ['正社員', 'リモート'] },
      { login: 'user4', tags: ['正社員', 'オンサイト'] },
      { login: 'user5', tags: undefined },
    ];

    // 1. 単一タグ選択
    const filterByTags = (items: typeof users, selectedTags: string[]) => {
      if (selectedTags.length === 0) return items;
      return items.filter((item) => item.tags && selectedTags.every((t) => item.tags!.includes(t)));
    };

    const resRemote = filterByTags(users, ['リモート']);
    assert.strictEqual(resRemote.length, 2);
    assert.deepStrictEqual(resRemote.map((u) => u.login), ['user1', 'user3']);

    // 2. 複数タグ AND 選択
    const resContractorRemote = filterByTags(users, ['業務委託', 'リモート']);
    assert.strictEqual(resContractorRemote.length, 1);
    assert.strictEqual(resContractorRemote[0].login, 'user1');

    // 3. 該当なしタグ
    const resNone = filterByTags(users, ['業務委託', '正社員']);
    assert.strictEqual(resNone.length, 0);

    // 4. 空タグ選択 (全件返却)
    const resAll = filterByTags(users, []);
    assert.strictEqual(resAll.length, 5);
  });

  it('ANALYSIS_VIEW_REGISTRY defines all 7 required analysis views with clean capability contracts', () => {
    assert.strictEqual(ANALYSIS_VIEW_REGISTRY.length, 7);

    const ids = ANALYSIS_VIEW_REGISTRY.map((v) => v.id);
    assert.deepStrictEqual(ids, [
      'overview',
      'ranking',
      'users',
      'trend',
      'budget',
      'deep_analysis',
      'model_radar',
    ]);

    for (const view of ANALYSIS_VIEW_REGISTRY) {
      assert.ok(view.title.length > 0, `View ${view.id} must have a title`);
      assert.ok(view.shortTitle.length > 0, `View ${view.id} must have a shortTitle`);
      assert.ok(view.description.length > 0, `View ${view.id} must have a description`);
      assert.ok(view.supportedDataSources.length > 0, `View ${view.id} must have supported data sources`);
      assert.ok(view.requiredCapabilities.length > 0, `View ${view.id} must have required capabilities`);
    }
  });

  it('ForkSafeStorage correctly saves and indexes rolling 1-year trends and deep analysis archives', () => {
    const tmpBase = path.join(process.cwd(), '.tmp_test_storage_' + Date.now());
    try {
      const storage = new ForkSafeStorage({ baseDir: tmpBase });

      // 1. saveRolling1YearTrend
      storage.saveRolling1YearTrend({
        generated_at: '2026-09-10T00:00:00Z',
        months: ['2026-09', '2026-08'],
        trends: [{ month: '2026-09', spend: 500 }],
      });
      const trendPath = path.join(tmpBase, 'processed', 'trends', 'rolling-1year.json');
      assert.ok(fs.existsSync(trendPath));
      const trendData = JSON.parse(fs.readFileSync(trendPath, 'utf-8'));
      assert.strictEqual(trendData.months.length, 2);

      // 2. saveDeepAnalysisArchive
      storage.saveDeepAnalysisArchive('2026-09', {
        month: '2026-09',
        profiles: [{ login: 'alice' }],
      });
      const deepPath = path.join(tmpBase, 'processed', 'deep-analysis', '2026-09.json');
      assert.ok(fs.existsSync(deepPath));

      // 3. getStoredDeepAnalysisMonths
      const deepMonths = storage.getStoredDeepAnalysisMonths();
      assert.deepStrictEqual(deepMonths, ['2026-09']);
    } finally {
      if (fs.existsSync(tmpBase)) {
        fs.rmSync(tmpBase, { recursive: true, force: true });
      }
    }
  });
});
