import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RawApiFetcher } from '../../adapters/github-api/RawApiFetcher.js';
import { GitHubApiCopilotDataSource } from '../../adapters/github-api/GitHubApiCopilotDataSource.js';
import { RawLandingStore } from '../../adapters/raw-landing/RawLandingStore.js';
import { RecordingFetcher } from '../../adapters/raw-landing/RecordingFetcher.js';
import { ReplayFetcher, ReplayMissError } from '../../adapters/raw-landing/ReplayFetcher.js';
import { canonicalRequestKey, downloadKey } from '../../adapters/raw-landing/request-key.js';
import { ForkSafeStorageWriter } from '../../adapters/storage/ForkSafeStorageWriter.js';
import { PipelineOrchestrator } from '../../application/pipeline/PipelineOrchestrator.js';
import { billingConfigProvider } from '../../adapters/storage/BillingConfigLoader.js';
import { AttributeResolverAdapter } from '../../adapters/storage/AttributeResolverAdapter.js';
import { createPipelineApp, createReprocessApp } from '../../adapters/composition-root.js';

const BASE = 'https://api.github.com';
const BLOB = 'https://reports.example.test';
const DAYS = ['2026-09-08', '2026-09-09', '2026-09-10'];

const metric = (extra: Record<string, number> = {}) => ({
  user_initiated_interaction_count: 0,
  code_generation_activity_count: 0,
  code_acceptance_activity_count: 0,
  loc_suggested_to_add_sum: 0,
  loc_added_sum: 0,
  ...extra,
});

function userRow(day: string, login: string, id: number, n: number) {
  return {
    day,
    user_id: id,
    user_login: login,
    enterprise_id: 'e1',
    organization_id: null,
    ai_credits_used: n,
    user_initiated_interaction_count: 10 + n,
    code_generation_activity_count: 100 + n,
    code_acceptance_activity_count: 30 + n,
    loc_suggested_to_add_sum: 400,
    loc_added_sum: 120,
    loc_deleted_sum: 8,
    used_agent: n % 2 === 0,
    totals_by_ide: [{ ide: 'vscode', ...metric({ code_generation_activity_count: 100 + n, code_acceptance_activity_count: 30 + n }) }],
    totals_by_feature: [
      { feature: 'code_completion', ...metric({ code_generation_activity_count: 100 + n, code_acceptance_activity_count: 30 + n, loc_suggested_to_add_sum: 400, loc_added_sum: 120 }) },
      { feature: 'chat_panel_agent_mode', ...metric({ user_initiated_interaction_count: 8 }) },
    ],
    totals_by_language_feature: [],
    totals_by_model_feature: [{ model: 'gpt-5', feature: 'chat_panel_agent_mode', ...metric({ user_initiated_interaction_count: 8 }) }],
  };
}

const rawSeat = (login: string, id: number) => ({
  created_at: '2026-01-15T00:00:00Z',
  last_activity_at: '2026-09-09T00:00:00Z',
  plan_type: 'business',
  assignee: { login, id, avatar_url: '', html_url: '', type: 'User' },
  organization: { login: 'acme-org', id: 1 },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Enterprise の API を模した fetch。呼び出し回数を数える (再処理が通信しないことの確認用) */
function createFakeGitHub(overrides: { failSeats?: boolean } = {}) {
  let calls = 0;
  const signedSeen: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    calls++;
    const url = new URL(String(input));
    if (url.host === 'reports.example.test') {
      signedSeen.push(url.toString());
      const day = url.pathname.match(/(\d{4}-\d{2}-\d{2})/)![1];
      const n = Number(day.slice(-2));
      return new Response(
        [userRow(day, 'alice', 1, n), userRow(day, 'bob', 2, n)].map((r) => JSON.stringify(r)).join('\n') + '\n'
      );
    }
    if (url.pathname.endsWith('/copilot/metrics/reports/users-1-day')) {
      const day = url.searchParams.get('day')!;
      if (day === '2026-09-08') return new Response('', { status: 404 });
      return json({ report_day: day, download_links: [`${BLOB}/ent/${day}.ndjson?sig=SECRET-SIGNATURE-${day}`] });
    }
    if (url.pathname.endsWith('/copilot/billing/seats')) {
      if (overrides.failSeats) return new Response('boom', { status: 403 });
      return json({ total_seats: 2, seats: [rawSeat('alice', 1), rawSeat('bob', 2)] });
    }
    if (url.pathname.endsWith('/settings/billing/cost-centers')) return json({ costCenters: [] });
    if (url.pathname.endsWith('/settings/billing/ai_credit/usage')) {
      const [year, month, day] = ['year', 'month', 'day'].map((k) => Number(url.searchParams.get(k)));
      return json({
        timePeriod: { year, month, day },
        enterprise: 'acme-ent',
        usageItems: [
          { product: 'Copilot', sku: 'Copilot AI Credits', model: 'gpt-5', unitType: 'credits', pricePerUnit: 0.01, grossQuantity: 100, grossAmount: 1, discountQuantity: 0, discountAmount: 0, netQuantity: 100, netAmount: 1 },
        ],
      });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, callCount: () => calls, signedSeen };
}

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raw-landing-'));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** 時刻・乱数に依存する項目を除いて比較できる形にする */
function readProcessed(baseDir: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        if (name === 'raw') continue;
        walk(full);
        continue;
      }
      if (!name.endsWith('.json')) continue;
      const text = fs
        .readFileSync(full, 'utf-8')
        .replace(/"(generated_at|timestamp|collected_at|last_attempt_at|last_success_at|fetched_at)": "[^"]*"/g, '"$1": "T"')
        .replace(/issue_\d+_[a-z0-9]+/g, 'issue_X');
      out[path.relative(baseDir, full)] = JSON.parse(text);
    }
  };
  walk(baseDir);
  return out;
}

async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log;
  const warn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

function collectingApp(baseDir: string, fake: ReturnType<typeof createFakeGitHub>) {
  const storage = new ForkSafeStorageWriter({ baseDir, publicDir: '' });
  const store = new RawLandingStore(baseDir);
  const recorder = new RecordingFetcher(
    new RawApiFetcher({ token: 't', baseUrl: BASE, fetchImpl: fake.fetchImpl, maxRetries: 0, retryDelayMs: 0 }),
    store,
    RawLandingStore.newRunId(new Date(Date.UTC(2026, 8, 11, 3, 0, 0)))
  );
  const source = new GitHubApiCopilotDataSource({ fetcher: recorder, enterprise: 'acme-ent', reportDays: DAYS });
  const orchestrator = new PipelineOrchestrator({
    dataSource: source,
    resolver: new AttributeResolverAdapter(undefined, false),
    storage,
    billingConfig: billingConfigProvider,
    isMock: false,
    anonymize: false,
    run: { runId: recorder.runId, finishLanding: () => recorder.finish(source.getCollectionConfig()) !== null },
  });
  return { orchestrator, recorder, store };
}

describe('request keys', () => {
  it('are independent of the base URL, query order and the signature of a signed URL', () => {
    assert.equal(
      canonicalRequestKey('/enterprises/{ent}/x', { ent: 'a b' }, { z: 1, a: 'b' }),
      'GET /enterprises/a%20b/x?a=b&z=1'
    );
    assert.equal(downloadKey(`${BLOB}/p/f.ndjson?sig=SECRET#frag`), `GET ${BLOB}/p/f.ndjson`);
  });
});

describe('RawLandingStore (P1-2)', () => {
  it('stores identical content once (content-addressed, immutable) and refuses a path outside the root', () => {
    const store = new RawLandingStore(tmp);
    const a = store.putObject('{"a":1}', 'json');
    const b = store.putObject('{"a":1}', 'json');
    assert.deepEqual(a, b);
    assert.equal(store.readObject(a.object), '{"a":1}');
    assert.throws(() => store.readObject('../../../etc/passwd'), /escapes/);
    assert.throws(() => store.readManifest('../x'), /Invalid run id/);
  });

  it('orders run ids by time and returns the latest', () => {
    const store = new RawLandingStore(tmp);
    assert.equal(store.latestRunId(), null);
    const older = RawLandingStore.newRunId(new Date(Date.UTC(2026, 8, 1)));
    const newer = RawLandingStore.newRunId(new Date(Date.UTC(2026, 8, 2)));
    for (const run_id of [newer, older]) {
      store.writeManifest({
        schema_version: 1, run_id, started_at: '', finished_at: '', api_version: 'v', config: { orgs: [], report_days: [] }, entries: [],
      });
    }
    assert.equal(store.latestRunId(), newer);
    assert.throws(
      () => store.writeManifest({ schema_version: 1, run_id: newer, started_at: '', finished_at: '', api_version: 'v', config: { orgs: [], report_days: [] }, entries: [] }),
      /EEXIST/,
      'a manifest is never overwritten'
    );
  });
});

describe('Raw Landing: record a run, replay it (P1-2)', () => {
  it('records every request, never stores a download signature, and writes no real-time data into the manifest entries order', async () => {
    const fake = createFakeGitHub();
    const { orchestrator, store, recorder } = collectingApp(tmp, fake);
    await quiet(() => orchestrator.run());

    const manifest = store.readManifest(recorder.runId);
    assert.equal(manifest.config.enterprise, 'acme-ent');
    assert.deepEqual(manifest.config.report_days, DAYS);
    const byOutcome = (o: string) => manifest.entries.filter((e) => e.outcome === o).length;
    assert.equal(byOutcome('empty'), 1, 'the 2026-09-08 report is 404 (empty)');
    // 2 日分の users-1-day (links) + 2 日分の NDJSON + seats + cost centers + 日数分の AI credit usage
    assert.equal(byOutcome('ok'), 6 + DAYS.length);
    assert.deepEqual(
      manifest.entries.map((e) => e.request),
      [...manifest.entries.map((e) => e.request)].sort((a, b) => a.localeCompare(b))
    );

    // 署名はどこにも残らない
    const all = fs
      .readdirSync(store.root, { recursive: true, encoding: 'utf-8' })
      .map((f) => path.join(store.root, f))
      .filter((f) => fs.statSync(f).isFile())
      .map((f) => fs.readFileSync(f, 'utf-8'))
      .join('\n');
    assert.ok(!all.includes('SECRET-SIGNATURE'));
    assert.ok(all.includes(`${BLOB}/ent/2026-09-09.ndjson`), 'the link is kept without its signature');

    // 成果物は run を指す
    const index = JSON.parse(fs.readFileSync(path.join(tmp, 'index.json'), 'utf-8'));
    assert.equal(index.run.run_id, recorder.runId);
    assert.equal(index.run.reprocessed, undefined);
  });

  it('replays the run into identical outputs without any network access', async () => {
    const fake = createFakeGitHub();
    const first = collectingApp(tmp, fake);
    await quiet(() => first.orchestrator.run());
    const before = readProcessed(tmp);
    const callsAfterCollect = fake.callCount();
    assert.ok(Object.keys(before).some((k) => k.startsWith(path.join('processed', 'monthly'))));

    // 成果物を消して、Raw Landing だけから作り直す
    fs.rmSync(path.join(tmp, 'processed'), { recursive: true });
    fs.rmSync(path.join(tmp, 'index.json'));
    fs.rmSync(path.join(tmp, 'error-log.json'));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('reprocess must not use the network');
    }) as typeof fetch;
    const savedCwd = process.cwd();
    try {
      const baseDirEnvCwd = tmp;
      process.chdir(baseDirEnvCwd);
      fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
      // createReprocessApp は <cwd>/data を使う。収集した Raw Landing を同じ配置に置く
      fs.cpSync(path.join(tmp, 'raw'), path.join(tmp, 'data', 'raw'), { recursive: true });
      const { orchestrator, runId } = createReprocessApp();
      assert.equal(runId, first.recorder.runId);
      await quiet(() => orchestrator.run());
    } finally {
      process.chdir(savedCwd);
      globalThis.fetch = originalFetch;
    }
    assert.equal(fake.callCount(), callsAfterCollect, 'no request was made while reprocessing');

    const replayedDir = path.join(tmp, 'data');
    const after = readProcessed(replayedDir);
    const normalize = (o: Record<string, unknown>) => {
      const copy = structuredClone(o) as Record<string, any>;
      // 再処理は index に印を付ける。それ以外は同一であること
      if (copy['index.json']?.run) delete copy['index.json'].run;
      for (const k of Object.keys(copy)) if (k.startsWith('catalog')) delete copy[k];
      // シート監査イベント (P4-3) は追記専用の記録で、再処理 (Raw を書き換えない) の対象外
      for (const k of Object.keys(copy)) if (k.startsWith('audit')) delete copy[k];
      return copy;
    };
    const stripBefore = normalize(before);
    const stripAfter = normalize(after);
    assert.deepEqual(Object.keys(stripAfter).sort(), Object.keys(stripBefore).sort());
    for (const key of Object.keys(stripBefore)) {
      assert.deepEqual(stripAfter[key], stripBefore[key], `${key} is regenerated identically`);
    }
    const index = JSON.parse(fs.readFileSync(path.join(replayedDir, 'index.json'), 'utf-8'));
    assert.deepEqual(index.run, { run_id: first.recorder.runId, reprocessed: true });
  });

  it('reproduces a recorded failure (the seats source failed) instead of inventing data', async () => {
    const fake = createFakeGitHub({ failSeats: true });
    const { orchestrator, store, recorder } = collectingApp(tmp, fake);
    await quiet(() => orchestrator.run());
    const manifest = store.readManifest(recorder.runId);
    const seats = manifest.entries.find((e) => e.request.includes('/billing/seats'))!;
    assert.equal(seats.outcome, 'error');
    assert.equal(seats.error?.name, 'AuthorizationError');

    const replay = new GitHubApiCopilotDataSource({
      fetcher: new ReplayFetcher(manifest, store),
      enterprise: manifest.config.enterprise,
      reportDays: manifest.config.report_days,
    });
    assert.deepEqual(await replay.fetchSeats(), []);
    assert.equal(replay.getSourceStatuses().find((s) => s.source === 'seats')?.status, 'failed');
  });

  it('fails loudly when the replay asks for something the run never requested', async () => {
    const fake = createFakeGitHub();
    const { orchestrator, store, recorder } = collectingApp(tmp, fake);
    await quiet(() => orchestrator.run());
    const replay = new ReplayFetcher(store.readManifest(recorder.runId), store);
    await assert.rejects(() => replay.fetchRaw('/orgs/{org}/never', { org: 'x' }), ReplayMissError);
  });

  it('does not land anything in anonymization mode (raw responses hold real logins)', async () => {
    const saved = { ...process.env };
    const cwd = process.cwd();
    try {
      process.chdir(tmp);
      process.env.ANONYMIZE_SECRET = 'x'.repeat(24);
      process.env.COPILOT_ENTERPRISE = 'acme-ent';
      const app = createPipelineApp({ isMock: false, anonymize: true });
      assert.ok(app);
      assert.equal(fs.existsSync(path.join(tmp, 'data', 'raw', 'landing')), false);
    } finally {
      process.chdir(cwd);
      process.env = saved;
    }
  });

  it('createReprocessApp explains what to do when no run exists', () => {
    const cwd = process.cwd();
    try {
      process.chdir(tmp);
      assert.throws(() => createReprocessApp(), /No raw landing run found/);
    } finally {
      process.chdir(cwd);
    }
  });
});
