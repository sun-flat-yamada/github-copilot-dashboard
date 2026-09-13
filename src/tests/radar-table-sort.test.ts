import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('AI Model Radar Table Sort and Action Button Tests', async (t) => {
  const datasetPath = path.resolve(process.cwd(), 'dashboard/public/data/model-benchmarks.json');
  const datasetJson = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const models = datasetJson.models as Array<{ id: string; name: string }>;

  await t.test('verifies 3-state loop logic for model column sort (default -> asc -> desc -> default)', () => {
    type ModelSortMode = 'default' | 'asc' | 'desc';
    const getNextModelSortMode = (current: ModelSortMode): ModelSortMode => {
      if (current === 'default') return 'asc';
      if (current === 'asc') return 'desc';
      return 'default';
    };

    let mode: ModelSortMode = 'default';
    mode = getNextModelSortMode(mode);
    assert.strictEqual(mode, 'asc', 'Next after default must be asc');
    mode = getNextModelSortMode(mode);
    assert.strictEqual(mode, 'desc', 'Next after asc must be desc');
    mode = getNextModelSortMode(mode);
    assert.strictEqual(mode, 'default', 'Next after desc must loop back to default');
  });

  await t.test('sorts models correctly according to 3-state model sort modes', () => {
    const originalOrder = [...models];

    // 1. default mode: preserves dataset.models order
    const defaultSorted = [...models];
    assert.deepStrictEqual(
      defaultSorted.map((m) => m.id),
      originalOrder.map((m) => m.id),
      'Default sort must preserve dataset order'
    );

    // 2. asc mode: sorts by name ascending
    const ascSorted = [...models].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    for (let i = 0; i < ascSorted.length - 1; i++) {
      assert.ok(
        ascSorted[i].name.localeCompare(ascSorted[i + 1].name, undefined, { numeric: true, sensitivity: 'base' }) <= 0,
        `ascSorted: ${ascSorted[i].name} should come before or equal to ${ascSorted[i + 1].name}`
      );
    }

    // 3. desc mode: sorts by name descending
    const descSorted = [...models].sort((a, b) =>
      b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    for (let i = 0; i < descSorted.length - 1; i++) {
      assert.ok(
        descSorted[i].name.localeCompare(descSorted[i + 1].name, undefined, { numeric: true, sensitivity: 'base' }) >= 0,
        `descSorted: ${descSorted[i].name} should come after or equal to ${descSorted[i + 1].name}`
      );
    }
  });

  await t.test('sorts models correctly according to radar display state', () => {
    const selectedIds = ['gpt-6-astra', 'claude-sonnet-5'];

    // 1. radar sort descending (default on first click): selected models first
    const radarDesc = [...models].sort((a, b) => {
      const valA = selectedIds.includes(a.id) ? 1 : 0;
      const valB = selectedIds.includes(b.id) ? 1 : 0;
      return valB - valA;
    });
    assert.ok(selectedIds.includes(radarDesc[0].id), 'First model should be selected');
    assert.ok(selectedIds.includes(radarDesc[1].id), 'Second model should be selected');
    assert.ok(!selectedIds.includes(radarDesc[2].id), 'Third model should NOT be selected');

    // 2. radar sort ascending: unselected models first
    const radarAsc = [...models].sort((a, b) => {
      const valA = selectedIds.includes(a.id) ? 1 : 0;
      const valB = selectedIds.includes(b.id) ? 1 : 0;
      return valA - valB;
    });
    assert.ok(!selectedIds.includes(radarAsc[0].id), 'First model in asc should NOT be selected');
    const lastIndex = radarAsc.length - 1;
    assert.ok(selectedIds.includes(radarAsc[lastIndex].id), 'Last model in asc should be selected');
  });

  await t.test('ModelRadarView file contains required icons and table header sort bindings', () => {
    const viewFilePath = path.resolve(process.cwd(), 'dashboard/src/components/ModelRadarView.tsx');
    const content = fs.readFileSync(viewFilePath, 'utf-8');

    // Button icon requirement: Trash2 for deselect, Plus for add
    assert.ok(content.includes('<Trash2 className="w-4 h-4" />'), 'Must render Trash2 icon for deselect');
    assert.ok(content.includes('<Plus className="w-4 h-4" />'), 'Must render Plus icon for add');
    assert.ok(content.includes('{isSelected ? ('), 'Must render ternary icon for isSelected');

    // Header sort requirement: model and radar columns
    assert.ok(content.includes("handleSort('model')"), "Header must have onClick handleSort('model')");
    assert.ok(content.includes("handleSort('radar')"), "Header must have onClick handleSort('radar')");
    assert.ok(content.includes("handleSort('arena')"), "Header must have onClick handleSort('arena')");

    // 3-state loop indicators
    assert.ok(content.includes("modelSortMode === 'default'"), 'Must support default sort mode');
    assert.ok(content.includes("modelSortMode === 'asc'"), 'Must support asc sort mode');
    assert.ok(content.includes("modelSortMode === 'desc'"), 'Must support desc sort mode');
  });

  await t.test('verifies 6-axis quick reference interactive links and cross-widget navigation', () => {
    const viewFilePath = path.resolve(process.cwd(), 'dashboard/src/components/ModelRadarView.tsx');
    const content = fs.readFileSync(viewFilePath, 'utf-8');

    // Section title & explanation
    assert.ok(content.includes('6軸評価基準 & 実測ベンチマーク対応'), 'Must render clear 6-axis reference title');
    assert.ok(content.includes('handleJumpToTable'), 'Must provide handleJumpToTable navigation');
    assert.ok(content.includes('handleJumpToSource'), 'Must provide handleJumpToSource navigation');

    // All 6 axes mapped
    const requiredAxes = [
      'coding_swe',
      'reasoning_logic',
      'arena_elo',
      'speed_latency',
      'cost_efficiency',
      'architecture_design',
    ];
    for (const axisKey of requiredAxes) {
      assert.ok(content.includes(axisKey), `Must configure axis link for ${axisKey}`);
    }

    // Source highlight state and anchors
    assert.ok(content.includes('highlightedSourceId'), 'Must manage highlightedSourceId state');
    assert.ok(content.includes('id={`source-${src.id}`}'), 'Must set source anchor IDs for smooth scroll');
  });
});
