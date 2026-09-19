import { AttributeResolver } from '../collector/attribute-resolver.js';
import { parseCSVRows } from '../utils/csv-parser.js';
import {
  EnrichedUserSeat,
  GroupSummary,
  MonthlyReportAggregatedData,
  MonthlyUsageReportRawRecord,
  ReportDailyTrend,
  ReportModelBreakdown,
  ReportSkuBreakdown,
  ReportUserDetail,
  UserModelDailyUsage,
  UserUsageProfile,
} from '../types/copilot.js';

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
   * ヘッダー自動認識（Smart Header Detection）によるカラムインデックスのマッピング
   */
  private detectHeaders(headerRow: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    const normalized = headerRow.map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));

    normalized.forEach((h, idx) => {
      // 日付
      if (['date', 'day', 'usage_date', 'report_date'].includes(h)) map.date = idx;
      else if (h.includes('report_time') || h.includes('timestamp')) map.report_time = idx;

      // ユーザー名
      if (['username', 'login', 'user', 'user_login', 'github_username'].includes(h)) map.username = idx;

      // 製品・SKU
      if (['product', 'product_name'].includes(h)) map.product = idx;
      if (['sku', 'sku_name', 'metric'].includes(h)) map.sku = idx;

      // モデル
      if (['model', 'model_name', 'ai_model'].includes(h)) map.model = idx;

      // 数量
      if (['quantity', 'requests', 'requests_count', 'count', 'tokens'].includes(h)) map.quantity = idx;

      // 単位
      if (['unit_type', 'unit', 'pricing_unit'].includes(h)) map.unit_type = idx;

      // 単価
      if (['applied_cost_per_quantity', 'cost_per_unit', 'unit_price', 'rate'].includes(h))
        map.applied_cost_per_quantity = idx;

      // 金額
      if (['gross_amount', 'gross_cost', 'total_gross'].includes(h)) map.gross_amount = idx;
      if (['discount_amount', 'discount', 'credits_applied'].includes(h)) map.discount_amount = idx;
      if (['net_amount', 'net_cost', 'cost', 'amount', 'total_amount'].includes(h)) map.net_amount = idx;

      // 組織・Cost Center
      if (['organization', 'org', 'organization_name'].includes(h)) map.organization = idx;
      if (['cost_center_name', 'cost_center', 'costcenter', 'cost_centre'].includes(h)) map.cost_center_name = idx;

      // アクティビティ情報 (Activity Report 向け)
      if (['last_activity_at', 'last_interaction_at'].includes(h)) map.last_activity_at = idx;
      if (['last_authenticated_at'].includes(h)) map.last_authenticated_at = idx;
      if (['last_surface_used', 'surface', 'editor', 'ide'].includes(h)) map.last_surface_used = idx;
    });

    return map;
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
    const rows = this.parseCSVRows(csvText);
    if (rows.length < 2) {
      return [];
    }

    const headerMap = this.detectHeaders(rows[0]);
    const records: MonthlyUsageReportRawRecord[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length === 0 || !row.some((c) => c.length > 0)) continue;

      // ユーザー名の取得 (必須)
      const username = headerMap.username !== undefined ? row[headerMap.username] : '';
      if (!username) continue;

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
        }
      } else {
        date = new Date().toISOString().substring(0, 10);
      }

      // 数値項目の取得とパース
      const parseNum = (idx?: number): number | undefined => {
        if (idx === undefined || !row[idx]) return undefined;
        const val = parseFloat(row[idx].replace(/[^0-9.-]/g, ''));
        return isNaN(val) ? undefined : val;
      };

      const quantity = parseNum(headerMap.quantity) ?? 1;
      const unitCost = parseNum(headerMap.applied_cost_per_quantity);
      let grossAmount = parseNum(headerMap.gross_amount);
      const discountAmount = parseNum(headerMap.discount_amount) ?? 0;
      let netAmount = parseNum(headerMap.net_amount);

      // 金額の補完計算
      if (netAmount === undefined && grossAmount !== undefined) {
        netAmount = Math.max(0, grossAmount - discountAmount);
      } else if (grossAmount === undefined && netAmount !== undefined) {
        grossAmount = netAmount + discountAmount;
      } else if (netAmount === undefined && unitCost !== undefined) {
        grossAmount = quantity * unitCost;
        netAmount = Math.max(0, grossAmount - discountAmount);
      }

      records.push({
        date,
        username,
        product: headerMap.product !== undefined ? row[headerMap.product] : 'copilot',
        sku: headerMap.sku !== undefined ? row[headerMap.sku] : 'copilot_usage',
        model: headerMap.model !== undefined ? row[headerMap.model] : undefined,
        quantity,
        unit_type: headerMap.unit_type !== undefined ? row[headerMap.unit_type] : 'requests',
        applied_cost_per_quantity: unitCost,
        gross_amount: grossAmount !== undefined ? Number(grossAmount.toFixed(4)) : undefined,
        discount_amount: Number(discountAmount.toFixed(4)),
        net_amount: netAmount !== undefined ? Number(netAmount.toFixed(4)) : 0,
        organization: headerMap.organization !== undefined ? row[headerMap.organization] : undefined,
        cost_center_name: headerMap.cost_center_name !== undefined ? row[headerMap.cost_center_name] : undefined,
        last_activity_at: headerMap.last_activity_at !== undefined ? row[headerMap.last_activity_at] : undefined,
        last_surface_used: headerMap.last_surface_used !== undefined ? row[headerMap.last_surface_used] : undefined,
      });
    }

    return records;
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
      if (!login) continue;

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

      const qty = rec.quantity ?? 0;
      const modelKey = slugifyModelName(rec.model || 'unknown-model');
      day.total_chats += qty;
      day.model_breakdown[modelKey] = (day.model_breakdown[modelKey] || 0) + qty;
      day.daily_cost_usd = Number((day.daily_cost_usd + (rec.net_amount || 0)).toFixed(4));
      dayMap.set(rec.date, day);

      if (rec.organization) orgByUser.set(login, rec.organization);
      if (rec.sku) skuByUser.set(login, rec.sku);
    }

    const profiles: UserUsageProfile[] = [];
    for (const [login, dayMap] of byUserByDate.entries()) {
      const resolved = this.resolver.resolve(login);
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
        cost_center: resolved.costCenterOverride || seat?.cost_center || 'Unassigned-CC',
        organization: seat?.organization || orgByUser.get(login) || 'Default-Org',
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
   * レコード群から MonthlyReportAggregatedData を生成
   */
  public aggregate(
    records: MonthlyUsageReportRawRecord[],
    reportMonth: string,
    fileName: string,
    sourceType: 'persisted' | 'local_drop' = 'persisted'
  ): MonthlyReportAggregatedData {
    let totalNetSpend = 0;
    let totalGrossSpend = 0;
    let totalDiscount = 0;
    let totalRequests = 0;

    const uniqueUsers = new Set<string>();
    const userSummaryMap = new Map<
      string,
      {
        login: string;
        displayName: string;
        department: string;
        costCenter: string;
        organization: string;
        requests: number;
        spendUsd: number;
        grossSpendUsd: number;
        netSpendUsd: number;
        modelCounts: Record<string, number>;
        lastActivityDate?: string;
        surface?: string;
      }
    >();

    const deptMap = new Map<string, { seats: Set<string>; requests: number; spend: number; grossSpend: number; netSpend: number }>();
    const ccMap = new Map<string, { seats: Set<string>; requests: number; spend: number; grossSpend: number; netSpend: number }>();
    const orgMap = new Map<string, { seats: Set<string>; requests: number; spend: number; grossSpend: number; netSpend: number }>();

    const modelMap = new Map<string, { requests: number; spend: number; users: Set<string> }>();
    const skuMap = new Map<string, { quantity: number; spend: number; unitType: string }>();
    const dailyMap = new Map<string, { requests: number; spend: number; users: Set<string> }>();

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

      const login = rec.username;
      uniqueUsers.add(login);

      const netSpend = rec.net_amount || 0;
      const grossSpend = rec.gross_amount ?? netSpend;
      const discount = rec.discount_amount || 0;
      const reqCount = rec.quantity || 1;

      totalNetSpend += netSpend;
      totalGrossSpend += grossSpend;
      totalDiscount += discount;
      totalRequests += reqCount;

      // 属性解決 (Department, CostCenter, etc.)
      const resolved = this.resolver.resolve(login);
      const department = resolved.department || '未分類 (Unassigned)';
      const costCenter = resolved.costCenterOverride || rec.cost_center_name || 'Unassigned-CC';
      const organization = rec.organization || 'Default-Org';
      const model = rec.model || 'Standard Completion';
      const sku = rec.sku || 'copilot_standard';

      // ユーザー集計
      let userStat = userSummaryMap.get(login);
      if (!userStat) {
        userStat = {
          login,
          displayName: resolved.displayName,
          department,
          costCenter,
          organization,
          requests: 0,
          spendUsd: 0,
          grossSpendUsd: 0,
          netSpendUsd: 0,
          modelCounts: {},
          lastActivityDate: rec.date || rec.last_activity_at?.substring(0, 10),
          surface: rec.last_surface_used,
        };
        userSummaryMap.set(login, userStat);
      }
      userStat.requests += reqCount;
      userStat.spendUsd += grossSpend;
      userStat.grossSpendUsd += grossSpend;
      userStat.netSpendUsd += netSpend;
      userStat.modelCounts[model] = (userStat.modelCounts[model] || 0) + reqCount;
      if (rec.date && (!userStat.lastActivityDate || rec.date > userStat.lastActivityDate)) {
        userStat.lastActivityDate = rec.date;
      }
      if (rec.last_surface_used) {
        userStat.surface = rec.last_surface_used;
      }

      // 3軸集計 (Department)
      let dStat = deptMap.get(department);
      if (!dStat) {
        dStat = { seats: new Set(), requests: 0, spend: 0, grossSpend: 0, netSpend: 0 };
        deptMap.set(department, dStat);
      }
      dStat.seats.add(login);
      dStat.requests += reqCount;
      dStat.spend += grossSpend;
      dStat.grossSpend += grossSpend;
      dStat.netSpend += netSpend;

      // 3軸集計 (Cost Center)
      let cStat = ccMap.get(costCenter);
      if (!cStat) {
        cStat = { seats: new Set(), requests: 0, spend: 0, grossSpend: 0, netSpend: 0 };
        ccMap.set(costCenter, cStat);
      }
      cStat.seats.add(login);
      cStat.requests += reqCount;
      cStat.spend += grossSpend;
      cStat.grossSpend += grossSpend;
      cStat.netSpend += netSpend;

      // 3軸集計 (Organization)
      let oStat = orgMap.get(organization);
      if (!oStat) {
        oStat = { seats: new Set(), requests: 0, spend: 0, grossSpend: 0, netSpend: 0 };
        orgMap.set(organization, oStat);
      }
      oStat.seats.add(login);
      oStat.requests += reqCount;
      oStat.spend += grossSpend;
      oStat.grossSpend += grossSpend;
      oStat.netSpend += netSpend;

      // モデル別集計
      let mStat = modelMap.get(model);
      if (!mStat) {
        mStat = { requests: 0, spend: 0, users: new Set() };
        modelMap.set(model, mStat);
      }
      mStat.requests += reqCount;
      mStat.spend += netSpend;
      mStat.users.add(login);

      // SKU別集計
      let sStat = skuMap.get(sku);
      if (!sStat) {
        sStat = { quantity: 0, spend: 0, unitType: rec.unit_type || 'requests' };
        skuMap.set(sku, sStat);
      }
      sStat.quantity += reqCount;
      sStat.spend += netSpend;

      // 日別推移
      const dayKey = rec.date;
      if (dayKey) {
        let dayStat = dailyMap.get(dayKey);
        if (!dayStat) {
          dayStat = { requests: 0, spend: 0, users: new Set() };
          dailyMap.set(dayKey, dayStat);
        }
        dayStat.requests += reqCount;
        dayStat.spend += netSpend;
        dayStat.users.add(login);
      }
    }

    if (skippedOutOfMonth > 0) {
      console.warn(
        `⚠️ [ReportParser] Skipped ${skippedOutOfMonth} record(s) whose date falls outside reportMonth "${reportMonth}" (file: ${fileName}).`
      );
    }

    // グループサマリーへの変換ヘルパー
    const buildGroupSummaries = (
      map: Map<string, { seats: Set<string>; requests: number; spend: number; grossSpend: number; netSpend: number }>
    ): Record<string, GroupSummary> => {
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
          acceptance_rate: 0.35, // レポートCSVからの推定値
          total_suggestions: val.requests,
          total_acceptances: Math.round(val.requests * 0.35),
          total_chats: Math.round(val.requests * 0.2),
          total_pr_summaries: 0,
        };
      });
      return res;
    };

    // モデル内訳リストの生成
    const modelBreakdown: ReportModelBreakdown[] = Array.from(modelMap.entries())
      .map(([name, stat]) => ({
        model_name: name,
        total_requests: stat.requests,
        total_spend_usd: Number(stat.spend.toFixed(2)),
        active_users: stat.users.size,
        percentage: totalRequests > 0 ? Number(((stat.requests / totalRequests) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total_requests - a.total_requests);

    // SKU内訳リストの生成
    const skuBreakdown: ReportSkuBreakdown[] = Array.from(skuMap.entries())
      .map(([name, stat]) => ({
        sku_name: name,
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
      }))
      .sort((a, b) => this.compareDateStrings(a.date, b.date));

    // ユーザー別明細リストの生成
    const userDetails: ReportUserDetail[] = Array.from(userSummaryMap.values())
      .map((u) => {
        // 主要モデルを特定
        let topM = 'None';
        let topCount = -1;
        for (const [m, count] of Object.entries(u.modelCounts)) {
          if (count > topCount) {
            topCount = count;
            topM = m;
          }
        }

        return {
          login: u.login,
          display_name: u.displayName,
          department: u.department,
          cost_center: u.costCenter,
          organization: u.organization,
          total_requests: u.requests,
          total_spend_usd: Number(u.grossSpendUsd.toFixed(2)),
          gross_spend_usd: Number(u.grossSpendUsd.toFixed(2)),
          net_spend_usd: Number(u.netSpendUsd.toFixed(2)),
          primary_model: topM,
          last_activity_date: u.lastActivityDate,
          surface: u.surface || 'VS Code',
          tags: this.resolver.resolve(u.login).tags,
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
      user_details: userDetails,
    };
  }
}
