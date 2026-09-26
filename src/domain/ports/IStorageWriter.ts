import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
  AnalysisScopeType,
  ScopeAggregatedData,
  MonthlyReportAggregatedData,
  UserUsageProfile,
  IndexMetadata,
  DataFetchIssue,
} from '../entities/copilot.js';

/**
 * Port interface for persisting processed metric partitions to disk/storage.
 * Implemented by: ForkSafeStorageWriter
 */
export interface IStorageWriter {
  saveRawDailyData(
    date: string,
    metrics: CopilotDailyMetrics,
    seats: CopilotSeatAssignment[],
    costCenters: EnterpriseCostCenter[]
  ): void;
  saveScopeData(scopeType: AnalysisScopeType, key: string, data: ScopeAggregatedData): void;
  saveReportData(month: string, data: MonthlyReportAggregatedData): void;
  saveDeepAnalysisArchive(month: string, profiles: UserUsageProfile[]): void;
  saveIndex(metadata: IndexMetadata): void;
  saveErrorLog(issues: DataFetchIssue[]): void;
}
