import { DerivedDataNode } from '../DerivedDataGraph.js';
import { DataStoreState } from '../../DataStoreState.js';
import { ScopeAggregatedData } from '../../../../domain/entities/copilot.js';

export const filteredScopeDataNode: DerivedDataNode<ScopeAggregatedData | null> = {
  id: 'filteredScopeData',
  dependencies: ['rawScopeData', 'selectedTags', 'userStatusFilter'],
  compute(state: DataStoreState): ScopeAggregatedData | null {
    if (!state.rawScopeData) return null;
    const { rawScopeData, selectedTags, userStatusFilter } = state;

    let filteredUsers = rawScopeData.users;

    // 1. Tag AND フィルタ
    if (selectedTags.length > 0) {
      filteredUsers = filteredUsers.filter((u) => {
        if (!u.tags || u.tags.length === 0) return false;
        return selectedTags.every((t) => u.tags!.includes(t));
      });
    }

    // 2. Status フィルタ
    if (userStatusFilter !== 'all') {
      filteredUsers = filteredUsers.filter((u) => u.status === userStatusFilter);
    }

    return {
      ...rawScopeData,
      users: filteredUsers,
    };
  },
};
