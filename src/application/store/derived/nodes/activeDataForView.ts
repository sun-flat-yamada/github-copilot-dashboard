import { DerivedDataNode } from '../DerivedDataGraph.js';
import { DataStoreState } from '../../DataStoreState.js';
import {
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
} from '../../../../domain/entities/copilot.js';

export interface ActiveViewData {
  sourceType: 'live_metrics' | 'monthly_report' | 'user_upload';
  scopeData: ScopeAggregatedData | null;
  reportData: MonthlyReportAggregatedData | null;
  isAvailable: boolean;
}

export const activeDataForViewNode: DerivedDataNode<ActiveViewData> = {
  id: 'activeDataForView',
  dependencies: ['activeSource', 'filteredScopeData', 'filteredReportData', 'uploadedData'],
  compute(state: DataStoreState): ActiveViewData {
    const scopeData = state.derived.get('filteredScopeData') as ScopeAggregatedData | null;
    const reportData = state.derived.get('filteredReportData') as MonthlyReportAggregatedData | null;

    if (state.activeSource === 'live_metrics') {
      return {
        sourceType: 'live_metrics',
        scopeData: scopeData || null,
        reportData: null,
        isAvailable: scopeData !== null,
      };
    }

    if (state.activeSource === 'monthly_report') {
      return {
        sourceType: 'monthly_report',
        scopeData: null,
        reportData: reportData || null,
        isAvailable: reportData !== null,
      };
    }

    return {
      sourceType: 'user_upload',
      scopeData: null,
      reportData: state.uploadedData || null,
      isAvailable: state.uploadedData !== null,
    };
  },
};
