import test from 'node:test';
import assert from 'node:assert';
import { generateBenchmarkDataset } from '../../scripts/update-benchmarks.js';
import { resolveCatalogModelId } from '../processor/model-catalog.js';

test('Latest Copilot models (Sonnet 5.5 / GPT-6.1 Sol)', async (t) => {
  const dataset = generateBenchmarkDataset();

  await t.test('resolve through the catalog', () => {
    assert.strictEqual(resolveCatalogModelId('Claude Sonnet 5.5'), 'claude-sonnet-5-5');
    assert.strictEqual(resolveCatalogModelId('GPT-6.1 Sol'), 'gpt-6-1-sol');
    assert.strictEqual(resolveCatalogModelId('Claude Sonnet 5'), 'claude-sonnet-5');
  });

  await t.test('are in the dataset and flagged as estimated', () => {
    for (const id of ['claude-sonnet-5-5', 'gpt-6-1-sol']) {
      const model = dataset.models.find((m) => m.id === id);
      assert.ok(model, `${id} must be in the dataset`);
      assert.strictEqual(model.is_estimated, true, `${id} scores are estimates and must be flagged`);
    }
  });

  await t.test('models with verified scores are not flagged', () => {
    assert.ok(!dataset.models.find((m) => m.id === 'claude-sonnet-5')?.is_estimated);
  });
});
