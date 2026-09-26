import { ViewPluginRegistry } from '../../application/views/ViewPluginRegistry.js';
import { ViewPlugin } from './ViewPlugin.js';
import { OverviewViewPlugin } from './OverviewViewPlugin.js';
import { UsersViewPlugin } from './UsersViewPlugin.js';
import { TrendViewPlugin } from './TrendViewPlugin.js';
import { BudgetViewPlugin } from './BudgetViewPlugin.js';
import { DeepAnalysisViewPlugin } from './DeepAnalysisViewPlugin.js';
import { ModelRadarViewPlugin } from './ModelRadarViewPlugin.js';

export * from './ViewPlugin.js';
export * from './OverviewViewPlugin.js';
export * from './UsersViewPlugin.js';
export * from './TrendViewPlugin.js';
export * from './BudgetViewPlugin.js';
export * from './DeepAnalysisViewPlugin.js';
export * from './ModelRadarViewPlugin.js';

export const CORE_VIEW_PLUGINS: ViewPlugin[] = [
  OverviewViewPlugin,
  UsersViewPlugin,
  TrendViewPlugin,
  BudgetViewPlugin,
  DeepAnalysisViewPlugin,
  ModelRadarViewPlugin,
];

export function registerAllViewPlugins(registry: ViewPluginRegistry<any>): void {
  for (const plugin of CORE_VIEW_PLUGINS) {
    registry.register(plugin);
  }
}

export function createDefaultViewPluginRegistry(): ViewPluginRegistry<ViewPlugin> {
  const registry = new ViewPluginRegistry<ViewPlugin>();
  registerAllViewPlugins(registry);
  return registry;
}
