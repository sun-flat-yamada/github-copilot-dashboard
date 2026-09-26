import {
  IndexMetadata,
  AnalysisScopeType,
  ScopeAggregatedData,
  MonthlyReportAggregatedData,
  UserUsageProfile,
} from '../entities/copilot.js';
import { BenchmarkDataset } from '../entities/model-benchmark.js';

/**
 * Port interface for persistent metric storage and retrieval.
 * Implemented by: HttpJsonMetricsRepository (Browser), FsJsonMetricsRepository (Node/CLI)
 */
export interface IMetricsRepository {
  fetchIndex(isDemoMode?: boolean): Promise<IndexMetadata>;
  fetchScopeData(scopeType: AnalysisScopeType, key: string, isDemoMode?: boolean): Promise<ScopeAggregatedData>;
  fetchReportData(month: string, isDemoMode?: boolean): Promise<MonthlyReportAggregatedData>;
  fetchDeepAnalysisProfiles(month: string, isDemoMode?: boolean): Promise<UserUsageProfile[]>;
  fetchBenchmarkData(): Promise<BenchmarkDataset>;
}
