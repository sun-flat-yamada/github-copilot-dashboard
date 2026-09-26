import { DerivedDataNode } from '../DerivedDataGraph.js';
import { DataStoreState } from '../../DataStoreState.js';
import { MonthlyReportAggregatedData } from '../../../../domain/entities/copilot.js';

export const filteredReportDataNode: DerivedDataNode<MonthlyReportAggregatedData | null> = {
  id: 'filteredReportData',
  dependencies: ['rawReportData', 'selectedTags'],
  compute(state: DataStoreState): MonthlyReportAggregatedData | null {
    if (!state.rawReportData) return null;
    const { rawReportData, selectedTags } = state;

    if (selectedTags.length === 0) {
      return rawReportData;
    }

    const filteredUsers = rawReportData.user_details.filter((u) => {
      if (!u.tags || u.tags.length === 0) return false;
      return selectedTags.every((t) => u.tags!.includes(t));
    });

    return {
      ...rawReportData,
      user_details: filteredUsers,
    };
  },
};
