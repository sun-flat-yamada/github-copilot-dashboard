import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ViewPluginRegistry } from '../../application/views/ViewPluginRegistry.js';
import { ViewOrchestrator } from '../../application/views/ViewOrchestrator.js';
import { IViewPluginManifest } from '../../domain/ports/IViewPluginManifest.js';

describe('ViewOrchestrator & ViewPluginRegistry Tests', () => {
  const createMockManifest = (
    id: string,
    order: number,
    requiredData: string[] = [],
    canRenderFn: (state: any) => boolean = () => true
  ): IViewPluginManifest => ({
    id,
    label: `Label for ${id}`,
    icon: 'TestIcon',
    order,
    capabilities: ['kpi_summary'],
    canRender: canRenderFn,
    requiredDerivedData: () => requiredData,
  });

  it('registers and retrieves view manifests sorted by order', () => {
    const registry = new ViewPluginRegistry();
    registry.register(createMockManifest('users', 2));
    registry.register(createMockManifest('overview', 1));
    registry.register(createMockManifest('trend', 3));

    assert.strictEqual(registry.count(), 3);
    assert.strictEqual(registry.has('overview'), true);
    assert.strictEqual(registry.has('unknown'), false);

    const all = registry.getAll();
    assert.strictEqual(all[0].id, 'overview');
    assert.strictEqual(all[1].id, 'users');
    assert.strictEqual(all[2].id, 'trend');
  });

  it('unregisters plugins cleanly', () => {
    const registry = new ViewPluginRegistry();
    registry.register(createMockManifest('overview', 1));
    assert.strictEqual(registry.count(), 1);

    const removed = registry.unregister('overview');
    assert.strictEqual(removed, true);
    assert.strictEqual(registry.count(), 0);
  });

  it('validates required derived data keys correctly', () => {
    const registry = new ViewPluginRegistry();
    registry.register(createMockManifest('deep_analysis', 5, ['diagnosticResults', 'filteredScopeData']));
    registry.register(createMockManifest('overview', 1, []));

    const orchestrator = new ViewOrchestrator(registry);

    // Empty requirements always pass
    const overviewVal = orchestrator.validateRequiredData('overview', []);
    assert.strictEqual(overviewVal.valid, true);
    assert.strictEqual(overviewVal.missingKeys.length, 0);

    // Missing keys
    const missingVal = orchestrator.validateRequiredData('deep_analysis', ['diagnosticResults']);
    assert.strictEqual(missingVal.valid, false);
    assert.deepStrictEqual(missingVal.missingKeys, ['filteredScopeData']);

    // All keys present
    const completeVal = orchestrator.validateRequiredData('deep_analysis', ['diagnosticResults', 'filteredScopeData', 'other']);
    assert.strictEqual(completeVal.valid, true);
    assert.strictEqual(completeVal.missingKeys.length, 0);

    // Unknown plugin
    const unknownVal = orchestrator.validateRequiredData('non_existent', []);
    assert.strictEqual(unknownVal.valid, false);
  });

  it('determines canRenderView based on state and derived data requirements', () => {
    const registry = new ViewPluginRegistry();
    registry.register(
      createMockManifest('live_only', 1, ['filteredScopeData'], (state) => state.activeSource === 'live_metrics')
    );

    const orchestrator = new ViewOrchestrator(registry);

    // Matches state and has data
    assert.strictEqual(
      orchestrator.canRenderView('live_only', { activeSource: 'live_metrics' }, ['filteredScopeData']),
      true
    );

    // Matches state but missing data
    assert.strictEqual(
      orchestrator.canRenderView('live_only', { activeSource: 'live_metrics' }, []),
      false
    );

    // Does not match state
    assert.strictEqual(
      orchestrator.canRenderView('live_only', { activeSource: 'monthly_report' }, ['filteredScopeData']),
      false
    );
  });

  it('filters navigable views and resolves fallback views', () => {
    const registry = new ViewPluginRegistry();
    registry.register(createMockManifest('overview', 1, ['filteredScopeData']));
    registry.register(createMockManifest('report_only', 2, ['filteredReportData'], (s) => s.activeSource === 'monthly_report'));
    registry.register(createMockManifest('model_radar', 3, []));

    const orchestrator = new ViewOrchestrator(registry);

    // Under live metrics with only scope data: report_only cannot render
    const navigable = orchestrator.getNavigableViews({ activeSource: 'live_metrics' }, ['filteredScopeData']);
    assert.strictEqual(navigable.length, 2);
    assert.strictEqual(navigable[0].id, 'overview');
    assert.strictEqual(navigable[1].id, 'model_radar');

    // Resolving valid view
    assert.strictEqual(
      orchestrator.resolveActiveView('overview', { activeSource: 'live_metrics' }, ['filteredScopeData']),
      'overview'
    );

    // Resolving unavailable view falls back to first navigable view ('overview')
    assert.strictEqual(
      orchestrator.resolveActiveView('report_only', { activeSource: 'live_metrics' }, ['filteredScopeData']),
      'overview'
    );

    // When overview cannot render (missing data), falls back to next available view ('model_radar')
    assert.strictEqual(
      orchestrator.resolveActiveView('overview', { activeSource: 'live_metrics' }, []),
      'model_radar'
    );
  });
});
