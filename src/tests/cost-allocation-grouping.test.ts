import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('CostAllocationCharts Grouping Tab Toggle & Sync (#122)', () => {
  const rootDir = process.cwd();
  const costAllocationChartsPath = path.join(rootDir, 'dashboard/src/components/CostAllocationCharts.tsx');
  const overviewPluginPath = path.join(rootDir, 'src/adapters/views/OverviewViewPlugin.tsx');

  it('CostAllocationCharts.tsx should synchronize externalGrouping with internalGrouping and support fallback', () => {
    const content = fs.readFileSync(costAllocationChartsPath, 'utf-8');
    assert.ok(
      content.includes('React.useEffect'),
      'CostAllocationCharts must use useEffect to synchronize externalGrouping'
    );
    assert.ok(
      content.includes('setInternalGrouping(externalGrouping)'),
      'CostAllocationCharts must update internalGrouping when externalGrouping changes'
    );
    assert.ok(
      content.includes('currentGrouping = onGroupingChange ? (externalGrouping || internalGrouping) : internalGrouping'),
      'CostAllocationCharts must fallback to internalGrouping when onGroupingChange is not provided or update accordingly'
    );
  });

  it('App.tsx should pass onGroupingChange to CostAllocationCharts in Overview Live Metrics section', () => {
    const content = fs.readFileSync(path.join(rootDir, 'dashboard/src/views/overview/View.tsx'), 'utf-8');
    // Ensure onGroupingChange={handleGroupingChange} is passed to CostAllocationCharts
    assert.ok(
      content.includes('<CostAllocationCharts\n                    data={currentData}\n                    grouping={currentGrouping}\n                    onGroupingChange={handleGroupingChange}\n                  />') ||
      content.includes('onGroupingChange={handleGroupingChange}'),
      'App.tsx must pass onGroupingChange={handleGroupingChange} to CostAllocationCharts'
    );
  });

  it('OverviewViewPlugin.tsx should pass onGroupingChange to CostAllocationCharts', () => {
    const content = fs.readFileSync(overviewPluginPath, 'utf-8');
    assert.ok(
      content.includes('onGroupingChange={onGroupingChange}'),
      'OverviewViewPlugin.tsx must pass onGroupingChange to CostAllocationCharts'
    );
  });
});
