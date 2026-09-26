import { DerivedDataNode } from '../DerivedDataGraph.js';
import { DataStoreState } from '../../DataStoreState.js';

export const availableTagsNode: DerivedDataNode<string[]> = {
  id: 'availableTags',
  dependencies: ['rawScopeData', 'rawReportData', 'uploadedData'],
  compute(state: DataStoreState): string[] {
    const tags = new Set<string>();

    if (state.rawScopeData?.users) {
      for (const u of state.rawScopeData.users) {
        if (u.tags) {
          for (const t of u.tags) {
            if (t.trim()) tags.add(t.trim());
          }
        }
      }
    }

    if (state.rawReportData?.user_details) {
      for (const u of state.rawReportData.user_details) {
        if (u.tags) {
          for (const t of u.tags) {
            if (t.trim()) tags.add(t.trim());
          }
        }
      }
    }

    if (state.uploadedData?.user_details) {
      for (const u of state.uploadedData.user_details) {
        if (u.tags) {
          for (const t of u.tags) {
            if (t.trim()) tags.add(t.trim());
          }
        }
      }
    }

    return Array.from(tags).sort();
  },
};
