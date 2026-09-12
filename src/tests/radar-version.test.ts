import test from 'node:test';
import assert from 'node:assert';
import {
  isValidRadarVersion,
  parseRadarVersion,
  getNextRadarVersion,
  formatDateKey,
} from '../processor/radar-version.js';

test('AI Model Radar Version Management Tests', async (t) => {
  await t.test('formats Date object into yyyy-mm-dd format', () => {
    const d = new Date(2026, 8, 13);
    assert.strictEqual(formatDateKey(d), '2026-09-13');
  });

  await t.test('validates version strings against yyyy-mm-dd-xxxx format', () => {
    assert.strictEqual(isValidRadarVersion('2026-09-13-0001'), true);
    assert.strictEqual(isValidRadarVersion('2026-12-31-9999'), true);
    assert.strictEqual(isValidRadarVersion('2026.09.2'), false);
    assert.strictEqual(isValidRadarVersion('2026-09-13-1'), false);
    assert.strictEqual(isValidRadarVersion('2026-9-13-0001'), false);
    assert.strictEqual(isValidRadarVersion(''), false);
  });

  await t.test('parses valid version strings into date and sequence', () => {
    const parsed = parseRadarVersion('2026-09-13-0042');
    assert.ok(parsed);
    assert.strictEqual(parsed.date, '2026-09-13');
    assert.strictEqual(parsed.sequence, 42);

    assert.strictEqual(parseRadarVersion('invalid-version'), null);
  });

  await t.test('increments sequence for the same date', () => {
    const fixedDate = new Date(2026, 8, 13); // September 13, 2026
    const next1 = getNextRadarVersion('2026-09-13-0001', fixedDate);
    assert.strictEqual(next1, '2026-09-13-0002');

    const next9 = getNextRadarVersion('2026-09-13-0009', fixedDate);
    assert.strictEqual(next9, '2026-09-13-0010');
  });

  await t.test('resets sequence to 0001 when date changes', () => {
    const yesterday = '2026-09-12-0005';
    const today = new Date(2026, 8, 13); // September 13, 2026
    const next = getNextRadarVersion(yesterday, today);
    assert.strictEqual(next, '2026-09-13-0001');
  });

  await t.test('handles undefined or legacy version format gracefully', () => {
    const fixedDate = new Date(2026, 8, 13);
    assert.strictEqual(getNextRadarVersion(undefined, fixedDate), '2026-09-13-0001');
    assert.strictEqual(getNextRadarVersion('2026.09.2', fixedDate), '2026-09-13-0001');
    assert.strictEqual(getNextRadarVersion('', fixedDate), '2026-09-13-0001');
  });
});
