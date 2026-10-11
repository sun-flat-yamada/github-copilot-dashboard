import { AttributeResolver } from '../collector/attribute-resolver.js';
import { parseCSVRows } from '../utils/csv-parser.js';
import {
  EnrichedUserSeat,
  GroupSummary,
  MonthlyReportAggregatedData,
  MonthlyUsageReportRawRecord,
  ReportCostCenterDailyEntry,
  ReportDailyTrend,
  ReportImportSummary,
  ReportModelBreakdown,
  ReportSkuBreakdown,
  ReportUserDetail,
  UserModelDailyUsage,
  UserUsageProfile,
} from '../types/copilot.js';
import { analyzeHeaders } from './csv-format-profiles.js';
import {
  CSV_IMPORT_REPORT_SCHEMA_VERSION,
  CsvImportReport,
  CsvUnitFamily,
} from '../domain/entities/csv-import.js';
import { UNASSIGNED_LABELS } from '../domain/constants/unassigned.js';
import {
  addUsageRow,
  computeOrgBaseline,
  computeUsageInsight,
  createUserUsageAccumulator,
  UserUsageAccumulator,
} from './usage-insight.js';

const MAX_SKIPPED_SAMPLES = 10;
const UNIT_ORDER: CsvUnitFamily[] = ['requests', 'credits', 'seats', 'tokens', 'other'];

/**
 * 数量 (quantity) の単位の系統。レポートにはリクエスト数・AI クレジット・シート (ユーザー月) 等が
 * 混在するため、単位を区別せずに合算すると意味のない「リクエスト数」になる。
 */
export type UnitFamily = 'requests' | 'credits' | 'seats' | 'tokens' | 'other';

/**
 * unit_type から単位の系統を判定する。
 * unit_type 列が無い CSV は、従来どおり quantity をリクエスト数として扱う (互換)。
 */
export function classifyUnit(unitType?: string): UnitFamily {
  const u = (unitType ?? '').trim().toLowerCase();
  if (!u) return 'requests';
  if (/credit/.test(u)) return 'credits';
  if (/request|prompt|interaction|completion|message|chat/.test(u)) return 'requests';
  if (/seat|licen[sc]e|user|member|month/.test(u)) return 'seats';
  if (/token/.test(u)) return 'tokens';
  return 'other';
}

const hasTokenColumns = (rec: MonthlyUsageReportRawRecord): boolean =>
  [rec.input_tokens, rec.output_tokens, rec.cache_read_tokens, rec.cache_write_tokens, rec.token_count].some(
    (v) => v !== undefined
  );

/**
 * 明細行の単位の系統。unit_type が無い行は従来どおり requests 扱いだが、AI usage report の行
 * (token 列がある) は quantity がリクエスト数とは限らないため 'other' とし、リクエスト数に混ぜない。
 */
export function classifyRecordUnit(rec: MonthlyUsageReportRawRecord): UnitFamily {
  if (!rec.unit_type?.trim() && hasTokenColumns(rec)) return 'other';
  return classifyUnit(rec.unit_type);
}

/** 数値マップの値を丸める (0 の項目は落とす) */
function roundMap(map: Record<string, number>, digits: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(map)) {
    const rounded = Number(value.toFixed(digits));
    if (rounded !== 0) out[key] = rounded;
  }
  return out;
}

/** 数量の単位別集計で使うキー (表記ゆれを小文字・ハイフン区切りに揃える)。unit_type 列が無ければ 'requests' */
function normalizeUnitKey(unitType?: string): string {
  const u = (unitType ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  return u || 'requests';
}

/**
 * モデルの表示名(例: "Claude 3.7 Sonnet")をアプリ全体で使われる正規化ID(例: 'claude-3-7-sonnet')に変換する。
 * ModelRadarView/UserTrendViewer など他画面が参照する既存の固定モデルIDと一致させるための純粋な文字列正規化であり、
 * 値の捏造は行わない。
 */
function slugifyModelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-model';
}

export class ReportParser {
  private resolver: AttributeResolver;

  constructor(resolver?: AttributeResolver) {
    this.resolver = resolver || new AttributeResolver();
  }

  /**
   * RFC 4180 準拠の CSV パース（クォート・カンマ・改行対応）
   */
  public parseCSVRows(csvText: string): string[][] {
    return parseCSVRows(csvText);
  }

  /**
   * 日付文字列を "YYYY-MM-DD" (ゼロ埋め) に正規化する。
   *
   * CSV の日付列はエクスポート元やスプレッドシートでの再編集によって
   * "2026-8-1" (ゼロ埋めなし) や "2026/08/01" (区切り文字違い) のような
   * 表記ゆれを含み得る。これを未正規化のまま文字列比較 (localeCompare) で
   * ソートすると、桁数が揃っていない月/日の値が本来の暦日順とは異なる
   * 位置に並んでしまう (例: 未ゼロ埋めの "8" は "09"/"10"/"11"/"12" の
   * 先頭文字より大きいため、8月のレコードが9月以降より後ろに並ぶ)。
   * 認識できない形式は捏造せず null を返し、呼び出し側でフォールバックさせる。
   */
  private normalizeDateString(raw: string): string | null {
    const trimmed = raw.trim();
    const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!match) return null;

    const [, year, month, day] = match;
    const monthNum = Number(month);
    const dayNum = Number(day);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * 日付文字列同士を実際の暦日として比較する (localeCompare の文字列比較に頼らない)。
   * 両方が解釈可能な日付であれば実時刻で比較し、解釈できない場合のみ
   * 文字列比較にフォールバックする。
   */
  private compareDateStrings(a: string, b: string): number {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (!isNaN(ta) && !isNaN(tb)) return ta - tb;
    return a.localeCompare(b);
  }

  /**
   * CSV テキストから生レコード配列を抽出
   */
  public parseRecords(csvText: string): MonthlyUsageReportRawRecord[] {
    return this.parseRecordsWithReport(csvText).records;
  }

  /**
   * CSV テキストから生レコードと取込レポート (認識した列・未認識の列・スキップした行・単位別合計) を作る。
   * フォーマットを自動判別できない (必須列が無い) ときは、レコードを返さず理由を report.stop_reason に残す。
   */
  public parseRecordsWithReport(
    csvText: string,
    fileName?: string
  ): { records: MonthlyUsageReportRawRecord[]; report: CsvImportReport } {
    const rows = this.parseCSVRows(csvText);
    const report: CsvImportReport = {
      schema_version: CSV_IMPORT_REPORT_SCHEMA_VERSION,
      ...(fileName ? { file_name: fileName } : {}),
      profile: null,
      columns: { recognized: [], unrecognized: [] },
      rows: {
        total: 0,
        imported: 0,
        skipped: 0,
        skipped_by_reason: {},
        skipped_samples: [],
        undated: 0,
        ragged: 0,
        repeated: 0,
      },
      totals_by_unit: [],
      warnings: [],
    };

    if (rows.length < 2) {
      report.stop_reason = rows.length === 0 ? 'ファイルが空です' : 'ヘッダー行のみで、データ行がありません';
      return { records: [], report };
    }

    const analysis = analyzeHeaders(rows[0]);
    report.columns = { recognized: analysis.recognized, unrecognized: analysis.unrecognized };
    if (!analysis.profile) {
      report.stop_reason = analysis.stopReason;
      return { records: [], report };
    }
    report.profile = { id: analysis.profile.id, label: analysis.profile.label };
    const headerMap = analysis.map;
    const headerWidth = rows[0].length;
    const records: MonthlyUsageReportRawRecord[] = [];
    const unitTotals = new Map<CsvUnitFamily, { rows: number; quantity: number | null; gross: number | null; net: number | null }>();
    const seenRows = new Set<string>();
    const skip = (rowNumber: number, reason: string) => {
      report.rows.skipped++;
      report.rows.skipped_by_reason[reason] = (report.rows.skipped_by_reason[reason] ?? 0) + 1;
      if (report.rows.skipped_samples.length < MAX_SKIPPED_SAMPLES) report.rows.skipped_samples.push({ row: rowNumber, reason });
    };

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length === 0 || !row.some((c) => c.length > 0)) continue;
      report.rows.total++;
      if (row.length !== headerWidth) report.rows.ragged++;
      const rowKey = row.join('\u0000');
      if (seenRows.has(rowKey)) report.rows.repeated++;
      else seenRows.add(rowKey);

      // ユーザー名の取得 (必須)
      const username = headerMap.username !== undefined ? row[headerMap.username] : '';
      if (!username) {
        skip(report.rows.total, 'ユーザー名が空');
        continue;
      }

      // 日付の取得 (date または report_time の先頭 YYYY-MM-DD)
      // 表記ゆれは normalizeDateString() で "YYYY-MM-DD" ゼロ埋め形式に正規化する。
      // 正規化できない場合のみ、既存互換のため生の先頭10文字にフォールバックする
      // (値の捏造はしないが、この場合は日付順ソートが崩れ得るため警告を出す)。
      let date = '';
      const rawDateValue =
        headerMap.date !== undefined && row[headerMap.date]
          ? row[headerMap.date]
          : headerMap.report_time !== undefined && row[headerMap.report_time]
            ? row[headerMap.report_time]
            : '';

      if (rawDateValue) {
        const normalized = this.normalizeDateString(rawDateValue);
        if (normalized) {
          date = normalized;
        } else {
          console.warn(
            `⚠️ [ReportParser] Unrecognized date format "${rawDateValue}" at row ${r + 1} — falling back to raw substring. Chronological sort order may be affected.`
          );
          date = rawDateValue.substring(0, 10);
          report.rows.undated++;
        }
      } else {
        // 日付が無い行を「今日」にしない。日付なし (空文字) のまま保持し、集計では合計にのみ含めて
        // 日別推移からは除外する。
        date = '';
        report.rows.undated++;
      }

      // 数値項目の取得とパース
      const parseNum = (idx?: number): number | undefined => {
        if (idx === undefined || !row[idx]) return undefined;
        const val = parseFloat(row[idx].replace(/[^0-9.-]/g, ''));
        return isNaN(val) ? undefined : val;
      };

      // 数量が無い行を 1 件とみなさない (欠損は欠損として扱う)
      const quantity = parseNum(headerMap.quantity);
      const unitCost = parseNum(headerMap.applied_cost_per_quantity);
      let grossAmount = parseNum(headerMap.gross_amount);
      const discountAmount = parseNum(headerMap.discount_amount) ?? 0;
      let netAmount = parseNum(headerMap.net_amount);

      // 金額の補完計算
      if (netAmount === undefined && grossAmount !== undefined) {
        netAmount = Math.max(0, grossAmount - discountAmount);
      } else if (grossAmount === undefined && netAmount !== undefined) {
        grossAmount = netAmount + discountAmount;
      } else if (netAmount === undefined && unitCost !== undefined && quantity !== undefined) {
        grossAmount = (quantity ?? 0) * unitCost;
        netAmount = Math.max(0, grossAmount - discountAmount);
      }

      const record: MonthlyUsageReportRawRecord = {
        date,
        username,
        product: headerMap.product !== undefined ? row[headerMap.product] : 'copilot',
        sku: headerMap.sku !== undefined ? row[headerMap.sku] : 'copilot_usage',
        model: headerMap.model !== undefined ? row[headerMap.model] : undefined,
        quantity,
        unit_type: headerMap.unit_type !== undefined ? row[headerMap.unit_type] : undefined,
        applied_cost_per_quantity: unitCost,
        gross_amount: grossAmount !== undefined ? Number(grossAmount.toFixed(4)) : undefined,
        discount_amount: Number(discountAmount.toFixed(4)),
        net_amount: netAmount !== undefined ? Number(netAmount.toFixed(4)) : 0,
        organization: headerMap.organization !== undefined ? row[headerMap.organization] : undefined,
        cost_center_name: headerMap.cost_center_name !== undefined ? row[headerMap.cost_center_name] : undefined,
        last_activity_at: headerMap.last_activity_at !== undefined ? row[headerMap.last_activity_at] : undefined,
        last_surface_used: headerMap.last_surface_used !== undefined ? row[headerMap.last_surface_used] : undefined,
        ai_credits_consumed: parseNum(headerMap.ai_credits_consumed),
        token_count: parseNum(headerMap.token_count),
        input_tokens: parseNum(headerMap.input_tokens),
        output_tokens: parseNum(headerMap.output_tokens),
        cache_read_tokens: parseNum(headerMap.cache_read_tokens),
        cache_write_tokens: parseNum(headerMap.cache_write_tokens),
      };
      records.push(record);

      // 単位別の合計 (単位の異なる値を合算しない。値が無い行は 0 として足さない)
      const unit = classifyRecordUnit(record);
      const total = unitTotals.get(unit) ?? { rows: 0, quantity: null, gross: null, net: null };
      total.rows++;
      if (quantity !== undefined) total.quantity = (total.quantity ?? 0) + quantity;
      if (grossAmount !== undefined) total.gross = (total.gross ?? 0) + grossAmount;
      if (netAmount !== undefined) total.net = (total.net ?? 0) + netAmount;
      unitTotals.set(unit, total);
    }

    report.rows.imported = records.length;
    report.totals_by_unit = UNIT_ORDER.filter((u) => unitTotals.has(u)).map((unit) => {
      const t = unitTotals.get(unit)!;
      const round = (v: number | null) => (v === null ? null : Number(v.toFixed(4)));
      return { unit, rows: t.rows, quantity: round(t.quantity), gross_usd: round(t.gross), net_usd: round(t.net) };
    });

    if (report.columns.unrecognized.length > 0) {
      report.warnings.push(`未認識の列 ${report.columns.unrecognized.length} 件は集計に使っていません: ${report.columns.unrecognized.join(', ')}`);
    }
    if (report.rows.skipped > 0) report.warnings.push(`${report.rows.skipped} 行をスキップしました`);
    if (report.rows.ragged > 0) report.warnings.push(`列数がヘッダーと異なる行が ${report.rows.ragged} 行あります (列ずれの疑い)`);
    if (report.rows.undated > 0) report.warnings.push(`日付が無い / 解釈できない行が ${report.rows.undated} 行あります (日別推移には載りません)`);
    if (report.rows.repeated > 0) report.warnings.push(`内容が完全に同一の行が ${report.rows.repeated} 行あります (複数明細の可能性があるため残しています)`);
    if (report.totals_by_unit.length > 1) report.warnings.push('単位の異なる明細が混在しています。合計は単位ごとに分けて表示しています');

    return { records, report };
  }

  /**
   * Monthly Usage Report の生レコードから、ユーザー別モデル利用プロファイル(UserUsageProfile[])を構築する。
   *
   * 実データ運用における「ライブAPIでは取得不可能なユーザー別モデル内訳」の代替ソースとして、
   * 既にインポート済みの Monthly Usage Report CSV (date, username, model, quantity, net_amount 等) を
   * 集計する。CSVに存在しない指標 (suggestions/acceptances/lines_suggested/lines_accepted) は
   * 絶対に推測・捏造せず 0 固定とする。
   *
   * @param records parseRecords() で取得した生レコード群（複数月分をまとめて渡してよい）
   * @param seatsByLogin login(小文字)をキーとした EnrichedUserSeat のマップ。渡された場合、
   *   avatar_url / organization / plan_type などシート由来の実データで補完する（任意）。
   */
  public buildUserProfiles(
    records: MonthlyUsageReportRawRecord[],
    seatsByLogin?: Map<string, EnrichedUserSeat>
  ): UserUsageProfile[] {
    if (records.length === 0) return [];

    const byUserByDate = new Map<string, Map<string, UserModelDailyUsage>>();
    const orgByUser = new Map<string, string>();
    const skuByUser = new Map<string, string>();

    for (const rec of records) {
      const login = rec.username;
      // 日付が無い行は日次履歴に載せられない (「今日」と偽らない)
      if (!login || !rec.date) continue;

      const dayMap = byUserByDate.get(login) || new Map<string, UserModelDailyUsage>();
      byUserByDate.set(login, dayMap);

      const day: UserModelDailyUsage = dayMap.get(rec.date) || {
        date: rec.date,
        total_chats: 0,
        model_breakdown: {},
        suggestions: 0,
        acceptances: 0,
        lines_suggested: 0,
        lines_accepted: 0,
        acceptance_rate: 0,
        daily_cost_usd: 0,
      };

      // リクエスト数として数えるのは単位が requests 系の明細だけ (シート行・クレジット行は費用にのみ反映)
      const qty = classifyRecordUnit(rec) === 'requests' ? (rec.quantity ?? 0) : 0;
      const modelKey = slugifyModelName(rec.model || 'unknown-model');
      day.total_chats += qty;
      day.model_breakdown[modelKey] = (day.model_breakdown[modelKey] || 0) + qty;
      day.daily_cost_usd = Number((day.daily_cost_usd + (rec.net_amount || 0)).toFixed(4));
      if (rec.ai_credits_consumed) {
        day.ai_credits_consumed = (day.ai_credits_consumed ?? 0) + rec.ai_credits_consumed;
      }
      const rowTokenTotal = hasTokenColumns(rec)
        ? (rec.input_tokens ?? 0) +
          (rec.output_tokens ?? 0) +
          (rec.cache_read_tokens ?? 0) +
          (rec.cache_write_tokens ?? 0) +
          (rec.token_count ?? 0)
        : 0;
      if (rowTokenTotal) {
        day.token_count = (day.token_count ?? 0) + rowTokenTotal;
      }
      dayMap.set(rec.date, day);

      if (rec.organization) orgByUser.set(login, rec.organization);
      if (rec.sku) skuByUser.set(login, rec.sku);
    }

    const profiles: UserUsageProfile[] = [];
    for (const [login, dayMap] of byUserByDate.entries()) {
      // 実効期間付きマッピングは最終利用日の属性 (異動後の所属) で解決する
      const lastDate = Array.from(dayMap.keys()).sort((a, b) => this.compareDateStrings(a, b)).pop();
      const resolved = this.resolver.resolve(login, lastDate);
      const seat = seatsByLogin?.get(login.toLowerCase());
      const dailyHistory = Array.from(dayMap.values()).sort((a, b) => this.compareDateStrings(a.date, b.date));

      const modelTotals: Record<string, number> = {};
      let totalChats = 0;
      let totalCost = 0;
      for (const d of dailyHistory) {
        totalChats += d.total_chats;
        totalCost += d.daily_cost_usd;
        for (const [model, count] of Object.entries(d.model_breakdown)) {
          modelTotals[model] = (modelTotals[model] || 0) + count;
        }
      }

      const sku = skuByUser.get(login);
      profiles.push({
        login: resolved.login,
        display_name: resolved.displayName,
        avatar_url: seat?.avatar_url || '',
        department: resolved.department,
        cost_center: resolved.costCenterOverride || seat?.cost_center || UNASSIGNED_LABELS.reportCostCenter,
        organization: seat?.organization || orgByUser.get(login) || UNASSIGNED_LABELS.organization,
        plan_type: seat?.plan_type ?? (sku?.includes('enterprise') ? 'enterprise' : 'business'),
        total_chats: totalChats,
        // Monthly Usage Report には suggestions/acceptances 相当の指標が存在しないため捏造せず0固定
        total_suggestions: 0,
        total_acceptances: 0,
        acceptance_rate: 0,
        total_cost_usd: Number(totalCost.toFixed(2)),
        model_usage_totals: modelTotals,
        daily_history: dailyHistory,
        tags: resolved.tags || seat?.tags,
      });
    }

    return profiles;
  }

  /**
   * 複数の CSV (同じ月の複数ファイル) のレコードを 1 つに結合する。
   *
   * 別ファイルに同じ行 (日付・ユーザー・SKU・モデル・数量・金額が同一) が含まれている場合 (同じ
   * エクスポートの再取り込み、期間が重なる分割エクスポート等) は 1 件に集約する。
   * 同一ファイル内の同一行は正当な複数明細の可能性があるため残し、ファイル間では
   * 「各行の出現回数の最大値」を採る (集合和)。
   */
  public mergeRecordSets(
    sets: Array<{ fileName: string; records: MonthlyUsageReportRawRecord[] }>
  ): { records: MonthlyUsageReportRawRecord[]; duplicatesSkipped: number; sourceFiles: string[] } {
    const keptCount = new Map<string, number>();
    const merged: MonthlyUsageReportRawRecord[] = [];
    let duplicatesSkipped = 0;
    const sourceFiles: string[] = [];

    for (const set of sets) {
      sourceFiles.push(set.fileName);

      const rowsByKey = new Map<string, MonthlyUsageReportRawRecord[]>();
      for (const rec of set.records) {
        const key = this.recordKey(rec);
        const rows = rowsByKey.get(key);
        if (rows) rows.push(rec);
        else rowsByKey.set(key, [rec]);
      }

      for (const [key, rows] of rowsByKey) {
        const already = keptCount.get(key) ?? 0;
        if (rows.length > already) {
          merged.push(...rows.slice(already));
          keptCount.set(key, rows.length);
        }
        duplicatesSkipped += Math.min(rows.length, already);
      }
    }

    return { records: merged, duplicatesSkipped, sourceFiles };
  }

  /** 重複検知用の行キー (識別に関わる全フィールド。ユーザー名は大文字小文字を区別しない) */
  private recordKey(rec: MonthlyUsageReportRawRecord): string {
    return JSON.stringify([
      rec.date,
      rec.username?.toLowerCase(),
      rec.product,
      rec.sku,
      rec.model,
      rec.quantity,
      rec.unit_type,
      rec.applied_cost_per_quantity,
      rec.gross_amount,
      rec.discount_amount,
      rec.net_amount,
      rec.organization,
      rec.cost_center_name,
      rec.last_activity_at,
      rec.last_surface_used,
      rec.ai_credits_consumed,
      rec.token_count,
      rec.input_tokens,
      rec.output_tokens,
      rec.cache_read_tokens,
      rec.cache_write_tokens,
    ]);
  }

  /**
   * レコード群から MonthlyReportAggregatedData を生成
   *
   * - 数量は unit_type の系統 (requests / credits / seats …) で区別する。リクエスト数
   *   (total_requests) に数えるのは requests 系の明細だけで、シート行やクレジット行の数量を
   *   リクエスト数に混ぜない。単位別の数量は overview.quantity_by_unit に残す。
   * - レポート CSV には提案数・受諾数・チャット数・PR 要約数が存在しないため、グループ別のこれらの
   *   指標は固定値 (旧: 受諾率 0.35 など) で埋めず null とする。
   */
  public aggregate(
    records: MonthlyUsageReportRawRecord[],
    reportMonth: string,
    fileName: string,
    sourceType: 'persisted' | 'local_drop' = 'persisted',
    importSummary?: Omit<ReportImportSummary, 'undated_records'>
  ): MonthlyReportAggregatedData {
    let totalNetSpend = 0;
    let totalGrossSpend = 0;
    let totalDiscount = 0;
    let totalRequests = 0;
    let undatedRecords = 0;

    const quantityByUnit: Record<string, number> = {};
    const uniqueUsers = new Set<string>();
    const userSummaryMap = new Map<
      string,
      {
        /** CSV 上のユーザー名 (集計キー・属性の解決に使う) */
        login: string;
        /** 出力 (ユーザー別明細) に使うログイン名。匿名化モードでは仮名 */
        outputLogin: string;
        displayName: string;
        department: string;
        costCenter: string;
        organization: string;
        requests: number;
        spendUsd: number;
        grossSpendUsd: number;
        netSpendUsd: number;
        modelCounts: Record<string, number>;
        modelSpend: Record<string, number>;
        modelGross: Record<string, number>;
        lastActivityDate?: string;
        surface?: string;
        usage: UserUsageAccumulator;
      }
    >();

    type GroupAcc = { seats: Set<string>; requests: number; grossSpend: number; netSpend: number };
    const deptMap = new Map<string, GroupAcc>();
    const ccMap = new Map<string, GroupAcc>();
    const orgMap = new Map<string, GroupAcc>();

    const modelMap = new Map<string, { requests: number; spend: number; users: Set<string> }>();
    // SKU は単位ごとに行を分ける (単位の異なる数量を 1 行に合算しない)
    const skuMap = new Map<string, { sku: string; quantity: number; spend: number; unitType: string }>();
    const dailyMap = new Map<string, { requests: number; spend: number; users: Set<string>; credits: number }>();

    // Cost Center × 日付の利用費用 (gross)。日付の無いレコードは時系列に載せない
    const ccDailyMap = new Map<string, Map<string, number>>();

    let skippedOutOfMonth = 0;

    for (const rec of records) {
      // reportMonth (YYYY-MM) に属さないレコードは除外する。
      // 呼び出し元 (例: ReportDropzoneModal の月自動推測) が複数月にまたがる
      // CSV をそのまま渡した場合、前月分のレコードが当月レポートの
      // daily_trends / 集計値に混入し、月内トレンドの意味が壊れるのを防ぐ。
      // 値の捏造はせず、対象外レコードは黙って集計から除外するのみ。
      if (rec.date && !rec.date.startsWith(reportMonth)) {
        skippedOutOfMonth++;
        continue;
      }
      if (!rec.date) undatedRecords++;

      const login = rec.username;
      uniqueUsers.add(login);

      const netSpend = rec.net_amount || 0;
      const grossSpend = rec.gross_amount ?? netSpend;
      const discount = rec.discount_amount || 0;

      // 数量: 単位別に集計し、リクエスト数に数えるのは requests 系の単位だけ。数量が無い行は 0 (1 件とみなさない)
      const quantity = rec.quantity ?? 0;
      const unitKey = normalizeUnitKey(rec.unit_type);
      if (rec.quantity !== undefined) {
        quantityByUnit[unitKey] = (quantityByUnit[unitKey] || 0) + quantity;
      }
      const unitFamily = classifyRecordUnit(rec);
      const reqCount = unitFamily === 'requests' ? quantity : 0;

      totalNetSpend += netSpend;
      totalGrossSpend += grossSpend;
      totalDiscount += discount;
      totalRequests += reqCount;

      // 属性解決 (Department, CostCenter, etc.)
      // 属性はレコードの日付時点の実効属性で解決する (異動月は日付で部署・Cost Center が分かれる)。
      // 日付が無いレコードは対象月の月末時点
      const resolved = this.resolver.resolve(login, rec.date || reportMonth);
      const department = resolved.department || UNASSIGNED_LABELS.department;
      const costCenter = resolved.costCenterOverride || rec.cost_center_name || UNASSIGNED_LABELS.reportCostCenter;
      const organization = rec.organization || UNASSIGNED_LABELS.organization;
      const model = rec.model || 'Standard Completion';
      const sku = rec.sku || 'copilot_standard';

      // ユーザー集計
      let userStat = userSummaryMap.get(login);
      if (!userStat) {
        userStat = {
          login,
          outputLogin: resolved.login,
          displayName: resolved.displayName,
          department,
          costCenter,
          organization,
          requests: 0,
          spendUsd: 0,
          grossSpendUsd: 0,
          netSpendUsd: 0,
          modelCounts: {},
          modelSpend: {},
          modelGross: {},
          lastActivityDate: rec.date || rec.last_activity_at?.substring(0, 10),
          surface: rec.last_surface_used,
          usage: createUserUsageAccumulator(),
        };
        userSummaryMap.set(login, userStat);
      }
      // 使用量・トークン・単価の算出用 (シート行など requests でも credits でもない行は費用にのみ含まれる)
      const rowCredits = rec.ai_credits_consumed ?? (unitFamily === 'credits' ? rec.quantity : undefined);
      addUsageRow(userStat.usage, {
        date: rec.date,
        model: rec.model,
        requests: reqCount,
        isRequestRow: unitFamily === 'requests' && rec.quantity !== undefined,
        credits: rowCredits,
        isCreditRow: rowCredits !== undefined,
        gross: grossSpend,
        input: rec.input_tokens,
        output: rec.output_tokens,
        cacheRead: rec.cache_read_tokens,
        cacheWrite: rec.cache_write_tokens,
        tokenTotal: rec.token_count,
      });
      userStat.requests += reqCount;
      userStat.spendUsd += grossSpend;
      userStat.grossSpendUsd += grossSpend;
      userStat.netSpendUsd += netSpend;
      userStat.modelCounts[model] = (userStat.modelCounts[model] || 0) + reqCount;
      userStat.modelSpend[model] = (userStat.modelSpend[model] || 0) + netSpend;
      userStat.modelGross[model] = (userStat.modelGross[model] || 0) + grossSpend;
      if (rec.date && (!userStat.lastActivityDate || rec.date > userStat.lastActivityDate)) {
        userStat.lastActivityDate = rec.date;
        // ユーザー別の属性は最新の利用日の実効属性にそろえる (集計軸の配賦はレコード単位で既に分かれている)
        userStat.outputLogin = resolved.login;
        userStat.displayName = resolved.displayName;
        userStat.department = department;
        userStat.costCenter = costCenter;
      }
      if (rec.last_surface_used) {
        userStat.surface = rec.last_surface_used;
      }

      // 3軸集計 (Department / Cost Center / Organization)
      const accumulate = (map: Map<string, GroupAcc>, key: string) => {
        let acc = map.get(key);
        if (!acc) {
          acc = { seats: new Set(), requests: 0, grossSpend: 0, netSpend: 0 };
          map.set(key, acc);
        }
        acc.seats.add(login);
        acc.requests += reqCount;
        acc.grossSpend += grossSpend;
        acc.netSpend += netSpend;
      };
      accumulate(deptMap, department);
      accumulate(ccMap, costCenter);
      if (rec.date) {
        let byDate = ccDailyMap.get(costCenter);
        if (!byDate) {
          byDate = new Map();
          ccDailyMap.set(costCenter, byDate);
        }
        byDate.set(rec.date, (byDate.get(rec.date) || 0) + grossSpend);
      }
      accumulate(orgMap, organization);

      // モデル別集計
      let mStat = modelMap.get(model);
      if (!mStat) {
        mStat = { requests: 0, spend: 0, users: new Set() };
        modelMap.set(model, mStat);
      }
      mStat.requests += reqCount;
      mStat.spend += netSpend;
      mStat.users.add(login);

      // SKU別集計 (SKU × 単位)
      const skuKey = `${sku}\u0000${unitKey}`;
      let sStat = skuMap.get(skuKey);
      if (!sStat) {
        sStat = { sku, quantity: 0, spend: 0, unitType: rec.unit_type?.trim() || 'requests' };
        skuMap.set(skuKey, sStat);
      }
      sStat.quantity += quantity;
      sStat.spend += netSpend;

      // 日別推移 (日付が無い行は推移に載せない)
      const dayKey = rec.date;
      if (dayKey) {
        let dayStat = dailyMap.get(dayKey);
        if (!dayStat) {
          dayStat = { requests: 0, spend: 0, users: new Set(), credits: 0 };
          dailyMap.set(dayKey, dayStat);
        }
        dayStat.requests += reqCount;
        dayStat.spend += netSpend;
        dayStat.users.add(login);
        if (rowCredits !== undefined) {
          dayStat.credits += rowCredits;
        }
      }
    }

    if (skippedOutOfMonth > 0) {
      console.warn(
        `⚠️ [ReportParser] Skipped ${skippedOutOfMonth} record(s) whose date falls outside reportMonth "${reportMonth}" (file: ${fileName}).`
      );
    }

    // グループサマリーへの変換ヘルパー。
    // 受諾率・提案数・受諾数・チャット数・PR 要約数はレポート CSV に存在しないため null (推定もしない)。
    const buildGroupSummaries = (map: Map<string, GroupAcc>): Record<string, GroupSummary> => {
      const res: Record<string, GroupSummary> = {};
      map.forEach((val, name) => {
        const count = val.seats.size;
        res[name] = {
          group_name: name,
          total_seats: count,
          active_seats: count,
          idle_seats: 0,
          total_cost_usd: Number(val.grossSpend.toFixed(2)),
          net_cost_usd: Number(val.netSpend.toFixed(2)),
          potential_savings_usd: 0,
          active_ratio: 1.0,
          acceptance_rate: null,
          total_suggestions: null,
          total_acceptances: null,
          total_chats: null,
          total_pr_summaries: null,
          total_requests: val.requests,
        };
      });
      return res;
    };

    // モデル内訳リストの生成 (割合はリクエスト数ベース。リクエスト数が無い場合は費用ベース)
    const modelBreakdown: ReportModelBreakdown[] = Array.from(modelMap.entries())
      .map(([name, stat]) => ({
        model_name: name,
        total_requests: stat.requests,
        total_spend_usd: Number(stat.spend.toFixed(2)),
        active_users: stat.users.size,
        percentage:
          totalRequests > 0
            ? Number(((stat.requests / totalRequests) * 100).toFixed(1))
            : totalNetSpend > 0
            ? Number(((stat.spend / totalNetSpend) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.total_requests - a.total_requests || b.total_spend_usd - a.total_spend_usd);

    // SKU内訳リストの生成
    const skuBreakdown: ReportSkuBreakdown[] = Array.from(skuMap.values())
      .map((stat) => ({
        sku_name: stat.sku,
        total_quantity: stat.quantity,
        unit_type: stat.unitType,
        total_spend_usd: Number(stat.spend.toFixed(2)),
        percentage: totalNetSpend > 0 ? Number(((stat.spend / totalNetSpend) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total_spend_usd - a.total_spend_usd);

    // 日別トレンドの生成
    const dailyTrends: ReportDailyTrend[] = Array.from(dailyMap.entries())
      .map(([date, stat]) => ({
        date,
        requests: stat.requests,
        spend_usd: Number(stat.spend.toFixed(2)),
        active_users: stat.users.size,
        credits: Number(stat.credits.toFixed(2)),
      }))
      .sort((a, b) => this.compareDateStrings(a.date, b.date));

    const costCenterDaily: Record<string, ReportCostCenterDailyEntry[]> = {};
    ccDailyMap.forEach((byDate, name) => {
      costCenterDaily[name] = Array.from(byDate.entries())
        .map(([date, spend]) => ({ date, spend_usd: Number(spend.toFixed(4)) }))
        .sort((a, b) => this.compareDateStrings(a.date, b.date));
    });

    // 使用量・兆候の組織基準は全ユーザーから作る (表示のフィルターで基準が動かないようにする)
    const orgBaseline = computeOrgBaseline(Array.from(userSummaryMap.values(), (u) => u.usage));

    // ユーザー別明細リストの生成
    const userDetails: ReportUserDetail[] = Array.from(userSummaryMap.values())
      .map((u) => {
        // 主要モデルを特定 (リクエスト数が最大のモデル。リクエスト数が無い場合は費用が最大のモデル)
        const modelNames = Object.keys(u.modelCounts);
        modelNames.sort(
          (a, b) =>
            (u.modelCounts[b] || 0) - (u.modelCounts[a] || 0) || (u.modelSpend[b] || 0) - (u.modelSpend[a] || 0)
        );
        const topM = modelNames[0] ?? 'None';

        return {
          // 匿名化モードでは仮名のログイン名を出力する (CSV 上の実ユーザー名を成果物に残さない)
          login: u.outputLogin,
          display_name: u.displayName,
          department: u.department,
          cost_center: u.costCenter,
          organization: u.organization,
          total_requests: u.requests,
          total_spend_usd: Number(u.grossSpendUsd.toFixed(2)),
          gross_spend_usd: Number(u.grossSpendUsd.toFixed(2)),
          net_spend_usd: Number(u.netSpendUsd.toFixed(2)),
          primary_model: topM,
          // フィルター後のモデル別内訳を正確に再集計できるよう、ユーザー別のモデル内訳を保持する
          model_requests: roundMap(u.modelCounts, 2),
          model_spend_usd: roundMap(u.modelSpend, 4),
          model_gross_usd: roundMap(u.modelGross, 4),
          last_activity_date: u.lastActivityDate,
          // 実データが無い場合に既定のサーフェス (VS Code) を捏造しない
          surface: u.surface,
          tags: this.resolver.resolve(u.login, u.lastActivityDate).tags,
          usage_insight: computeUsageInsight(u.usage, orgBaseline),
        };
      })
      .sort((a, b) => b.total_spend_usd - a.total_spend_usd);

    return {
      report_month: reportMonth,
      source_type: sourceType,
      file_name: fileName,
      parsed_at: new Date().toISOString(),
      overview: {
        total_net_spend_usd: Number(totalNetSpend.toFixed(2)),
        total_gross_spend_usd: Number(totalGrossSpend.toFixed(2)),
        total_discount_usd: Number(totalDiscount.toFixed(2)),
        total_requests: totalRequests,
        quantity_by_unit: quantityByUnit,
        total_active_users: uniqueUsers.size,
        top_model: modelBreakdown[0]?.model_name || 'N/A',
        top_sku: skuBreakdown[0]?.sku_name || 'N/A',
      },
      by_department: buildGroupSummaries(deptMap),
      by_cost_center: buildGroupSummaries(ccMap),
      by_organization: buildGroupSummaries(orgMap),
      model_breakdown: modelBreakdown,
      sku_breakdown: skuBreakdown,
      daily_trends: dailyTrends,
      ...(ccDailyMap.size > 0 ? { cost_center_daily: costCenterDaily } : {}),
      user_details: userDetails,
      ...(importSummary
        ? { import_summary: { ...importSummary, ...(undatedRecords > 0 ? { undated_records: undatedRecords } : {}) } }
        : undatedRecords > 0
        ? { import_summary: { source_files: [fileName], records_total: records.length, duplicates_skipped: 0, undated_records: undatedRecords } }
        : {}),
    };
  }
}
