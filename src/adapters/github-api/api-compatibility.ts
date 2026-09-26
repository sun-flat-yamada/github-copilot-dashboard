/**
 * Declarative GitHub API Version Compatibility Matrix.
 * Manages version lifecycle and automated fallback negotiation.
 */

export interface ApiVersionEntry {
  version: string;
  status: 'current' | 'deprecated' | 'preview';
  fallbackVersion?: string;
  headerKey: string;
}

export const API_COMPATIBILITY_TABLE: Record<string, ApiVersionEntry> = {
  '2026-03-10': {
    version: '2026-03-10',
    status: 'current',
    headerKey: 'X-GitHub-Api-Version',
  },
  '2025-09-01': {
    version: '2025-09-01',
    status: 'deprecated',
    fallbackVersion: '2026-03-10',
    headerKey: 'X-GitHub-Api-Version',
  },
  '2026-09-01': {
    version: '2026-09-01',
    status: 'preview',
    fallbackVersion: '2026-03-10',
    headerKey: 'X-GitHub-Api-Version',
  },
};

export const DEFAULT_API_VERSION = '2026-03-10';

export function resolveEffectiveApiVersion(requestedVersion?: string): string {
  if (!requestedVersion) return DEFAULT_API_VERSION;
  const entry = API_COMPATIBILITY_TABLE[requestedVersion];
  if (!entry) return DEFAULT_API_VERSION;
  if (entry.status === 'deprecated' && entry.fallbackVersion) {
    return entry.fallbackVersion;
  }
  return entry.version;
}
