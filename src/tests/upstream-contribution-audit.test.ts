import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { checkDataLeaks } from '../../scripts/audit-upstream-contribution.js';

// upstream への貢献ブランチに、組織固有の実データ(Copilot利用実績・請求データ・
// ユーザーマッピング等)が絶対に混入しないことを検証する。.gitignore の実データ
// 保護パターン(AIUsageReport*.csv / *<yyyymm>.csv 等)と同期していることが前提。
describe('Upstream Contribution Data-Leak Audit (checkDataLeaks)', () => {
  it('flags AIUsageReport*.csv exports', () => {
    const findings = checkDataLeaks(['AIUsageReport.csv']);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule.id, 'ai-usage-report-csv');
  });

  it('flags generic usage-report CSV exports', () => {
    const findings = checkDataLeaks(['export_usage_report_final.csv']);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule.id, 'usage-report-csv');
  });

  it('flags filenames ending in a 6-digit YYYYMM before .csv', () => {
    const findings = checkDataLeaks(['partition_202608.csv']);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule.id, 'yyyymm-csv');
  });

  it('flags filenames ending in a hyphenated YYYY-MM before .csv', () => {
    const findings = checkDataLeaks(['partition_2026-08.csv']);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule.id, 'yyyy-mm-csv');
  });

  it('flags realistic dated exports that match multiple protection rules at once (defense-in-depth)', () => {
    // This is the exact naming shape of the real stray file found in this repo during development.
    const findings = checkDataLeaks(['AIUsageReport_202608.csv', 'downloads/AIUsageReport-2026-09.csv']);
    const ruleIds = findings.map((f) => f.rule.id).sort();
    assert.deepEqual(ruleIds, ['ai-usage-report-csv', 'ai-usage-report-csv', 'yyyy-mm-csv', 'yyyymm-csv'].sort());
  });

  it('flags files under the runtime data/ and dashboard/public/data/ directories', () => {
    const findings = checkDataLeaks(['data/2026-09/daily.json', 'dashboard/public/data/index.json']);
    assert.equal(findings.length, 2);
    assert.ok(findings.every((f) => f.rule.id === 'data-directory'));
  });

  it('flags user mapping and org chart PII dumps', () => {
    const findings = checkDataLeaks([
      'user_mapping.json',
      'copilot_user_mapping_acme.json',
      'internal_org_chart.csv',
    ]);
    assert.equal(findings.length, 3);
  });

  it('flags hardcoded secrets/credentials files', () => {
    const findings = checkDataLeaks(['secrets.yaml', 'credentials.json', 'service-account-prod.json']);
    assert.equal(findings.length, 3);
  });

  it('does not flag ordinary source, test, and documentation files', () => {
    const findings = checkDataLeaks([
      'src/cli/run-pipeline.ts',
      'src/tests/report-parser.test.ts',
      'docs/specifications/08_automation_workflow_spec.md',
      '.github/workflows/copilot-analysis-cron.yml',
      'package.json',
      'README.md',
    ]);
    assert.deepEqual(findings, []);
  });

  it('does not flag benchmark/model CSV fixtures without a real-data filename shape', () => {
    const findings = checkDataLeaks(['docs/model-benchmark-source.csv', 'src/tests/fixtures/sample.csv']);
    assert.deepEqual(findings, []);
  });
});
