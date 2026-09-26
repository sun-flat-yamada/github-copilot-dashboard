import {
  AnalysisScopeType,
  DataFetchIssue,
  DataSourceType,
  GroupingDimension,
  IndexMetadata,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
  UserSeatStatus,
  UserUsageProfile,
} from '../../domain/entities/copilot.js';
import { BenchmarkDataset } from '../../domain/entities/model-benchmark.js';
import { DataStoreState } from './DataStoreState.js';

export type DataStoreAction =
  | { type: 'SET_ACTIVE_SOURCE'; source: DataSourceType }
  | { type: 'SET_SCOPE'; scopeType: AnalysisScopeType; key: string }
  | { type: 'SET_TAGS'; tags: string[] }
  | { type: 'TOGGLE_TAG'; tag: string }
  | { type: 'SET_GROUPING'; dimension: GroupingDimension }
  | { type: 'SET_SELECTED_GROUP'; group: string | null }
  | { type: 'SET_STATUS_FILTER'; status: UserSeatStatus | 'all' }
  | { type: 'SET_INDEX_META'; meta: IndexMetadata }
  | { type: 'SET_RAW_SCOPE_DATA'; data: ScopeAggregatedData | null }
  | { type: 'SET_RAW_REPORT_DATA'; data: MonthlyReportAggregatedData | null }
  | { type: 'SET_UPLOADED_DATA'; data: MonthlyReportAggregatedData | null }
  | { type: 'SET_BENCHMARK_DATA'; data: BenchmarkDataset | null }
  | { type: 'SET_DEEP_PROFILES'; profiles: UserUsageProfile[] }
  | { type: 'SET_ISSUES'; issues: DataFetchIssue[] }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_DEMO_MODE'; isDemo: boolean };

export function dataStoreReducer(state: DataStoreState, action: DataStoreAction): DataStoreState {
  switch (action.type) {
    case 'SET_ACTIVE_SOURCE':
      return { ...state, activeSource: action.source, selectedGroup: null };

    case 'SET_SCOPE':
      return { ...state, activeScopeType: action.scopeType, activeScopeKey: action.key, selectedGroup: null };

    case 'SET_TAGS':
      return { ...state, selectedTags: action.tags };

    case 'TOGGLE_TAG': {
      const exists = state.selectedTags.includes(action.tag);
      const newTags = exists
        ? state.selectedTags.filter((t) => t !== action.tag)
        : [...state.selectedTags, action.tag];
      return { ...state, selectedTags: newTags };
    }

    case 'SET_GROUPING':
      return { ...state, groupingDimension: action.dimension, selectedGroup: null };

    case 'SET_SELECTED_GROUP':
      return { ...state, selectedGroup: action.group };

    case 'SET_STATUS_FILTER':
      return { ...state, userStatusFilter: action.status };

    case 'SET_INDEX_META':
      return { ...state, indexMeta: action.meta };

    case 'SET_RAW_SCOPE_DATA':
      return { ...state, rawScopeData: action.data };

    case 'SET_RAW_REPORT_DATA':
      return { ...state, rawReportData: action.data };

    case 'SET_UPLOADED_DATA':
      return { ...state, uploadedData: action.data };

    case 'SET_BENCHMARK_DATA':
      return { ...state, benchmarkData: action.data };

    case 'SET_DEEP_PROFILES':
      return { ...state, deepAnalysisProfiles: action.profiles };

    case 'SET_ISSUES':
      return { ...state, issues: action.issues };

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };

    case 'SET_DEMO_MODE':
      return { ...state, isDemoMode: action.isDemo };

    default:
      return state;
  }
}

export function detectChangedKeys(prev: DataStoreState, next: DataStoreState): string[] {
  const keys: string[] = [];
  const checkKeys: (keyof DataStoreState)[] = [
    'activeSource',
    'activeScopeType',
    'activeScopeKey',
    'selectedTags',
    'groupingDimension',
    'selectedGroup',
    'userStatusFilter',
    'rawScopeData',
    'rawReportData',
    'uploadedData',
    'benchmarkData',
    'deepAnalysisProfiles',
  ];

  for (const k of checkKeys) {
    if (prev[k] !== next[k]) {
      keys.push(k);
    }
  }
  return keys;
}
