import { DerivedDataNode } from '../DerivedDataGraph.js';
import { DataStoreState } from '../../DataStoreState.js';
import { ActiveViewData } from './activeDataForView.js';

export const availableGroupsNode: DerivedDataNode<string[]> = {
  id: 'availableGroups',
  dependencies: ['activeDataForView', 'groupingDimension'],
  compute(state: DataStoreState): string[] {
    const active = state.derived.get('activeDataForView') as ActiveViewData | undefined;
    if (!active || !active.isAvailable) return [];

    const dimension = state.groupingDimension;
    const groups = new Set<string>();

    if (active.sourceType === 'live_metrics' && active.scopeData) {
      const summaryMap =
        dimension === 'cost_center'
          ? active.scopeData.by_cost_center
          : dimension === 'organization'
          ? active.scopeData.by_organization
          : active.scopeData.by_department;

      if (summaryMap) {
        for (const g of Object.keys(summaryMap)) {
          groups.add(g);
        }
      }
    } else if (active.reportData) {
      const summaryMap =
        dimension === 'cost_center'
          ? active.reportData.by_cost_center
          : dimension === 'organization'
          ? active.reportData.by_organization
          : active.reportData.by_department;

      if (summaryMap) {
        for (const g of Object.keys(summaryMap)) {
          groups.add(g);
        }
      }
    }

    return Array.from(groups).sort();
  },
};
