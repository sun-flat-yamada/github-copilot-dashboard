import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  extractTotalAiCredits,
  calculateDailyCreditsProgression,
  buildMonthlyCreditsTrend,
  filterCreditsTrendByRange,
} from '../../dashboard/src/utils/monthlyCreditsTrend.js';
import type { MonthlyReportAggregatedData, ReportDailyTrend } from '../types/copilot.js';

describe('Monthly AI Credits Trend Feature Tests', () => {
  const createMockReport = (
    month: string,
    credits: number,
    spendUsd: number,
    dailyList: Array<{ date: string; credits: number; spend: number }>
  ): MonthlyReportAggregatedData => ({
    report_month: month,
    source_type: 'persisted',
    file_name: `copilot_monthly_usage_${month}.csv`,
    parsed_at: '2026-10-01T00:00:00Z',
    overview: {
      total_net_spend_usd: spendUsd,
      total_gross_spend_usd: spendUsd,
      total_discount_usd: 0,
      total_requests: 100,
      quantity_by_unit: { credits },
      total_active_users: 10,
      top_model: 'Claude 3.7 Sonnet',
      top_sku: 'copilot_ai_credit',
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    model_breakdown: [],
    sku_breakdown: [
      {
        sku_name: 'copilot_ai_credit',
        total_quantity: credits,
        unit_type: 'credits',
        total_spend_usd: spendUsd,
        percentage: 100,
      },
    ],
    daily_trends: dailyList.map(
      (d): ReportDailyTrend => ({
        date: d.date,
        requests: 10,
        spend_usd: d.spend,
        active_users: 5,
        credits: d.credits,
      })
    ),
    user_details: [],
  });

  it('Feature Requirement 1: 月次変化グラフ用の推移データを正しく集計・生成する', () => {
    const repAug = createMockReport('2026-08', 5000, 50, [
      { date: '2026-08-01', credits: 2000, spend: 20 },
      { date: '2026-08-02', credits: 3000, spend: 30 },
    ]);
    const repSep = createMockReport('2026-09', 8000, 80, [
      { date: '2026-09-01', credits: 3500, spend: 35 },
      { date: '2026-09-02', credits: 4500, spend: 45 },
    ]);
    const repOct = createMockReport('2026-10', 12000, 120, [
      { date: '2026-10-01', credits: 6000, spend: 60 },
      { date: '2026-10-02', credits: 6000, spend: 60 },
    ]);

    const trend = buildMonthlyCreditsTrend([repOct, repAug, repSep]);
    assert.strictEqual(trend.length, 3);
    // 時系列ソートの確認
    assert.strictEqual(trend[0].month, '2026-08');
    assert.strictEqual(trend[1].month, '2026-09');
    assert.strictEqual(trend[2].month, '2026-10');

    // 8月の月次クレジット
    assert.strictEqual(trend[0].totalCredits, 5000);
    assert.strictEqual(trend[0].momCreditsDelta, null);

    // 9月の月次クレジットと前月比 (8月 -> 9月: +3000, +60.0%)
    assert.strictEqual(trend[1].totalCredits, 8000);
    assert.strictEqual(trend[1].momCreditsDelta, 3000);
    assert.strictEqual(trend[1].momCreditsRate, 60.0);

    // 10月の月次クレジットと前月比 (9月 -> 10月: +4000, +50.0%)
    assert.strictEqual(trend[2].totalCredits, 12000);
    assert.strictEqual(trend[2].momCreditsDelta, 4000);
    assert.strictEqual(trend[2].momCreditsRate, 50.0);
  });

  it('Feature Requirement 1b: 選択したデータ範囲 (開始月〜終了月) による絞り込みが正確に機能する', () => {
    const repAug = createMockReport('2026-08', 5000, 50, []);
    const repSep = createMockReport('2026-09', 8000, 80, []);
    const repOct = createMockReport('2026-10', 12000, 120, []);

    const trend = buildMonthlyCreditsTrend([repAug, repSep, repOct]);

    // 2026-08 〜 2026-09 の範囲指定
    const filtered1 = filterCreditsTrendByRange(trend, '2026-08', '2026-09');
    assert.strictEqual(filtered1.length, 2);
    assert.strictEqual(filtered1[0].month, '2026-08');
    assert.strictEqual(filtered1[1].month, '2026-09');

    // 2026-09 〜 2026-10 の範囲指定
    const filtered2 = filterCreditsTrendByRange(trend, '2026-09', '2026-10');
    assert.strictEqual(filtered2.length, 2);
    assert.strictEqual(filtered2[0].month, '2026-09');
    assert.strictEqual(filtered2[1].month, '2026-10');

    // 単一月指定
    const filtered3 = filterCreditsTrendByRange(trend, '2026-09', '2026-09');
    assert.strictEqual(filtered3.length, 1);
    assert.strictEqual(filtered3[0].month, '2026-09');
  });

  it('Feature Requirement 2: 指定月内の変化 (日ごとのAI Credit消費総量の累積増加) を計算する', () => {
    const dailyData: ReportDailyTrend[] = [
      { date: '2026-08-01', requests: 10, spend_usd: 10, active_users: 3, credits: 1000 },
      { date: '2026-08-02', requests: 15, spend_usd: 15, active_users: 4, credits: 1500 },
      { date: '2026-08-03', requests: 20, spend_usd: 20, active_users: 5, credits: 2000 },
    ];

    const progression = calculateDailyCreditsProgression(dailyData, false);
    assert.strictEqual(progression.length, 3);

    // 1日目
    assert.strictEqual(progression[0].date, '2026-08-01');
    assert.strictEqual(progression[0].dailyCredits, 1000);
    assert.strictEqual(progression[0].cumulativeCredits, 1000);

    // 2日目: 当日1500 + 累積2500
    assert.strictEqual(progression[1].date, '2026-08-02');
    assert.strictEqual(progression[1].dailyCredits, 1500);
    assert.strictEqual(progression[1].cumulativeCredits, 2500);

    // 3日目: 当日2000 + 累積4500
    assert.strictEqual(progression[2].date, '2026-08-03');
    assert.strictEqual(progression[2].dailyCredits, 2000);
    assert.strictEqual(progression[2].cumulativeCredits, 4500);
  });

  it('フォールバック換算: 明示的credit行がない場合、公式換算 (1 credit = $0.01) で推定する', () => {
    const reportNoCredit: MonthlyReportAggregatedData = {
      report_month: '2026-08',
      source_type: 'persisted',
      file_name: 'no_credits.csv',
      parsed_at: '2026-10-01T00:00:00Z',
      overview: {
        total_net_spend_usd: 35.5,
        total_gross_spend_usd: 35.5,
        total_discount_usd: 0,
        total_requests: 100,
        total_active_users: 5,
        top_model: 'GPT-4o',
        top_sku: 'copilot_premium_request',
      },
      by_department: {},
      by_cost_center: {},
      by_organization: {},
      model_breakdown: [],
      sku_breakdown: [],
      daily_trends: [
        { date: '2026-08-01', requests: 50, spend_usd: 15.5, active_users: 3 },
        { date: '2026-08-02', requests: 50, spend_usd: 20.0, active_users: 4 },
      ],
      user_details: [],
    };

    const extracted = extractTotalAiCredits(reportNoCredit);
    assert.strictEqual(extracted.isEstimatedFromSpend, true);
    assert.strictEqual(extracted.totalCredits, 3550); // $35.50 * 100 = 3550 credits

    const progression = calculateDailyCreditsProgression(reportNoCredit.daily_trends, true);
    assert.strictEqual(progression[0].dailyCredits, 1550);
    assert.strictEqual(progression[0].cumulativeCredits, 1550);
    assert.strictEqual(progression[1].dailyCredits, 2000);
    assert.strictEqual(progression[1].cumulativeCredits, 3550);
  });
});
