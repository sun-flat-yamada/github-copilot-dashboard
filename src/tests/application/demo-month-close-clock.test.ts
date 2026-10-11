import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PipelineOrchestrator } from '../../application/pipeline/PipelineOrchestrator.js';
import { DEMO_GAP_MONTHS, DEMO_REVISED_MONTH, demoMonthCloseAt } from '../../application/pipeline/demo-history.js';
import { MockCopilotDataSource } from '../../adapters/github-api/MockCopilotDataSource.js';
import { DemoAttributeResolver } from '../../adapters/storage/DemoAttributeResolver.js';
import { ForkSafeStorageWriter } from '../../adapters/storage/ForkSafeStorageWriter.js';
import { billingConfigProvider } from '../../adapters/storage/BillingConfigLoader.js';
import { DEMO_BASE_DATE } from '../../collector/mock-generator.js';

/**
 * #305: the DEMO month close is evaluated at the DEMO base date, not at the run date.
 * Before the fix, a DEMO generated on or after 2026-10-07 (the close day of 2026-09) closed 2026-09
 * and the 1-year trend lost its provisional month.
 */

const CLOCKS = [
  { label: 'before the 2026-09 close day', at: '2026-10-06T06:00:00.000Z' },
  { label: 'on the 2026-09 close day', at: '2026-10-07T06:00:00.000Z' },
  { label: 'months after the 2026-09 close day', at: '2027-03-15T12:00:00.000Z' },
];

async function runDemo(baseDir: string, at: string): Promise<void> {
  const orchestrator = new PipelineOrchestrator({
    dataSource: new MockCopilotDataSource(),
    resolver: new DemoAttributeResolver(),
    storage: new ForkSafeStorageWriter({ baseDir, publicDir: '', isDemo: true }),
    billingConfig: billingConfigProvider,
    isMock: true,
    anonymize: false,
    clock: () => new Date(at),
  });
  const log = console.log;
  const warn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    await orchestrator.run();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

const readJson = (dir: string, rel: string) => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf-8'));

describe('DEMO month close is pinned to the DEMO base date (#305)', () => {
  const dirs = new Map<string, string>();
  const savedEnv = { ANONYMIZE_USERS: process.env.ANONYMIZE_USERS, COPILOT_BUSINESS_CALENDAR: process.env.COPILOT_BUSINESS_CALENDAR };

  before(async () => {
    delete process.env.ANONYMIZE_USERS;
    delete process.env.COPILOT_BUSINESS_CALENDAR;
    for (const { at } of CLOCKS) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-close-clock-'));
      dirs.set(at, dir);
      await runDemo(dir, at);
    }
  });

  after(() => {
    for (const dir of dirs.values()) fs.rmSync(dir, { recursive: true, force: true });
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('evaluates the DEMO close at the base date (00:00 UTC)', () => {
    assert.equal(demoMonthCloseAt().toISOString(), `${DEMO_BASE_DATE}T00:00:00.000Z`);
  });

  for (const { label, at } of CLOCKS) {
    it(`keeps the current DEMO month provisional ${label} (${at.slice(0, 10)})`, () => {
      const dir = dirs.get(at)!;
      const trend = readJson(dir, 'processed/trends/rolling-1year.json');
      const status = new Map<string, string>(trend.points.map((p: any) => [p.month, p.status]));
      const current = DEMO_BASE_DATE.slice(0, 7);
      assert.equal(status.get(current), 'provisional', `${current} is provisional`);
      assert.equal(status.get('2026-08'), 'closed', 'the month before is closed');
      assert.equal(status.get(DEMO_GAP_MONTHS[0]), 'missing', `${DEMO_GAP_MONTHS[0]} is missing`);
      assert.ok(!fs.existsSync(path.join(dir, `processed/closes/${current}.json`)), `${current} has no close snapshot`);

      // display timestamps keep the run time
      assert.equal(trend.generated_at, at);
      assert.equal(readJson(dir, 'index.json').generated_at, at);

      // close records are dated at the DEMO base date, not at the run date
      const closed = readJson(dir, 'processed/closes/2026-08.json');
      assert.equal(closed.closed.at, demoMonthCloseAt().toISOString());
      const revised = readJson(dir, `processed/closes/${DEMO_REVISED_MONTH}.json`);
      assert.ok(revised.revisions.length > 0);
      assert.ok(revised.revisions[0].at < demoMonthCloseAt().toISOString());
    });
  }

  it('produces the same month-close records whatever the run date', () => {
    const snapshot = (dir: string) =>
      Object.fromEntries(
        fs
          .readdirSync(path.join(dir, 'processed/closes'))
          .sort()
          .map((f) => [f, readJson(dir, `processed/closes/${f}`)])
      );
    const [first, ...rest] = CLOCKS.map(({ at }) => snapshot(dirs.get(at)!));
    for (const other of rest) assert.deepEqual(other, first);
  });
});
