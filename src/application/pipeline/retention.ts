import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MAX_RETENTION_LOG_RUNS,
  RETENTION_LOG_SCHEMA_VERSION,
  type RetentionCategory,
  type RetentionCategorySummary,
  type RetentionItem,
  type RetentionLog,
  type RetentionPlan,
  type RetentionRunRecord,
} from '../../domain/entities/retention.js';
import { buildRetentionPlan, type RetentionInventory } from '../../processor/retention.js';
import type { ReportOutputIndex } from '../../domain/entities/report-definition.js';

/**
 * 保持期間の削除 (P4-6 / E-05)。SDD-17 §8。
 * 計画 (plan) は読み取りだけ。execute だけが削除し、先に「意図」を audit/retention/log.json へ記録してから削除する。
 * processed/** (確定済みの月次 closes/ と改訂履歴を含む)・index.json・error-log.json・catalog/・config/ には触れない。
 */

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR = /^\d{4}$/;
const MM = /^(0[1-9]|1[0-2])$/;
const RUN_ID = /^\d{8}T\d{6}Z-[0-9a-f]+$/;
const OBJECT_PATH = /^objects\/[0-9a-f]{2}\/[0-9a-f]{64}\.[a-z0-9]+$/;
const REPORT_ID = /^[a-z0-9][a-z0-9-]*$/;
const PERIOD = /^\d{4}-(\d{2}|W\d{2})$/;

/** ForkSafeStorage が満たす最小のインタフェース */
export interface RetentionStorage {
  getBaseDir(): string;
  isDemoStorage(): boolean;
  getClosedMonths(): string[];
  loadReportOutputIndex(): ReportOutputIndex | null;
  saveReportOutputIndex(index: ReportOutputIndex): void;
}

/** Raw Landing の一覧 (RawLandingStore が満たす)。Composition Root / CLI が注入する */
export interface RetentionLandingIndex {
  /** data/raw/landing の絶対パス */
  readonly root: string;
  /** manifests/ にある run id の一覧 */
  listRunIds(): string[];
}

function isDir(p: string): boolean {
  try {
    const st = fs.lstatSync(p);
    return st.isDirectory() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    const st = fs.lstatSync(p);
    return st.isFile() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

function listDirs(p: string): string[] {
  if (!isDir(p)) return [];
  return fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.isSymbolicLink()).map((e) => e.name).sort();
}

function listFiles(p: string): string[] {
  if (!isDir(p)) return [];
  return fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isFile() && !e.isSymbolicLink()).map((e) => e.name).sort();
}

function sizeOf(p: string): number {
  let st: fs.Stats;
  try {
    st = fs.lstatSync(p);
  } catch {
    return 0;
  }
  if (st.isSymbolicLink()) return 0;
  if (st.isFile()) return st.size;
  if (!st.isDirectory()) return 0;
  return fs.readdirSync(p).reduce((sum, name) => sum + sizeOf(path.join(p, name)), 0);
}

function removeIfEmpty(dir: string, stopAt: string): void {
  let cur = dir;
  while (cur !== stopAt && cur.startsWith(stopAt + path.sep)) {
    try {
      if (fs.readdirSync(cur).length > 0) return;
      fs.rmdirSync(cur);
    } catch {
      return;
    }
    cur = path.dirname(cur);
  }
}

export class RetentionService {
  private readonly base: string;

  constructor(
    private readonly storage: RetentionStorage,
    private readonly landing: RetentionLandingIndex
  ) {
    this.base = path.resolve(storage.getBaseDir());
  }

  /** data/ 配下の、保持期間の対象になり得るものの一覧 (読み取りのみ) */
  inventory(): RetentionInventory {
    const rawDir = path.join(this.base, 'raw');
    const rawDailyMonths: string[] = [];
    for (const year of listDirs(rawDir).filter((y) => YEAR.test(y))) {
      for (const mm of listDirs(path.join(rawDir, year)).filter((m) => MM.test(m))) rawDailyMonths.push(`${year}-${mm}`);
    }

    const landing = this.landing;
    const landingManifests: RetentionInventory['landingManifests'] = [];
    let landingUnreadable = false;
    for (const runId of landing.listRunIds()) {
      let objects: string[] = [];
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(landing.root, 'manifests', `${runId}.json`), 'utf-8')) as { entries?: Array<{ object?: unknown }> };
        objects = (manifest.entries ?? []).map((e) => e.object).filter((o): o is string => typeof o === 'string');
      } catch {
        // 読めない manifest は参照を数えられない。共有 object を誤って消さないよう、object の削除をすべて見送る
        landingUnreadable = true;
        continue;
      }
      landingManifests.push({ run_id: runId, objects });
    }

    const monthsOf = (dir: string, ext: string) =>
      listFiles(dir).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)).filter((m) => MONTH.test(m));

    const outputsDir = path.join(this.base, 'audit', 'report-outputs');
    const reportOutputs: RetentionInventory['reportOutputs'] = [];
    for (const id of listDirs(outputsDir).filter((d) => REPORT_ID.test(d))) {
      const periods = new Set<string>();
      for (const f of listFiles(path.join(outputsDir, id))) {
        const m = /^(.+)\.(md|csv)$/.exec(f);
        if (m && PERIOD.test(m[1])) periods.add(m[1]);
      }
      for (const period of [...periods].sort()) reportOutputs.push({ report_id: id, period });
    }

    return {
      rawDailyMonths,
      landingManifests,
      landingUnreadable,
      reportCsvMonths: listDirs(path.join(this.base, 'reports', 'monthly')).filter((m) => MONTH.test(m)),
      seatEventMonths: monthsOf(path.join(this.base, 'audit', 'seat-events'), '.json'),
      billingReconciliationMonths: monthsOf(path.join(this.base, 'audit', 'billing-reconciliation'), '.json'),
      reportOutputs,
      closedMonths: this.storage.getClosedMonths(),
    };
  }

  plan(now: Date, retentionMonths: number): RetentionPlan {
    return buildRetentionPlan(this.inventory(), now, retentionMonths);
  }

  /** 計画の要約 (カテゴリ別の件数・キー・現在のバイト数) */
  summarizePlan(plan: RetentionPlan): Partial<Record<RetentionCategory, RetentionCategorySummary>> {
    return summarize(plan.items, (item) => this.targets(item).reduce((sum, t) => sum + sizeOf(t), 0));
  }

  /** 項目が指す、data/ 配下の絶対パス (複数)。形式が不正なら空 (削除しない) */
  private targets(item: RetentionItem): string[] {
    const b = this.base;
    switch (item.category) {
      case 'raw_daily':
        return MONTH.test(item.key) ? [path.join(b, 'raw', item.key.slice(0, 4), item.key.slice(5, 7))] : [];
      case 'raw_landing_manifests':
        return RUN_ID.test(item.key) ? [path.join(b, 'raw', 'landing', 'manifests', `${item.key}.json`)] : [];
      case 'raw_landing_objects':
        return OBJECT_PATH.test(item.key) ? [path.join(b, 'raw', 'landing', ...item.key.split('/'))] : [];
      case 'report_csv':
        return MONTH.test(item.key) ? [path.join(b, 'reports', 'monthly', item.key)] : [];
      case 'seat_events':
        return MONTH.test(item.key) ? [path.join(b, 'audit', 'seat-events', `${item.key}.json`)] : [];
      case 'billing_reconciliation':
        return MONTH.test(item.key) ? [path.join(b, 'audit', 'billing-reconciliation', `${item.key}.json`)] : [];
      case 'report_outputs': {
        const [id, period, ...rest] = item.key.split('/');
        if (rest.length > 0 || !REPORT_ID.test(id ?? '') || !PERIOD.test(period ?? '')) return [];
        return ['md', 'csv'].map((ext) => path.join(b, 'audit', 'report-outputs', id, `${period}.${ext}`));
      }
    }
  }

  private inside(p: string): boolean {
    return path.resolve(p).startsWith(this.base + path.sep);
  }

  private logPath(): string {
    return path.join(this.base, 'audit', 'retention', 'log.json');
  }

  loadLog(): RetentionLog {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.logPath(), 'utf-8')) as RetentionLog;
      if (Array.isArray(parsed.runs)) return parsed;
    } catch {
      // 無い・壊れている場合は新しい記録を始める
    }
    return { schema_version: RETENTION_LOG_SCHEMA_VERSION, runs: [] };
  }

  private writeLog(record: RetentionRunRecord): void {
    const log = this.loadLog();
    const runs = log.runs.filter((r) => r.run_id !== record.run_id).concat(record).slice(-MAX_RETENTION_LOG_RUNS);
    fs.mkdirSync(path.dirname(this.logPath()), { recursive: true });
    fs.writeFileSync(this.logPath(), JSON.stringify({ schema_version: RETENTION_LOG_SCHEMA_VERSION, runs }, null, 2), 'utf-8');
  }

  /**
   * 計画を実行する。呼び出し側 (CLI) が --execute / --confirm / ブランチの確認を済ませてから呼ぶ。
   * 先に status "started" で記録し、削除後に "completed" / "failed" へ更新する。1 件の失敗は他を止めない。
   */
  execute(plan: RetentionPlan, runId: string, now: Date, actor?: string): RetentionRunRecord {
    if (this.storage.isDemoStorage()) throw new Error('Retention is not applied to demo data.');
    const record: RetentionRunRecord = {
      run_id: runId,
      started_at: now.toISOString(),
      status: 'started',
      retention_months: plan.retention_months,
      keep_from: plan.keep_from,
      ...(actor ? { actor } : {}),
      categories: this.summarizePlan(plan),
      skipped: plan.skipped,
      errors: [],
    };
    this.writeLog(record);

    const deletedOutputs = new Set<string>();
    for (const item of plan.items) {
      try {
        for (const target of this.targets(item)) {
          if (!this.inside(target)) throw new Error(`path escapes the data directory: ${item.category}/${item.key}`);
          if (!fs.lstatSync(target, { throwIfNoEntry: false })) continue;
          if (isDir(target)) fs.rmSync(target, { recursive: true, force: false });
          else if (isFile(target)) fs.unlinkSync(target);
          else throw new Error(`not a regular file or directory (symbolic link?): ${item.category}/${item.key}`);
          removeIfEmpty(path.dirname(target), this.base);
        }
        if (item.category === 'report_outputs') deletedOutputs.add(item.key);
      } catch (e) {
        record.errors.push(`${item.category}/${item.key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (deletedOutputs.size > 0) {
      try {
        const index = this.storage.loadReportOutputIndex();
        if (index) {
          this.storage.saveReportOutputIndex({
            ...index,
            outputs: index.outputs.filter((o) => !deletedOutputs.has(`${o.report_id}/${o.period}`)),
          });
        }
      } catch (e) {
        record.errors.push(`report_outputs/index.json: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    record.finished_at = new Date().toISOString();
    record.status = record.errors.length > 0 ? 'failed' : 'completed';
    this.writeLog(record);
    return record;
  }
}

function summarize(items: RetentionItem[], bytesOf: (item: RetentionItem) => number): Partial<Record<RetentionCategory, RetentionCategorySummary>> {
  const out: Partial<Record<RetentionCategory, RetentionCategorySummary>> = {};
  for (const item of items) {
    const s = (out[item.category] ??= { count: 0, keys: [], bytes: 0 });
    s.count++;
    s.keys.push(item.key);
    s.bytes += bytesOf(item);
  }
  return out;
}
