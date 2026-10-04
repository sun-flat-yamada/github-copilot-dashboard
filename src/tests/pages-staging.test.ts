import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { findStagingProblems, planStaging, stageData } from '../../scripts/pages-staging.js';

function write(file: string, content = '{}') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf-8');
}

describe('Pages staging: real processed data (past months included) reaches the artifact (P0-7)', () => {
  let tmp: string;
  let dataDir: string;
  let publicDir: string;
  let distDataDir: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-staging-'));
    dataDir = path.join(tmp, 'data');
    publicDir = path.join(tmp, 'dashboard/public/data');
    distDataDir = path.join(tmp, 'dist/data');

    // 永続ストレージ (copilot-data ブランチから復元した data/) の想定
    write(path.join(dataDir, 'index.json'), JSON.stringify({ available_days: ['2026-09-10', '2026-09-09'] }));
    write(path.join(dataDir, 'error-log.json'));
    write(path.join(dataDir, 'catalog/exchange-rates.json'));
    write(path.join(dataDir, 'processed/monthly/2026-09.json'));
    write(path.join(dataDir, 'processed/monthly/2026-08.json')); // 過去月
    write(path.join(dataDir, 'processed/monthly/2026-07.json')); // 過去月
    write(path.join(dataDir, 'processed/reports/2026-08.json'));
    write(path.join(dataDir, 'processed/deep-analysis/2026-08.json')); // 過去月
    write(path.join(dataDir, 'processed/trends/rolling-1year.json'));
    write(path.join(dataDir, 'processed/custom/latest-30d.json'));
    write(path.join(dataDir, 'processed/quality/history.json')); // データ品質の履歴 (件数・日付のみ)
    write(path.join(dataDir, 'processed/closes/2026-08.json')); // 月次締めの確定スナップショットと改訂履歴 (数値・チェックサムのみ)
    write(path.join(dataDir, 'processed/closes/index.json'));
    write(path.join(dataDir, 'processed/daily/2026-09-10.json'));
    write(path.join(dataDir, 'processed/daily/2026-09-09.json'));
    write(path.join(dataDir, 'processed/daily/2026-01-05.json')); // index に載っていない古い日 (UI から参照されない)
    // 公開してはならないもの
    write(path.join(dataDir, 'raw/2026/09/2026-09-10-raw.json'), '{"seats":[{"login":"real-user"}]}');
    write(path.join(dataDir, 'reports/monthly/2026-08/export.csv'), 'username\nreal-user\n');
    write(path.join(dataDir, 'config/copilot-user-mapping.json.gpg'), 'encrypted');
    write(path.join(dataDir, 'demo/index.json')); // demo は別ステップでステージされる
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('plans exactly the allow-listed files: index, error-log, processed/* and only the indexed daily files', () => {
    const targets = planStaging(dataDir).map((e) => e.to.split(path.sep).join('/')).sort();
    assert.deepEqual(targets, [
      'catalog/exchange-rates.json',
      'closes/2026-08.json',
      'closes/index.json',
      'custom/latest-30d.json',
      'daily/2026-09-09.json',
      'daily/2026-09-10.json',
      'deep-analysis/2026-08.json',
      'error-log.json',
      'index.json',
      'monthly/2026-07.json',
      'monthly/2026-08.json',
      'monthly/2026-09.json',
      'quality/history.json',
      'reports/2026-08.json',
      'trends/rolling-1year.json',
    ]);
  });

  it('copies past months and never copies raw data, original CSVs, the encrypted mapping or demo', () => {
    const { copied } = stageData(dataDir, publicDir);
    assert.equal(copied, 15);

    assert.ok(fs.existsSync(path.join(publicDir, 'monthly/2026-08.json')), 'a past month must be staged (it used to 404 on Pages)');
    assert.ok(fs.existsSync(path.join(publicDir, 'deep-analysis/2026-08.json')));
    assert.ok(!fs.existsSync(path.join(publicDir, 'raw')));
    assert.ok(!fs.existsSync(path.join(publicDir, 'config')));
    assert.ok(!fs.existsSync(path.join(publicDir, 'reports/monthly')));
    assert.ok(!fs.existsSync(path.join(publicDir, 'demo')));
    assert.ok(!fs.existsSync(path.join(publicDir, 'daily/2026-01-05.json')));
  });

  it('plans nothing when there is no data yet (first run) instead of failing', () => {
    const empty = path.join(tmp, 'empty-data');
    fs.mkdirSync(empty);
    assert.deepEqual(planStaging(empty), []);
    assert.deepEqual(planStaging(path.join(tmp, 'does-not-exist')), []);
  });

  it('verification passes when the build output holds every staged file', () => {
    const plan = planStaging(dataDir);
    stageData(dataDir, distDataDir); // dist/data は publicDir の中身がそのまま入る
    const problems = findStagingProblems(plan, distDataDir);
    assert.deepEqual(problems.missing, []);
    assert.deepEqual(problems.forbidden, []);
    assert.equal(problems.checked, plan.length);
  });

  it('verification FAILS when past-month files are missing from the build output (the original defect)', () => {
    const plan = planStaging(dataDir);
    stageData(dataDir, distDataDir);
    fs.rmSync(path.join(distDataDir, 'monthly/2026-08.json'));
    fs.rmSync(path.join(distDataDir, 'deep-analysis/2026-08.json'));

    const problems = findStagingProblems(plan, distDataDir);
    assert.deepEqual(problems.missing.map((m) => m.split(path.sep).join('/')).sort(), [
      'deep-analysis/2026-08.json',
      'monthly/2026-08.json',
    ]);
  });

  it('verification FAILS when private material leaks into the build output (raw / config / original CSV)', () => {
    const plan = planStaging(dataDir);
    stageData(dataDir, distDataDir);
    write(path.join(distDataDir, 'raw/2026/09/x.json'));
    write(path.join(distDataDir, 'config/copilot-user-mapping.json.gpg'));
    write(path.join(distDataDir, 'reports/monthly/2026-08/export.csv'));
    write(path.join(distDataDir, 'somewhere/else/leak.csv'));

    const forbidden = findStagingProblems(plan, distDataDir).forbidden.map((f) => f.split(path.sep).join('/'));
    assert.ok(forbidden.includes('raw'));
    assert.ok(forbidden.includes('config'));
    assert.ok(forbidden.includes('reports/monthly'));
    assert.ok(forbidden.includes('somewhere/else/leak.csv'));
  });

  it('the demo directory is exempt from the CSV scan (fictional, intentionally public)', () => {
    const plan = planStaging(dataDir);
    stageData(dataDir, distDataDir);
    write(path.join(distDataDir, 'demo/reports/sample.csv'));
    assert.deepEqual(findStagingProblems(plan, distDataDir).forbidden, []);
  });
});

describe('copilot-analysis-cron.yml wiring (P0-7 / P0-8 / P0-11)', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/copilot-analysis-cron.yml'), 'utf-8');
  const indexOf = (needle: string) => {
    const i = workflow.indexOf(needle);
    assert.ok(i >= 0, `workflow must contain: ${needle}`);
    return i;
  };

  it('stages real processed data before the build and verifies the built artifact before the upload', () => {
    const stage = indexOf('name: Stage processed data for GitHub Pages');
    const demo = indexOf('name: Stage DEMO Partitions for GitHub Pages');
    const build = indexOf('name: Build Dashboard SPA');
    const verify = indexOf('name: Verify Pages artifact');
    const upload = indexOf('name: Upload Pages Artifact');
    assert.ok(stage < build && demo < build, 'staging must happen before the build');
    assert.ok(build < verify && verify < upload, 'the artifact must be verified after the build and before the upload');
    assert.match(workflow, /run: npm run pages:stage/);
    assert.match(workflow, /run: npm run pages:verify/);
  });

  it('passes the configuration the pipeline reads (billing config, anonymization, API version)', () => {
    const pipelineStep = workflow.slice(indexOf('name: Run Copilot Analytics Pipeline'), indexOf('name: Commit and Push to data branch'));
    assert.match(pipelineStep, /COPILOT_BILLING_CONFIG: \$\{\{ vars\.COPILOT_BILLING_CONFIG \|\| secrets\.COPILOT_BILLING_CONFIG \}\}/);
    assert.match(pipelineStep, /ANONYMIZE_USERS: \$\{\{ vars\.ANONYMIZE_USERS \}\}/);
    assert.match(pipelineStep, /ANONYMIZE_SECRET: \$\{\{ secrets\.ANONYMIZE_SECRET \}\}/);
    assert.match(pipelineStep, /GITHUB_API_VERSION: \$\{\{ vars\.GITHUB_API_VERSION \}\}/);
  });

  it('runs the exposure check (fork:verify) before the pipeline collects or publishes anything', () => {
    const preflight = indexOf('npm run fork:verify');
    const pipeline = indexOf('name: Run Copilot Analytics Pipeline');
    const push = indexOf('name: Commit and Push to data branch');
    assert.ok(preflight < pipeline && pipeline < push);
  });

  it('keeps the DEMO staging step (demo data is still deployable under /data/demo/)', () => {
    assert.match(workflow, /cp -r data\/demo\/\* dashboard\/public\/data\/demo\//);
    assert.match(workflow, /cp -r data\/demo\/processed\/\* dashboard\/public\/data\/demo\//);
  });

  it('the CI workflow runs the ESLint (react-hooks) step', () => {
    const ci = fs.readFileSync(path.join(root, '.github/workflows/test-and-preview.yml'), 'utf-8');
    assert.match(ci, /run: npm run lint/);
  });
});
