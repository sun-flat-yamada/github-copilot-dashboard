import test from 'node:test';
import assert from 'node:assert';
import { PRESETS } from '../../dashboard/src/components/ModelRadarView.js';
import fs from 'node:fs';
import path from 'node:path';
import { runBenchmarkUpdate } from '../../scripts/update-benchmarks.js';

test('AI Model Radar Comparison Presets Tests', async (t) => {
  const datasetPath = path.resolve(process.cwd(), 'dashboard/public/data/model-benchmarks.json');
  if (!fs.existsSync(datasetPath)) {
    runBenchmarkUpdate();
  }
  const datasetJson = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const validModelIds = new Set(datasetJson.models.map((m: { id: string }) => m.id));

  await t.test('includes the practical-high-value preset with required models including GPT-6 Luna and GPT-5.6 Luna', () => {
    const practicalPreset = PRESETS.find((p) => p.id === 'practical-high-value');
    assert.ok(practicalPreset, 'practical-high-value preset must exist');
    assert.match(practicalPreset.name, /実用性能で高コスパ/, 'Preset name must contain 実用性能で高コスパ');

    // Required models specified by user (including gpt-6-luna and maintaining gpt-5-6-luna for high-value)
    assert.ok(practicalPreset.modelIds.includes('gpt-6-luna'), 'Must include gpt-6-luna');
    assert.ok(practicalPreset.modelIds.includes('gpt-5-6-luna'), 'Must include gpt-5-6-luna');
    assert.ok(practicalPreset.modelIds.includes('gemini-3-8-flash'), 'Must include gemini-3-8-flash');
    assert.ok(practicalPreset.modelIds.includes('claude-sonnet-5'), 'Must include claude-sonnet-5');
    assert.ok(practicalPreset.modelIds.includes('kimi-k2-7-code'), 'Includes kimi-k2-7-code as proposed balanced code model');
    assert.strictEqual(practicalPreset.modelIds.length, 5, 'Preset should contain 5 models');
  });

  await t.test('includes the 2026 flagship preset with both Claude Opus 5.5 and Opus 5', () => {
    const flagshipPreset = PRESETS.find((p) => p.id === 'flagship-2026');
    assert.ok(flagshipPreset, 'flagship-2026 preset must exist');
    assert.match(flagshipPreset.name, /2026.*旗艦/);
    assert.strictEqual(flagshipPreset.modelIds.length, 5, 'Must contain 5 models');
    // Verify both Claude Opus 5.5 and Opus 5 are included
    assert.ok(flagshipPreset.modelIds.includes('claude-opus-5-5'), 'Must include claude-opus-5-5');
    assert.ok(flagshipPreset.modelIds.includes('claude-opus-5'), 'Must include claude-opus-5');
    assert.ok(flagshipPreset.modelIds.includes('gpt-6-astra'), 'Must include gpt-6-astra');
    assert.ok(flagshipPreset.modelIds.includes('gemini-3-8-flash'), 'Must include gemini-3-8-flash');
    assert.ok(flagshipPreset.modelIds.includes('kimi-k3'), 'Must include kimi-k3');
  });

  await t.test('includes recommended presets (code review, codebase analysis, architecture) with Opus 5.5 additions and Opus 5 retention', () => {
    // 1. コードレビュー利用に推奨 (Opus 5.5 追加、Opus 5 維持)
    const reviewPreset = PRESETS.find((p) => p.id === 'recommended-code-review');
    assert.ok(reviewPreset, 'recommended-code-review preset must exist');
    assert.match(reviewPreset.name, /コードレビュー利用に推奨/);
    assert.strictEqual(reviewPreset.modelIds.length, 4, 'Must contain 4 models');
    assert.deepStrictEqual(reviewPreset.modelIds, ['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5', 'gemini-3-8-flash']);

    // 2. コードベース分析に推奨 (Opus 5.5 追加、Opus 5 維持)
    const analysisPreset = PRESETS.find((p) => p.id === 'recommended-codebase-analysis');
    assert.ok(analysisPreset, 'recommended-codebase-analysis preset must exist');
    assert.match(analysisPreset.name, /コードベース分析に推奨/);
    assert.strictEqual(analysisPreset.modelIds.length, 4, 'Must contain 4 models');
    assert.deepStrictEqual(analysisPreset.modelIds, ['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5', 'gemini-3-8-flash']);

    // 3. 設計に推奨 (Opus 5.5 および Opus 5 を含む)
    const archPreset = PRESETS.find((p) => p.id === 'recommended-architecture');
    assert.ok(archPreset, 'recommended-architecture preset must exist');
    assert.match(archPreset.name, /設計に推奨/);
    assert.strictEqual(archPreset.modelIds.length, 5, 'Must contain 5 models');
    assert.deepStrictEqual(archPreset.modelIds, ['gpt-6-astra', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5', 'gemini-3-8-flash']);
  });

  await t.test('verifies tier and vendor presets including lightweight GPT-6 Luna and OpenAI lineup updates', () => {
    // tier-powerful: claude-opus-5-5, claude-opus-5, gpt-6-sol (gpt-5-5 removed)
    const powerfulPreset = PRESETS.find((p) => p.id === 'tier-powerful');
    assert.ok(powerfulPreset);
    assert.ok(powerfulPreset.modelIds.includes('claude-opus-5-5'), 'tier-powerful must include claude-opus-5-5');
    assert.ok(powerfulPreset.modelIds.includes('claude-opus-5'), 'tier-powerful must keep claude-opus-5');
    assert.ok(powerfulPreset.modelIds.includes('gpt-6-sol'), 'tier-powerful must include gpt-6-sol');
    assert.ok(!powerfulPreset.modelIds.includes('gpt-5-5'), 'tier-powerful must NOT include gpt-5-5');
    assert.strictEqual(powerfulPreset.modelIds.length, 5, 'tier-powerful should contain 5 models');

    // tier-versatile: gpt-5-4 -> gpt-5-6-terra
    const versatilePreset = PRESETS.find((p) => p.id === 'tier-versatile');
    assert.ok(versatilePreset);
    assert.ok(versatilePreset.modelIds.includes('gpt-5-6-terra'), 'tier-versatile must include gpt-5-6-terra');
    assert.ok(!versatilePreset.modelIds.includes('gpt-5-4'), 'tier-versatile must NOT include gpt-5-4');
    assert.strictEqual(versatilePreset.modelIds.length, 4, 'tier-versatile should contain 4 models');

    // tier-lightweight: keeps gpt-5-6-luna and includes gpt-6-luna
    const lightweightPreset = PRESETS.find((p) => p.id === 'tier-lightweight');
    assert.ok(lightweightPreset);
    assert.ok(lightweightPreset.modelIds.includes('gpt-6-luna'), 'tier-lightweight must include gpt-6-luna');
    assert.ok(lightweightPreset.modelIds.includes('gpt-5-6-luna'), 'tier-lightweight must retain gpt-5-6-luna');
    assert.strictEqual(lightweightPreset.modelIds.length, 5, 'tier-lightweight should contain 5 models');

    // vendor-openai: adds GPT-6 Sol and GPT-5.6 Sol, removes GPT-5.5, GPT-5.4, GPT-5 mini
    const openaiPreset = PRESETS.find((p) => p.id === 'vendor-openai');
    assert.ok(openaiPreset);
    assert.ok(openaiPreset.modelIds.includes('gpt-6-astra'), 'vendor-openai must keep gpt-6-astra');
    assert.ok(openaiPreset.modelIds.includes('gpt-6-sol'), 'vendor-openai must include gpt-6-sol');
    assert.ok(openaiPreset.modelIds.includes('gpt-5-6-sol'), 'vendor-openai must include gpt-5-6-sol');
    assert.ok(!openaiPreset.modelIds.includes('gpt-5-5'), 'vendor-openai must NOT include gpt-5-5');
    assert.ok(!openaiPreset.modelIds.includes('gpt-5-4'), 'vendor-openai must NOT include gpt-5-4');
    assert.ok(!openaiPreset.modelIds.includes('gpt-5-mini'), 'vendor-openai must NOT include gpt-5-mini');
    assert.strictEqual(openaiPreset.modelIds.length, 3, 'vendor-openai should contain 3 models');

    // vendor-anthropic: includes opus-5.5 and keeps opus-5
    const anthropicPreset = PRESETS.find((p) => p.id === 'vendor-anthropic');
    assert.ok(anthropicPreset);
    assert.ok(anthropicPreset.modelIds.includes('claude-opus-5-5'));
    assert.ok(anthropicPreset.modelIds.includes('claude-opus-5'));
  });

  await t.test('all presets have unique IDs and non-empty metadata', () => {
    const ids = PRESETS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'Preset IDs must be unique');

    PRESETS.forEach((p) => {
      assert.ok(p.name.length > 0, `Preset ${p.id} must have a name`);
      assert.ok(p.description.length > 0, `Preset ${p.id} must have a description`);
      assert.ok(p.modelIds.length > 0 && p.modelIds.length <= 5, `Preset ${p.id} must have 1-5 models`);
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
