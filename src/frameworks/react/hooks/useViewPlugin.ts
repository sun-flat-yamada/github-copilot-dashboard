import { useMemo } from 'react';
import { AnalysisViewId } from '../../../domain/entities/views.js';
import { ViewPlugin } from '../../../adapters/views/ViewPlugin.js';
import { createDefaultViewPluginRegistry } from '../../../adapters/views/index.js';
import { ViewOrchestrator } from '../../../application/views/ViewOrchestrator.js';
import { useStoreSelector } from './useStoreSelector.js';

const defaultRegistry = createDefaultViewPluginRegistry();
const defaultOrchestrator = new ViewOrchestrator<ViewPlugin>(defaultRegistry);

export interface UseViewPluginResult<P = any> {
  plugin: ViewPlugin<P> | undefined;
  activeViewId: AnalysisViewId;
  canRender: boolean;
  isDataReady: boolean;
  missingDataKeys: string[];
  presenter: P | undefined;
}

export function useViewPlugin<P = any>(
  activeViewId: AnalysisViewId,
  customOrchestrator?: ViewOrchestrator<ViewPlugin>
): UseViewPluginResult<P> {
  const orchestrator = customOrchestrator || defaultOrchestrator;

  const activeSource = useStoreSelector((s) => s.activeSource);
  const derived = useStoreSelector((s) => s.derived);
  const rawScopeData = useStoreSelector((s) => s.rawScopeData);
  const rawReportData = useStoreSelector((s) => s.rawReportData);
  const benchmarkData = useStoreSelector((s) => s.benchmarkData);
  const deepAnalysisProfiles = useStoreSelector((s) => s.deepAnalysisProfiles);

  const availableDerivedKeys = useMemo(() => {
    return Array.from(derived.keys());
  }, [derived]);

  const stateContext = useMemo(() => {
    return {
      activeSource,
      rawScopeData,
      rawReportData,
    };
  }, [activeSource, rawScopeData, rawReportData]);

  // Resolve active view (fall back if not renderable)
  const resolvedViewId = useMemo(() => {
    return orchestrator.resolveActiveView(activeViewId, stateContext, availableDerivedKeys) as AnalysisViewId;
  }, [orchestrator, activeViewId, stateContext, availableDerivedKeys]);

  const plugin = useMemo(() => {
    return orchestrator.getActivePlugin(resolvedViewId, stateContext, availableDerivedKeys);
  }, [orchestrator, resolvedViewId, stateContext, availableDerivedKeys]);

  const validation = useMemo(() => {
    return orchestrator.validateRequiredData(resolvedViewId, availableDerivedKeys);
  }, [orchestrator, resolvedViewId, availableDerivedKeys]);

  const presenter = useMemo(() => {
    if (!plugin?.presenterFactory) {
      return undefined;
    }

    const filteredScopeData = derived.get('filteredScopeData') || rawScopeData;
    const filteredReportData = derived.get('filteredReportData') || rawReportData;

    const presenterInput = {
      currentData: filteredScopeData,
      currentReportData: filteredReportData,
      activeSource,
      benchmarkData,
      profiles: deepAnalysisProfiles,
    };

    return plugin.presenterFactory(presenterInput, stateContext);
  }, [
    plugin,
    derived,
    rawScopeData,
    rawReportData,
    activeSource,
    benchmarkData,
    deepAnalysisProfiles,
    stateContext,
  ]);

  return {
    plugin,
    activeViewId: resolvedViewId,
    canRender: !!plugin,
    isDataReady: validation.valid,
    missingDataKeys: validation.missingKeys,
    presenter,
  };
}
