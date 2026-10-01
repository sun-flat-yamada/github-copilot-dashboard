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
  RollingTrendDataset,
} from '../entities/copilot.js';

/**
 * Port interface for persisting processed metric partitions to disk/storage.
 * Implemented by: ForkSafeStorageWriter
 *
 * 書き込みに加えて、前回成果物の読み出し (loadIndex / loadScopeData) を提供する。
 * 取得に失敗したソースの Last-known-good を維持したり、保存済みの月次集計から
 * 1 年推移を実値で構成したりするために使う。
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
  saveRolling1YearTrend(data: RollingTrendDataset): void;
  saveIndex(metadata: IndexMetadata): void;
  /** 前回保存した index.json。未保存・破損時は null */
  loadIndex(): IndexMetadata | null;
  /** 保存済みのスコープ集計 (daily / monthly / custom)。未保存・破損時は null */
  loadScopeData(scopeType: AnalysisScopeType, key: string): ScopeAggregatedData | null;
  saveErrorLog(issues: DataFetchIssue[]): void;
  getRawReportFiles(month: string): string[];
  getStoredReportMonths(): string[];
  getStoredProcessedMonths(): string[];
  getStoredDeepAnalysisMonths(): string[];
  saveRawReportFile(month: string, fileName: string, content: string): void;
}
