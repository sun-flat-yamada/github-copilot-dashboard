import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Control Bar Consolidation & Filter Redundancy Removal (#108)', () => {
  const rootDir = process.cwd();
  const appTsxPath = path.join(rootDir, 'dashboard/src/App.tsx');
  const appV2TsxPath = path.join(rootDir, 'dashboard/src/AppV2.tsx');
  const groupingSelectorPath = path.join(rootDir, 'dashboard/src/components/GroupingSelector.tsx');
  const tagFilterBarPath = path.join(rootDir, 'dashboard/src/components/TagFilterBar.tsx');
  const costAllocationChartsPath = path.join(rootDir, 'dashboard/src/components/CostAllocationCharts.tsx');

  it('should have deleted GroupingSelector.tsx and TagFilterBar.tsx files', () => {
    assert.strictEqual(
      fs.existsSync(groupingSelectorPath),
      false,
      'GroupingSelector.tsx must be physically deleted'
    );
    assert.strictEqual(
      fs.existsSync(tagFilterBarPath),
      false,
      'TagFilterBar.tsx must be physically deleted'
    );
  });

  it('should not import or render GroupingSelector or TagFilterBar in App.tsx', () => {
    const appContent = fs.readFileSync(appTsxPath, 'utf-8');
    assert.strictEqual(
      appContent.includes('GroupingSelector'),
      false,
      'App.tsx must not contain any reference to GroupingSelector'
    );
    assert.strictEqual(
      appContent.includes('TagFilterBar'),
      false,
      'App.tsx must not contain any reference to TagFilterBar'
    );
  });

  it('should not import or render GroupingSelector or TagFilterBar in AppV2.tsx', () => {
    const appV2Content = fs.readFileSync(appV2TsxPath, 'utf-8');
    assert.strictEqual(
      appV2Content.includes('GroupingSelector'),
      false,
      'AppV2.tsx must not contain any reference to GroupingSelector'
    );
    assert.strictEqual(
      appV2Content.includes('TagFilterBar'),
      false,
      'AppV2.tsx must not contain any reference to TagFilterBar'
    );
  });

  it('should have removed the redundant control bar container from App.tsx and AppV2.tsx', () => {
    const appContent = fs.readFileSync(appTsxPath, 'utf-8');
    const appV2Content = fs.readFileSync(appV2TsxPath, 'utf-8');
    const containerClass = 'bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 shadow-sm';

    assert.strictEqual(
      appContent.includes(containerClass),
      false,
      'App.tsx must not contain the redundant control bar container class'
    );
    assert.strictEqual(
      appV2Content.includes(containerClass),
      false,
      'AppV2.tsx must not contain the redundant control bar container class'
    );
  });

  it('should have inline grouping selector tabs inside CostAllocationCharts.tsx', () => {
    const chartsContent = fs.readFileSync(costAllocationChartsPath, 'utf-8');
    assert.ok(
      chartsContent.includes('handleGroupingSelect'),
      'CostAllocationCharts must implement handleGroupingSelect'
    );
    assert.ok(
      chartsContent.includes("handleGroupingSelect('department')"),
      'CostAllocationCharts must have department grouping tab'
    );
    assert.ok(
      chartsContent.includes("handleGroupingSelect('cost_center')"),
      'CostAllocationCharts must have cost_center grouping tab'
    );
    assert.ok(
      chartsContent.includes("handleGroupingSelect('organization')"),
      'CostAllocationCharts must have organization grouping tab'
    );
  });

  it('should retain accordion batch controls inside App.tsx Overview view', () => {
    const appContent = fs.readFileSync(appTsxPath, 'utf-8');
    assert.ok(
      appContent.includes('expandAll()'),
      'App.tsx must retain expandAll control'
    );
    assert.ok(
      appContent.includes('collapseAll'),
      'App.tsx must retain collapseAll control'
    );
  });
});
