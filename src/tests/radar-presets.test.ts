import test from 'node:test';
import assert from 'node:assert';
import { PRESETS } from '../../dashboard/src/components/ModelRadarView.js';
import fs from 'node:fs';
import path from 'node:path';

test('AI Model Radar Comparison Presets Tests', async (t) => {
  const datasetPath = path.resolve(process.cwd(), 'dashboard/public/data/model-benchmarks.json');
  const datasetJson = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const validModelIds = new Set(datasetJson.models.map((m: { id: string }) => m.id));

  await t.test('includes the practical-high-value preset with required models', () => {
    const practicalPreset = PRESETS.find((p) => p.id === 'practical-high-value');
    assert.ok(practicalPreset, 'practical-high-value preset must exist');
    assert.match(practicalPreset.name, /実用性能で高コスパ/, 'Preset name must contain 実用性能で高コスパ');

    // Required models specified by user
    assert.ok(practicalPreset.modelIds.includes('gpt-5-6-luna'), 'Must include gpt-5-6-luna');
    assert.ok(practicalPreset.modelIds.includes('gemini-3-8-flash'), 'Must include gemini-3-8-flash');
    assert.ok(practicalPreset.modelIds.includes('claude-sonnet-5'), 'Must include claude-sonnet-5');

    // Additional proposed model
    assert.ok(practicalPreset.modelIds.includes('kimi-k2-7-code'), 'Includes kimi-k2-7-code as proposed balanced code model');
    assert.strictEqual(practicalPreset.modelIds.length, 4, 'Preset should contain 4 models');
  });

  await t.test('all presets have unique IDs and non-empty metadata', () => {
    const ids = PRESETS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'Preset IDs must be unique');

    PRESETS.forEach((p) => {
      assert.ok(p.name.length > 0, `Preset ${p.id} must have a name`);
      assert.ok(p.description.length > 0, `Preset ${p.id} must have a description`);
      assert.ok(p.modelIds.length > 0 && p.modelIds.length <= 4, `Preset ${p.id} must have 1-4 models`);
    });
  });

  await t.test('all model IDs referenced in presets exist in the benchmark dataset', () => {
    PRESETS.forEach((p) => {
      p.modelIds.forEach((id) => {
        assert.ok(
          validModelIds.has(id),
          `Model ID "${id}" in preset "${p.id}" must exist in model-benchmarks.json`
        );
      });
    });
  });
});
