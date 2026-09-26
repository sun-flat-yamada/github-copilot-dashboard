import { IViewPluginManifest } from '../../domain/ports/IViewPluginManifest.js';
import { ViewPluginRegistry } from './ViewPluginRegistry.js';

export interface DataRequirementValidationResult {
  valid: boolean;
  missingKeys: string[];
}

/**
 * ViewOrchestrator orchestrates active views and verifies derived data requirements.
 * Interacts only via IViewPluginManifest and ViewPluginRegistry.
 */
export class ViewOrchestrator<T extends IViewPluginManifest = IViewPluginManifest> {
  constructor(private readonly registry: ViewPluginRegistry<T>) {}

  /**
   * Validate whether all derived data required by the specified view are available.
   */
  public validateRequiredData(viewId: string, availableDerivedKeys: string[]): DataRequirementValidationResult {
    const plugin = this.registry.get(viewId);
    if (!plugin) {
      return { valid: false, missingKeys: [`plugin:${viewId}`] };
    }

    const required = plugin.requiredDerivedData();
    if (!required || required.length === 0) {
      return { valid: true, missingKeys: [] };
    }

    const availableSet = new Set(availableDerivedKeys);
    const missingKeys = required.filter((key) => !availableSet.has(key));

    return {
      valid: missingKeys.length === 0,
      missingKeys,
    };
  }

  /**
   * Check if the specified view can be rendered in the current state and with available derived data.
   */
  public canRenderView(viewId: string, state: any, availableDerivedKeys?: string[]): boolean {
    const plugin = this.registry.get(viewId);
    if (!plugin) {
      return false;
    }

    if (!plugin.canRender(state)) {
      return false;
    }

    if (availableDerivedKeys) {
      const validation = this.validateRequiredData(viewId, availableDerivedKeys);
      if (!validation.valid) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all navigable views that can render in the current state.
   */
  public getNavigableViews(state: any, availableDerivedKeys?: string[]): T[] {
    return this.registry.getAll().filter((plugin) => {
      if (!plugin.canRender(state)) {
        return false;
      }
      if (availableDerivedKeys) {
        const validation = this.validateRequiredData(plugin.id, availableDerivedKeys);
        if (!validation.valid) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Resolve an active view id. If the requested view cannot be rendered,
   * fall back to the first available navigable view, or 'overview'.
   */
  public resolveActiveView(requestedViewId: string, state: any, availableDerivedKeys?: string[]): string {
    if (this.canRenderView(requestedViewId, state, availableDerivedKeys)) {
      return requestedViewId;
    }

    const navigable = this.getNavigableViews(state, availableDerivedKeys);
    if (navigable.length > 0) {
      return navigable[0].id;
    }

    return 'overview';
  }

  /**
   * Get the plugin manifest for an active view if it can be rendered.
   */
  public getActivePlugin(viewId: string, state: any, availableDerivedKeys?: string[]): T | undefined {
    if (!this.canRenderView(viewId, state, availableDerivedKeys)) {
      return undefined;
    }
    return this.registry.get(viewId);
  }
}
