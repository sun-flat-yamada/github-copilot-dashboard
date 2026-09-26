import { IStorageWriter } from '../../domain/ports/IStorageWriter.js';
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
} from '../../domain/entities/copilot.js';
import { ForkSafeStorage, StorageConfig } from '../../storage/fork-safe-storage.js';

export class ForkSafeStorageWriter implements IStorageWriter {
  private storage: ForkSafeStorage;

  constructor(config: StorageConfig = {}) {
    this.storage = new ForkSafeStorage(config);
  }

  saveRawDailyData(
    date: string,
    metrics: CopilotDailyMetrics,
    seats: CopilotSeatAssignment[],
    costCenters: EnterpriseCostCenter[]
  ): void {
    this.storage.saveRawDailyData(date, metrics, seats, costCenters);
  }

  saveScopeData(_scopeType: AnalysisScopeType, _key: string, data: ScopeAggregatedData): void {
    this.storage.saveProcessedScope(data);
  }

  saveReportData(_month: string, data: MonthlyReportAggregatedData): void {
    this.storage.saveProcessedReport(data);
  }

  saveDeepAnalysisArchive(month: string, profiles: UserUsageProfile[]): void {
    this.storage.saveDeepAnalysisArchive(month, profiles);
  }

  saveIndex(metadata: IndexMetadata): void {
    this.storage.saveIndex(metadata);
  }

  saveErrorLog(issues: DataFetchIssue[]): void {
    this.storage.saveErrorLog(issues);
  }

  getStorage(): ForkSafeStorage {
    return this.storage;
  }
}
