import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ReportParser } from '../processor/report-parser.js';
import { AttributeResolver } from '../collector/attribute-resolver.js';

const HEADER =
  'date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,organization,cost_center_name';

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join('\n') + '\n';
}

const ALICE_1 = '2026-08-01,alice,copilot,copilot_premium_request,Claude 3.7 Sonnet,10,requests,0.04,0.40,0.00,0.40,acme-org,Platform';
const ALICE_2 = '2026-08-02,alice,copilot,copilot_premium_request,GPT-4o,5,requests,0.03,0.15,0.00,0.15,acme-org,Platform';
const BOB_1 = '2026-08-16,bob,copilot,copilot_premium_request,o1,4,requests,0.05,0.20,0.00,0.20,acme-org,Data';
const BOB_2 = '2026-08-20,bob,copilot,copilot_premium_request,o1,6,requests,0.05,0.30,0.00,0.30,acme-org,Data';

function aggregateFiles(files: Array<{ name: string; text: string }>) {
  const parser = new ReportParser(new AttributeResolver());
  const sets = files.map((f) => ({ fileName: f.name, records: parser.parseRecords(f.text) }));
  const merged = parser.mergeRecordSets(sets);
  const report = parser.aggregate(merged.records, '2026-08', merged.sourceFiles.join(','), 'persisted', {
    source_files: merged.sourceFiles,
    records_total: merged.records.length,
    duplicates_skipped: merged.duplicatesSkipped,
  });
  return { merged, report };
}

describe('Monthly Usage Report: several CSV files in the same month are combined (P0-10)', () => {
  it('two files (a split export) are summed, not overwritten by the last file', () => {
    const { report, merged } = aggregateFiles([
      { name: 'aug-1-15.csv', text: csv(ALICE_1, ALICE_2) },
      { name: 'aug-16-31.csv', text: csv(BOB_1, BOB_2) },
    ]);

    assert.equal(merged.duplicatesSkipped, 0);
    assert.equal(report.overview.total_net_spend_usd, 1.05); // 0.40 + 0.15 + 0.20 + 0.30
    assert.equal(report.overview.total_requests, 25); // 10 + 5 + 4 + 6
    assert.equal(report.overview.total_active_users, 2);
    assert.deepEqual(report.import_summary?.source_files, ['aug-1-15.csv', 'aug-16-31.csv']);
    assert.equal(report.import_summary?.records_total, 4);
    assert.equal(report.user_details.length, 2);
  });

  it('re-importing an overlapping export does not double count (duplicate rows collapse to one)', () => {
    const { report, merged } = aggregateFiles([
      { name: 'first.csv', text: csv(ALICE_1, ALICE_2, BOB_1) },
      { name: 'overlap.csv', text: csv(ALICE_2, BOB_1, BOB_2) }, // ALICE_2 / BOB_1 は first.csv と同じ行
    ]);

    assert.equal(merged.duplicatesSkipped, 2);
    assert.equal(merged.records.length, 4);
    assert.equal(report.overview.total_net_spend_usd, 1.05);
    assert.equal(report.overview.total_requests, 25);
    assert.equal(report.import_summary?.duplicates_skipped, 2);
  });

  it('importing the identical file twice yields the same report as importing it once', () => {
    const once = aggregateFiles([{ name: 'a.csv', text: csv(ALICE_1, ALICE_2, BOB_1) }]).report;
    const twice = aggregateFiles([
      { name: 'a.csv', text: csv(ALICE_1, ALICE_2, BOB_1) },
      { name: 'a-copy.csv', text: csv(ALICE_1, ALICE_2, BOB_1) },
    ]).report;

    assert.equal(twice.overview.total_net_spend_usd, once.overview.total_net_spend_usd);
    assert.equal(twice.overview.total_requests, once.overview.total_requests);
    assert.deepEqual(
      twice.user_details.map((u) => [u.login, u.total_requests, u.total_spend_usd]),
      once.user_details.map((u) => [u.login, u.total_requests, u.total_spend_usd])
    );
  });

  it('identical rows inside one file are legitimate separate line items and are kept', () => {
    const { merged, report } = aggregateFiles([{ name: 'a.csv', text: csv(ALICE_1, ALICE_1) }]);
    assert.equal(merged.duplicatesSkipped, 0);
    assert.equal(merged.records.length, 2);
    assert.equal(report.overview.total_requests, 20);
  });

  it('across files the per-row maximum occurrence wins (a row twice in one file and once in another stays twice)', () => {
    const { merged } = aggregateFiles([
      { name: 'a.csv', text: csv(ALICE_1, ALICE_1) },
      { name: 'b.csv', text: csv(ALICE_1) },
    ]);
    assert.equal(merged.records.length, 2);
    assert.equal(merged.duplicatesSkipped, 1);
  });

  it('user names are matched case-insensitively when detecting duplicates', () => {
    const upper = ALICE_1.replace(',alice,', ',ALICE,');
    const { merged } = aggregateFiles([
      { name: 'a.csv', text: csv(ALICE_1) },
      { name: 'b.csv', text: csv(upper) },
    ]);
    assert.equal(merged.records.length, 1);
  });
});

describe('Monthly Usage Report: units are not mixed and missing values are not invented (P0-10 / P0-4)', () => {
  it('seat and credit rows do not inflate the request count; per-unit quantities are kept', () => {
    const seatRow = '2026-08-03,carol,copilot,copilot_business,,1,seats,19.00,19.00,0.00,19.00,acme-org,Platform';
    const creditRow = '2026-08-04,carol,copilot,ai_credits,,3400,ai-credits,0.01,34.00,0.00,34.00,acme-org,Platform';
    const { report } = aggregateFiles([{ name: 'a.csv', text: csv(ALICE_1, seatRow, creditRow) }]);

    assert.equal(report.overview.total_requests, 10, 'only requests-family rows are counted as requests');
    assert.equal(report.overview.quantity_by_unit?.requests, 10);
    assert.equal(report.overview.quantity_by_unit?.seats, 1);
    assert.equal(report.overview.quantity_by_unit?.['ai-credits'], 3400);
    assert.equal(report.overview.total_net_spend_usd, 53.4);
  });

  it('group-level usage metrics that a billing CSV cannot contain are null, not fixed numbers', () => {
    const { report } = aggregateFiles([{ name: 'a.csv', text: csv(ALICE_1, BOB_1) }]);
    for (const group of Object.values(report.by_department)) {
      assert.equal(group.acceptance_rate, null, 'the old fixed 35% acceptance rate must be gone');
      assert.equal(group.total_suggestions, null);
      assert.equal(group.total_acceptances, null);
      assert.equal(group.total_chats, null);
      assert.equal(group.total_pr_summaries, null);
    }
  });

  it('rows without a date still count toward totals but are reported, and no date is invented', () => {
    const undated = ',erin,copilot,copilot_premium_request,GPT-4o,7,requests,0.03,0.21,0.00,0.21,acme-org,Platform';
    const { report } = aggregateFiles([{ name: 'a.csv', text: csv(ALICE_1, undated) }]);

    assert.equal(report.overview.total_requests, 17);
    assert.equal(report.import_summary?.undated_records, 1);
    assert.ok(report.daily_trends.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)), 'undated rows must not appear in the daily trend');
  });

  it('a row with no surface does not get a made-up default surface', () => {
    const { report } = aggregateFiles([{ name: 'a.csv', text: csv(ALICE_1) }]);
    assert.equal(report.user_details[0].surface, undefined);
  });
});
