import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('AI Model Radar Benchmark Table Task Cost & Citations Contract Tests', async (t) => {
  const repoRoot = process.cwd();

  await t.test('verifies benchmark records have valid task_cost_usd for all evaluated models', () => {
    const recordsPath = path.resolve(repoRoot, 'scripts/benchmark-data/benchmark-records.json');
    assert.ok(fs.existsSync(recordsPath), 'benchmark-records.json must exist');
    const records = JSON.parse(fs.readFileSync(recordsPath, 'utf-8'));
    assert.ok(Array.isArray(records) && records.length > 0, 'Records should not be empty');

    for (const model of records) {
      assert.ok(
        typeof model.raw_metrics.task_cost_usd === 'number' && model.raw_metrics.task_cost_usd > 0,
        `Model ${model.id} must have a positive number for task_cost_usd, got: ${model.raw_metrics.task_cost_usd}`
      );
    }
  });

  await t.test('verifies ModelRadarView.tsx contains Task Cost column, sorting, and detail card integration', () => {
    const viewPath = path.resolve(repoRoot, 'dashboard/src/components/ModelRadarView.tsx');
    assert.ok(fs.existsSync(viewPath), 'ModelRadarView.tsx must exist');
    const content = fs.readFileSync(viewPath, 'utf-8');

    // SortKey includes 'task_cost'
    assert.match(content, /'task_cost'/, 'sortKey state must include task_cost');

    // Sorting comparison branch for task_cost
    assert.match(
      content,
      /else\s+if\s*\(\s*sortKey\s*===\s*'task_cost'\s*\)\s*\{\s*valA\s*=\s*a\.raw_metrics\.task_cost_usd/,
      'Must contain sorting logic for task_cost'
    );

    // Sort button in toolbar
    assert.match(
      content,
      /handleSort\('task_cost'\)/,
      'Must provide handleSort call for task_cost in sort bar or table'
    );
    assert.match(content, /Task単価/, 'Toolbar or header must display Task単価 label');

    // Separate Token cost and Task cost headers
    assert.match(content, /Token単価\s*\(\$\/1M\)/, 'Must display Token単価 header');
    assert.match(content, /Task単価\s*\(\$\/Task\)/, 'Must display Task単価 header');

    // Table body cell rendering task_cost_usd
    assert.match(
      content,
      /m\.raw_metrics\.task_cost_usd/,
      'tbody must render m.raw_metrics.task_cost_usd'
    );

    // Detail card pricing grid includes task cost
    assert.match(
      content,
      /実測\s*Task\s*単価/,
      'Focused model detail card must display 実測 Task 単価'
    );
  });

  await t.test('verifies RadarDocReferences.tsx includes Task Cost citation card', () => {
    const docRefPath = path.resolve(repoRoot, 'dashboard/src/components/radar/RadarDocReferences.tsx');
    assert.ok(fs.existsSync(docRefPath), 'RadarDocReferences.tsx must exist');
    const content = fs.readFileSync(docRefPath, 'utf-8');

    assert.match(
      content,
      /著名ベンチマーク実測タスクコスト/,
      'Must contain Task Cost citation card title'
    );
    assert.match(
      content,
      /https:\/\/www\.tbench\.ai\/leaderboard\/terminal-bench\/4\.0/,
      'Must contain link to Terminal-Bench leaderboard'
    );
    assert.match(
      content,
      /grid-cols-1\s+md:grid-cols-2\s+lg:grid-cols-3/,
      'Grid should accommodate the third citation card'
    );
  });

  await t.test('verifies benchmark definitions describe task cost context', () => {
    const defsPath = path.resolve(repoRoot, 'src/processor/benchmark-definitions.ts');
    assert.ok(fs.existsSync(defsPath), 'benchmark-definitions.ts must exist');
    const content = fs.readFileSync(defsPath, 'utf-8');

    assert.match(
      content,
      /Task単価|\$\/task/,
      'Benchmark definitions must mention Task cost / $/task'
    );
  });
});
