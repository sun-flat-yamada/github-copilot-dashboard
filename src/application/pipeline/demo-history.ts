import { MetricsAggregator } from '../../processor/metrics-aggregator.js';
import { BillingCalculator } from '../../processor/billing-calculator.js';
import { MockDataGenerator, MOCK_DATA_UNAVAILABLE_ORGS } from '../../collector/mock-generator.js';
import { appendRevision, createCloseRecord, buildCloseIndex, extractMonthlyFigures, extractReportFigures } from '../../processor/month-close.js';
import { buildDataQualityReport } from './data-quality.js';
import type { AttributeResolver } from '../../collector/attribute-resolver.js';
import type { IStorageWriter } from '../../domain/ports/IStorageWriter.js';
import type { EnterpriseCostCenter, SourceStatus } from '../../domain/entities/copilot.js';
import type { BusinessCalendarConfig, CloseFigures } from '../../domain/entities/month-close.js';
import type { DataQualityHistory, DataQualityReport } from '../../domain/entities/data-quality.js';

/**
 * DEMO (MOCK_MODE) 専用: 表示パターンを網羅するための過去月の履歴を生成する。
 *
 * - 月次スコープ・Deep Analysis: 過去 23 か月 (欠損月を含む) を本番と同じ集計ロジックで作る
 * - 月次締め: 1 か月を確定後に改訂した履歴 (revision あり)
 * - データ品質履歴: ok / warning / error と欠損日・隔離を含む実行履歴
 *
 * 乱数は月ごとの seed で決定的。確定済みの月は書き換えない (再実行しても同じ結果)。
 * 実データの運用では呼ばれない。
 */

/** 履歴の月数 (当月を除く)。1 年トレンドの窓 12 か月 + 前年同月 12 か月に足りる */
export const DEMO_HISTORY_MONTHS = 23;
/** 保存しない月 (1 年トレンドの「欠損」と、前年同月比の「前年なし」の見本) */
export const DEMO_GAP_MONTHS: readonly string[] = ['2026-01', '2025-03'];
/** 確定後に改訂された月 (月次締めの改訂履歴の見本) */
export const DEMO_REVISED_MONTH = '2026-04';
/** 月次レポート CSV を用意する履歴の月数 (当月を除く) */
export const DEMO_REPORT_HISTORY_MONTHS = 11;
/** Deep Analysis を保存する履歴の月数 (当月を除く) */
export const DEMO_DEEP_ANALYSIS_HISTORY_MONTHS = 5;

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthSeed(month: string): number {
  return Number(month.replace('-', ''));
}

/** 当月を除く履歴の月 (古い順)。欠損月を含まない */
export function demoHistoryMonths(currentMonth: string): string[] {
  const out: string[] = [];
  for (let i = DEMO_HISTORY_MONTHS; i >= 1; i--) {
    const m = addMonths(currentMonth, -i);
    if (!DEMO_GAP_MONTHS.includes(m)) out.push(m);
  }
  return out;
}

/** 月次レポート CSV を用意する月 (古い順、当月を除く) */
export function demoReportMonths(currentMonth: string): string[] {
  return demoHistoryMonths(currentMonth).slice(-DEMO_REPORT_HISTORY_MONTHS);
}

export interface DemoHistoryDeps {
  storage: IStorageWriter;
  resolver: AttributeResolver;
  costCenters: EnterpriseCostCenter[];
  currentMonth: string;
  calendar: BusinessCalendarConfig;
  now: Date;
}

export class DemoHistoryService {
  constructor(private readonly deps: DemoHistoryDeps) {}

  private isClosed(month: string): boolean {
    return Boolean(this.deps.storage.loadMonthClose?.(month));
  }

  /** 過去月の月次スコープと Deep Analysis を保存する。保存した月を返す */
  seedMonthlyScopes(): string[] {
    const { storage, resolver, costCenters, currentMonth } = this.deps;
    const aggregator = new MetricsAggregator();
    const months = demoHistoryMonths(currentMonth);
    const deepFrom = new Set(months.slice(-DEMO_DEEP_ANALYSIS_HISTORY_MONTHS));
    const written: string[] = [];

    months.forEach((month, index) => {
      if (this.isClosed(month)) return;
      const [y, m] = month.split('-').map(Number);
      const daysInMonth = BillingCalculator.getDaysInMonth(y, m);
      const end = `${month}-${String(daysInMonth).padStart(2, '0')}`;
      // 導入が進み、シート数が増えていく推移
      const seatCount = 40 + Math.round((index * 40) / Math.max(1, months.length - 1));
      const bundle = new MockDataGenerator(end, monthSeed(month)).generateBundle(daysInMonth, seatCount);
      const calc = new BillingCalculator(resolver, costCenters, end, { dataUnavailableOrgs: MOCK_DATA_UNAVAILABLE_ORGS });
      const enriched = calc.enrichAllSeats(bundle.seats, daysInMonth);
      const scope = aggregator.aggregateScope(
        'monthly',
        month,
        bundle.metrics,
        enriched,
        { start: `${month}-01`, end, days_count: daysInMonth },
        [],
        bundle.costCenterBudgets,
        bundle.userProfiles
      );
      storage.saveScopeData('monthly', month, scope);
      if (deepFrom.has(month)) storage.saveDeepAnalysisArchive(month, bundle.userProfiles);
      written.push(month);
    });
    return written;
  }

  /**
   * 改訂の見本月を「いったん確定 -> 後から改訂」の状態にする。成果物 (monthly / report) は改訂後の数値で保存済みの前提。
   * 確定時点の数値は、請求の訂正前の値 (支出を少なく見積もった版) として作る。確定済み・成果物なしの場合は何もしない。
   */
  seedRevisedClose(): boolean {
    const { storage, currentMonth, calendar, now } = this.deps;
    const month = DEMO_REVISED_MONTH;
    if (!storage.saveMonthClose || !storage.loadMonthClose || this.isClosed(month) || month >= currentMonth) return false;
    const scope = storage.loadScopeData('monthly', month);
    if (!scope) return false;
    const report = storage.loadReportData?.(month) ?? null;
    const revised: CloseFigures = { ...extractMonthlyFigures(scope), ...(report ? extractReportFigures(report) : {}) };
    const original: CloseFigures = { ...revised };
    for (const key of ['monthly.overview.total_spend_usd', 'report.overview.total_net_spend_usd']) {
      const v = original[key];
      if (typeof v === 'number') original[key] = Number((v * 0.94).toFixed(2));
    }
    const closedAt = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    const revisedAt = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000);
    const record = createCloseRecord(month, original, calendar, { now: closedAt });
    const next = appendRevision(
      record,
      { reason: 'Late invoice correction received from the billing team (demo sample).', actor: 'finance-ops', figures: revised },
      { now: revisedAt }
    );
    if (!next) return false;
    const others = (storage.getClosedMonths?.() ?? [])
      .map((m) => storage.loadMonthClose!(m))
      .filter((r): r is NonNullable<typeof r> => r !== null && r.month !== month);
    storage.saveMonthClose(next, buildCloseIndex([...others, next]));
    return true;
  }

  /**
   * 現在の実行より前の品質履歴。ok / warning / error と、欠損日・隔離・ソース失敗を含む。
   * 実行 ID は固定で、再実行しても置き換わる (件数が増えない)。
   */
  buildQualityHistory(): DataQualityHistory {
    const { now } = this.deps;
    const day = 24 * 60 * 60 * 1000;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const src = (metrics: SourceStatus['status'], seats: SourceStatus['status'], aiCredits: SourceStatus['status']): SourceStatus[] => {
      const at = now.toISOString();
      const mk = (source: SourceStatus['source'], status: SourceStatus['status'], records: number): SourceStatus => ({
        source, status, records, last_attempt_at: at, last_success_at: status === 'failed' ? null : at,
      });
      return [mk('metrics', metrics, metrics === 'failed' ? 0 : 30), mk('seats', seats, 85), mk('cost_centers', 'ok', 4), mk('ai_credits', aiCredits, aiCredits === 'failed' ? 0 : 1)];
    };
    // 古い -> 新しい。直前 (最後) は error で、現在の実行 (warning) は「回復」として表示される
    const plan: Array<{
      missing: number; quarantined: number; outOfRange: number; malformed: number;
      statuses: [SourceStatus['status'], SourceStatus['status'], SourceStatus['status']];
    }> = [
      { missing: 0, quarantined: 0, outOfRange: 0, malformed: 0, statuses: ['ok', 'ok', 'ok'] },
      { missing: 0, quarantined: 0, outOfRange: 0, malformed: 0, statuses: ['ok', 'ok', 'ok'] },
      { missing: 0, quarantined: 0, outOfRange: 0, malformed: 0, statuses: ['ok', 'ok', 'ok'] },
      { missing: 2, quarantined: 0, outOfRange: 0, malformed: 0, statuses: ['ok', 'ok', 'ok'] },
      { missing: 1, quarantined: 3, outOfRange: 1, malformed: 0, statuses: ['ok', 'partial', 'ok'] },
      { missing: 0, quarantined: 0, outOfRange: 0, malformed: 0, statuses: ['ok', 'ok', 'ok'] },
      { missing: 0, quarantined: 0, outOfRange: 0, malformed: 0, statuses: ['ok', 'ok', 'ok'] },
      { missing: 5, quarantined: 0, outOfRange: 0, malformed: 2, statuses: ['failed', 'ok', 'ok'] },
      { missing: 3, quarantined: 0, outOfRange: 0, malformed: 1, statuses: ['partial', 'ok', 'ok'] },
      { missing: 0, quarantined: 2, outOfRange: 0, malformed: 0, statuses: ['ok', 'partial', 'ok'] },
      { missing: 0, quarantined: 0, outOfRange: 0, malformed: 0, statuses: ['ok', 'ok', 'ok'] },
      { missing: 0, quarantined: 0, outOfRange: 0, malformed: 0, statuses: ['ok', 'ok', 'failed'] },
      { missing: 4, quarantined: 0, outOfRange: 0, malformed: 0, statuses: ['failed', 'ok', 'ok'] },
    ];
    const entries: DataQualityReport[] = plan.map((p, i) => {
      const age = plan.length - i; // 日前
      const at = new Date(now.getTime() - age * day);
      const requested = Array.from({ length: 30 }, (_, k) => iso(new Date(at.getTime() - (29 - k) * day)));
      const missingDays = new Set(requested.slice(requested.length - 1 - p.missing, requested.length - 1));
      return buildDataQualityReport(
        {
          requested_days: requested,
          available_days: requested.filter((d) => !missingDays.has(d)),
          duplicates_collapsed: 3,
          out_of_range: p.outOfRange,
          quarantined: p.quarantined,
          malformed_lines: p.malformed,
        },
        src(...p.statuses),
        at.toISOString(),
        `demo-seed-${String(i + 1).padStart(2, '0')}`
      );
    });
    return { schema_version: 1, entries };
  }
}
