import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ReportParser } from '../../processor/report-parser.js';
import {
  extractTotalAiCredits,
  calculateDailyCreditsProgression,
  buildMonthlyCreditsTrend,
  filterCreditsTrendByRange,
} from '../../../dashboard/src/utils/monthlyCreditsTrend.js';
import type { MonthlyReportAggregatedData } from '../../types/copilot.js';

describe('ReportParser daily credits aggregation', () => {
  it('aggregates credits in daily_trends when credit rows exist', () => {
    const csv = [
      'date,product,sku,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,username,organization,cost_center_name,model',
      '2026-08-01,copilot,copilot_ai_credit,120,credits,0.01,1.20,0.00,1.20,alice,org-a,cc-1,gpt-4o',
      '2026-08-01,copilot,copilot_ai_credit,80,credits,0.01,0.80,0.00,0.80,bob,org-a,cc-1,claude-3-7-sonnet',
      '2026-08-02,copilot,copilot_ai_credit,250,credits,0.01,2.50,0.00,2.50,alice,org-a,cc-1,gpt-4o',
    ].join('\n');

    const parser = new ReportParser();
    const records = parser.parseRecords(csv);
    const report = parser.aggregate(records, '2026-08', 'test.csv');

    assert.equal(report.daily_trends.length, 2);
    assert.equal(report.daily_trends[0]?.date, '2026-08-01');
    assert.equal(report.daily_trends[0]?.credits, 200);
    assert.equal(report.daily_trends[1]?.date, '2026-08-02');
    assert.equal(report.daily_trends[1]?.credits, 250);
  });
});

describe('monthlyCreditsTrend utilities', () => {
  const dummyReportAug: MonthlyReportAggregatedData = {
    report_month: '2026-08',
    source_type: 'persisted',
    file_name: 'test-08.csv',
    parsed_at: '2026-09-01T00:00:00Z',
    overview: {
      total_net_spend_usd: 50,
      total_gross_spend_usd: 50,
      total_discount_usd: 0,
      total_requests: 0,
      quantity_by_unit: { credits: 5000 },
      total_active_users: 10,
      top_model: 'gpt-4o',
      top_sku: 'copilot_ai_credit',
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    model_breakdown: [],
    sku_breakdown: [
      {
        sku_name: 'copilot_ai_credit',
        total_quantity: 5000,
        unit_type: 'credits',
        total_spend_usd: 50,
        percentage: 100,
      },
    ],
    daily_trends: [
      { date: '2026-08-01', requests: 0, spend_usd: 20, active_users: 5, credits: 2000 },
      { date: '2026-08-02', requests: 0, spend_usd: 30, active_users: 8, credits: 3000 },
    ],
    user_details: [],
  };

  const dummyReportSep: MonthlyReportAggregatedData = {
    report_month: '2026-09',
    source_type: 'persisted',
    file_name: 'test-09.csv',
    parsed_at: '2026-10-01T00:00:00Z',
    overview: {
      total_net_spend_usd: 80,
      total_gross_spend_usd: 80,
      total_discount_usd: 0,
      total_requests: 0,
      quantity_by_unit: { credits: 8000 },
      total_active_users: 15,
      top_model: 'claude-3-7-sonnet',
      top_sku: 'copilot_ai_credit',
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    model_breakdown: [],
    sku_breakdown: [
      {
        sku_name: 'copilot_ai_credit',
        total_quantity: 8000,
        unit_type: 'credits',
        total_spend_usd: 80,
        percentage: 100,
      },
    ],
    daily_trends: [
      { date: '2026-09-01', requests: 0, spend_usd: 40, active_users: 10, credits: 4000 },
      { date: '2026-09-02', requests: 0, spend_usd: 40, active_users: 12, credits: 4000 },
    ],
    user_details: [],
  };

  it('extractTotalAiCredits returns total from quantity_by_unit', () => {
    const res = extractTotalAiCredits(dummyReportAug);
    assert.equal(res.totalCredits, 5000);
    assert.equal(res.isEstimatedFromSpend, false);
  });

  it('calculateDailyCreditsProgression calculates daily and cumulative credits', () => {
    const dailyProgression = calculateDailyCreditsProgression(
      dummyReportAug.daily_trends,
      false
    );
    assert.equal(dailyProgression.length, 2);
    assert.equal(dailyProgression[0]?.dailyCredits, 2000);
    assert.equal(dailyProgression[0]?.cumulativeCredits, 2000);
    assert.equal(dailyProgression[1]?.dailyCredits, 3000);
    assert.equal(dailyProgression[1]?.cumulativeCredits, 5000);
  });

  it('buildMonthlyCreditsTrend creates MoM trend data points', () => {
    const trend = buildMonthlyCreditsTrend([dummyReportSep, dummyReportAug]);
    assert.equal(trend.length, 2);
    // Should sort chronologically: 2026-08 then 2026-09
    assert.equal(trend[0]?.month, '2026-08');
    assert.equal(trend[0]?.totalCredits, 5000);
    assert.equal(trend[0]?.momCreditsDelta, null);

    assert.equal(trend[1]?.month, '2026-09');
    assert.equal(trend[1]?.totalCredits, 8000);
    assert.equal(trend[1]?.momCreditsDelta, 3000);
    assert.equal(trend[1]?.momCreditsRate, 60.0);
  });

  it('filterCreditsTrendByRange filters months correctly', () => {
    const trend = buildMonthlyCreditsTrend([dummyReportSep, dummyReportAug]);
    const filtered = filterCreditsTrendByRange(trend, '2026-09', '2026-09');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.month, '2026-09');
  });
});
