import { IViewPluginManifest } from '../../domain/ports/IViewPluginManifest.js';

/**
 * ViewPluginRegistry manages analysis view plugins in the dashboard application.
 * Adheres strictly to Clean Architecture by depending ONLY on the IViewPluginManifest port.
 */
export class ViewPluginRegistry<T extends IViewPluginManifest = IViewPluginManifest> {
  private readonly plugins = new Map<string, T>();

  /**
   * Register a view plugin or manifest.
   */
  public register(plugin: T): void {
    this.plugins.set(plugin.id, plugin);
  }

  /**
   * Unregister a view plugin by id.
   */
  public unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  /**
   * Get a registered plugin by id.
   */
  public get(id: string): T | undefined {
    return this.plugins.get(id);
  }

  /**
   * Check if a plugin is registered.
   */
  public has(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * Get all registered plugins sorted by their display order.
   */
  public getAll(): T[] {
    return Array.from(this.plugins.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Get all plugins that can be rendered in the given state.
   */
  public getAvailable(state: any): T[] {
    return this.getAll().filter((plugin) => plugin.canRender(state));
  }

  /**
   * Get total number of registered plugins.
   */
  public count(): number {
    return this.plugins.size;
  }

  /**
   * Clear all registered plugins.
   */
  public clear(): void {
    this.plugins.clear();
  }
}
