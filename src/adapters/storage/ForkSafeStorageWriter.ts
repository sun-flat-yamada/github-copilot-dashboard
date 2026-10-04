import type { BillingReconciliationMonthDocument } from '../../domain/entities/billing-reconciliation.js';
import type { DataQualityHistory } from '../../domain/entities/data-quality.js';
import type { MonthCloseIndex, MonthCloseRecord } from '../../domain/entities/month-close.js';
import type { SeatAuditMonthDocument } from '../../domain/entities/seat-audit.js';
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
  RollingTrendDataset,
} from '../../domain/entities/copilot.js';
import { ForkSafeStorage, StorageConfig } from '../../storage/fork-safe-storage.js';

export class ForkSafeStorageWriter implements IStorageWriter {
  private storage: ForkSafeStorage;

  constructor(config: StorageConfig = {}) {
    this.storage = new ForkSafeStorage(config);
  }

  getBaseDir(): string {
    return this.storage.getBaseDir();
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
    this.storage.saveDeepAnalysisArchive(month, {
      month,
      generated_at: new Date().toISOString(),
      user_profiles: profiles,
    });
  }

  saveRolling1YearTrend(data: RollingTrendDataset): void {
    this.storage.saveRolling1YearTrend(data);
  }

  saveDataQualityHistory(history: DataQualityHistory): void {
    this.storage.saveDataQualityHistory(history);
  }

  loadDataQualityHistory(): DataQualityHistory | null {
    return this.storage.loadDataQualityHistory();
  }

  saveMonthClose(record: MonthCloseRecord, index: MonthCloseIndex): void {
    this.storage.saveMonthClose(record, index);
  }

  loadMonthClose(month: string): MonthCloseRecord | null {
    return this.storage.loadMonthClose(month);
  }

  getClosedMonths(): string[] {
    return this.storage.getClosedMonths();
  }

  listRawSeatDays(): string[] {
    return this.storage.listRawSeatDays();
  }

  loadRawSeats(day: string): CopilotSeatAssignment[] | null {
    return this.storage.loadRawSeats(day);
  }

  saveSeatAuditMonth(doc: SeatAuditMonthDocument): void {
    this.storage.saveSeatAuditMonth(doc);
  }

  loadSeatAuditMonth(month: string): SeatAuditMonthDocument | null {
    return this.storage.loadSeatAuditMonth(month);
  }

  getSeatAuditMonths(): string[] {
    return this.storage.getSeatAuditMonths();
  }

  saveBillingReconciliationMonth(doc: BillingReconciliationMonthDocument): void {
    this.storage.saveBillingReconciliationMonth(doc);
  }

  loadBillingReconciliationMonth(month: string): BillingReconciliationMonthDocument | null {
    return this.storage.loadBillingReconciliationMonth(month);
  }

  getBillingReconciliationMonths(): string[] {
    return this.storage.getBillingReconciliationMonths();
  }

  loadReportData(month: string): MonthlyReportAggregatedData | null {
    return this.storage.loadReportData(month);
  }

  saveIndex(metadata: IndexMetadata): void {
    this.storage.saveIndex(metadata);
  }

  loadIndex(): IndexMetadata | null {
    return this.storage.loadIndex();
  }

  loadScopeData(scopeType: AnalysisScopeType, key: string): ScopeAggregatedData | null {
    return this.storage.loadScopeData(scopeType, key);
  }

  loadCatalog<T = unknown>(name: string): T | null {
    return this.storage.loadCatalog<T>(name);
  }

  saveErrorLog(issues: DataFetchIssue[]): void {
    this.storage.saveErrorLog(issues);
  }

  getRawReportFiles(month: string): string[] {
    return this.storage.getRawReportFiles(month);
  }

  getStoredReportMonths(): string[] {
    return this.storage.getStoredReportMonths();
  }

  getStoredProcessedMonths(): string[] {
    return this.storage.getStoredProcessedMonths();
  }

  getStoredDeepAnalysisMonths(): string[] {
    return this.storage.getStoredDeepAnalysisMonths();
  }

  saveRawReportFile(month: string, fileName: string, content: string): void {
    this.storage.saveRawReportFile(month, fileName, content);
  }

  getStorage(): ForkSafeStorage {
    return this.storage;
  }
}
