import { AnalysisScopeType, IndexMetadata } from '../../domain/entities/copilot.js';

export interface ResolvedScope {
  scopeType: AnalysisScopeType;
  key: string;
}

export class ScopeManager {
  static resolveDefaultScope(indexMeta: IndexMetadata | null): ResolvedScope {
    if (!indexMeta || !indexMeta.default_scopes) {
      return { scopeType: 'monthly', key: '' };
    }

    if (indexMeta.default_scopes.latest_month) {
      return { scopeType: 'monthly', key: indexMeta.default_scopes.latest_month };
    }

    if (indexMeta.default_scopes.latest_day) {
      return { scopeType: 'daily', key: indexMeta.default_scopes.latest_day };
    }

    return { scopeType: 'custom', key: 'latest-30d' };
  }

  static isScopeAvailable(indexMeta: IndexMetadata | null, scopeType: AnalysisScopeType, key: string): boolean {
    if (!indexMeta) return false;
    if (scopeType === 'daily') {
      return indexMeta.available_days.includes(key);
    }
    if (scopeType === 'monthly') {
      return indexMeta.available_months.includes(key);
    }
    if (scopeType === 'custom') {
      if (key === 'latest-30d') return true;
      if (key.startsWith('custom:')) {
        const parts = key.slice('custom:'.length).split('_');
        return parts.length === 2 && Boolean(parts[0]) && Boolean(parts[1]) && parts[0] <= parts[1];
      }
      return false;
    }
    return false;
  }
}
