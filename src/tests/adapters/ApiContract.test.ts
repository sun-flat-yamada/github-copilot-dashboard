import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { userReportRowSchema } from '../../adapters/github-api/usage-reports/user-report-schema.js';
import { CopilotSeatAssignmentRawSchema } from '../../adapters/github-api/schemas/seats-schema.js';
import { EnterpriseCostCenterRawSchema, pickCostCenterRecords } from '../../adapters/github-api/schemas/cost-centers-schema.js';
import {
  diffFingerprints,
  driftSignature,
  fingerprintOf,
  hasDrift,
} from '../../adapters/github-api/schema-fingerprint.js';
import {
  fixtureFingerprints,
  loadBaseline,
  loadContractSample,
} from '../../adapters/github-api/api-contract-fixtures.js';

describe('API contract fixtures (anonymized recordings)', () => {
  it('users-1-day rows satisfy the ingestion schema', () => {
    const rows = loadContractSample('users-1-day') as unknown[];
    assert.ok(rows.length >= 2);
    for (const row of rows) assert.equal(userReportRowSchema.safeParse(row).success, true);
  });

  it('seats satisfy the ingestion schema, including a null organization and a team', () => {
    const page = loadContractSample('seats') as { seats: unknown[] };
    const parsed = page.seats.map((s) => CopilotSeatAssignmentRawSchema.parse(s));
    assert.equal(parsed.some((s) => s.organization === null), true);
    assert.equal(parsed.some((s) => s.assigning_team !== null), true);
  });

  it('cost centers satisfy the ingestion schema', () => {
    const records = pickCostCenterRecords(loadContractSample('cost-centers'));
    assert.ok(records.length > 0);
    for (const r of records) EnterpriseCostCenterRawSchema.parse(r);
  });

  it('the committed baseline fingerprints match the fixtures (run `npm run schema:drift -- --update-baseline` after changing them)', () => {
    assert.deepEqual(loadBaseline(), fixtureFingerprints());
  });

  it('fixtures contain no real identity or credential-shaped values', () => {
    for (const source of ['users-1-day', 'seats', 'cost-centers'] as const) {
      const text = JSON.stringify(loadContractSample(source));
      assert.doesNotMatch(text, /@|ghp_|github_pat_|token/i);
    }
  });
});

describe('schema fingerprint', () => {
  it('records key paths and types only, never values', () => {
    const fp = fingerprintOf([{ a: 'secret-value', n: 1, list: [{ x: true }, { x: null }] }]);
    assert.deepEqual(fp, {
      a: ['string'],
      list: ['array'],
      'list[]': ['object'],
      'list[].x': ['boolean', 'null'],
      n: ['number'],
    });
    assert.doesNotMatch(JSON.stringify(fp), /secret-value/);
  });

  it('detects an added field, a removed field and a type change', () => {
    const baseline = fingerprintOf([{ id: 1, name: 'a', old: 'x' }]);
    const live = fingerprintOf([{ id: '1', name: 'a', fresh: 1 }]);
    const drift = diffFingerprints(baseline, live);
    assert.deepEqual(drift.added, ['fresh']);
    assert.deepEqual(drift.removed, ['old']);
    assert.deepEqual(drift.typeChanged, [{ path: 'id', baseline: ['number'], live: ['string'] }]);
    assert.equal(hasDrift(drift), true);
  });

  it('does not flag a live subset of the baseline types (e.g. null never sampled)', () => {
    const baseline = fingerprintOf([{ v: 1 }, { v: null }]);
    const drift = diffFingerprints(baseline, fingerprintOf([{ v: 2 }]));
    assert.equal(hasDrift(drift), false);
  });

  it('gives the same signature for the same drift and a different one otherwise', () => {
    const a = diffFingerprints(fingerprintOf([{ a: 1 }]), fingerprintOf([{ a: 1, b: 1 }]));
    const b = diffFingerprints(fingerprintOf([{ a: 1 }]), fingerprintOf([{ a: 1, b: 2 }]));
    const c = diffFingerprints(fingerprintOf([{ a: 1 }]), fingerprintOf([{ a: 1, c: 1 }]));
    assert.equal(driftSignature(a), driftSignature(b));
    assert.notEqual(driftSignature(a), driftSignature(c));
  });
});
