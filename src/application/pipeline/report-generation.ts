import {
  REPORT_DEFINITION_SCHEMA_VERSION,
  type ReportDefinition,
  type ReportOutputEntry,
  type ReportOutputIndex,
} from '../../domain/entities/report-definition.js';
import type { MonthCloseRecord } from '../../domain/entities/month-close.js';
import { renderReport } from '../../processor/report-engine.js';

/**
 * 定義駆動レポートの生成 (P4-5 / E-04)。何を・いつ生成するかの判定と保存。描画は processor/report-engine.ts。
 * 出力は audit/report-outputs/ (Pages へ配信しない。SDD-17 §6.6)。
 */

/** ForkSafeStorage が満たす最小のインタフェース (テストでは一時ディレクトリの実物を使う) */
export interface ReportGenerationStorage {
  isDemoStorage(): boolean;
  loadIndex(): { is_mock_mode?: boolean } | null;
  getStoredProcessedMonths(): string[];
  getStoredReportMonths(): string[];
  getClosedMonths(): string[];
  loadScopeData(scopeType: 'monthly', key: string): unknown;
  loadReportData(month: string): unknown;
  loadMonthClose(month: string): MonthCloseRecord | null;
  loadReportOutputIndex(): ReportOutputIndex | null;
  saveReportOutputIndex(index: ReportOutputIndex): void;
  saveReportOutput(reportId: string, period: string, ext: 'md' | 'csv', content: string): string;
}

export interface ReportTarget {
  period: string;
  dataMonth: string;
}

export interface ReportDefinitionEntry {
  definition: ReportDefinition;
  sha256: string;
}

export interface GenerationResult {
  report_id: string;
  period: string;
  status: 'generated' | 'up_to_date' | 'no_data';
  files: string[];
}

/** ISO 8601 の週 (YYYY-Www)。UTC 基準 */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export class ReportGenerationService {
  constructor(private readonly storage: ReportGenerationStorage) {}

  private datasetMonths(def: ReportDefinition): string[] {
    return def.dataset === 'monthly' ? this.storage.getStoredProcessedMonths() : this.storage.getStoredReportMonths();
  }

  private loadDoc(def: ReportDefinition, month: string): Record<string, unknown> | null {
    const doc = def.dataset === 'monthly' ? this.storage.loadScopeData('monthly', month) : this.storage.loadReportData(month);
    return doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : null;
  }

  /** スケジュールに従って生成すべき対象 (出力が無い、または定義が変わったもの)。schedule 無しは手動のみ */
  dueTargets(entry: ReportDefinitionEntry, now: Date): ReportTarget[] {
    const { definition: def } = entry;
    if (!def.schedule) return [];
    const months = this.datasetMonths(def);
    let candidates: ReportTarget[] = [];
    if (def.schedule === 'monthly-close') {
      const closed = new Set(this.storage.getClosedMonths());
      candidates = months.filter((m) => closed.has(m)).map((m) => ({ period: m, dataMonth: m }));
    } else if (months.length > 0) {
      candidates = [{ period: isoWeek(now), dataMonth: months[0] }];
    }
    const existing = this.storage.loadReportOutputIndex()?.outputs ?? [];
    return candidates.filter((t) => {
      const e = existing.find((o) => o.report_id === def.id && o.period === t.period);
      return !e || e.definition_sha256 !== entry.sha256 || def.outputs.some((o) => !e.outputs.includes(o));
    });
  }

  /** 1 件を生成して保存する。入力データが無ければ no_data (何も書かない) */
  generate(entry: ReportDefinitionEntry, target: ReportTarget, now: Date): GenerationResult {
    const { definition: def } = entry;
    const doc = this.loadDoc(def, target.dataMonth);
    if (!doc) return { report_id: def.id, period: target.period, status: 'no_data', files: [] };
    const demo = this.storage.isDemoStorage() || this.storage.loadIndex()?.is_mock_mode === true;
    const rendered = renderReport(def, doc, {
      dataMonth: target.dataMonth,
      period: target.period,
      isDemo: demo,
      definitionSha256: entry.sha256,
      closeChecksum: this.currentCloseChecksum(target.dataMonth),
    });
    const files: string[] = [];
    if (rendered.markdown !== undefined) files.push(this.storage.saveReportOutput(def.id, target.period, 'md', rendered.markdown));
    if (rendered.csv !== undefined) files.push(this.storage.saveReportOutput(def.id, target.period, 'csv', rendered.csv));

    const index = this.storage.loadReportOutputIndex() ?? { schema_version: REPORT_DEFINITION_SCHEMA_VERSION, outputs: [] };
    const next: ReportOutputEntry = {
      report_id: def.id,
      period: target.period,
      data_month: target.dataMonth,
      generated_at: now.toISOString(),
      definition_sha256: entry.sha256,
      outputs: [...def.outputs],
      demo,
    };
    const outputs = index.outputs
      .filter((o) => !(o.report_id === def.id && o.period === target.period))
      .concat(next)
      .sort((a, b) => a.report_id.localeCompare(b.report_id) || b.period.localeCompare(a.period));
    this.storage.saveReportOutputIndex({ schema_version: REPORT_DEFINITION_SCHEMA_VERSION, outputs });
    return { report_id: def.id, period: target.period, status: 'generated', files };
  }

  private currentCloseChecksum(month: string): string | undefined {
    const record = this.storage.loadMonthClose(month);
    if (!record) return undefined;
    const last = record.revisions?.length ? record.revisions[record.revisions.length - 1] : record.closed;
    return last?.checksum;
  }

  /** 手動生成の既定の対象: 指定月、無ければ最新の月 */
  manualTarget(entry: ReportDefinitionEntry, month: string | undefined): ReportTarget | null {
    const months = this.datasetMonths(entry.definition);
    const dataMonth = month ?? months[0];
    return dataMonth ? { period: dataMonth, dataMonth } : null;
  }
}
