import test from 'node:test';
import assert from 'node:assert';
import { classifyModel, countByTier, normalizeModelId } from '../processor/model-classification.js';
import { MODEL_ESTIMATED_CHAT_COST, diagnoseOverkillModel } from '../processor/inefficiency-rules.js';

test('model ids are classified by family rules, not by a fixed list', () => {
  const cases: Array<[string, string]> = [
    ['o1', 'reasoning_heavy'],
    ['o3', 'reasoning_heavy'],
    ['claude-opus-4-1', 'reasoning_heavy'],
    ['deepseek-r1', 'reasoning_heavy'],
    ['claude-3-7-sonnet', 'heavy'],
    ['claude-sonnet-4-5', 'heavy'],
    ['gemini-2.5-pro', 'heavy'],
    ['gpt-5', 'heavy'],
    ['GPT-4o', 'standard'],
    ['gpt-4.1', 'standard'],
    ['gemini-2-0-flash', 'light'],
    ['claude-haiku-4-5', 'light'],
    ['gpt-5-mini', 'light'],
    ['o3-mini', 'light'],
    ['gpt-4o-mini', 'light'],
  ];
  for (const [id, tier] of cases) assert.strictEqual(classifyModel(id).tier, tier, id);
});

test('an unknown model is "unknown": neither heavy nor light, with an assumed cost', () => {
  const c = classifyModel('totally-new-model-x');
  assert.strictEqual(c.tier, 'unknown');
  assert.strictEqual(c.costIsAssumed, true);
  const counts = countByTier({ 'totally-new-model-x': 10, o1: 5 });
  assert.strictEqual(counts.unknown, 10);
  assert.strictEqual(counts.reasoning_heavy, 5);
  assert.strictEqual(counts.total, 15);
});

test('normalization and invalid counts', () => {
  assert.strictEqual(normalizeModelId('  Claude_3.7 Sonnet '), 'claude-3-7-sonnet');
  const counts = countByTier({ o1: -3, 'gpt-4o': Number.NaN, 'gemini-2-0-flash': 2 });
  assert.strictEqual(counts.total, 2);
});

test('legacy cost table is derived from the catalog', () => {
  assert.strictEqual(MODEL_ESTIMATED_CHAT_COST['o1'], classifyModel('o1').estimatedChatCostUsd);
  assert.ok(MODEL_ESTIMATED_CHAT_COST['o1'] > MODEL_ESTIMATED_CHAT_COST['gemini-2-0-flash']);
});

test('overkill model rule fires for current models (it used to fire only for 2025 ids)', () => {
  const heavy = diagnoseOverkillModel(40, { 'claude-opus-4-1': 30, 'claude-sonnet-4-5': 8, 'gpt-5-mini': 2 });
  assert.ok(heavy.probabilityPercent >= 70, String(heavy.probabilityPercent));
  const balanced = diagnoseOverkillModel(40, { 'claude-sonnet-4-5': 10, 'gpt-5-mini': 20, 'gpt-4.1': 10 });
  assert.ok(balanced.probabilityPercent < 40, String(balanced.probabilityPercent));
  // unknown models do not create a heavy-model signal
  const unknown = diagnoseOverkillModel(40, { 'mystery-1': 40 });
  assert.ok(unknown.probabilityPercent < 40, String(unknown.probabilityPercent));
});
