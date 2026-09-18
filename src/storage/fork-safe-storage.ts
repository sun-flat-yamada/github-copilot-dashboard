import * as fs from 'fs';
import * as path from 'path';
import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
  IndexMetadata,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
} from '../types/copilot.js';

export interface StorageConfig {
  baseDir?: string;
  publicDir?: string;
}

export class ForkSafeStorage {
  private baseDir: string;
  private publicDir?: string;

  constructor(config: StorageConfig = {}) {
    this.baseDir = config.baseDir || path.resolve(process.cwd(), 'data');
    this.publicDir = config.publicDir || path.resolve(process.cwd(), 'dashboard/public/data');
    this.ensureDirectory(this.baseDir);
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
  public saveRolling1YearTrend(data: any): void {
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

