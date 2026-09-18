import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GitHubCopilotClient } from '../collector/github-client.js';

// COPILOT_READ_TOKEN / COPILOT_ENTERPRISE / COPILOT_ORGS が未設定でも、
// (a) 捏造データで埋めず、(b) パイプライン全体を中断せず、
// (c) 認証情報に依存しない機能 (Monthly Usage Report CSV 等) は継続動作すること
// を検証する。Enterprise Owner 権限が無いケースも同じ「未設定」経路として扱われる。

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TSX_CLI = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const PIPELINE_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'run-pipeline.ts');

const CREDENTIAL_ENV_KEYS = ['COPILOT_READ_TOKEN', 'COPILOT_ENTERPRISE', 'COPILOT_ORGS', 'GITHUB_TOKEN', 'MOCK_MODE'];

/**
 * run-pipeline.ts を指定した一時ディレクトリ(ForkSafeStorageのbaseDir)・
 * クリーンな認証情報環境変数の下で実行し、標準出力を返す。
 * ローカルの node_modules/tsx を直接起動するため、npx解決やネットワークアクセスに依存しない。
 */
function runPipelineWithoutCredentials(cwd: string): string {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of CREDENTIAL_ENV_KEYS) {
    delete env[key];
  }
  return execFileSync(process.execPath, [TSX_CLI, PIPELINE_SCRIPT], {
    cwd,
    env,
    encoding: 'utf-8',
  });
}

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-pipeline-test-'));
}

describe('GitHubCopilotClient: no COPILOT_ENTERPRISE/COPILOT_ORGS configured (real mode)', () => {
  it('fetchMetrics returns [] and records an explanatory (not silent) issue', async () => {
    const client = new GitHubCopilotClient({ mockMode: false, token: 'dummy-token' });
    const metrics = await client.fetchMetrics();
    assert.deepStrictEqual(metrics, []);
    const issues = client.getIssues();
    assert.ok(
      issues.some((i) => i.target === 'config:copilot-metrics' && i.severity === 'warning'),
      'expected an explanatory issue about missing COPILOT_ENTERPRISE/COPILOT_ORGS configuration'
    );
  });

  it('fetchSeats returns [] and records an explanatory (not silent) issue', async () => {
    const client = new GitHubCopilotClient({ mockMode: false, token: 'dummy-token' });
    const seats = await client.fetchSeats();
    assert.deepStrictEqual(seats, []);
    const issues = client.getIssues();
    assert.ok(
      issues.some((i) => i.target === 'config:copilot-billing-seats' && i.severity === 'warning'),
      'expected an explanatory issue about missing COPILOT_ENTERPRISE/COPILOT_ORGS configuration'
    );
  });
});

describe('run-pipeline.ts (graceful operation without credentials)', () => {
  it('completes successfully (does not abort) and produces a valid empty-state index.json', () => {
    const cwd = makeTempDir();
    try {
      const stdout = runPipelineWithoutCredentials(cwd);
      assert.ok(stdout.includes('Pipeline completed successfully!'), 'pipeline must not abort when credentials are absent');

      const indexPath = path.join(cwd, 'data', 'index.json');
      assert.ok(fs.existsSync(indexPath), 'index.json must still be generated');
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

      assert.deepStrictEqual(index.available_months, []);
      assert.deepStrictEqual(index.available_days, []);
      assert.deepStrictEqual(index.available_reports, []);
      assert.strictEqual(index.default_scopes.latest_day, undefined);
      assert.strictEqual(index.default_scopes.latest_month, undefined);
      assert.strictEqual(index.default_scopes.latest_range, undefined);
      assert.strictEqual(index.summary.total_seats, 0);
      assert.ok(
        index.issues.some((i: { message: string }) => i.message.includes('COPILOT_ENTERPRISE and COPILOT_ORGS are both unset')),
        'index.json must explain why no live data is present'
      );
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('still aggregates an independently-imported Monthly Usage Report CSV even without live credentials', () => {
    const cwd = makeTempDir();
    try {
      const reportDir = path.join(cwd, 'data', 'reports', 'monthly', '2026-08');
      fs.mkdirSync(reportDir, { recursive: true });
      const csv = [
        'date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,organization,cost_center_name',
        '2026-08-01,dev_alice,copilot,copilot_premium_request,"Claude 3.7 Sonnet",10,requests,0.04,0.40,0.00,0.40,proud-org,CC-DEV-101',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(reportDir, 'sample.csv'), csv, 'utf-8');

      const stdout = runPipelineWithoutCredentials(cwd);
      assert.ok(stdout.includes('Pipeline completed successfully!'));

      const reportPath = path.join(cwd, 'data', 'processed', 'reports', '2026-08.json');
      assert.ok(fs.existsSync(reportPath), 'Monthly Usage Report must still be aggregated without live credentials');
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      assert.strictEqual(report.report_month, '2026-08');
      assert.strictEqual(report.overview.total_net_spend_usd, 0.4);

      const index = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'index.json'), 'utf-8'));
      assert.deepStrictEqual(index.available_reports, ['2026-08']);
      // ライブメトリクス(Metrics/Seats)は依然として存在しない
      assert.deepStrictEqual(index.available_months, []);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
