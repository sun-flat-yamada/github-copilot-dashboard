import { createHash } from 'node:crypto';
import {
  BusinessCalendarConfig,
  CloseFigures,
  CloseRevision,
  CloseVersion,
  DEFAULT_BUSINESS_CALENDAR,
  FigureDiff,
  MONTH_CLOSE_SCHEMA_VERSION,
  MonthCloseIndex,
  MonthCloseIndexEntry,
  MonthCloseProblem,
  MonthCloseRecord,
} from '../domain/entities/month-close.js';
import type { MonthlyReportAggregatedData, ScopeAggregatedData } from '../types/copilot.js';

/**
 * 月次締め (P4-2) の純関数: 営業日計算・確定する数値の抽出・チェックサム・差分・改訂。
 * 入出力 (保存・環境変数) は application 層が受け持つ。
 */

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function shiftMonth(month: string, n: number): string {
  if (!MONTH_RE.test(month)) throw new Error(`Invalid month: ${month}`);
  const idx = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + n;
  return `${String(Math.floor(idx / 12)).padStart(4, '0')}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** 設定の検証。問題があれば error を返し、呼び出し側は既定値を使って issue 化する */
export function parseBusinessCalendar(raw: string | undefined): { config: BusinessCalendarConfig; error?: string } {
  const fallback = { ...DEFAULT_BUSINESS_CALENDAR, weekend_days: [...DEFAULT_BUSINESS_CALENDAR.weekend_days], holidays: [] };
  if (!raw || !raw.trim()) return { config: fallback };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { config: fallback, error: 'COPILOT_BUSINESS_CALENDAR is not valid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { config: fallback, error: 'COPILOT_BUSINESS_CALENDAR must be a JSON object.' };
  }
  const o = parsed as Record<string, unknown>;
  const config: BusinessCalendarConfig = { ...fallback };
  if (o.close_business_days !== undefined) {
    const n = o.close_business_days;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 20) {
      return { config: fallback, error: 'close_business_days must be an integer from 1 to 20.' };
    }
    config.close_business_days = n;
  }
  if (o.weekend_days !== undefined) {
    const w = o.weekend_days;
    if (!Array.isArray(w) || w.some((d) => typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6) || new Set(w).size >= 7) {
      return { config: fallback, error: 'weekend_days must be an array of weekday numbers (0=Sun..6=Sat) that leaves at least one business day.' };
    }
    config.weekend_days = [...new Set(w as number[])].sort();
  }
  if (o.holidays !== undefined) {
    const h = o.holidays;
    if (!Array.isArray(h) || h.some((d) => typeof d !== 'string' || !DATE_RE.test(d))) {
      return { config: fallback, error: 'holidays must be an array of YYYY-MM-DD strings.' };
    }
    config.holidays = [...new Set(h as string[])].sort();
  }
  return { config };
}

/** 翌月の第 N 営業日 (UTC) の日付 (YYYY-MM-DD)。週末の曜日と祝日は設定で変えられる */
export function monthCloseDate(month: string, calendar: BusinessCalendarConfig = DEFAULT_BUSINESS_CALENDAR): string {
  const next = shiftMonth(month, 1);
  const y = Number(next.slice(0, 4));
  const m = Number(next.slice(5, 7));
  const holidays = new Set(calendar.holidays);
  let counted = 0;
  // 祝日が続いても必ず終わるよう、上限を設ける (2 か月先まで)
  for (let day = 1; day <= 62; day++) {
    const d = new Date(Date.UTC(y, m - 1, day));
    const iso = d.toISOString().slice(0, 10);
    if (calendar.weekend_days.includes(d.getUTCDay()) || holidays.has(iso)) continue;
    counted++;
    if (counted === calendar.close_business_days) return iso;
  }
  throw new Error(`Cannot compute close date for ${month}`);
}

/** 締め日 (UTC) の当日から締め対象とする */
export function isCloseDue(month: string, now: Date, calendar: BusinessCalendarConfig = DEFAULT_BUSINESS_CALENDAR): boolean {
  return now.toISOString().slice(0, 10) >= monthCloseDate(month, calendar);
}

// ---------------------------------------------------------------------------
// 数値の抽出・チェックサム・差分
// ---------------------------------------------------------------------------

function pushNumbers(out: CloseFigures, prefix: string, obj: unknown): void {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[`${prefix}.${k}`] = v;
    else if (v === null) out[`${prefix}.${k}`] = null;
    else if (typeof v === 'object' && !Array.isArray(v)) pushNumbers(out, `${prefix}.${k}`, v);
  }
}

export const MONTHLY_NAMESPACE = 'monthly';
export const REPORT_NAMESPACE = 'report';

/**
 * 月次スコープ集計から確定する数値を取り出す。overview の数値と、AI クレジット合計・エージェントセッション数。
 * 利用者単位の行 (users / user_profiles) は読まない。
 */
export function extractMonthlyFigures(scope: ScopeAggregatedData): CloseFigures {
  const out: CloseFigures = {};
  pushNumbers(out, `${MONTHLY_NAMESPACE}.overview`, scope.overview);
  out[`${MONTHLY_NAMESPACE}.ai_credits_used`] = (scope.users ?? []).reduce((s, u) => s + (u.ai_credits_used_28d ?? 0), 0);
  out[`${MONTHLY_NAMESPACE}.agent_sessions`] = scope.agent_summary?.total_sessions ?? null;
  return out;
}

/** 月次レポート (CSV 取り込み) の集計から確定する数値を取り出す (overview の数値のみ) */
export function extractReportFigures(report: MonthlyReportAggregatedData): CloseFigures {
  const out: CloseFigures = {};
  pushNumbers(out, `${REPORT_NAMESPACE}.overview`, report.overview);
  return out;
}

/** キー順を固定した JSON (チェックサムを環境・挿入順に依存させない) */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

export function computeChecksum(month: string, figures: CloseFigures): string {
  return createHash('sha256').update(canonicalJson({ month, figures })).digest('hex');
}

/** 変わった項目だけを返す (キー順)。浮動小数の丸め誤差は無視しない: 同じ入力は同じ値になる前提 */
export function diffFigures(before: CloseFigures, after: CloseFigures): FigureDiff[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const diffs: FigureDiff[] = [];
  for (const key of keys) {
    const b = key in before ? before[key] : null;
    const a = key in after ? after[key] : null;
    if (b === a) continue;
    diffs.push({ key, before: b, after: a, delta: b !== null && a !== null ? Number((a - b).toFixed(10)) : null });
  }
  return diffs;
}

/** 名前空間 (monthly / report) の項目だけを取り出す */
export function figuresOf(figures: CloseFigures, namespace: string): CloseFigures {
  const prefix = `${namespace}.`;
  return Object.fromEntries(Object.entries(figures).filter(([k]) => k.startsWith(prefix)));
}

// ---------------------------------------------------------------------------
// 確定・改訂
// ---------------------------------------------------------------------------

export interface CloseContext {
  now: Date;
  runId?: string;
}

export function currentVersion(record: MonthCloseRecord): CloseVersion {
  return record.revisions.length > 0 ? record.revisions[record.revisions.length - 1] : record.closed;
}

export function createCloseRecord(
  month: string,
  figures: CloseFigures,
  calendar: BusinessCalendarConfig,
  ctx: CloseContext
): MonthCloseRecord {
  return {
    schema_version: MONTH_CLOSE_SCHEMA_VERSION,
    month,
    closes_on: monthCloseDate(month, calendar),
    calendar,
    closed: {
      version: 1,
      at: ctx.now.toISOString(),
      ...(ctx.runId ? { run_id: ctx.runId } : {}),
      figures,
      checksum: computeChecksum(month, figures),
    },
    revisions: [],
  };
}

export interface RevisionInput {
  reason: string;
  actor?: string;
  figures: CloseFigures;
}

/**
 * 改訂版を追記した新しい記録を返す (元の確定版・過去の改訂は書き換えない)。
 * 数値に差が無ければ追記しない (null)。理由が空なら例外。
 */
export function appendRevision(record: MonthCloseRecord, input: RevisionInput, ctx: CloseContext): MonthCloseRecord | null {
  const reason = input.reason.trim();
  if (!reason) throw new Error('A revision requires a reason.');
  const prev = currentVersion(record);
  const diff = diffFigures(prev.figures, input.figures);
  if (diff.length === 0) return null;
  const actor = input.actor?.trim();
  const revision: CloseRevision = {
    version: prev.version + 1,
    at: ctx.now.toISOString(),
    ...(ctx.runId ? { run_id: ctx.runId } : {}),
    figures: input.figures,
    checksum: computeChecksum(record.month, input.figures),
    reason,
    ...(actor ? { actor } : {}),
    previous_checksum: prev.checksum,
    diff,
  };
  return { ...record, revisions: [...record.revisions, revision] };
}

/** 記録そのものの整合性 (各版のチェックサム・改訂の連鎖) を検査する */
export function verifyRecordIntegrity(record: MonthCloseRecord): MonthCloseProblem | null {
  const versions: CloseVersion[] = [record.closed, ...record.revisions];
  let prev: CloseVersion | null = null;
  for (const v of versions) {
    if (computeChecksum(record.month, v.figures) !== v.checksum) {
      return { month: record.month, kind: 'checksum_mismatch', message: `Version ${v.version} of ${record.month} does not match its checksum.`, diff: [] };
    }
    if (prev && (v as CloseRevision).previous_checksum !== prev.checksum) {
      return { month: record.month, kind: 'checksum_mismatch', message: `Revision chain of ${record.month} is broken at version ${v.version}.`, diff: [] };
    }
    prev = v;
  }
  return null;
}

/**
 * 現在保存されている成果物の数値が、現在有効な版と一致するか検査する。
 * 成果物が無い名前空間は比較しない (締め後に消えたのではなく、元から無い場合がある)。
 */
export function verifyAgainstArtifacts(
  record: MonthCloseRecord,
  artifacts: { monthly?: CloseFigures | null; report?: CloseFigures | null }
): MonthCloseProblem | null {
  const cur = currentVersion(record).figures;
  const diff: FigureDiff[] = [];
  if (artifacts.monthly) diff.push(...diffFigures(figuresOf(cur, MONTHLY_NAMESPACE), artifacts.monthly));
  if (artifacts.report) diff.push(...diffFigures(figuresOf(cur, REPORT_NAMESPACE), artifacts.report));
  if (diff.length === 0) return null;
  return {
    month: record.month,
    kind: 'unrecorded_change',
    message: `The stored figures of closed month ${record.month} differ from the closed version without a recorded revision.`,
    diff,
  };
}

export function toIndexEntry(record: MonthCloseRecord): MonthCloseIndexEntry {
  const cur = currentVersion(record);
  return {
    month: record.month,
    closes_on: record.closes_on,
    closed_at: record.closed.at,
    checksum: cur.checksum,
    revision_count: record.revisions.length,
    last_revised_at: record.revisions.length > 0 ? record.revisions[record.revisions.length - 1].at : null,
  };
}

export function buildCloseIndex(records: MonthCloseRecord[]): MonthCloseIndex {
  return {
    schema_version: MONTH_CLOSE_SCHEMA_VERSION,
    months: records.map(toIndexEntry).sort((a, b) => b.month.localeCompare(a.month)),
  };
}
