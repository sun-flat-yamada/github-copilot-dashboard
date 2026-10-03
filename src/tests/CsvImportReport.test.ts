import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportParser } from '../processor/report-parser.js';
import { analyzeHeaders } from '../processor/csv-format-profiles.js';
import { formatCsvImportReport } from '../processor/csv-import-report-format.js';
import { CsvImportReportPanel } from '../../dashboard/src/components/common/CsvImportReportPanel.js';

const parser = new ReportParser();
const csv = (...lines: string[]) => lines.join('\n') + '\n';

const BILLING_HEADER = 'date,username,product,sku,quantity,unit_type,gross_amount,discount_amount,net_amount,cost_center,note_from_finance';

describe('CSV format profiles and import report (P1-5)', () => {
  it('detects the billing usage report and lists unrecognized columns', () => {
    const { report, records } = parser.parseRecordsWithReport(
      csv(BILLING_HEADER, '2026-09-01,user-a,copilot,Premium Request,10,requests,0.4,0,0.4,CC-A,x'),
      'usage.csv'
    );
    assert.equal(report.profile?.id, 'billing-usage-report');
    assert.equal(report.file_name, 'usage.csv');
    assert.deepEqual(report.columns.unrecognized, ['note_from_finance']);
    assert.equal(records.length, 1);
    assert.ok(report.warnings.some((w) => w.includes('note_from_finance')));
  });

  it('accepts header variants (Title Case with symbols) through the alias rules', () => {
    const analysis = analyzeHeaders(['Date', 'Username', 'Quantity', 'Gross Amount ($)', 'Net Amount']);
    assert.equal(analysis.map.username, 1);
    assert.equal(analysis.map.quantity, 2);
    // 'Gross Amount ($)' → gross_amount、'Net Amount' → net_amount (空白・記号は区切りとして扱う)
    assert.equal(analysis.map.gross_amount, 3);
    assert.equal(analysis.map.net_amount, 4);
    assert.deepEqual(analysis.unrecognized, []);
    assert.equal(analysis.profile?.id, 'billing-usage-report');
  });

  it('detects the AI usage report and the activity report', () => {
    assert.equal(analyzeHeaders(['date', 'username', 'model', 'input', 'output']).profile?.id, 'ai-usage-report');
    assert.equal(analyzeHeaders(['username', 'last_activity_at', 'editor']).profile?.id, 'activity-report');
  });

  it('stops the import with a reason when the format cannot be detected', () => {
    const { records, report } = parser.parseRecordsWithReport(csv('foo,bar,baz', '1,2,3'));
    assert.deepEqual(records, []);
    assert.equal(report.profile, null);
    assert.match(report.stop_reason ?? '', /必須列を認識できません: username/);
    assert.deepEqual(report.columns.unrecognized, ['foo', 'bar', 'baz']);

    const noValues = parser.parseRecordsWithReport(csv('username,city', 'user-a,x'));
    assert.equal(noValues.report.profile, null);
    assert.match(noValues.report.stop_reason ?? '', /使用量・金額の列/);

    assert.match(parser.parseRecordsWithReport('').report.stop_reason ?? '', /空/);
    assert.match(parser.parseRecordsWithReport('username,quantity\n').report.stop_reason ?? '', /データ行がありません/);
  });

  it('reports skipped rows with their reason and data row number, without echoing values', () => {
    const { records, report } = parser.parseRecordsWithReport(
      csv(
        'date,username,quantity,unit_type,net_amount',
        '2026-09-01,user-a,1,requests,0.1',
        '2026-09-01,,2,requests,0.2',
        '',
        '2026-09-02,,3,requests,0.3'
      )
    );
    assert.equal(records.length, 1);
    assert.equal(report.rows.total, 3, 'blank lines are not data rows');
    assert.equal(report.rows.imported, 1);
    assert.equal(report.rows.skipped, 2);
    assert.deepEqual(report.rows.skipped_by_reason, { ユーザー名が空: 2 });
    assert.deepEqual(report.rows.skipped_samples.map((s) => s.row), [2, 3], 'data row numbers: the header and blank lines are not counted');
    assert.ok(!JSON.stringify(report).includes('user-a'));
  });

  it('never mixes units: totals are per unit, and a unit with no value stays null (not 0)', () => {
    const { report } = parser.parseRecordsWithReport(
      csv(
        'date,username,quantity,unit_type,gross_amount,net_amount',
        '2026-09-01,user-a,10,requests,0.4,0.4',
        '2026-09-01,user-a,500,ai-credits,5,5',
        '2026-09-01,user-b,2,requests,0.08,0.08',
        '2026-09-01,user-b,,seats,,'
      )
    );
    const byUnit = Object.fromEntries(report.totals_by_unit.map((t) => [t.unit, t]));
    assert.deepEqual(Object.keys(byUnit), ['requests', 'credits', 'seats']);
    assert.equal(byUnit.requests.quantity, 12);
    assert.equal(byUnit.requests.net_usd, 0.48);
    assert.equal(byUnit.credits.quantity, 500);
    assert.equal(byUnit.credits.gross_usd, 5);
    assert.equal(byUnit.seats.quantity, null);
    assert.equal(byUnit.seats.net_usd, null);
    assert.ok(report.warnings.some((w) => w.includes('単位の異なる')));
  });

  it('flags column-count mismatches and identical repeated rows without dropping them', () => {
    const { records, report } = parser.parseRecordsWithReport(
      csv(
        'date,username,quantity,unit_type,net_amount',
        '2026-09-01,user-a,1,requests,0.1',
        '2026-09-01,user-a,1,requests,0.1',
        '2026-09-02,user-a,1,requests'
      )
    );
    assert.equal(records.length, 3);
    assert.equal(report.rows.repeated, 1);
    assert.equal(report.rows.ragged, 1);
    assert.ok(report.warnings.some((w) => w.includes('列ずれ')));
  });

  it('counts rows without a usable date', () => {
    const { report } = parser.parseRecordsWithReport(csv('date,username,quantity', ',user-a,1', 'not-a-date,user-a,1', '2026-09-01,user-a,1'));
    assert.equal(report.rows.undated, 2);
  });

  it('parseRecords keeps returning just the records (compatible)', () => {
    assert.equal(parser.parseRecords(csv('date,username,quantity', '2026-09-01,user-a,1')).length, 1);
  });

  it('carries the report into the aggregate and renders it for the user', () => {
    const { records, report } = parser.parseRecordsWithReport(
      csv(BILLING_HEADER, '2026-09-01,user-a,copilot,Premium Request,10,requests,0.4,0,0.4,CC-A,x', ',,,,,,,,,,'),
      'usage.csv'
    );
    const aggregated = parser.aggregate(records, '2026-09', 'usage.csv', 'local_drop', {
      source_files: ['usage.csv'],
      records_total: records.length,
      duplicates_skipped: 0,
      csv_reports: [report],
    });
    assert.equal(aggregated.import_summary?.csv_reports?.[0].profile?.id, 'billing-usage-report');

    const html = renderToStaticMarkup(React.createElement(CsvImportReportPanel, { report }));
    assert.match(html, /data-testid="csv-import-report"/);
    assert.match(html, /note_from_finance/);
    assert.match(html, /リクエスト/);
    assert.match(html, /1\/1 行を取り込みました/);
  });

  it('formats the report as text for the CLI', () => {
    const { report } = parser.parseRecordsWithReport(csv(BILLING_HEADER, '2026-09-01,user-a,copilot,Premium Request,10,requests,0.4,0,0.4,CC-A,x'), 'usage.csv');
    const text = formatCsvImportReport(report).join('\n');
    assert.match(text, /usage\.csv/);
    assert.match(text, /未認識の列: note_from_finance/);
    assert.match(text, /リクエスト: 1 行/);
    const stopped = formatCsvImportReport(parser.parseRecordsWithReport(csv('a,b', '1,2')).report).join('\n');
    assert.match(stopped, /取り込めません/);
  });
});
