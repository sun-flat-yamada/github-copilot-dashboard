import type { DataFetchIssue } from '../../domain/entities/copilot.js';
import type {
  BusinessCalendarConfig,
  CloseFigures,
  FigureDiff,
  MonthCloseProblem,
  MonthCloseRecord,
} from '../../domain/entities/month-close.js';
import type { IStorageWriter } from '../../domain/ports/IStorageWriter.js';
import {
  MONTHLY_NAMESPACE,
  REPORT_NAMESPACE,
  appendRevision,
  buildCloseIndex,
  createCloseRecord,
  currentVersion,
  diffFigures,
  extractMonthlyFigures,
  extractReportFigures,
  figuresOf,
  isCloseDue,
  verifyAgainstArtifacts,
  verifyRecordIntegrity,
} from '../../processor/month-close.js';

/**
 * 月次締めジョブ・確定月の保護・改訂・整合性検査 (P4-2 / E-01)。
 * 保存は IStorageWriter の任意メソッド経由。未対応の実装 (旧モック等) では何もしない。
 */

export interface RevisionRequest {
  /** 改訂を許可する月 (YYYY-MM) */
  months: string[];
  /** 改訂の理由 (必須) */
  reason: string;
  /** 運用者が明示した別名・役割 (実名や GitHub ログインを自動では入れない) */
  actor?: string;
}

export interface MonthCloseServiceOptions {
  now: Date;
  calendar: BusinessCalendarConfig;
  /** この実行の ID (Run Manifest の run_id) */
  runId?: string;
  revision?: RevisionRequest;
}

const DIFF_PREVIEW = 5;

function describeDiff(diff: FigureDiff[]): string {
  const head = diff.slice(0, DIFF_PREVIEW).map((d) => `${d.key}: ${d.before ?? '—'} -> ${d.after ?? '—'}`);
  return diff.length > DIFF_PREVIEW ? `${head.join('; ')}; (+${diff.length - DIFF_PREVIEW} more)` : head.join('; ');
}

function replaceNamespace(base: CloseFigures, namespace: string, next: CloseFigures): CloseFigures {
  const kept = Object.fromEntries(Object.entries(base).filter(([k]) => !k.startsWith(`${namespace}.`)));
  return { ...kept, ...next };
}

export class MonthCloseService {
  private readonly issues: DataFetchIssue[] = [];
  private readonly staged = new Map<string, CloseFigures>();
  private readonly seen = new Set<string>();

  constructor(
    private readonly storage: IStorageWriter,
    private readonly opts: MonthCloseServiceOptions
  ) {}

  get enabled(): boolean {
    return Boolean(this.storage.saveMonthClose && this.storage.loadMonthClose && this.storage.getClosedMonths);
  }

  getIssues(): DataFetchIssue[] {
    return [...this.issues];
  }

  private issue(severity: 'error' | 'warning', month: string, message: string, details?: string): void {
    this.issues.push({
      id: `issue_close_${month}_${this.issues.length}`,
      timestamp: this.opts.now.toISOString(),
      severity,
      category: 'data_integrity',
      target: `month-close:${month}`,
      message,
      details,
    });
  }

  private records(): MonthCloseRecord[] {
    if (!this.enabled) return [];
    return this.storage
      .getClosedMonths!()
      .map((m) => this.storage.loadMonthClose!(m))
      .filter((r): r is MonthCloseRecord => r !== null);
  }

  private persist(record: MonthCloseRecord): void {
    const all = this.records().filter((r) => r.month !== record.month);
    this.storage.saveMonthClose!(record, buildCloseIndex([...all, record]));
  }

  /** 確定スナップショットがある月 -> 改訂回数 (1 年推移の確定判定に使う) */
  closedMonthsMap(): Map<string, { revision_count: number }> {
    return new Map(this.records().map((r) => [r.month, { revision_count: r.revisions.length }]));
  }

  /** 保存済みの成果物から、その月の確定対象の数値を作る。成果物が無い名前空間は含めない */
  private artifactFigures(month: string): { monthly: CloseFigures | null; report: CloseFigures | null } {
    const scope = this.storage.loadScopeData('monthly', month);
    const report = this.storage.loadReportData?.(month) ?? null;
    return {
      monthly: scope ? extractMonthlyFigures(scope) : null,
      report: report ? extractReportFigures(report) : null,
    };
  }

  /** 締め日 (翌月の第 N 営業日) を迎え、まだ確定していない月を確定する。確定した月を返す */
  closeDueMonths(): string[] {
    if (!this.enabled) return [];
    const closed = new Set(this.storage.getClosedMonths!());
    const months = new Set<string>([
      ...this.storage.getStoredProcessedMonths(),
      ...(this.storage.getStoredReportMonths?.() ?? []),
    ]);
    const done: string[] = [];
    for (const month of [...months].sort()) {
      if (closed.has(month) || !isCloseDue(month, this.opts.now, this.opts.calendar)) continue;
      const a = this.artifactFigures(month);
      const figures: CloseFigures = { ...(a.monthly ?? {}), ...(a.report ?? {}) };
      if (Object.keys(figures).length === 0) continue;
      const record = createCloseRecord(month, figures, this.opts.calendar, { now: this.opts.now, runId: this.opts.runId });
      this.persist(record);
      done.push(month);
      console.log(`🔒 Month closed: ${month} (closes_on ${record.closes_on}, checksum ${record.closed.checksum.slice(0, 12)}).`);
    }
    return done;
  }

  /**
   * 成果物 (monthly / report) を書き込んでよいか。確定していない月は常に true。
   * 確定月は、数値が確定版と同じなら true、違えば改訂の指定がある月だけ true (改訂として記録)。
   * 指定が無い違いは書き込まず、issue 化する (黙って上書きしない)。
   */
  allowWrite(month: string, kind: 'monthly' | 'report', candidate: CloseFigures): boolean {
    if (!this.enabled) return true;
    const record = this.storage.loadMonthClose!(month);
    if (!record) return true;
    this.seen.add(month);
    const namespace = kind === 'monthly' ? MONTHLY_NAMESPACE : REPORT_NAMESPACE;
    const base = this.staged.get(month) ?? currentVersion(record).figures;
    const diff = diffFigures(figuresOf(base, namespace), candidate);
    if (diff.length === 0) return true;
    if (this.opts.revision?.months.includes(month)) {
      this.staged.set(month, replaceNamespace(base, namespace, candidate));
      return true;
    }
    this.issue(
      'warning',
      month,
      `Closed month ${month} would change (${kind}); the stored figures were kept. Revise it explicitly with --revise ${month} --reason "<reason>".`,
      describeDiff(diff)
    );
    console.warn(`🔒 Month ${month} is closed: ${kind} figures differ (${diff.length} item(s)); kept the closed version.`);
    return false;
  }

  /** 改訂の指定を反映する。数値が変わった月は改訂版を履歴に追記し、変わらなかった月・対象外の月は報告する */
  finalize(): void {
    const req = this.opts.revision;
    if (!this.enabled || !req) return;
    for (const month of req.months) {
      const record = this.storage.loadMonthClose!(month);
      if (!record) {
        this.issue('error', month, `Cannot revise ${month}: the month is not closed.`);
        continue;
      }
      const figures = this.staged.get(month);
      if (!figures) {
        const note = this.seen.has(month)
          ? `Revision requested for ${month} but its figures did not change; nothing recorded.`
          : `Revision requested for ${month} but this run produced no data for that month; nothing recorded.`;
        this.issue('warning', month, note);
        console.warn(`🔒 ${note}`);
        continue;
      }
      const next = appendRevision(record, { reason: req.reason, actor: req.actor, figures }, { now: this.opts.now, runId: this.opts.runId });
      if (!next) continue;
      this.persist(next);
      const rev = next.revisions[next.revisions.length - 1];
      console.log(`🔒 Month revised: ${month} -> version ${rev.version} (${rev.diff.length} item(s) changed).`);
    }
  }

  /** 記録の整合性と、成果物が現在有効な版と一致するかを検査する */
  verify(): MonthCloseProblem[] {
    const problems: MonthCloseProblem[] = [];
    for (const record of this.records()) {
      const integrity = verifyRecordIntegrity(record);
      if (integrity) {
        problems.push(integrity);
        continue;
      }
      const a = this.artifactFigures(record.month);
      const p = verifyAgainstArtifacts(record, a);
      if (p) problems.push(p);
    }
    return problems;
  }

  /** verify() の結果を issue にする (パイプライン用) */
  reportProblems(problems: MonthCloseProblem[]): void {
    for (const p of problems) this.issue('error', p.month, p.message, p.diff.length > 0 ? describeDiff(p.diff) : undefined);
  }
}
