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

  await t.test('includes the 2026 flagship 4 preset with Powerful Claude model (Claude Opus 5)', () => {
    const flagshipPreset = PRESETS.find((p) => p.id === 'flagship-2026');
    assert.ok(flagshipPreset, 'flagship-2026 preset must exist');
    assert.match(flagshipPreset.name, /2026上 旗艦4選/);
    assert.strictEqual(flagshipPreset.modelIds.length, 4, 'Must contain 4 models');
    // Verify Claude Powerful model (claude-opus-5) is selected over versatile
    assert.ok(flagshipPreset.modelIds.includes('claude-opus-5'), 'Must include claude-opus-5 as Anthropic Powerful flagship');
    assert.ok(flagshipPreset.modelIds.includes('gpt-6-astra'), 'Must include gpt-6-astra');
    assert.ok(flagshipPreset.modelIds.includes('gemini-3-8-flash'), 'Must include gemini-3-8-flash');
    assert.ok(flagshipPreset.modelIds.includes('kimi-k3'), 'Must include kimi-k3');
  });

  await t.test('includes the 3 new recommended presets (code review, codebase analysis, architecture) with top-3 cost variations', () => {
    // 1. コードレビュー利用に推奨
    const reviewPreset = PRESETS.find((p) => p.id === 'recommended-code-review');
    assert.ok(reviewPreset, 'recommended-code-review preset must exist');
    assert.match(reviewPreset.name, /コードレビュー利用に推奨/);
    assert.strictEqual(reviewPreset.modelIds.length, 3, 'Must contain top 3 models');
    assert.deepStrictEqual(reviewPreset.modelIds, ['claude-opus-5', 'claude-sonnet-5', 'gemini-3-8-flash']);

    // 2. コードベース分析に推奨
    const analysisPreset = PRESETS.find((p) => p.id === 'recommended-codebase-analysis');
    assert.ok(analysisPreset, 'recommended-codebase-analysis preset must exist');
    assert.match(analysisPreset.name, /コードベース分析に推奨/);
    assert.strictEqual(analysisPreset.modelIds.length, 3, 'Must contain top 3 models');
    assert.deepStrictEqual(analysisPreset.modelIds, ['claude-opus-5', 'claude-sonnet-5', 'gemini-3-8-flash']);

    // 3. 設計に推奨
    const archPreset = PRESETS.find((p) => p.id === 'recommended-architecture');
    assert.ok(archPreset, 'recommended-architecture preset must exist');
    assert.match(archPreset.name, /設計に推奨/);
    assert.strictEqual(archPreset.modelIds.length, 3, 'Must contain top 3 models');
    assert.deepStrictEqual(archPreset.modelIds, ['gpt-6-astra', 'claude-sonnet-5', 'gemini-3-8-flash']);
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
