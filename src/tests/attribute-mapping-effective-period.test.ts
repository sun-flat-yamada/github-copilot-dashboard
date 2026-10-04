import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { AttributeResolver } from '../collector/attribute-resolver.js';
import { AttributeResolverAdapter } from '../adapters/storage/AttributeResolverAdapter.js';
import { normalizeAsOf, selectEffectiveEntry, validateMappingPeriods } from '../collector/mapping-periods.js';
import { ReportParser } from '../processor/report-parser.js';

// 架空データのみ (実在の人物・部署・組織は使わない)
const TRANSFER_MAPPING = JSON.stringify([
  {
    github_user: 'dev_alice',
    display_name: 'Alice A.',
    department: 'Unit Alpha',
    cost_center_override: 'CC-ALPHA',
    valid_to: '2026-08-14',
  },
  {
    github_user: 'dev_alice',
    display_name: 'Alice A.',
    department: 'Unit Beta',
    cost_center_override: 'CC-BETA',
    valid_from: '2026-08-15',
  },
  { github_user: 'dev_bob', display_name: 'Bob B.', department: 'Unit Alpha' },
]);

describe('mapping-periods: validation', () => {
  it('accepts contiguous periods and period-less rows', () => {
    assert.deepStrictEqual(validateMappingPeriods([{}]), []);
    assert.deepStrictEqual(
      validateMappingPeriods([{ valid_to: '2026-08-14' }, { valid_from: '2026-08-15' }]),
      []
    );
  });

  it('detects overlapping periods as errors', () => {
    const issues = validateMappingPeriods([{ valid_to: '2026-08-15' }, { valid_from: '2026-08-15' }]);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].code, 'overlap');
    assert.strictEqual(issues[0].severity, 'error');
  });

  it('detects two period-less rows as an overlap', () => {
    assert.strictEqual(validateMappingPeriods([{}, {}])[0].code, 'overlap');
  });

  it('detects a gap between periods as a warning', () => {
    const issues = validateMappingPeriods([{ valid_to: '2026-08-14' }, { valid_from: '2026-08-20' }]);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].code, 'gap');
    assert.strictEqual(issues[0].severity, 'warning');
  });

  it('detects invalid dates and inverted ranges', () => {
    assert.strictEqual(validateMappingPeriods([{ valid_from: '2026-02-30' }])[0].code, 'invalid_date');
    assert.strictEqual(validateMappingPeriods([{ valid_from: 'soon' }])[0].code, 'invalid_date');
    assert.strictEqual(
      validateMappingPeriods([{ valid_from: '2026-09-01', valid_to: '2026-08-01' }])[0].code,
      'invalid_range'
    );
  });
});

describe('mapping-periods: effective entry selection', () => {
  const entries = [
    { id: 'old', valid_to: '2026-08-14' },
    { id: 'new', valid_from: '2026-08-15' },
  ];

  it('picks the entry in effect on the boundary dates', () => {
    assert.strictEqual(selectEffectiveEntry(entries, '2026-08-14')?.id, 'old');
    assert.strictEqual(selectEffectiveEntry(entries, '2026-08-15')?.id, 'new');
    assert.strictEqual(selectEffectiveEntry(entries, '2026-01-01')?.id, 'old');
  });

  it('treats YYYY-MM as the last day of the month and omitted asOf as the current entry', () => {
    assert.strictEqual(normalizeAsOf('2026-02'), '2026-02-28');
    assert.strictEqual(normalizeAsOf('2026-08-15T10:00:00Z'), '2026-08-15');
    assert.strictEqual(selectEffectiveEntry(entries, '2026-08')?.id, 'new');
    assert.strictEqual(selectEffectiveEntry(entries)?.id, 'new');
  });

  it('returns undefined when no entry is in effect', () => {
    assert.strictEqual(selectEffectiveEntry([{ valid_from: '2026-09-01' }], '2026-08-31'), undefined);
  });

  it('prefers the later valid_from when periods overlap', () => {
    const overlapping = [{ id: 'a', valid_to: '2026-08-20' }, { id: 'b', valid_from: '2026-08-15' }];
    assert.strictEqual(selectEffectiveEntry(overlapping, '2026-08-17')?.id, 'b');
  });
});

describe('AttributeResolver: effective periods', () => {
  it('stays backward compatible: mappings without periods are unlimited', () => {
    const resolver = new AttributeResolver(TRANSFER_MAPPING);
    assert.strictEqual(resolver.resolve('dev_bob', '1999-01-01').department, 'Unit Alpha');
    assert.strictEqual(resolver.resolve('dev_bob', '2099-12-31').department, 'Unit Alpha');
    assert.strictEqual(resolver.resolve('dev_bob').department, 'Unit Alpha');
    assert.strictEqual(resolver.getMappingCount(), 2);
  });

  it('resolves by effective date for a transferred user', () => {
    const resolver = new AttributeResolver(TRANSFER_MAPPING);
    assert.strictEqual(resolver.resolve('dev_alice', '2026-08-14').department, 'Unit Alpha');
    assert.strictEqual(resolver.resolve('dev_alice', '2026-08-14').costCenterOverride, 'CC-ALPHA');
    assert.strictEqual(resolver.resolve('dev_alice', '2026-08-15').department, 'Unit Beta');
    assert.strictEqual(resolver.resolve('dev_alice').department, 'Unit Beta');
    assert.deepStrictEqual(resolver.getValidationIssues(), []);
  });

  it('reads valid_from / valid_to columns from CSV', () => {
    const csv = [
      'github_user,display_name,department,cost_center_override,notes,tags,valid_from,valid_to',
      'dev_carol,Carol C.,Unit Alpha,CC-ALPHA,,,,2026-06-30',
      'dev_carol,Carol C.,Unit Beta,CC-BETA,,,2026-07-01,',
    ].join('\n');
    const resolver = new AttributeResolver(csv);
    assert.strictEqual(resolver.resolve('dev_carol', '2026-06-30').department, 'Unit Alpha');
    assert.strictEqual(resolver.resolve('dev_carol', '2026-07-01').department, 'Unit Beta');
  });

  it('reports overlaps and gaps without leaking login names, and drops invalid rows', () => {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => void warnings.push(args.join(' '));
    try {
      const resolver = new AttributeResolver(
        JSON.stringify([
          { github_user: 'dev_dave', department: 'Unit Alpha', valid_to: '2026-08-20' },
          { github_user: 'dev_dave', department: 'Unit Beta', valid_from: '2026-08-10' },
          { github_user: 'dev_erin', department: 'Unit Alpha', valid_to: '2026-03-31' },
          { github_user: 'dev_erin', department: 'Unit Beta', valid_from: '2026-05-01' },
          { github_user: 'dev_frank', department: 'Unit Alpha', valid_from: 'not-a-date' },
        ])
      );
      const codes = resolver.getValidationIssues().map((i) => i.code).sort();
      assert.deepStrictEqual(codes, ['gap', 'invalid_date', 'overlap']);
      // 隙間の日は未登録、不正な行は解決対象外
      assert.strictEqual(resolver.resolve('dev_erin', '2026-04-15').department, '未分類 (Unassigned)');
      assert.strictEqual(resolver.resolve('dev_frank').department, '未分類 (Unassigned)');
      // 重複は新しい valid_from を優先
      assert.strictEqual(resolver.resolve('dev_dave', '2026-08-15').department, 'Unit Beta');
    } finally {
      console.warn = original;
    }
    assert.ok(warnings.some((w) => w.includes('Effective-period validation')));
    assert.ok(!warnings.join('\n').includes('dev_'), 'warnings must not contain login names');
  });

  it('keeps pseudonymization when periods are used', () => {
    const secret = 'mock-secret-0000000000000000';
    const resolver = new AttributeResolver(TRANSFER_MAPPING, true, { anonymizeSecret: secret });
    const before = resolver.resolve('dev_alice', '2026-08-01');
    const after = resolver.resolve('dev_alice', '2026-08-31');
    assert.notStrictEqual(before.department, after.department);
    assert.ok(before.department.startsWith('Group-'));
    assert.strictEqual(before.login, after.login);
    assert.ok(!before.displayName.includes('Alice'));
  });

  it('adapter (IAttributeResolver) resolves by effective date', () => {
    const adapter = new AttributeResolverAdapter(TRANSFER_MAPPING, false);
    assert.strictEqual(adapter.resolve('dev_alice', '2026-08-14')?.department, 'Unit Alpha');
    assert.strictEqual(adapter.resolve('dev_alice', '2026-08-15')?.department, 'Unit Beta');
    assert.strictEqual(adapter.resolveAll(['dev_alice'], '2026-08-01').get('dev_alice')?.department, 'Unit Alpha');
  });
});

describe('ReportParser: allocation in the transfer month', () => {
  const csv = `date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,organization,cost_center_name
2026-08-10,dev_alice,copilot,copilot_premium_request,GPT-4o,10,requests,0.04,0.40,0.00,0.40,mock-org,CC-REPORT
2026-08-14,dev_alice,copilot,copilot_premium_request,GPT-4o,10,requests,0.04,0.40,0.00,0.40,mock-org,CC-REPORT
2026-08-15,dev_alice,copilot,copilot_premium_request,GPT-4o,5,requests,0.04,0.20,0.00,0.20,mock-org,CC-REPORT
2026-08-31,dev_alice,copilot,copilot_premium_request,GPT-4o,5,requests,0.04,0.20,0.00,0.20,mock-org,CC-REPORT
`;

  it('splits department and cost center allocation by effective date', () => {
    const parser = new ReportParser(new AttributeResolver(TRANSFER_MAPPING));
    const agg = parser.aggregate(parser.parseRecords(csv), '2026-08', 'mock.csv');
    assert.strictEqual(agg.by_department['Unit Alpha'].total_cost_usd, 0.8);
    assert.strictEqual(agg.by_department['Unit Beta'].total_cost_usd, 0.4);
    assert.strictEqual(agg.by_cost_center['CC-ALPHA'].total_cost_usd, 0.8);
    assert.strictEqual(agg.by_cost_center['CC-BETA'].total_cost_usd, 0.4);
    assert.strictEqual(agg.overview.total_net_spend_usd, 1.2);
    // ユーザー別の属性は最新の利用日 (異動後) の所属
    const alice = agg.user_details.find((u) => u.login === 'dev_alice');
    assert.strictEqual(alice?.department, 'Unit Beta');
  });

  it('allocates a past month to the department in effect then, not the current one', () => {
    const parser = new ReportParser(new AttributeResolver(TRANSFER_MAPPING));
    const july = csv.replace(/2026-08-/g, '2026-07-');
    const agg = parser.aggregate(parser.parseRecords(july), '2026-07', 'mock-july.csv');
    assert.strictEqual(agg.by_department['Unit Alpha'].total_cost_usd, 1.2);
    assert.strictEqual(agg.by_department['Unit Beta'], undefined);
  });
});
