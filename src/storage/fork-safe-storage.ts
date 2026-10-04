import type { DataQualityHistory } from '../domain/entities/data-quality.js';
import type { BillingReconciliationMonthDocument } from '../domain/entities/billing-reconciliation.js';
import type { SeatAuditMonthDocument } from '../domain/entities/seat-audit.js';
import type { MonthCloseIndex, MonthCloseRecord } from '../domain/entities/month-close.js';
import * as fs from 'fs';
import * as path from 'path';
import {
  AnalysisScopeType,
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
  IndexMetadata,
  MonthlyReportAggregatedData,
  RollingTrendDataset,
  ScopeAggregatedData,
} from '../types/copilot.js';

export interface StorageConfig {
  baseDir?: string;
  publicDir?: string;
  isDemo?: boolean;
}

export class ForkSafeStorage {
  private baseDir: string;
  private publicDir?: string;
  private isDemo: boolean;

  constructor(config: StorageConfig = {}) {
    this.isDemo = config.isDemo ?? false;
    this.baseDir =
      config.baseDir ||
      (this.isDemo ? path.resolve(process.cwd(), 'data/demo') : path.resolve(process.cwd(), 'data'));
    this.publicDir =
      config.publicDir !== undefined
        ? config.publicDir
        : this.isDemo
        ? path.resolve(process.cwd(), 'dashboard/public/data/demo')
        : path.resolve(process.cwd(), 'dashboard/public/data');
    this.ensureDirectory(this.baseDir);
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  public getPublicDir(): string | undefined {
    return this.publicDir;
  }

  public isDemoStorage(): boolean {
    return this.isDemo;
  }

  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Rawデータ（未加工APIレスポンス）を日付別パーティションで保存 (Append-Only)
   */
  public saveRawDailyData(
    dateStr: string,
    metrics: CopilotDailyMetrics,
    seats: CopilotSeatAssignment[],
    costCenters: EnterpriseCostCenter[]
  ): void {
    const [year, month] = dateStr.split('-');
    const rawDir = path.join(this.baseDir, 'raw', year, month);
    this.ensureDirectory(rawDir);

    const payload = {
      collected_at: new Date().toISOString(),
      date: dateStr,
      metrics,
      seats,
      cost_centers: costCenters,
    };

    const filePath = path.join(rawDir, `${dateStr}-raw.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`💾 [ForkSafeStorage] Saved raw partition: ${filePath}`);
  }

  /**
   * 加工・集計済みスコープデータを保存
   */
  public saveProcessedScope(data: ScopeAggregatedData): void {
    let subDir = 'daily';
    let fileName = `${data.scope_key}.json`;

    if (data.scope_type === 'monthly') {
      subDir = 'monthly';
    } else if (data.scope_type === 'custom') {
      subDir = 'custom';
      // ファイル名として安全な文字に置換
      fileName = `${data.scope_key.replace(/[:\/]/g, '_')}.json`;
    }

    const targetDir = path.join(this.baseDir, 'processed', subDir);
    this.ensureDirectory(targetDir);

    const filePath = path.join(targetDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 [ForkSafeStorage] Saved processed scope: ${filePath}`);

    // ダッシュボードのpublicディレクトリにも複製 (GitHub Pages SPAビルド用)
    if (this.publicDir) {
      const publicTargetDir = path.join(this.publicDir, subDir);
      this.ensureDirectory(publicTargetDir);
      fs.writeFileSync(path.join(publicTargetDir, fileName), JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /**
   * インデックスメタデータ (index.json) を更新・保存
   */
  public saveIndex(metadata: IndexMetadata): void {
    const filePath = path.join(this.baseDir, 'index.json');
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`💾 [ForkSafeStorage] Saved index metadata: ${filePath}`);

    if (this.publicDir) {
      this.ensureDirectory(this.publicDir);
      fs.writeFileSync(path.join(this.publicDir, 'index.json'), JSON.stringify(metadata, null, 2), 'utf-8');
    }
  }

  /**
   * データ品質レポートの履歴 (processed/quality/history.json) を保存する。
   * 件数・日付・ソース名のみで個人情報を含まないため、配信用にも複製する。
   */
  public saveDataQualityHistory(history: DataQualityHistory): void {
    const targetDir = path.join(this.baseDir, 'processed', 'quality');
    this.ensureDirectory(targetDir);
    const body = JSON.stringify(history, null, 2);
    fs.writeFileSync(path.join(targetDir, 'history.json'), body, 'utf-8');
    if (this.publicDir) {
      const publicTargetDir = path.join(this.publicDir, 'quality');
      this.ensureDirectory(publicTargetDir);
      fs.writeFileSync(path.join(publicTargetDir, 'history.json'), body, 'utf-8');
    }
  }

  public loadDataQualityHistory(): DataQualityHistory | null {
    return this.readJson<DataQualityHistory>(path.join(this.baseDir, 'processed', 'quality', 'history.json'));
  }

  /**
   * 月次締めの記録 (processed/closes/{month}.json) と一覧 (index.json) を保存する (P4-2)。
   * 数値・日付・チェックサムのみで個人情報を含まないため、配信用にも複製する。
   */
  public saveMonthClose(record: MonthCloseRecord, index: MonthCloseIndex): void {
    const targetDir = path.join(this.baseDir, 'processed', 'closes');
    this.ensureDirectory(targetDir);
    const files: Array<[string, string]> = [
      [`${record.month}.json`, JSON.stringify(record, null, 2)],
      ['index.json', JSON.stringify(index, null, 2)],
    ];
    for (const [name, body] of files) fs.writeFileSync(path.join(targetDir, name), body, 'utf-8');
    if (this.publicDir) {
      const publicTargetDir = path.join(this.publicDir, 'closes');
      this.ensureDirectory(publicTargetDir);
      for (const [name, body] of files) fs.writeFileSync(path.join(publicTargetDir, name), body, 'utf-8');
    }
  }

  public loadMonthClose(month: string): MonthCloseRecord | null {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    return this.readJson<MonthCloseRecord>(path.join(this.baseDir, 'processed', 'closes', `${month}.json`));
  }

  /** 締め済みの月 (降順) */
  public getClosedMonths(): string[] {
    const dir = path.join(this.baseDir, 'processed', 'closes');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .map((f) => f.replace(/\.json$/, ''))
      .filter((m) => /^\d{4}-\d{2}$/.test(m))
      .sort()
      .reverse();
  }

  /** Raw パーティションのシート一覧 (raw/YYYY/MM/YYYY-MM-DD-raw.json) の日 (昇順) (P4-3) */
  public listRawSeatDays(): string[] {
    const rawDir = path.join(this.baseDir, 'raw');
    if (!fs.existsSync(rawDir)) return [];
    const days: string[] = [];
    for (const year of fs.readdirSync(rawDir)) {
      if (!/^\d{4}$/.test(year)) continue;
      for (const month of fs.readdirSync(path.join(rawDir, year))) {
        if (!/^\d{2}$/.test(month)) continue;
        for (const file of fs.readdirSync(path.join(rawDir, year, month))) {
          const m = /^(\d{4}-\d{2}-\d{2})-raw\.json$/.exec(file);
          if (m) days.push(m[1]);
        }
      }
    }
    return days.sort();
  }

  /** ある日の Raw パーティションの seats。未保存・破損時は null (P4-3) */
  public loadRawSeats(day: string): CopilotSeatAssignment[] | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const payload = this.readJson<{ seats?: unknown }>(path.join(this.baseDir, 'raw', day.slice(0, 4), day.slice(5, 7), `${day}-raw.json`));
    return payload && Array.isArray(payload.seats) ? (payload.seats as CopilotSeatAssignment[]) : null;
  }

  /**
   * シート監査イベント (audit/seat-events/{month}.json) を保存する (P4-3)。
   * 利用者単位の個人データなので processed/ の外に置き、配信用ディレクトリ (Pages) へは複製しない。
   */
  public saveSeatAuditMonth(doc: SeatAuditMonthDocument): void {
    const dir = path.join(this.baseDir, 'audit', 'seat-events');
    this.ensureDirectory(dir);
    fs.writeFileSync(path.join(dir, `${doc.month}.json`), JSON.stringify(doc, null, 2), 'utf-8');
  }

  public loadSeatAuditMonth(month: string): SeatAuditMonthDocument | null {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    return this.readJson<SeatAuditMonthDocument>(path.join(this.baseDir, 'audit', 'seat-events', `${month}.json`));
  }

  /** シート監査イベントのある月 (降順) */
  public getSeatAuditMonths(): string[] {
    const dir = path.join(this.baseDir, 'audit', 'seat-events');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .map((f) => f.replace(/\.json$/, ''))
      .filter((m) => /^\d{4}-\d{2}$/.test(m))
      .sort()
      .reverse();
  }

  /**
   * 請求突合の月次文書 (audit/billing-reconciliation/{month}.json) を保存する (P4-4)。
   * 実際の請求額に由来するため processed/ の外に置き、配信用ディレクトリ (Pages) へは複製しない。
   */
  public saveBillingReconciliationMonth(doc: BillingReconciliationMonthDocument): void {
    const dir = path.join(this.baseDir, 'audit', 'billing-reconciliation');
    this.ensureDirectory(dir);
    fs.writeFileSync(path.join(dir, `${doc.month}.json`), JSON.stringify(doc, null, 2), 'utf-8');
  }

  public loadBillingReconciliationMonth(month: string): BillingReconciliationMonthDocument | null {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    return this.readJson<BillingReconciliationMonthDocument>(
      path.join(this.baseDir, 'audit', 'billing-reconciliation', `${month}.json`)
    );
  }

  /** 請求突合の文書がある月 (降順) */
  public getBillingReconciliationMonths(): string[] {
    const dir = path.join(this.baseDir, 'audit', 'billing-reconciliation');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .map((f) => f.replace(/\.json$/, ''))
      .filter((m) => /^\d{4}-\d{2}$/.test(m))
      .sort()
      .reverse();
  }

  /** 保存済みの月次レポート集計 (processed/reports/{month}.json)。未保存・破損時は null */
  public loadReportData(month: string): MonthlyReportAggregatedData | null {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    return this.readJson<MonthlyReportAggregatedData>(path.join(this.baseDir, 'processed', 'reports', `${month}.json`));
  }

  /**
   * 前回保存した index.json を読み出す (取得失敗ソースの Last-known-good 維持に使う)。
   * 未保存・JSON 破損時は null (呼び出し側は「前回なし」として扱う)。
   */
  public loadIndex(): IndexMetadata | null {
    return this.readJson<IndexMetadata>(path.join(this.baseDir, 'index.json'));
  }

  /**
   * 保存済みのスコープ集計 (processed/{daily|monthly|custom}/...) を読み出す。
   */
  public loadScopeData(scopeType: AnalysisScopeType, key: string): ScopeAggregatedData | null {
    const subDir = scopeType === 'daily' ? 'daily' : scopeType === 'monthly' ? 'monthly' : 'custom';
    const fileName = scopeType === 'custom' ? `${key.replace(/[:\/]/g, '_')}.json` : `${key}.json`;
    return this.readJson<ScopeAggregatedData>(path.join(this.baseDir, 'processed', subDir, fileName));
  }

  /**
   * 参照カタログ (為替など。`catalog/<name>.json`) を保存する。SPA 配信用にも複製する。
   */
  public saveCatalog(name: string, data: unknown): void {
    const body = JSON.stringify(data, null, 2);
    const dir = path.join(this.baseDir, 'catalog');
    this.ensureDirectory(dir);
    fs.writeFileSync(path.join(dir, `${name}.json`), body, 'utf-8');
    if (this.publicDir) {
      const pub = path.join(this.publicDir, 'catalog');
      this.ensureDirectory(pub);
      fs.writeFileSync(path.join(pub, `${name}.json`), body, 'utf-8');
    }
  }

  /** 保存済みの参照カタログ。未保存・破損時は null */
  public loadCatalog<T = unknown>(name: string): T | null {
    return this.readJson<T>(path.join(this.baseDir, 'catalog', `${name}.json`));
  }

  private readJson<T>(filePath: string): T | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
      return null;
    }
  }

  /**
   * 異常検出ログ (error-log.json) を保存
   */
  public saveErrorLog(issues: any[]): void {
    const payload = {
      generated_at: new Date().toISOString(),
      total_issues: issues.length,
      errors_count: issues.filter((i) => i.severity === 'error').length,
      warnings_count: issues.filter((i) => i.severity === 'warning').length,
      issues,
    };

    const filePath = path.join(this.baseDir, 'error-log.json');
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`💾 [ForkSafeStorage] Saved error log: ${filePath} (${issues.length} issues)`);

    if (this.publicDir) {
      this.ensureDirectory(this.publicDir);
      fs.writeFileSync(path.join(this.publicDir, 'error-log.json'), JSON.stringify(payload, null, 2), 'utf-8');
    }
  }

  /**
   * 既存のRawデータを一覧読み込み
   */
  public getStoredDates(): string[] {
    const dates: string[] = [];
    const rawDir = path.join(this.baseDir, 'raw');
    if (!fs.existsSync(rawDir)) return dates;

    const years = fs.readdirSync(rawDir);
    for (const year of years) {
      const yearDir = path.join(rawDir, year);
      if (!fs.statSync(yearDir).isDirectory()) continue;

      const months = fs.readdirSync(yearDir);
      for (const month of months) {
        const monthDir = path.join(yearDir, month);
        if (!fs.statSync(monthDir).isDirectory()) continue;

        const files = fs.readdirSync(monthDir);
        for (const file of files) {
          if (file.endsWith('-raw.json')) {
            const dateStr = file.replace('-raw.json', '');
            dates.push(dateStr);
          }
        }
      }
    }

    return dates.sort().reverse();
  }

  /**
   * RawレポートCSVファイルを保存 (Append-Only)
   */
  public saveRawReportFile(monthStr: string, fileName: string, content: string): string {
    const reportDir = path.join(this.baseDir, 'reports', 'monthly', monthStr);
    this.ensureDirectory(reportDir);

    const targetFile = path.join(reportDir, fileName);
    fs.writeFileSync(targetFile, content, 'utf-8');
    console.log(`💾 [ForkSafeStorage] Saved raw report CSV: ${targetFile}`);
    return targetFile;
  }

  /**
   * 集計済み月次レポートデータを保存
   */
  public saveProcessedReport(data: MonthlyReportAggregatedData): void {
    const targetDir = path.join(this.baseDir, 'processed', 'reports');
    this.ensureDirectory(targetDir);

    const fileName = `${data.report_month}.json`;
    const filePath = path.join(targetDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 [ForkSafeStorage] Saved processed report: ${filePath}`);

    if (this.publicDir) {
      const publicTargetDir = path.join(this.publicDir, 'reports');
      this.ensureDirectory(publicTargetDir);
      fs.writeFileSync(path.join(publicTargetDir, fileName), JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /**
   * 保持されているレポート月の一覧を取得 (降順)
   */
  public getStoredReportMonths(): string[] {
    const months = new Set<string>();

    // 1. Raw reports ディレクトリから探索
    const rawReportsDir = path.join(this.baseDir, 'reports', 'monthly');
    if (fs.existsSync(rawReportsDir)) {
      const entries = fs.readdirSync(rawReportsDir);
      for (const entry of entries) {
        if (/^\d{4}-\d{2}$/.test(entry)) {
          months.add(entry);
        }
      }
    }

    // 2. Processed reports ディレクトリから探索
    const procReportsDir = path.join(this.baseDir, 'processed', 'reports');
    if (fs.existsSync(procReportsDir)) {
      const files = fs.readdirSync(procReportsDir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          const m = f.replace('.json', '');
          if (/^\d{4}-\d{2}$/.test(m)) {
            months.add(m);
          }
        }
      }
    }

    return Array.from(months).sort().reverse();
  }

  /**
   * 過去1年間のマクロ推移トレンドデータ (trends/rolling-1year.json) を保存
   */
  public saveRolling1YearTrend(data: RollingTrendDataset): void {
    const targetDir = path.join(this.baseDir, 'processed', 'trends');
    this.ensureDirectory(targetDir);

    const filePath = path.join(targetDir, 'rolling-1year.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 [ForkSafeStorage] Saved rolling 1-year trend: ${filePath}`);

    if (this.publicDir) {
      const publicTargetDir = path.join(this.publicDir, 'trends');
      this.ensureDirectory(publicTargetDir);
      fs.writeFileSync(path.join(publicTargetDir, 'rolling-1year.json'), JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /**
   * 月次ディープ分析アーカイブ (deep-analysis/{YYYY-MM}.json) を保存
   */
  public saveDeepAnalysisArchive(monthStr: string, data: any): void {
    const targetDir = path.join(this.baseDir, 'processed', 'deep-analysis');
    this.ensureDirectory(targetDir);

    const filePath = path.join(targetDir, `${monthStr}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 [ForkSafeStorage] Saved deep analysis archive for ${monthStr}: ${filePath}`);

    if (this.publicDir) {
      const publicTargetDir = path.join(this.publicDir, 'deep-analysis');
      this.ensureDirectory(publicTargetDir);
      fs.writeFileSync(path.join(publicTargetDir, `${monthStr}.json`), JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /**
   * 保持されている全月次集計データ (processed/monthly) の月一覧を取得 (降順)
   */
  public getStoredProcessedMonths(): string[] {
    const months = new Set<string>();
    const monthlyDir = path.join(this.baseDir, 'processed', 'monthly');
    if (fs.existsSync(monthlyDir)) {
      const files = fs.readdirSync(monthlyDir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          const m = f.replace('.json', '');
          if (/^\d{4}-\d{2}$/.test(m)) {
            months.add(m);
          }
        }
      }
    }
    return Array.from(months).sort().reverse();
  }

  /**
   * 保持されているディープ分析アーカイブの月一覧を取得 (降順)
   */
  public getStoredDeepAnalysisMonths(): string[] {
    const months = new Set<string>();
    const deepDir = path.join(this.baseDir, 'processed', 'deep-analysis');
    if (fs.existsSync(deepDir)) {
      const files = fs.readdirSync(deepDir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          const m = f.replace('.json', '');
          if (/^\d{4}-\d{2}$/.test(m)) {
            months.add(m);
          }
        }
      }
    }
    return Array.from(months).sort().reverse();
  }

  /**
   * 指定月のRawレポートCSVファイル一覧を取得
   */
  public getRawReportFiles(monthStr: string): string[] {
    const reportDir = path.join(this.baseDir, 'reports', 'monthly', monthStr);
    if (!fs.existsSync(reportDir)) return [];

    return fs
      .readdirSync(reportDir)
      .filter((f) => f.endsWith('.csv'))
      .map((f) => path.join(reportDir, f));
  }
}

