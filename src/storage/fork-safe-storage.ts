import * as fs from 'fs';
import * as path from 'path';
import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
  IndexMetadata,
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
}
