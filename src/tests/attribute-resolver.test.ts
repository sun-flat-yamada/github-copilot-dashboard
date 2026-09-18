import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { AttributeResolver } from '../collector/attribute-resolver.js';

describe('AttributeResolver: baseline JSON/CSV parsing (rawConfig)', () => {
  it('resolves a JSON array mapping passed directly as rawConfig', () => {
    const resolver = new AttributeResolver(
      JSON.stringify([{ github_user: 'dev_alice', display_name: 'Alice A.', department: 'Frontend Unit' }])
    );
    const resolved = resolver.resolve('dev_alice');
    assert.strictEqual(resolved.displayName, 'Alice A.');
    assert.strictEqual(resolved.department, 'Frontend Unit');
    assert.strictEqual(resolver.getMappingCount(), 1);
  });

  it('resolves a CSV mapping passed directly as rawConfig', () => {
    const csv = 'github_user,display_name,department\ndev_bob,Bob B.,Platform Core';
    const resolver = new AttributeResolver(csv);
    const resolved = resolver.resolve('dev_bob');
    assert.strictEqual(resolved.displayName, 'Bob B.');
    assert.strictEqual(resolved.department, 'Platform Core');
  });

  it('falls back to the GitHub login and "Unassigned" department when no mapping matches', () => {
    const resolver = new AttributeResolver(JSON.stringify([{ github_user: 'dev_alice', display_name: 'Alice A.' }]));
    const resolved = resolver.resolve('dev_unknown');
    assert.strictEqual(resolved.displayName, 'dev_unknown');
    assert.strictEqual(resolved.department, '未分類 (Unassigned)');
  });
});

describe('AttributeResolver: tags field', () => {
  it('resolves a JSON mapping with a tags array', () => {
    const resolver = new AttributeResolver(
      JSON.stringify([{ github_user: 'dev_carol', display_name: 'Carol C.', tags: ['Contractor', 'Remote'] }])
    );
    const resolved = resolver.resolve('dev_carol');
    assert.deepStrictEqual(resolved.tags, ['Contractor', 'Remote']);
  });

  it('resolves a CSV mapping with a semicolon-separated tags column', () => {
    const csv = 'github_user,display_name,department,cost_center_override,notes,tags\ndev_dan,Dan D.,Platform,,,Contractor;Remote';
    const resolver = new AttributeResolver(csv);
    const resolved = resolver.resolve('dev_dan');
    assert.deepStrictEqual(resolved.tags, ['Contractor', 'Remote']);
  });

  it('leaves tags undefined when the field/column is absent', () => {
    const resolver = new AttributeResolver(
      JSON.stringify([{ github_user: 'dev_erin', display_name: 'Erin E.' }])
    );
    const resolved = resolver.resolve('dev_erin');
    assert.strictEqual(resolved.tags, undefined);
  });
});

