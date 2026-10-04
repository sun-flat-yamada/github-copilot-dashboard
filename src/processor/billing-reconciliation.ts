import {
  DEFAULT_RECONCILIATION_TOLERANCE,
  RECONCILIATION_MATCH_EPSILON_USD,
  type BillingReconciliationMonthDocument,
  type BillingReconciliationReport,
  type ReconciliationBreakdownRow,
  type ReconciliationDayRow,
  type ReconciliationStatus,
  type ReconciliationTolerance,
} from '../domain/entities/billing-reconciliation.js';
import type { CostLine } from '../domain/facts/schemas.js';

/**
 * 請求突合の純関数 (P4-4 / E-03)。入出力は値だけで、時刻・ファイル・ネットワークに依存しない。
 */

/** 浮動小数の誤差を落とす (金額は 6 桁で丸める) */
export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export interface ToleranceParseResult {
  tolerance: ReconciliationTolerance;
  /** 不正な指定があったときの理由 (値を含まない)。既定値を使った */
  error?: string;
}

/**
 * 環境変数 COPILOT_RECONCILIATION_TOLERANCE (JSON `{"absolute_usd":1,"percent":1}`) の解析。
 * 未設定は既定値。キーの省略は既定値で補う。負数・非数・未知の型は不正として既定値に戻す。
 */
export function parseTolerance(raw: string | undefined): ToleranceParseResult {
  const fallback = { ...DEFAULT_RECONCILIATION_TOLERANCE };
  if (raw === undefined || raw.trim() === '') return { tolerance: fallback };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { tolerance: fallback, error: 'COPILOT_RECONCILIATION_TOLERANCE is not valid JSON; the default tolerance is used.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { tolerance: fallback, error: 'COPILOT_RECONCILIATION_TOLERANCE must be a JSON object; the default tolerance is used.' };
  }
  const obj = parsed as Record<string, unknown>;
  const out = { ...fallback };
  for (const key of ['absolute_usd', 'percent'] as const) {
    if (obj[key] === undefined) continue;
    const v = obj[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      return {
        tolerance: fallback,
        error: `COPILOT_RECONCILIATION_TOLERANCE.${key} must be a non-negative number; the default tolerance is used.`,
      };
    }
    out[key] = v;
  }
  return { tolerance: out };
}

/** CostLine (請求 API 由来) を月 → 日 → (SKU × モデル) の行に集計する。識別子は持ち込まない */
export function aggregateCostLines(lines: readonly CostLine[]): Map<string, Map<string, ReconciliationDayRow[]>> {
  const acc = new Map<string, Map<string, Map<string, ReconciliationDayRow>>>();
  for (const line of lines) {
    const day = line.day;
    const month = day.slice(0, 7);
    const key = `${line.sku}\u0000${line.model ?? ''}`;
    const days = acc.get(month) ?? new Map<string, Map<string, ReconciliationDayRow>>();
    const rows = days.get(day) ?? new Map<string, ReconciliationDayRow>();
    const row = rows.get(key) ?? {
      sku: line.sku,
      model: line.model,
      quantity: 0,
      billed_gross: 0,
      billed_discount: 0,
      billed_net: 0,
    };
    row.quantity = round6(row.quantity + (line.quantity ?? 0));
    row.billed_gross = round6(row.billed_gross + (line.gross ?? 0));
    row.billed_discount = round6(row.billed_discount + (line.discount ?? 0));
    row.billed_net = round6(row.billed_net + (line.net ?? 0));
    rows.set(key, row);
    days.set(day, rows);
    acc.set(month, days);
  }
  const out = new Map<string, Map<string, ReconciliationDayRow[]>>();
  for (const [month, days] of acc) {
    const sorted = new Map<string, ReconciliationDayRow[]>();
    for (const day of [...days.keys()].sort()) {
      sorted.set(
        day,
        [...days.get(day)!.values()].sort((a, b) => a.sku.localeCompare(b.sku) || (a.model ?? '').localeCompare(b.model ?? ''))
      );
    }
    out.set(month, sorted);
  }
  return out;
}

/** 保存済みの日に新しい日を重ねる。同じ日は新しい方で置き換える (冪等) */
export function mergeDays(
  existing: Record<string, ReconciliationDayRow[]>,
  incoming: ReadonlyMap<string, ReconciliationDayRow[]>
): Record<string, ReconciliationDayRow[]> {
  const merged: Record<string, ReconciliationDayRow[]> = { ...existing };
  for (const [day, rows] of incoming) merged[day] = rows;
  return Object.fromEntries(Object.keys(merged).sort().map((d) => [d, merged[d]]));
}

/** 差と許容差から判定する。請求額 (gross) と計算額は USD */
export function classifyDifference(
  computed: number,
  billedGross: number,
  tolerance: ReconciliationTolerance
): { status: Exclude<ReconciliationStatus, 'unavailable'>; difference: number; percent: number | null } {
  const difference = round6(computed - billedGross);
  const abs = Math.abs(difference);
  const percent = billedGross !== 0 ? round6((abs / Math.abs(billedGross)) * 100) : abs === 0 ? 0 : null;
  if (abs < RECONCILIATION_MATCH_EPSILON_USD) return { status: 'match', difference, percent };
  const overAbsolute = abs > tolerance.absolute_usd;
  const overPercent = percent === null || percent > tolerance.percent;
  return { status: overAbsolute && overPercent ? 'exceeded' : 'within_tolerance', difference, percent };
}

/** 1 か月の突合。請求データ (日) が 1 件も無ければ unavailable (0 円として突合しない) */
export function reconcileMonth(doc: BillingReconciliationMonthDocument): BillingReconciliationReport {
  const dayKeys = Object.keys(doc.days).filter((d) => doc.days[d].length > 0);
  const unit = doc.versions.unit_price_usd;
  const bySku = new Map<string, ReconciliationBreakdownRow>();
  let quantity = 0;
  let gross = 0;
  let discount = 0;
  let net = 0;
  for (const day of dayKeys) {
    for (const row of doc.days[day]) {
      const key = `${row.sku}\u0000${row.model ?? ''}`;
      const b = bySku.get(key) ?? {
        sku: row.sku,
        model: row.model,
        quantity: 0,
        computed_usd: 0,
        billed_gross_usd: 0,
        difference_usd: 0,
      };
      b.quantity = round6(b.quantity + row.quantity);
      b.billed_gross_usd = round6(b.billed_gross_usd + row.billed_gross);
      bySku.set(key, b);
      quantity = round6(quantity + row.quantity);
      gross = round6(gross + row.billed_gross);
      discount = round6(discount + row.billed_discount);
      net = round6(net + row.billed_net);
    }
  }
  const breakdown = [...bySku.values()]
    .map((b) => {
      const computed = round6(b.quantity * unit);
      return { ...b, computed_usd: computed, difference_usd: round6(computed - b.billed_gross_usd) };
    })
    .sort((a, b) => a.sku.localeCompare(b.sku) || (a.model ?? '').localeCompare(b.model ?? ''));

  const base = {
    month: doc.month,
    scope: doc.scope,
    days_covered: dayKeys.length,
    tolerance: doc.tolerance,
    versions: doc.versions,
    breakdown,
  };
  if (dayKeys.length === 0) {
    return {
      ...base,
      status: 'unavailable',
      quantity: 0,
      computed_usd: 0,
      billed_gross_usd: 0,
      billed_discount_usd: 0,
      billed_net_usd: 0,
      difference_usd: null,
      difference_percent: null,
    };
  }
  const computed = round6(quantity * unit);
  const c = classifyDifference(computed, gross, doc.tolerance);
  return {
    ...base,
    status: c.status,
    quantity,
    computed_usd: computed,
    billed_gross_usd: gross,
    billed_discount_usd: discount,
    billed_net_usd: net,
    difference_usd: c.difference,
    difference_percent: c.percent,
  };
}

// ---------------------------------------------------------------------------
// issue 化
// ---------------------------------------------------------------------------

export const RECONCILIATION_ISSUE_LABEL = 'billing-reconciliation';

export function reconciliationMarker(month: string): string {
  return `<!-- billing-reconciliation:${month} -->`;
}

export interface ReconciliationIssueDraft {
  month: string;
  title: string;
  body: string;
  labels: string[];
  marker: string;
}

function fmtUsd(n: number): string {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
}

/**
 * 許容差超過の issue 下書き。請求の総額は載せない。
 * @param redact true (公開リポジトリ) のときは金額・割合も載せず、月・判定・許容差・版だけにする
 */
export function buildIssueDraft(report: BillingReconciliationReport, options: { redact?: boolean } = {}): ReconciliationIssueDraft {
  const marker = reconciliationMarker(report.month);
  const t = report.tolerance;
  const lines = [
    marker,
    '',
    `AI Credits の計算額と Billing API の金額 (gross) の差が許容差を超えました (対象月: ${report.month})。`,
    '',
    '| 項目 | 値 |',
    '| :--- | :--- |',
    `| 判定 | ${report.status} |`,
  ];
  if (!options.redact && report.difference_usd !== null) {
    lines.push(
      `| 差 (計算額 − 請求額) | ${fmtUsd(report.difference_usd)} |`,
      `| 差の割合 | ${report.difference_percent === null ? 'n/a' : `${report.difference_percent.toFixed(2)} %`} |`
    );
  }
  lines.push(
    `| 許容差 | ${fmtUsd(t.absolute_usd)} かつ ${t.percent} % (両方を超えた場合に超過) |`,
    `| 取得済みの日数 | ${report.days_covered} |`,
    `| 単価 (USD / credit) | ${report.versions.unit_price_usd} |`,
    `| 価格カタログの版 | ${report.versions.pricing_catalog_version} |`,
    `| 為替カタログの版 | ${
      report.versions.exchange_rate_catalog
        ? `${report.versions.exchange_rate_catalog.fetched_at} (${report.versions.exchange_rate_catalog.months} か月)`
        : 'なし'
    } |`,
    '',
    options.redact
      ? '公開リポジトリのため、金額と割合はこの issue に載せていません。詳細は `copilot-data` ブランチの `audit/billing-reconciliation/` と `npm run billing:report` で確認してください。'
      : '総額は載せていません。内訳は `copilot-data` ブランチの `audit/billing-reconciliation/` と `npm run billing:report` で確認してください。',
    '',
    '確認のしかた: 単価 (請求設定・価格カタログ) の更新漏れ、割引・調整行、収集窓の欠け (取得済みの日数) を順に確認します。',
    'この issue は同じ月について重複して作られません (閉じても再作成しません)。'
  );
  return {
    month: report.month,
    title: `[Billing reconciliation] ${report.month}: AI Credits の計算額と請求額が許容差を超過`,
    body: lines.join('\n'),
    labels: [RECONCILIATION_ISSUE_LABEL],
    marker,
  };
}
