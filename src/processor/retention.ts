import {
  DEFAULT_RETENTION_MONTHS,
  MAX_RETENTION_MONTHS,
  MIN_RETENTION_MONTHS,
  type RetentionCategory,
  type RetentionItem,
  type RetentionPlan,
  type RetentionSkip,
} from '../domain/entities/retention.js';
import { shiftMonth } from './month-close.js';

/**
 * 保持期間ポリシー (P4-6) の純関数: 設定の検証・期限判定・削除計画。入出力は application 層が受け持つ。
 * 削除してはならないもの (processed/** 、確定済みの月次 closes/ と改訂履歴) はここで計画に入らないことが保証される:
 * 入力 (RetentionInventory) がそもそも Raw と監査の派生物だけを列挙する。
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const RUN_ID_RE = /^(\d{4})(\d{2})\d{2}T\d{6}Z-[0-9a-f]+$/;
export const PERIOD_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const PERIOD_WEEK_RE = /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/;

export function monthOf(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** `COPILOT_DATA_RETENTION_MONTHS` の検証。不正なら既定 (60 か月) を返し error に理由を入れる */
export function parseRetentionMonths(raw: string | undefined): { months: number; error?: string } {
  if (raw === undefined || raw.trim() === '') return { months: DEFAULT_RETENTION_MONTHS };
  const text = raw.trim();
  if (!/^\d+$/.test(text)) {
    return { months: DEFAULT_RETENTION_MONTHS, error: `COPILOT_DATA_RETENTION_MONTHS must be an integer (got "${text}"); using ${DEFAULT_RETENTION_MONTHS}.` };
  }
  const n = Number(text);
  if (n < MIN_RETENTION_MONTHS || n > MAX_RETENTION_MONTHS) {
    return {
      months: DEFAULT_RETENTION_MONTHS,
      error: `COPILOT_DATA_RETENTION_MONTHS must be between ${MIN_RETENTION_MONTHS} and ${MAX_RETENTION_MONTHS} (got ${n}); using ${DEFAULT_RETENTION_MONTHS}.`,
    };
  }
  return { months: n };
}

/** 現在の月を含む直近 `months` か月を保持するときの、保持する最も古い月 */
export function keepFromMonth(now: Date, months: number): string {
  return shiftMonth(monthOf(now), -(months - 1));
}

export function isExpiredMonth(month: string, keepFrom: string): boolean {
  return MONTH_RE.test(month) && month < keepFrom;
}

/** run_id (`20261003T041500Z-ab12`) の月。形式が違えば null (削除しない) */
export function runIdMonth(runId: string): string | null {
  const m = RUN_ID_RE.exec(runId);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** レポート出力の期間 (`YYYY-MM` または `YYYY-Www`) の月。週は ISO 週の木曜日が属する月。形式が違えば null */
export function periodMonth(period: string): string | null {
  if (PERIOD_MONTH_RE.test(period)) return period;
  const m = PERIOD_WEEK_RE.exec(period);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // ISO 週 1 は 1/4 を含む週。その木曜日を求めて週を進める
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const thursday = new Date(Date.UTC(year, 0, 4 - jan4Day + 4 + (week - 1) * 7));
  return monthOf(thursday);
}

export interface RetentionInventory {
  /** `raw/YYYY/MM/` がある月 */
  rawDailyMonths: string[];
  /** `raw/landing/manifests/` の run と、その manifest が指す object (raw/landing からの相対パス) */
  landingManifests: Array<{ run_id: string; objects: string[] }>;
  /** 読めない manifest がある。参照を数えられないので object は 1 件も削除しない */
  landingUnreadable?: boolean;
  /** `reports/monthly/YYYY-MM/` (CSV 原本) がある月 */
  reportCsvMonths: string[];
  seatEventMonths: string[];
  billingReconciliationMonths: string[];
  reportOutputs: Array<{ report_id: string; period: string }>;
  /** 月次締め済みの月 (`processed/closes/{month}.json`) */
  closedMonths: string[];
}

/** 削除計画。Raw と CSV 原本は月次締め済みの月だけ。未締めは skipped (not_closed)。期限内は何も出さない */
export function buildRetentionPlan(inventory: RetentionInventory, now: Date, retentionMonths: number): RetentionPlan {
  const keepFrom = keepFromMonth(now, retentionMonths);
  const closed = new Set(inventory.closedMonths);
  const items: RetentionItem[] = [];
  const skipped: RetentionSkip[] = [];

  const monthKeyed = (category: RetentionCategory, months: string[], requireClosed: boolean) => {
    for (const month of months) {
      if (!isExpiredMonth(month, keepFrom)) continue;
      if (requireClosed && !closed.has(month)) skipped.push({ category, key: month, month, reason: 'not_closed' });
      else items.push({ category, key: month, month });
    }
  };

  monthKeyed('raw_daily', inventory.rawDailyMonths, true);
  monthKeyed('report_csv', inventory.reportCsvMonths, true);
  monthKeyed('seat_events', inventory.seatEventMonths, false);
  monthKeyed('billing_reconciliation', inventory.billingReconciliationMonths, false);

  // Run Manifest: 収集した月で判定する。manifest が消えて他のどの manifest からも参照されなくなった object も消す
  const expiredRuns = new Set<string>();
  const keptObjects = new Set<string>();
  const droppedObjects = new Map<string, string>();
  for (const run of inventory.landingManifests) {
    const month = runIdMonth(run.run_id);
    if (month === null) {
      skipped.push({ category: 'raw_landing_manifests', key: run.run_id, month: '', reason: 'unparsable' });
      run.objects.forEach((o) => keptObjects.add(o));
      continue;
    }
    if (isExpiredMonth(month, keepFrom)) {
      expiredRuns.add(run.run_id);
      items.push({ category: 'raw_landing_manifests', key: run.run_id, month });
      run.objects.forEach((o) => droppedObjects.set(o, month));
    } else {
      run.objects.forEach((o) => keptObjects.add(o));
    }
  }
  for (const [object, month] of [...droppedObjects].sort(([a], [b]) => a.localeCompare(b))) {
    if (!inventory.landingUnreadable && !keptObjects.has(object)) items.push({ category: 'raw_landing_objects', key: object, month });
  }

  for (const out of inventory.reportOutputs) {
    const month = periodMonth(out.period);
    const key = `${out.report_id}/${out.period}`;
    if (month === null) {
      skipped.push({ category: 'report_outputs', key, month: '', reason: 'unparsable' });
      continue;
    }
    if (isExpiredMonth(month, keepFrom)) items.push({ category: 'report_outputs', key, month });
  }

  items.sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
  return { retention_months: retentionMonths, keep_from: keepFrom, items, skipped };
}

export interface ExecutionGuardInput {
  /** `git rev-parse --abbrev-ref HEAD` (git 管理外なら null) */
  branch: string | null;
  /** `git ls-files data/` の件数 (git 管理外なら 0) */
  trackedDataFiles: number;
  isDemo: boolean;
}

/** 実行を拒否する理由。null なら実行してよい */
export function retentionExecutionRefusal(input: ExecutionGuardInput): string | null {
  if (input.isDemo) return 'Retention is not applied to demo data (data/demo).';
  const onDataBranch = input.branch !== null && /^copilot-data(-mock)?$/.test(input.branch);
  if (input.trackedDataFiles > 0 && !onDataBranch) {
    return `Refusing to delete: ${input.trackedDataFiles} file(s) under data/ are tracked by Git on branch "${input.branch ?? '(unknown)'}". Runtime data must never be tracked on main (SDD-05); run the retention on the copilot-data checkout.`;
  }
  return null;
}

/** `--confirm` がカットオフ (keep_from) の月と一致するか。古い計画のまま実行しないための確認 */
export function confirmMatches(confirm: string | undefined, plan: RetentionPlan): boolean {
  return confirm !== undefined && confirm === plan.keep_from;
}
