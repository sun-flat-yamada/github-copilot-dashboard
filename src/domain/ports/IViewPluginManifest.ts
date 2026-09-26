import { ViewCapability } from '../entities/views.js';

/**
 * Pure TypeScript View Plugin Manifest (React-independent Domain Port).
 * Defines metadata, capability contracts, and derived data dependencies.
 */
export interface IViewPluginManifest {
  readonly id: string;
  readonly label: string;
  readonly icon: string; // Lucide-react icon name (string identifier)
  readonly order: number;
  readonly capabilities: ViewCapability[];
  canRender(state: any): boolean;
  requiredDerivedData(): string[];
}
