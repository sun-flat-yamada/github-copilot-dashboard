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

export interface DataStoreState {
  activeSource: DataSourceType;
  activeScopeType: AnalysisScopeType;
  activeScopeKey: string;
  selectedTags: string[];
  groupingDimension: GroupingDimension;
  selectedGroup: string | null;
  userStatusFilter: UserSeatStatus | 'all';
  indexMeta: IndexMetadata | null;
  rawScopeData: ScopeAggregatedData | null;
  rawReportData: MonthlyReportAggregatedData | null;
  uploadedData: MonthlyReportAggregatedData | null;
  benchmarkData: BenchmarkDataset | null;
  deepAnalysisProfiles: UserUsageProfile[];
  issues: DataFetchIssue[];
  isLoading: boolean;
  isDemoMode: boolean;
  derived: Map<string, unknown>;
}

export const DEFAULT_DATA_STORE_STATE: DataStoreState = {
  activeSource: 'live_metrics',
  activeScopeType: 'monthly',
  activeScopeKey: '',
  selectedTags: [],
  groupingDimension: 'department',
  selectedGroup: null,
  userStatusFilter: 'all',
  indexMeta: null,
  rawScopeData: null,
  rawReportData: null,
  uploadedData: null,
  benchmarkData: null,
  deepAnalysisProfiles: [],
  issues: [],
  isLoading: false,
  isDemoMode: false,
  derived: new Map(),
};
