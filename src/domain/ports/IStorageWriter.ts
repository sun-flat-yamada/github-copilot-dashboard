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
  saveRolling1YearTrend(data: any): void;
  saveIndex(metadata: IndexMetadata): void;
  saveErrorLog(issues: DataFetchIssue[]): void;
  getRawReportFiles(month: string): string[];
  getStoredReportMonths(): string[];
  getStoredProcessedMonths(): string[];
  getStoredDeepAnalysisMonths(): string[];
  saveRawReportFile(month: string, fileName: string, content: string): void;
}
