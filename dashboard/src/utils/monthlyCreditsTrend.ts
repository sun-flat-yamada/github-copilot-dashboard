import type {
  MonthlyReportAggregatedData,
  ReportDailyTrend,
} from '../../../src/types/copilot';

export interface DailyCreditsTrendPoint {
  date: string;
  dailyCredits: number;
  cumulativeCredits: number;
  dailySpendUsd: number;
  cumulativeSpendUsd: number;
  activeUsers: number;
}

export interface MonthlyCreditsTrendPoint {
  month: string;
  totalCredits: number;
  totalSpendUsd: number;
  activeUsers: number;
  dailyTrends: DailyCreditsTrendPoint[];
  momCreditsDelta: number | null;
  momCreditsRate: number | null;
  isEstimatedFromSpend: boolean;
}

/**
 * MonthlyReportAggregatedData から月次の AI Credit 消費総量を安全に算出する。
 * 1. overview.quantity_by_unit (credits / ai-credits)
 * 2. sku_breakdown (copilot_ai_credit または unit_type に credit を含むもの)
 * 3. daily_trends の credits 合計
 * 4. (フォールバック) 金額換算 (1 AI Credit = $0.01 => spend * 100)
 */
export function extractTotalAiCredits(report: MonthlyReportAggregatedData): {
  totalCredits: number;
  isEstimatedFromSpend: boolean;
} {
  const byUnit = report.overview.quantity_by_unit;
  if (byUnit) {
    const directCredit = byUnit['credits'] ?? byUnit['ai-credits'] ?? byUnit['credit'];
    if (typeof directCredit === 'number' && directCredit > 0) {
      return { totalCredits: directCredit, isEstimatedFromSpend: false };
    }
  }

  // sku_breakdown からの合算
  if (report.sku_breakdown && report.sku_breakdown.length > 0) {
    const skuCredits = report.sku_breakdown
      .filter(
        (s) =>
          s.sku_name.toLowerCase().includes('credit') ||
          s.unit_type.toLowerCase().includes('credit')
      )
      .reduce((sum, s) => sum + s.total_quantity, 0);
    if (skuCredits > 0) {
      return { totalCredits: skuCredits, isEstimatedFromSpend: false };
    }
  }

  // daily_trends からの合算
  if (report.daily_trends && report.daily_trends.length > 0) {
    const dailyCreditSum = report.daily_trends.reduce(
      (sum, d) => sum + (d.credits ?? 0),
      0
    );
    if (dailyCreditSum > 0) {
      return { totalCredits: Number(dailyCreditSum.toFixed(2)), isEstimatedFromSpend: false };
    }
  }

  // user_details の usage_insight からの合算
  if (report.user_details && report.user_details.length > 0) {
    const userCreditSum = report.user_details.reduce(
      (sum, u) => sum + (u.usage_insight?.usage.credits ?? 0),
      0
    );
    if (userCreditSum > 0) {
      return { totalCredits: Number(userCreditSum.toFixed(2)), isEstimatedFromSpend: false };
    }
  }

  // フォールバック: 金額換算 (1 AI Credit = $0.01)
  const spend = report.overview.total_gross_spend_usd || report.overview.total_net_spend_usd || 0;
  if (spend > 0) {
    return {
      totalCredits: Math.round(spend * 100),
      isEstimatedFromSpend: true,
    };
  }

  return { totalCredits: 0, isEstimatedFromSpend: false };
}

/**
 * 日別トレンドから、日次クレジット消費量および日別累積消費総量の推移を計算する。
 */
export function calculateDailyCreditsProgression(
  dailyTrends: ReportDailyTrend[],
  isEstimatedMonth: boolean
): DailyCreditsTrendPoint[] {
  if (!dailyTrends || dailyTrends.length === 0) return [];

  const sorted = [...dailyTrends].sort((a, b) => a.date.localeCompare(b.date));
  let runningCredits = 0;
  let runningSpend = 0;

  return sorted.map((d) => {
    let dayCredit = d.credits ?? 0;
    if (dayCredit === 0 && isEstimatedMonth && d.spend_usd > 0) {
      dayCredit = Math.round(d.spend_usd * 100);
    }
    runningCredits += dayCredit;
    runningSpend += d.spend_usd || 0;

    return {
      date: d.date,
      dailyCredits: Number(dayCredit.toFixed(2)),
      cumulativeCredits: Number(runningCredits.toFixed(2)),
      dailySpendUsd: Number((d.spend_usd || 0).toFixed(2)),
      cumulativeSpendUsd: Number(runningSpend.toFixed(2)),
      activeUsers: d.active_users || 0,
    };
  });
}

/**
 * 複数の MonthlyReportAggregatedData を時系列順に並べ、前月比を付与した推移データを作成する。
 */
export function buildMonthlyCreditsTrend(
  reports: MonthlyReportAggregatedData[]
): MonthlyCreditsTrendPoint[] {
  const sortedReports = [...reports].sort((a, b) =>
    a.report_month.localeCompare(b.report_month)
  );

  let prevCredits: number | null = null;

  return sortedReports.map((report) => {
    const { totalCredits, isEstimatedFromSpend } = extractTotalAiCredits(report);
    const dailyProgression = calculateDailyCreditsProgression(
      report.daily_trends,
      isEstimatedFromSpend
    );

    let momCreditsDelta: number | null = null;
    let momCreditsRate: number | null = null;

    if (prevCredits !== null) {
      momCreditsDelta = totalCredits - prevCredits;
      momCreditsRate =
        prevCredits > 0
          ? Number(((momCreditsDelta / prevCredits) * 100).toFixed(1))
          : null;
    }

    prevCredits = totalCredits;

    return {
      month: report.report_month,
      totalCredits,
      totalSpendUsd: report.overview.total_gross_spend_usd || report.overview.total_net_spend_usd || 0,
      activeUsers: report.overview.total_active_users || 0,
      dailyTrends: dailyProgression,
      momCreditsDelta,
      momCreditsRate,
      isEstimatedFromSpend,
    };
  });
}

/**
 * 指定した月範囲 (startMonth 〜 endMonth) で推移データを切り出す。
 */
export function filterCreditsTrendByRange(
  points: MonthlyCreditsTrendPoint[],
  startMonth?: string,
  endMonth?: string
): MonthlyCreditsTrendPoint[] {
  return points.filter((p) => {
    if (startMonth && p.month < startMonth) return false;
    if (endMonth && p.month > endMonth) return false;
    return true;
  });
}
